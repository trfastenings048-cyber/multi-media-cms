import { NextRequest, NextResponse } from 'next/server'
import * as Ably from 'ably'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { screenControlChannel } from '@/lib/realtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId } = await params
  const screen = await prisma.screen.findUnique({ where: { id: screenId }, select: { id: true } })
  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 })

  const mode = request.nextUrl.searchParams.get('mode') === 'publish' ? 'publish' : 'subscribe'
  if (mode === 'publish') {
    const denied = await requireUser()
    if (denied) return denied
  }

  const key = process.env.ABLY_API_KEY
  if (!key) return NextResponse.json({ error: 'Realtime controls are not configured' }, { status: 503 })

  try {
    const client = new Ably.Rest({ key })
    const token = await client.auth.requestToken({
      capability: { [screenControlChannel(screenId)]: [mode] },
      ttl: 60 * 60 * 1000,
    })
    return NextResponse.json({ ...token, channel: screenControlChannel(screenId) })
  } catch (error) {
    console.error('[controls token]', error)
    return NextResponse.json({ error: 'Unable to create realtime token' }, { status: 502 })
  }
}
