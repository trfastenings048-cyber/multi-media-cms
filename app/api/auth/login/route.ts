import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ALLOWED_USERS, createSession, hashPassword, isValidEmail, normalizeEmail, toPublicUser, verifyPassword } from '@/lib/auth'

// Compared against when the email is unknown, so both cases take about the same time.
const dummyHash = hashPassword('not-a-real-password')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { email?: unknown; password?: unknown; remember?: unknown }
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    // 1. Check configured preset accounts (from proxy.ts)
    const presetUser = ALLOWED_USERS.find(
      (u) => normalizeEmail(u.email) === email && u.password === password
    )

    if (presetUser) {
      // Try to find/upsert user in DB, safely catching DB connection errors
      let userId = `usr_${presetUser.email.replace(/[^a-z0-9]/gi, '_')}`
      try {
        const passwordHash = await hashPassword(presetUser.password)
        const dbUser = await prisma.user.upsert({
          where: { email: presetUser.email },
          update: { lastLoginAt: new Date() },
          create: {
            name: presetUser.name,
            email: presetUser.email,
            passwordHash,
            lastLoginAt: new Date(),
          },
        })
        userId = dbUser.id
      } catch (dbErr) {
        console.warn('[auth login POST] Database upsert skipped:', dbErr)
      }

      await createSession(userId, request, body.remember === true)

      return NextResponse.json({
        user: {
          id: userId,
          name: presetUser.name,
          email: presetUser.email,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
      })
    }

    // 2. Fallback to database user authentication
    try {
      const user = await prisma.user.findUnique({ where: { email } })
      const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash)

      if (user && valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {})

        await createSession(user.id, request, body.remember === true)

        return NextResponse.json({ user: toPublicUser(user) })
      }
    } catch (dbErr) {
      console.warn('[auth login POST] DB lookup failed:', dbErr)
    }

    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  } catch (error) {
    console.error('[auth login POST]', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
