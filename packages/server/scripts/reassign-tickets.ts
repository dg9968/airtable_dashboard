/**
 * Reassigns the Processor on specific `corporate_pipeline_tickets` rows —
 * e.g. filling in a freshly-recreated batch of tickets, or moving a handful
 * of a processor's open tickets to someone else.
 *
 * Writes `processor_id` directly via Drizzle, bypassing
 * `PATCH /api/subscriptions-corporate/:id` entirely — that route is the only
 * place notify-processor-assigned.ts is wired in, so a direct DB write like
 * this one never emails anyone. Use this instead of the UI/API whenever you
 * want a silent reassignment (see packages/server/src/routes/
 * subscriptions-corporate.ts and packages/server/src/lib/
 * notify-processor-assigned.ts for the notification path this bypasses).
 *
 * Selecting which tickets to touch (pick exactly one):
 * - `--ids=id1,id2,...`         reassign exactly these corporate_pipeline_tickets rows.
 * - `--service="X" --all`      reassign every open ticket for service X (the
 *                               old blanket behavior — opt-in only, since
 *                               reassigning a whole service's open book to one
 *                               processor is rarely what you actually want).
 * - `--service="X"` (no --all) lists that service's open tickets numbered and
 *                               prompts you to pick which ones (comma list
 *                               and/or ranges, e.g. "1,3-5", or "all").
 * - no --service and no --ids  prompts interactively for a service first,
 *                               then falls into the picker above.
 *
 * If --processor isn't passed, prompts interactively with a numbered list of
 * team members (matches GET /api/teams — Better Auth users).
 *
 * "Open" (only relevant for --service / --all, not --ids) matches the same
 * definition used by packages/server/src/routes/open-tickets-dashboard.ts:
 * status is NULL or not the corporate terminal status ('Complete Service').
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - Tickets already assigned to the target processor are reported but
 *   skipped (no-op).
 * - With --apply, requires typing "yes" at a single confirmation prompt
 *   before anything is written.
 * - Each row is updated in its own transaction.
 *
 * Usage:
 *   bun run packages/server/scripts/reassign-tickets.ts --ids=rec1,rec2 --processor="Jane Doe" --apply
 *   bun run packages/server/scripts/reassign-tickets.ts --service="Payroll"                       # prompts which ones + processor, report only
 *   bun run packages/server/scripts/reassign-tickets.ts --service="Payroll" --all --processor="Jane Doe" --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, asc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import * as readline from 'node:readline/promises';
import * as schema from '../src/db/schema';
import { authUser } from '../src/db/auth-readonly';
import { parseSelection } from './lib/selection';

config({ path: resolve(__dirname, '../.env') });

const CORPORATE_TERMINAL_STATUS = 'Complete Service';

const isApply = process.argv.includes('--apply');
const isAll = process.argv.includes('--all');
const serviceArg = process.argv.find((a) => a.startsWith('--service='));
const processorArg = process.argv.find((a) => a.startsWith('--processor='));
const idsArg = process.argv.find((a) => a.startsWith('--ids='));

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

async function promptForTicketSelection(count: number): Promise<Set<number>> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    '\nWhich tickets should be reassigned? (comma list and/or ranges, e.g. "1,3-5", or "all"): '
  );
  rl.close();
  return parseSelection(answer, count);
}

interface Processor {
  id: string;
  name: string;
  email: string;
}

async function resolveProcessor(nameOrEmail: string, all: Processor[]): Promise<Processor> {
  const needle = nameOrEmail.trim().toLowerCase();
  const matches = all.filter(
    (p) => p.name.toLowerCase() === needle || p.email.toLowerCase() === needle
  );
  if (matches.length === 1) return matches[0];

  const looseMatches = all.filter((p) => p.name.toLowerCase().includes(needle));
  if (looseMatches.length === 1) return looseMatches[0];

  console.error(
    matches.length > 1 || looseMatches.length > 1
      ? `Ambiguous --processor="${nameOrEmail}" — matches: ${[...new Set([...matches, ...looseMatches])].map((p) => p.name).join(', ')}`
      : `No team member found matching --processor="${nameOrEmail}"`
  );
  process.exit(1);
}

async function promptForProcessor(all: Processor[]): Promise<Processor> {
  console.log('\nTeam members:\n');
  all.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} <${p.email}>`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nSelect a processor (number): ')).trim();
  rl.close();

  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= all.length) {
    console.error(`Invalid selection: "${answer}"`);
    process.exit(1);
  }
  return all[index];
}

interface TicketRow {
  id: string;
  status: string | null;
  processorId: string | null;
  company: string | null;
}

async function fetchTicketsByIds(ids: string[]): Promise<TicketRow[]> {
  return db
    .select({
      id: corporatePipelineTickets.id,
      status: corporatePipelineTickets.status,
      processorId: corporatePipelineTickets.processorId,
      company: corporations.company,
    })
    .from(corporatePipelineTickets)
    .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
    .where(inArray(corporatePipelineTickets.id, ids))
    .orderBy(corporatePipelineTickets.id);
}

async function fetchOpenTicketsForService(serviceName: string): Promise<TicketRow[]> {
  return db
    .select({
      id: corporatePipelineTickets.id,
      status: corporatePipelineTickets.status,
      processorId: corporatePipelineTickets.processorId,
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
        )
      )
    )
    .orderBy(corporatePipelineTickets.id);
}

async function main() {
  if (idsArg && (serviceArg || isAll)) {
    console.error('--ids cannot be combined with --service or --all — pick one selection mode.');
    process.exit(1);
  }

  const allProcessors = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email })
    .from(authUser)
    .orderBy(asc(authUser.name));
  const processorMap = new Map(allProcessors.map((p) => [p.id, p]));

  let rows: TicketRow[];
  let label: string;

  if (idsArg) {
    const ids = idsArg
      .slice('--ids='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    rows = await fetchTicketsByIds(ids);
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      console.error(`Ticket ID(s) not found: ${missing.join(', ')}`);
      process.exit(1);
    }
    label = `${rows.length} explicit ticket(s)`;
  } else {
    const serviceName = serviceArg ? serviceArg.slice('--service='.length) : await promptForService();
    const candidates = await fetchOpenTicketsForService(serviceName);

    if (candidates.length === 0) {
      console.log(`\nNo open tickets found for service "${serviceName}".\n`);
      await pool.end();
      return;
    }

    if (isAll) {
      rows = candidates;
    } else {
      console.log(`\nOpen tickets for "${serviceName}":\n`);
      candidates.forEach((row, i) => {
        const currentName = row.processorId ? processorMap.get(row.processorId)?.name ?? row.processorId : '(unassigned)';
        console.log(`  ${i + 1}. ${row.id}  company="${row.company ?? '(none)'}"  status=${row.status ?? '(null)'}  current=${currentName}`);
      });
      const selection = await promptForTicketSelection(candidates.length);
      rows = candidates.filter((_, i) => selection.has(i));
    }
    label = `${rows.length} of ${candidates.length} open ticket(s) for "${serviceName}"`;
  }

  const processor = processorArg
    ? await resolveProcessor(processorArg.slice('--processor='.length), allProcessors)
    : await promptForProcessor(allProcessors);

  console.log(`\nSelected: ${label}  |  reassigning to: ${processor.name} <${processor.email}>\n`);

  const toUpdate = rows.filter((row) => row.processorId !== processor.id);
  const skipped = rows.length - toUpdate.length;

  for (const row of rows) {
    const currentName = row.processorId ? processorMap.get(row.processorId)?.name ?? row.processorId : '(unassigned)';
    const noChange = row.processorId === processor.id;
    console.log(
      `  ${row.id}  company="${row.company ?? '(none)'}"  status=${row.status ?? '(null)'}  current=${currentName}${noChange ? '  (no change, skipped)' : ''}`
    );
  }

  if (rows.length === 0) {
    console.log('\nNothing selected.\n');
    await pool.end();
    return;
  }

  if (skipped > 0) {
    console.log(`\n${skipped} ticket(s) already assigned to ${processor.name} — will be skipped.`);
  }

  if (toUpdate.length === 0) {
    console.log('\nNothing to update.\n');
    await pool.end();
    return;
  }

  if (!isApply) {
    console.log(`\n[dry-run] no changes written. Re-run with --apply to reassign these ${toUpdate.length} ticket(s).\n`);
    await pool.end();
    return;
  }

  const ok = await confirm(`\nType "yes" to reassign these ${toUpdate.length} ticket(s) to ${processor.name}: `);
  if (!ok) {
    console.log('Aborted, nothing changed.\n');
    await pool.end();
    return;
  }

  let updated = 0;
  for (const row of toUpdate) {
    await db.transaction(async (tx) => {
      await tx
        .update(corporatePipelineTickets)
        .set({ processorId: processor.id })
        .where(eq(corporatePipelineTickets.id, row.id));
    });
    console.log(`  reassigned ${row.id}`);
    updated++;
  }

  console.log(`\nReassigned ${updated} ticket(s) to ${processor.name}. No emails were sent (direct DB write, bypasses the PATCH notification path).\n`);
  await pool.end();
}

main().catch((err) => {
  console.error('Reassignment failed:', err);
  process.exit(1);
});
