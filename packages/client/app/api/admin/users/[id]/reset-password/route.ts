import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Pool } from 'pg'
import { hash } from 'bcryptjs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('.render.com') ? { rejectUnauthorized: false } : false,
})

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if ((session.user as any).role !== 'admin') return null
  return session
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { password } = await request.json()

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const passwordHash = await hash(password, 12)
    const now = new Date().toISOString()
    await client.query(
      `UPDATE account SET password = $1, "updatedAt" = $2 WHERE "userId" = $3 AND "providerId" = 'credential'`,
      [passwordHash, now, id]
    )
    return NextResponse.json({ success: true })
  } finally {
    client.release()
  }
}
