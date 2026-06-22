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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { name, role } = body

  const validRoles = ['admin', 'staff', 'user']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (name) { fields.push(`name = $${idx++}`); values.push(name) }
    if (role) { fields.push(`role = $${idx++}`); values.push(role) }
    fields.push(`"updatedAt" = $${idx++}`)
    values.push(new Date().toISOString())
    values.push(id)

    await client.query(
      `UPDATE "user" SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    )
    return NextResponse.json({ success: true })
  } finally {
    client.release()
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Prevent self-deletion
  if (session.user.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM session WHERE "userId" = $1', [id])
    await client.query('DELETE FROM account WHERE "userId" = $1', [id])
    await client.query('DELETE FROM "user" WHERE id = $1', [id])
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
