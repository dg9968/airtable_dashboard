/**
 * Shared toolkit for the Airtable → Postgres ETL scripts (one script per
 * migration phase: phase1-catalogs.ts, phase2-entities.ts, ...).
 *
 * Follows the precedent of packages/client/scripts/migrate-airtable-users.ts:
 * dotenv from the package's env file, pg Pool with the Render SSL pattern,
 * Airtable rec IDs preserved as Postgres primary keys.
 *
 * Every script must be idempotent: all writes go through upsert() keyed on the
 * rec-ID primary key, so re-running is always safe. Deletions only happen via
 * an explicit reconcileDeletes() call at a table's final cutover.
 *
 * Usage from repo root:  bun run packages/server/scripts/etl/phaseN-*.ts [--dry-run]
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { inArray, notInArray, sql, getTableName, getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../../src/db/schema';

config({ path: resolve(__dirname, '../../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

export const isDryRun = process.argv.includes('--dry-run');

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export function requireEnv(): void {
  const missing = [
    !AIRTABLE_TOKEN && 'AIRTABLE_PERSONAL_ACCESS_TOKEN',
    !AIRTABLE_BASE_ID && 'AIRTABLE_BASE_ID',
    !DATABASE_URL && 'DATABASE_URL',
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Missing env vars in packages/server/.env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

let _pool: Pool | null = null;
export function getEtlDb(): NodePgDatabase<typeof schema> {
  if (!_pool) {
    _pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL!.includes('.render.com')
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return drizzle(_pool, { schema });
}

export async function closeEtlDb(): Promise<void> {
  await _pool?.end();
  _pool = null;
}

/**
 * Like fetchAll, but returns null when the table doesn't exist in the base
 * (or the token can't see it). Use for tables the app treats as optional —
 * e.g. the knowledge routes return setupRequired when their tables are missing.
 */
export async function fetchAllOptional(tableName: string): Promise<AirtableRecord[] | null> {
  try {
    return await fetchAll(tableName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') || msg.includes('NOT_FOUND')) {
      return null;
    }
    throw err;
  }
}

/** Fetch every record of an Airtable table via the REST API (handles pagination + 429s). */
export async function fetchAll(tableName: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
    );
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Airtable fetch failed for "${tableName}": ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

/**
 * Return the first non-empty value among aliased Airtable field names.
 * All knowledge of messy names (emoji keys like '📞Phone number' / '🤷‍♂️Email',
 * trailing-space 'Name ', double-space 'Company  (from Customer)') lives at the
 * call sites of this helper — nowhere else.
 */
export function pick(fields: Record<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    const v = fields[alias];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

export function pickString(fields: Record<string, unknown>, ...aliases: string[]): string | null {
  const v = pick(fields, ...aliases);
  if (v === null) return null;
  // Airtable lookups often arrive as single-element arrays.
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : null;
  return String(v);
}

export function pickNumber(fields: Record<string, unknown>, ...aliases: string[]): number | null {
  const v = pick(fields, ...aliases);
  if (v === null) return null;
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : null;
}

export function pickBoolean(fields: Record<string, unknown>, ...aliases: string[]): boolean {
  return Boolean(pick(fields, ...aliases));
}

/** Airtable link field (array of rec IDs) → single FK id (first entry) or null. */
export function linkOne(fields: Record<string, unknown>, name: string): string | null {
  const v = fields[name];
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : null;
}

/** Airtable link field → array of FK ids. */
export function linkMany(fields: Record<string, unknown>, name: string): string[] {
  const v = fields[name];
  return Array.isArray(v) ? v.map(String) : [];
}

export interface EtlStats {
  table: string;
  fetched: number;
  upserted: number;
  orphanLinks: Array<{ recordId: string; field: string; missingTarget: string }>;
  warnings: string[];
}

export function newStats(table: string): EtlStats {
  return { table, fetched: 0, upserted: 0, orphanLinks: [], warnings: [] };
}

/**
 * Validate a link against the set of known target IDs. Returns the id when it
 * resolves, otherwise records an orphan and returns null (never fails the batch —
 * the orphan report is reviewed before cutover).
 */
export function resolveLink(
  id: string | null,
  validIds: Set<string>,
  stats: EtlStats,
  recordId: string,
  field: string
): string | null {
  if (id === null) return null;
  if (validIds.has(id)) return id;
  stats.orphanLinks.push({ recordId, field, missingTarget: id });
  return null;
}

/** Batched idempotent upsert keyed on the rec-ID primary key. */
export async function upsert<T extends PgTable & { id: any }>(
  db: NodePgDatabase<typeof schema>,
  table: T,
  rows: Record<string, unknown>[],
  stats: EtlStats,
  batchSize = 200
): Promise<void> {
  if (rows.length === 0) return;
  if (isDryRun) {
    console.log(`  [dry-run] would upsert ${rows.length} rows into ${getTableName(table)}`);
    stats.upserted = rows.length;
    return;
  }

  // Update every column present in the row objects, using the real DB column
  // names from Drizzle's table metadata.
  const tableColumns = getTableColumns(table);
  const set = Object.fromEntries(
    Object.keys(rows[0])
      .filter((key) => key !== 'id' && key in tableColumns)
      .map((key) => [key, sql.raw(`excluded."${(tableColumns as any)[key].name}"`)])
  );

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db
      .insert(table)
      .values(batch as any)
      .onConflictDoUpdate({ target: (table as any).id, set });
    stats.upserted += batch.length;
  }
}

/**
 * Delete rows whose IDs are no longer present in Airtable. Run ONLY at a
 * table's final cutover, after the row-count sanity check passes.
 */
export async function reconcileDeletes<T extends PgTable & { id: any }>(
  db: NodePgDatabase<typeof schema>,
  table: T,
  liveIds: string[]
): Promise<number> {
  if (isDryRun) {
    console.log(`  [dry-run] would reconcile deletes on ${getTableName(table)}`);
    return 0;
  }
  const deleted = await db
    .delete(table)
    .where(notInArray((table as any).id, liveIds))
    .returning({ id: (table as any).id });
  return deleted.length;
}

/** Count how many of the given IDs exist in a Postgres table (post-run validation). */
export async function countExisting<T extends PgTable & { id: any }>(
  db: NodePgDatabase<typeof schema>,
  table: T,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .select({ id: (table as any).id })
    .from(table as any)
    .where(inArray((table as any).id, ids));
  return rows.length;
}

export function report(stats: EtlStats[]): void {
  console.log('\n========== ETL REPORT ==========');
  for (const s of stats) {
    console.log(`\n${s.table}`);
    console.log(`  fetched from Airtable : ${s.fetched}`);
    console.log(`  upserted to Postgres  : ${s.upserted}${isDryRun ? ' (dry-run)' : ''}`);
    if (s.orphanLinks.length > 0) {
      console.log(`  ⚠️  orphan links (${s.orphanLinks.length}) — link target missing, stored NULL:`);
      for (const o of s.orphanLinks.slice(0, 20)) {
        console.log(`     ${o.recordId} .${o.field} → ${o.missingTarget}`);
      }
      if (s.orphanLinks.length > 20) console.log(`     ... and ${s.orphanLinks.length - 20} more`);
    }
    for (const w of s.warnings) console.log(`  ⚠️  ${w}`);
  }
  console.log('\n================================\n');
}
