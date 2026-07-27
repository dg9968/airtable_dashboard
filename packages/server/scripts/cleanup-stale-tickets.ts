/**
 * Deletes open `corporate_pipeline_tickets` rows for a given service
 * older than a given age (default 10 days), for the case where a batch of
 * tickets is being manually replaced by a fresh batch and the stale ones
 * would otherwise sit open forever.
 *
 * If --service isn't passed, prompts interactively with a numbered list of
 * every service that currently has at least one corporate pipeline ticket,
 * so the caller doesn't need to know exact service-name spelling/casing.
 *
 * "Open" matches the same definition used by
 * packages/server/src/routes/open-tickets-dashboard.ts: status is NULL or
 * not the corporate terminal status ('Complete Service'). Age is measured
 * from createdAt.
 *
 * `corporate_pipeline_notes.subscription_corporate_id` has ON DELETE SET
 * NULL (see packages/server/src/db/schema/subscriptions.ts), so deleting a
 * ticket never fails or cascades — any notes on it just lose their link.
 * `billing_records.subscription_corporate_id` has no FK at all. Nothing
 * else references a corporate_pipeline_tickets row, so a plain DELETE is
 * safe.
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - With --apply, requires typing "yes" at a single confirmation prompt
 *   before anything is deleted.
 * - Each row is deleted in its own transaction.
 *
 * Usage:
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts                       # prompts for service, >10 days, report only
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --apply
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll" --days=10 --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, lt, ne, or } from 'drizzle-orm';
import * as readline from 'node:readline/promises';
import * as schema from '../src/db/schema';

config({ path: resolve(__dirname, '../.env') });

const CORPORATE_TERMINAL_STATUS = 'Complete Service';

const isApply = process.argv.includes('--apply');
const serviceArg = process.argv.find((a) => a.startsWith('--service='));
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Number(daysArg.slice('--days='.length)) : 10;

if (!Number.isFinite(days) || days < 0) {
  console.error(`Invalid --days value: ${daysArg}`);
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (packages/server/.env)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('.render.com') ? { rejectUnauthorized: false } : false,
});
const db = drizzle(pool, { schema });

const { corporatePipelineTickets, servicesCorporate, corporations } = schema;

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === 'yes';
}

// Only lists services that currently have at least one corporate pipeline
// ticket, so the list stays short and relevant instead of the full catalog.
async function promptForService(): Promise<string> {
  const rows = await db
    .selectDistinct({ name: servicesCorporate.name })
    .from(servicesCorporate)
    .innerJoin(corporatePipelineTickets, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
    .orderBy(servicesCorporate.name);

  if (rows.length === 0) {
    console.error('No corporate services with pipeline tickets found.');
    process.exit(1);
  }

  console.log('\nServices with corporate pipeline tickets:\n');
  rows.forEach((row, i) => console.log(`  ${i + 1}. ${row.name}`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nSelect a service (number): ')).trim();
  rl.close();

  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
    console.error(`Invalid selection: "${answer}"`);
    process.exit(1);
  }
  return rows[index].name;
}

async function main() {
  const serviceName = serviceArg ? serviceArg.slice('--service='.length) : await promptForService();
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const rows = await db
    .select({
      id: corporatePipelineTickets.id,
      status: corporatePipelineTickets.status,
      createdAt: corporatePipelineTickets.createdAt,
      company: corporations.company,
    })
    .from(corporatePipelineTickets)
    .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
    .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
    .where(
      and(
        eq(servicesCorporate.name, serviceName),
        or(
          isNull(corporatePipelineTickets.status),
          ne(corporatePipelineTickets.status, CORPORATE_TERMINAL_STATUS)
        ),
        lt(corporatePipelineTickets.createdAt, cutoff)
      )
    )
    .orderBy(corporatePipelineTickets.createdAt);

  console.log(`\nService: "${serviceName}"  |  older than ${days} day(s)  |  cutoff: ${cutoff.toISOString()}\n`);
  console.log(`Found ${rows.length} open ticket(s) to delete:\n`);

  for (const row of rows) {
    const ageDays = Math.floor((Date.now() - row.createdAt!.getTime()) / 86_400_000);
    console.log(
      `  ${row.id}  company="${row.company ?? '(none)'}"  status=${row.status ?? '(null)'}  created=${row.createdAt?.toISOString()}  age=${ageDays}d`
    );
  }

  if (rows.length === 0) {
    console.log('\nNothing to do.\n');
    await pool.end();
    return;
  }

  if (!isApply) {
    console.log('\n[dry-run] no changes written. Re-run with --apply to delete these rows.\n');
    await pool.end();
    return;
  }

  const ok = await confirm(`\nType "yes" to permanently delete these ${rows.length} ticket(s): `);
  if (!ok) {
    console.log('Aborted, nothing deleted.\n');
    await pool.end();
    return;
  }

  let deleted = 0;
  for (const row of rows) {
    await db.transaction(async (tx) => {
      await tx.delete(corporatePipelineTickets).where(eq(corporatePipelineTickets.id, row.id));
    });
    console.log(`  deleted ${row.id}`);
    deleted++;
  }

  console.log(`\nDeleted ${deleted} ticket(s).\n`);
  await pool.end();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
