import { NextRequest, NextResponse } from 'next/server'
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

  const capability = JSON.stringify({ [screenControlChannel(screenId)]: [mode] })
  const response = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(key.split(':')[0])}/requestToken`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(key).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ capability, ttl: 60 * 60 * 1000 }),
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) return NextResponse.json({ error: 'Unable to create realtime token' }, { status: 502 })
  const token = await response.json()
  return NextResponse.json({ ...token, channel: screenControlChannel(screenId) })
}
