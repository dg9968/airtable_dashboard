import { defineConfig } from 'drizzle-kit';

// IMPORTANT: only journal-based migrations are supported here.
// Use `bun run db:generate` + `bun run db:migrate`. NEVER run `drizzle-kit push` —
// the database also holds the Better Auth tables (user, session, account, verification)
// owned by packages/client/scripts/run-migrations.ts, and push would try to drop them.
// The read-only `user` definition lives in src/db/auth-readonly.ts, deliberately
// OUTSIDE the schema folder below so drizzle-kit never generates DDL for it.
// Render Postgres requires SSL but its cert chain fails Node verification, so
// use sslmode=no-verify in the URL — drizzle-kit (studio/migrate) ignores a
// separate `ssl` credentials object.
const url = process.env.DATABASE_URL ?? '';
const sslUrl =
  url.includes('.render.com') && !url.includes('sslmode=')
    ? `${url}${url.includes('?') ? '&' : '?'}sslmode=no-verify`
    : url;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle',
  dbCredentials: {
    url: sslUrl,
  },
});
