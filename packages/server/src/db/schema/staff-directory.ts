import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { authUser } from '../auth-readonly';

// Extra contact details for a Better Auth user (extension, cell phone, title,
// direct line). Not every user has a row here — the team-directory route
// LEFT JOINs from `user` so every account appears even before any details are
// filled in. PK is the user's own id (1:1 attribute extension), not the
// generic id() helper used by independent-entity tables elsewhere.
export const staffDirectory = pgTable('staff_directory', {
  userId: text('user_id')
    .primaryKey()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  extension: text('extension'),
  cellPhone: text('cell_phone'),
  title: text('title'),
  directLine: text('direct_line'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
