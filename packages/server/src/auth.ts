// lib/auth.ts - Secure Airtable-based authentication
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import Airtable from 'airtable'

// Initialize Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
})
const base = airtable.base(process.env.AIRTABLE_BASE_ID || '')

// Users table name - adjust this to match your Airtable base
const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users'

interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  role: string
  isActive: boolean
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password')
        }

        try {
          const user = await getUserByEmail(credentials.email)
          
          if (!user) {
            throw new Error('Invalid credentials')
          }

          if (!user.isActive) {
            throw new Error('Account is deactivated. Contact administrator.')
          }

          // Compare hashed password
          const isValidPassword = await compare(credentials.password, user.passwordHash)
          
          if (!isValidPassword) {
            throw new Error('Invalid credentials')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        } catch (error) {
          console.error('Authentication error:', error)
          throw new Error('Authentication failed')
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

  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)

// Secure function to get user from Airtable
async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const records = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage()

    if (records.length === 0) {
      return null
    }

    const record = records[0]
    const fields = record.fields

    return {
      id: record.id,
      email: fields.Email as string,
      name: fields.Name as string,
      passwordHash: fields.PasswordHash as string,
      role: fields.Role as string || 'user',
      isActive: fields.IsActive !== false // Default to true if not specified
    }
  } catch (error) {
    console.error('Error fetching user from Airtable:', error)
    return null
  }
}

// Utility function to create a new user (for admin use)
export async function createUser(email: string, name: string, password: string, role: string = 'user') {
  try {
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)

    const record = await base(USERS_TABLE).create([
      {
        fields: {
          Email: email,
          Name: name,
          PasswordHash: passwordHash,
          Role: role,
          IsActive: true
        }
      }
    ])

    return { success: true, userId: record[0].id }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}