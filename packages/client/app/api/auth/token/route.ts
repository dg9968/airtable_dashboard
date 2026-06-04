import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'

async function generateJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()

  const header = { alg: 'HS256', typ: 'JWT' }

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const message = `${encodedHeader}.${encodedPayload}`
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${message}.${encodedSignature}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const token = await generateJWT(
      {
        sub: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role ?? 'user',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
      JWT_SECRET
    )

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error generating token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
