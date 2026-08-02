import { betterAuth } from 'better-auth'
import { Pool } from 'pg'
import { hash, compare } from 'bcryptjs'

const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Only scope the session cookie to the shared parent domain when we're
// actually served from it. Setting domain='.vault1040.com' while running on
// localhost makes the browser drop the cookie outright, which would break
// sign-in in local dev. Dev needs no scoping anyway: cookies ignore port, so
// a localhost:3000 cookie already reaches the Hono server on :3001.
const ROOT_DOMAIN = '.vault1040.com'
const useCrossSubDomainCookies = new URL(appUrl).hostname.endsWith(ROOT_DOMAIN)

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  baseURL: appUrl,
  trustedOrigins: [
    appUrl,
    'https://app.vault1040.com',
    'https://api.vault1040.com',
    'http://localhost:3000',
  ],
  // The Hono API authenticates browser requests that reach it directly (see
  // packages/server/src/middleware/require-auth.ts) by reading this session
  // cookie. Scoping it to the registrable domain is what lets the cookie
  // travel from app.vault1040.com to api.vault1040.com; sameSite stays 'lax'
  // because those are the same site once they share vault1040.com. Do NOT
  // switch to sameSite:'none' — that is only needed for genuinely cross-site
  // hosts and Safari blocks those cookies.
  ...(useCrossSubDomainCookies
    ? {
        advanced: {
          crossSubDomainCookies: { enabled: true, domain: ROOT_DOMAIN },
        },
      }
    : {}),
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    // Internal Render connections don't need SSL; external ones do
    ssl: process.env.DATABASE_URL?.includes('.render.com')
      ? { rejectUnauthorized: false }
      : false,
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
