'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  HardDrive,
  ImageIcon,
  Monitor,
  Upload,
  Video,
  ExternalLink,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatBytes, formatDate } from '@/components/main-screen/shared'
import { Skeleton } from '@/components/ui/skeleton'

type DocumentItem = {
  id: string
  name: string
  mimeType: string
  size: number
  status: string
  createdAt: string
  cloudinaryUrl?: string
  s3Url?: string
}

type SessionItem = {
  id: string
  status: string
  createdAt: string
  _count?: { documents: number }
}

type ScreenItem = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string | number
  helper: string
  icon: React.ElementType
}) {
  return (
    <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 p-4 rounded-2xl flex flex-col gap-2.5 shadow-lg min-h-30">
      <div className="flex items-center justify-between text-zinc-400">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
      </div>
      <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none">{value}</h3>
      <p className="text-[10px] text-zinc-400 leading-relaxed">{helper}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [screens, setScreens] = useState<ScreenItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/documents').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/sessions').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/screens').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([docs, sessionData, screenData]) => {
        if (cancelled) return
        setDocuments(Array.isArray(docs) ? docs : [])
        setSessions(Array.isArray(sessionData) ? sessionData : [])
        setScreens(Array.isArray(screenData) ? screenData : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0)
    const completed = documents.filter((doc) => doc.status === 'UPLOADED' || doc.status === 'COMPLETED').length
    const failed = documents.filter((doc) => doc.status === 'FAILED').length
    const processing = documents.filter((doc) => doc.status === 'UPLOADING' || doc.status === 'PROCESSING').length
    const recent = documents.filter((doc) => Date.now() - new Date(doc.createdAt).getTime() <= 24 * 60 * 60 * 1000).length
    const images = documents.filter((doc) => doc.mimeType.startsWith('image/')).length
    const videos = documents.filter((doc) => doc.mimeType.startsWith('video/')).length
    const pdfs = documents.filter((doc) => doc.mimeType === 'application/pdf').length

    return { totalSize, completed, failed, processing, recent, images, videos, pdfs }
  }, [documents])

  const latestSessions = sessions.slice(0, 5)
  const latestDocuments = documents.slice(0, 5)

  // Background: white at the top, light sea blue in the middle, dark blue at the bottom.
  return (
    <div className="min-h-dvh bg-[linear-gradient(to_top,#0a1f5c_0%,#1d4ed8_22%,#5cc8e0_52%,#d6f4fa_78%,#ffffff_100%)] dark:bg-[linear-gradient(to_top,#020617_0%,#0f172a_50%,#1e293b_100%)] px-3 py-5 sm:px-6 sm:py-8 lg:px-8 3xl:px-12 flex flex-col gap-5 sm:gap-8">
      <header className="flex flex-col gap-2 border-b border-sky-100 dark:border-zinc-800/50 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Overview of sessions, uploaded documents, and registered screens.</p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-5 max-md:[&>*:last-child]:col-span-2 md:max-xl:[&>*:last-child]:col-span-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-32 rounded-2xl bg-white/50 backdrop-blur-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:[&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-40 rounded-2xl bg-white/50 backdrop-blur-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {Array.from({ length: 2 }).map((_, idx) => (
              <Skeleton key={idx} className="h-64 rounded-2xl bg-white/50 backdrop-blur-md" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl bg-white/50 backdrop-blur-md" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-5 max-md:[&>*:last-child]:col-span-2 md:max-xl:[&>*:last-child]:col-span-1">
            <StatCard label="Total Documents" value={documents.length} helper="Total uploaded files cataloged" icon={FileText} />
            <StatCard label="Storage Used" value={formatBytes(stats.totalSize)} helper="Cloud media currently tracked" icon={HardDrive} />
            <StatCard label="All Sessions" value={sessions.length} helper={`${latestSessions.length} recent sessions visible below`} icon={Clock} />
            <StatCard label="Screens" value={screens.length} helper="Registered display endpoints" icon={Monitor} />
            <StatCard label="Recent (24h)" value={stats.recent} helper="Files added in the last 24 hours" icon={Upload} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:[&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1">
            <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Process Status</h2>
                <CheckCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-xl font-extrabold text-emerald-700">{stats.completed}</p>
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Finalized</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xl font-extrabold text-blue-700">{stats.processing}</p>
                  <p className="text-[10px] font-bold uppercase text-blue-600">Processing</p>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                  <p className="text-xl font-extrabold text-rose-700">{stats.failed}</p>
                  <p className="text-[10px] font-bold uppercase text-rose-600">Failed</p>
                </div>
              </div>
            </div>

            <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Formats Split</h2>
                <ImageIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-lg font-extrabold text-zinc-900">{stats.pdfs}</p>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">PDF</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-lg font-extrabold text-blue-700">{stats.images}</p>
                  <p className="text-[10px] font-bold uppercase text-blue-500">IMG</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="text-lg font-extrabold text-purple-700">{stats.videos}</p>
                  <p className="text-[10px] font-bold uppercase text-purple-500">VID</p>
                </div>
              </div>
            </div>

            <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Quick Actions</h2>
                <AlertCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/" className="rounded-lg bg-black dark:bg-zinc-100 px-3 py-2.5 sm:py-2 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                  Manage Documents
                </Link>
                <Link href="/main-screen" className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  Main Screen
                </Link>
                <Link href="/screens" className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  Screens
                </Link>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">All Sessions</h2>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {latestSessions.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-400">No sessions yet.</p>
                ) : latestSessions.map((session) => (
                  <div key={session.id} className="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{session.id}</p>
                      <p className="text-xs text-zinc-400">{formatDate(session.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{session._count?.documents ?? 0} files</p>
                      <p className="text-[10px] uppercase text-zinc-400">{session.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Latest Documents</h2>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {latestDocuments.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-400">No documents yet.</p>
                ) : latestDocuments.map((doc) => (
                  <div key={doc.id} className="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center">
                        {doc.mimeType.startsWith('video/') ? <Video className="size-4 text-purple-500 dark:text-purple-400" /> : <FileText className="size-4 text-zinc-500 dark:text-zinc-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{doc.name}</p>
                        <p className="text-xs text-zinc-400">{formatBytes(doc.size)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold uppercase text-zinc-400">{doc.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border border-white/70 dark:border-zinc-800 shadow-blue-950/10 dark:shadow-black/40 rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">All Screen Cards</h2>
              <Monitor className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            </div>
            {screens.length === 0 ? (
              <p className="text-sm text-zinc-400">No screens registered.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-6 gap-4">
                {screens.map((screen) => (
                  <div key={screen.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 relative group">
                    <div className="flex items-start justify-between">
                      <div className="size-10 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
                        <Monitor className="size-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/view/screen/${screen.id}`
                            navigator.clipboard.writeText(url)
                            toast.success('Screen URL copied')
                          }}
                          className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-200/50 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 rounded-md transition-colors cursor-pointer"
                          title="Copy URL"
                        >
                          <Copy className="size-4" />
                        </button>
                        <Link
                          href={`/view/screen/${screen.id}`}
                          target="_blank"
                          className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-200/50 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 rounded-md transition-colors cursor-pointer"
                          title="Open Screen"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{screen.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">Created {formatDate(screen.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
