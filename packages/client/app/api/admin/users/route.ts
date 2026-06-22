import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Pool } from 'pg'

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

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, name, email, role, "emailVerified", "createdAt", "updatedAt"
       FROM "user"
       ORDER BY "createdAt" DESC`
    )
    return NextResponse.json({ users: result.rows })
  } finally {
    client.release()
  }
}
