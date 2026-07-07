import { text, timestamp } from 'drizzle-orm/pg-core';

// All business tables use text PKs: rows migrated from Airtable keep their
// "rec..." IDs verbatim (they live in client URLs, UI state, and link arrays);
// new rows get UUIDs. Same pattern as the already-migrated Better Auth user table.
export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// Populated from Airtable's createdTime during ETL; defaults to now() for new rows.
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
