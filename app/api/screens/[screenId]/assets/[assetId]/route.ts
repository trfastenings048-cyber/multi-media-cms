import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { publishScreenChanged } from '@/lib/realtime'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ screenId: string; assetId: string }> }
) {
  const denied = await requireUser()
  if (denied) return denied

  try {
    const { screenId, assetId } = await params
    await prisma.screenAsset.deleteMany({
      where: {
        id: assetId,
        screenId,
      },
    })

    await publishScreenChanged(screenId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[screen assets DELETE]', error)
    return NextResponse.json({ error: 'Failed to remove screen asset' }, { status: 500 })
  }
}
