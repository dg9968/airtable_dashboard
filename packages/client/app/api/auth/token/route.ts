import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'

// Helper function to generate JWT compatible with Hono server
async function generateJWT(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder()

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const message = `${encodedHeader}.${encodedPayload}`
  const messageBytes = encoder.encode(message)
  const secretBytes = encoder.encode(secret)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes)

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${message}.${encodedSignature}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Generate JWT token compatible with Hono server
    const token = await generateJWT(
      {
        sub: (session.user as any).id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      },
      JWT_SECRET
    )

    return NextResponse.json({ token })

  } catch (error) {
    console.error('Error generating token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
