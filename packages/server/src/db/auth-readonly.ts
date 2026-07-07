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
