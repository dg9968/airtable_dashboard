/**
 * Creates Better Auth tables directly in PostgreSQL — bypasses the CLI
 * which fails on Windows without Visual Studio (better-sqlite3 native build).
 *
 * Usage: bun run packages/client/scripts/run-migrations.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env.local') })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const migrations = `
CREATE TABLE IF NOT EXISTS "user" (
  "id"            TEXT        PRIMARY KEY,
  "name"          TEXT        NOT NULL,
  "email"         TEXT        NOT NULL UNIQUE,
  "emailVerified" BOOLEAN     NOT NULL DEFAULT FALSE,
  "image"         TEXT,
  "createdAt"     TIMESTAMP   NOT NULL,
  "updatedAt"     TIMESTAMP   NOT NULL,
  "role"          TEXT        DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"          TEXT        PRIMARY KEY,
  "expiresAt"   TIMESTAMP   NOT NULL,
  "token"       TEXT        NOT NULL UNIQUE,
  "createdAt"   TIMESTAMP   NOT NULL,
  "updatedAt"   TIMESTAMP   NOT NULL,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "userId"      TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                      TEXT        PRIMARY KEY,
  "accountId"               TEXT        NOT NULL,
  "providerId"              TEXT        NOT NULL,
  "userId"                  TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"             TEXT,
  "refreshToken"            TEXT,
  "idToken"                 TEXT,
  "accessTokenExpiresAt"    TIMESTAMP,
  "refreshTokenExpiresAt"   TIMESTAMP,
  "scope"                   TEXT,
  "password"                TEXT,
  "createdAt"               TIMESTAMP   NOT NULL,
  "updatedAt"               TIMESTAMP   NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"          TEXT        PRIMARY KEY,
  "identifier"  TEXT        NOT NULL,
  "value"       TEXT        NOT NULL,
  "expiresAt"   TIMESTAMP   NOT NULL,
  "createdAt"   TIMESTAMP,
  "updatedAt"   TIMESTAMP
);
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running Better Auth migrations...')
    await client.query(migrations)
    console.log('Done. Tables created: user, session, account, verification')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
