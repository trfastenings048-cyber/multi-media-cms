import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  let uploadedFiles: Array<{ name: string; size: number; mimeType: string; url: string; publicId: string }> = []
  
  try {
    const data = await request.json()
    uploadedFiles = data.files || []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON data' }, { status: 400 })
  }

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const session = await prisma.session.create({
    data: { status: 'UPLOADING' },
  })

  try {
    for (const file of uploadedFiles) {
      await prisma.document.create({
        data: {
          sessionId: session.id,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType || 'application/octet-stream',
          cloudinaryUrl: file.url,
          cloudinaryPublicId: file.publicId,
          status: 'UPLOADED',
        },
      })
    }

    const result = await prisma.session.update({
      where: { id: session.id },
      data: { status: 'COMPLETED' },
      include: { documents: true },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    await prisma.session
      .update({ where: { id: session.id }, data: { status: 'FAILED' } })
      .catch(() => {})

    console.error('[upload finalize]', error)
    return NextResponse.json({ error: 'Failed to save documents' }, { status: 500 })
  }
}
