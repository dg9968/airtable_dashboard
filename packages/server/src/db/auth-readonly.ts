import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

// READ-ONLY mirror of the Better Auth "user" table for joins (e.g. teams route,
// note authors). The table is created and owned by
// packages/client/scripts/run-migrations.ts — never write to it from the server
// and never move this file into src/db/schema/ (drizzle-kit would generate DDL
// for it and clobber Better Auth's tables).
// Column names are camelCase-quoted exactly as Better Auth created them.
export const authUser = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  role: text('role'),
});

// READ-ONLY mirror of the Better Auth "session" table, used by
// middleware/require-auth.ts to authenticate browser requests that reach this
// server directly (rather than through a Next.js proxy route, which sends
// X-API-Key instead). Sessions are database-backed — packages/client/lib/auth.ts
// configures no JWT/bearer plugin — so validating one is a plain lookup here.
// Same rules as authUser above: never write to it, never move this file into
// src/db/schema/.
export const authSession = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull(),
});
