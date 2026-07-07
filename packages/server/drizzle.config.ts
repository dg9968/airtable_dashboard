import { defineConfig } from 'drizzle-kit';

// IMPORTANT: only journal-based migrations are supported here.
// Use `bun run db:generate` + `bun run db:migrate`. NEVER run `drizzle-kit push` —
// the database also holds the Better Auth tables (user, session, account, verification)
// owned by packages/client/scripts/run-migrations.ts, and push would try to drop them.
// The read-only `user` definition lives in src/db/auth-readonly.ts, deliberately
// OUTSIDE the schema folder below so drizzle-kit never generates DDL for it.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('.render.com')
      ? { rejectUnauthorized: false }
      : false,
  },
});
