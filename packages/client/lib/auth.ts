import { betterAuth } from 'better-auth'
import { Pool } from 'pg'
import { hash, compare } from 'bcryptjs'

const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  baseURL: appUrl,
  trustedOrigins: [appUrl, 'https://app.vault1040.com', 'http://localhost:3000'],
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => hash(password, 12),
      verify: ({ hash: h, password }) => compare(password, h),
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
    },
  },
})
