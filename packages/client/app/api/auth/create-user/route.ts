import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Pool } from 'pg'
import { hash } from 'bcryptjs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, password, role = 'user' } = body

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    const validRoles = ['admin', 'user', 'staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin, user, or staff' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const existing = await client.query('SELECT id FROM "user" WHERE email = $1', [email.toLowerCase()])
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
      }

      const id = crypto.randomUUID()
      const passwordHash = await hash(password, 12)
      const now = new Date().toISOString()

      await client.query('BEGIN')
      await client.query(
        `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, name, email.toLowerCase(), true, role, now, now]
      )
      await client.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [`${id}_credential`, email.toLowerCase(), 'credential', id, passwordHash, now, now]
      )
      await client.query('COMMIT')

      return NextResponse.json({ success: true, message: 'User created successfully', userId: id })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
