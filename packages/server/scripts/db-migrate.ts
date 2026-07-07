/**
 * Applies pending Drizzle migrations from ./drizzle to DATABASE_URL.
 * Journal-compatible replacement for `drizzle-kit migrate` (whose CLI spinner
 * swallows error output on Windows). Same bookkeeping table:
 * drizzle.__drizzle_migrations.
 *
 * Usage: bun run db:migrate   (from packages/server)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

config({ path: resolve(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (packages/server/.env)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('.render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function main() {
  const db = drizzle(pool);
  console.log('Applying migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: resolve(__dirname, '../drizzle') });
  console.log('Migrations applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
