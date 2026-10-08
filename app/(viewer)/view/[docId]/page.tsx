import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CloseButton from './CloseButton'
import UniversalMediaViewer from '@/components/UniversalMediaViewer'

async function fetchDoc(id: string) {
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, mimeType: true, cloudinaryUrl: true, websiteUrl: true },
  })
  if (!doc) return null
  return { id: doc.id, name: doc.name, mimeType: doc.mimeType, s3Url: doc.cloudinaryUrl || doc.websiteUrl || '' }
}

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ docId: string }>
}) {
  const { docId } = await params
  const doc = await fetchDoc(docId)
  if (!doc) notFound()

  return (
    <div className="h-dvh flex flex-col bg-black">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3 bg-black/80 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 shrink-0 rounded-full bg-green-400" />
          <span className="text-sm text-white/80 font-medium truncate">
            {doc.name}
          </span>
          <span className="hidden sm:inline text-xs text-white/30 font-mono shrink-0">{doc.mimeType}</span>
        </div>
        <CloseButton />
      </div>

      <div className="flex-1 relative overflow-hidden">
        <UniversalMediaViewer doc={doc} />
      </div>
    </div>
  )
}
