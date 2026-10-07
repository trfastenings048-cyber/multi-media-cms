import { NextRequest, NextResponse } from 'next/server'
import { screenChannel } from '@/lib/realtime'

// Tells a desktop player which realtime channel to listen on. ABLY_SUBSCRIBE_KEY must be an
// Ably key restricted to "subscribe" on "screen-*" channels, so it cannot publish.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId } = await params
  const key = process.env.ABLY_SUBSCRIBE_KEY
  if (!key) return NextResponse.json({ key: null, channel: null })
  return NextResponse.json({ key, channel: screenChannel(screenId) })
}
