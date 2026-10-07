import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const screens = await prisma.screen.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        assets: {
          orderBy: { position: 'asc' },
          include: { document: true },
        },
      },
    })
    return NextResponse.json(screens)
  } catch (error) {
    console.error('[screens GET]', error)
    return NextResponse.json({ error: 'Failed to fetch screens' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireUser()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    const { name } = body as { name?: string }

    // Count screens to generate a default name if not provided
    const count = await prisma.screen.count()
    const screenName = name || `Screen ${String(count + 1).padStart(2, '0')}`

    const screen = await prisma.screen.create({
      data: {
        name: screenName,
      },
    })

    return NextResponse.json(screen, { status: 201 })
  } catch (error) {
    console.error('[screens POST]', error)
    return NextResponse.json({ error: 'Failed to create screen' }, { status: 500 })
  }
}
