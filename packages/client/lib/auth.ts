import { betterAuth } from 'better-auth'
import { Pool } from 'pg'
import { hash, compare } from 'bcryptjs'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
