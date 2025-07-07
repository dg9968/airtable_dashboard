// lib/auth.ts - NextAuth configuration
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { compare } from 'bcryptjs'

export const authOptions = {
  providers: [
    // Email/Password login
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Replace with your user lookup logic
        const user = await getUserByEmail(credentials.email)
        
        if (!user || !await compare(credentials.password, user.hashedPassword)) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role // 'admin', 'user', 'staff', etc.
        }
      }
    }),
    
    // Google OAuth (optional)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  
  session: {
    strategy: 'jwt' as const,
  },
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
      }
      return session
    }
  },
  
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  }
}

export default NextAuth(authOptions)

// Dummy user lookup function - replace with your database logic
async function getUserByEmail(email: string) {
  // This would typically query your database
  // Example: return await prisma.user.findUnique({ where: { email } })
  return null
}
