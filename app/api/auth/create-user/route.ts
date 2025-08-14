// app/api/auth/create-user/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, password, role = 'user' } = body

    // Validate required fields
    if (!email || !name || !password) {
      return NextResponse.json({ 
        error: 'Email, name, and password are required' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ 
        error: 'Password must be at least 8 characters long' 
      }, { status: 400 })
    }

    // Validate role
    const validRoles = ['admin', 'user', 'staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be admin, user, or staff' 
      }, { status: 400 })
    }

    // Create user
    const result = await createUser(email, name, password, role)

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'User created successfully',
        userId: result.userId
      })
    } else {
      return NextResponse.json({ 
        error: result.error || 'Failed to create user' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}