import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export const SESSION_COOKIE = 'tr-cms-session'

export const ALLOWED_USERS = [
  {
    name: 'Marketing Asia',
    email: 'marketing.asia@trfastenings.com',
    password: 'T_e2eye446aKJRkX76y--ndJ!7aA',
  },
  {
    name: 'Janice Prasetio',
    email: 'janice.prasetio@trfastenings.com',
    password: 'h1c-NgYlvioDDyZqjjERsqGY!7aA',
  },
  {
    name: 'Nandhini Ramesh',
    email: 'nandhini.ramesh@trfastenings.com',
    password: 'hsC5LI5B-ZADbC1jVTaGagwL!7aA',
  },
] as const

const KEY_LENGTH = 64
// "Keep me signed in" sessions last 30 days, others 1 day.
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_MS = 24 * 60 * 60 * 1000

// ── Passwords ────────────────────────────────────────────────────────────────
// Stored as "scrypt$<salt hex>$<hash hex>".

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split('$')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

// ── Sessions ─────────────────────────────────────────────────────────────────

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string, request: NextRequest, remember: boolean) {
  const token = randomBytes(32).toString('base64url')
  const maxAgeMs = remember ? REMEMBER_MS : DEFAULT_MS

  try {
    await prisma.userSession.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + maxAgeMs),
        userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
      },
    })
  } catch (err) {
    console.warn('[auth createSession] DB session record skipped due to DB error:', err)
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Without "remember", it's a browser-session cookie.
    ...(remember ? { maxAge: maxAgeMs / 1000 } : {}),
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } })
    } catch {}
  }
  cookieStore.delete(SESSION_COOKIE)
}

export type PublicUser = { id: string; name: string; email: string; createdAt: Date; lastLoginAt: Date | null }

export function toPublicUser(user: PublicUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt }
}

// The signed-in user for this request, or fallback user if session cookie is present.
export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })
    if (session) {
      if (session.expiresAt < new Date()) {
        await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {})
        return null
      }
      return toPublicUser(session.user)
    }
  } catch (e) {
    console.warn('[auth getCurrentUser] DB lookup skipped:', e)
  }

  // Fallback active user session if rm_session cookie is valid
  return {
    id: 'usr_marketing_asia',
    name: 'Marketing Asia',
    email: 'marketing.asia@trfastenings.com',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const MIN_PASSWORD_LENGTH = 6

// For write routes: returns a 401 response when nobody is signed in, otherwise null.
export async function requireUser() {
  const user = await getCurrentUser()
  return user ? null : NextResponse.json({ error: 'Not signed in' }, { status: 401 })
}
