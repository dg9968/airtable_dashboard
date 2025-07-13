// lib/auth.ts - Debug version with better logging
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

// Mock users for development - using plaintext passwords for testing
const mockUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'password123', // Temporary plaintext for testing
    role: 'admin'
  },
  {
    id: '2',
    email: 'user@example.com',
    name: 'Regular User',
    password: 'password123',
    role: 'user'
  },
  {
    id: '3',
    email: 'staff@example.com',
    name: 'Staff User',
    password: 'password123',
    role: 'staff'
  }
]

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('Auth attempt:', credentials?.email) // Debug log
        
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials')
          throw new Error('Please enter email and password')
        }

        const user = await getUserByEmail(credentials.email)
        console.log('User found:', user ? 'Yes' : 'No') // Debug log
        
        if (!user) {
          console.log('No user found for email:', credentials.email)
          throw new Error('No user found with this email')
        }

        // For testing, use simple password comparison
        const isValidPassword = credentials.password === user.password
        console.log('Password valid:', isValidPassword) // Debug log
        
        if (!isValidPassword) {
          console.log('Invalid password for user:', credentials.email)
          throw new Error('Invalid password')
        }

        console.log('Login successful for:', credentials.email) // Debug log
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  
  session: {
    strategy: 'jwt' as const,
  },
  
  callbacks: {
    async jwt({ token, user }: any) {
  if (user) {
    token.role = user.role
    }
  return token
    },

async session({ session, token }: any) {
  if (token && session.user) {
    session.user.id = token.sub!
    session.user.role = token.role as string
  }
  return session
}
  },
  
  pages: {
    signIn: '/auth/signin',
  },

  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-for-development',
}

export default NextAuth(authOptions)

async function getUserByEmail(email: string) {
  const user = mockUsers.find(user => user.email.toLowerCase() === email.toLowerCase())
  console.log('Looking for email:', email, 'Found:', user ? 'Yes' : 'No')
  return user || null
}