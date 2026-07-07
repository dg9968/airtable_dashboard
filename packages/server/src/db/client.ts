import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Lazy-init singleton so importing this module doesn't crash when DATABASE_URL
// is unset (mirrors validateEnvironment() in lib/airtable-service.ts).
let _db: NodePgDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _pool = new Pool({
      connectionString,
      ssl: connectionString.includes('.render.com')
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}
