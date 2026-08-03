/**
 * Deletes open `corporate_pipeline_tickets` rows, for the case where a batch
 * of tickets is being manually replaced by a fresh batch and the stale ones
 * would otherwise sit open forever.
 *
 * Two ways to choose what to delete:
 *
 *   1. By service, across every customer — the original mode. If --service
 *      isn't passed, prompts with a numbered list of every service that
 *      currently has at least one corporate pipeline ticket, so the caller
 *      doesn't need to know exact spelling/casing.
 *
 *   2. Scoped to one customer, across one or more of that customer's services
 *      — pass --company (or --company-id). Without --service, prompts with a
 *      numbered list of just that customer's services, each showing how many
 *      open tickets it has and how many pass the age filter, and accepts a
 *      multi-select ("1,3-5" or "all"). This is the "clean up everything we
 *      have open for this client" case.
 *
 * "Open" matches the same definition used by
 * packages/server/src/routes/open-tickets-dashboard.ts: status is NULL or
 * not the corporate terminal status ('Complete Service'). Age is measured
 * from createdAt.
 *
 * The age filter applies in both modes and defaults to 10 days, so scoping to
 * a customer does not by itself mean "every ticket regardless of age" — pass
 * --days=0 for that. When the age filter is what's hiding rows, the report
 * says so explicitly rather than just printing "Nothing to do".
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
 * - An ambiguous --company lists the candidates and exits without deleting
 *   anything, rather than guessing which customer was meant.
 * - Each row is deleted in its own transaction.
 *
 * Usage:
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts                              # prompts for service, >10 days, report only
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --apply
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll" --days=10 --apply
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll,Bookkeeping Clients"
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --company="NOE USA" --days=0   # pick services interactively
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --company              # pick the customer interactively too
 *   bun run packages/server/scripts/cleanup-stale-tickets.ts --company="NOE USA" --all-services --days=0 --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import * as readline from 'node:readline/promises';
import * as schema from '../src/db/schema';
import { parseSelection } from './lib/selection';

config({ path: resolve(__dirname, '../.env') });

const CORPORATE_TERMINAL_STATUS = 'Complete Service';

const isApply = process.argv.includes('--apply');
const allServices = process.argv.includes('--all-services');
const serviceArg = process.argv.find((a) => a.startsWith('--service='));
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const companyArg = process.argv.find((a) => a === '--company' || a.startsWith('--company='));
const companyIdArg = process.argv.find((a) => a.startsWith('--company-id='));
const days = daysArg ? Number(daysArg.slice('--days='.length)) : 10;

// Bare --company means "let me pick the customer from a list"; --company=X
// names one directly.
const companyName =
  companyArg && companyArg.startsWith('--company=') ? companyArg.slice('--company='.length).trim() : undefined;
const companyId = companyIdArg ? companyIdArg.slice('--company-id='.length).trim() : undefined;
const wantsCompanyScope = Boolean(companyArg || companyIdArg);

// Comma-separated so one run can clear several services at once. Names with a
// comma in them would need --company + the interactive picker instead.
const serviceNames = serviceArg
  ? serviceArg
      .slice('--service='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : undefined;

if (!Number.isFinite(days) || days < 0) {
  console.error(`Invalid --days value: ${daysArg}`);
  process.exit(1);
}

if (allServices && !wantsCompanyScope) {
  console.error('--all-services only makes sense together with --company / --company-id.');
  process.exit(1);
}

if (allServices && serviceNames) {
  console.error('Pass either --service= or --all-services, not both.');
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

// Reused by every query below so "open" can't drift between the picker counts
// and the rows actually deleted.
const isOpen = or(
  isNull(corporatePipelineTickets.status),
  ne(corporatePipelineTickets.status, CORPORATE_TERMINAL_STATUS)
);

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function confirm(message: string): Promise<boolean> {
  return (await ask(message)).toLowerCase() === 'yes';
}

type Company = { id: string; company: string | null };

// Only customers that actually have open tickets — the full corporations table
// is 400+ rows, almost none of them relevant here.
async function companiesWithOpenTickets(): Promise<(Company & { openCount: number })[]> {
  return db
    .select({
      id: corporations.id,
      company: corporations.company,
      openCount: sql<number>`count(*)::int`,
    })
    .from(corporatePipelineTickets)
    .innerJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
    .where(isOpen)
    .groupBy(corporations.id, corporations.company)
    .orderBy(corporations.company);
}

async function resolveCompany(): Promise<Company> {
  const candidates = await companiesWithOpenTickets();

  if (candidates.length === 0) {
    console.error('No customers currently have open corporate pipeline tickets.');
    process.exit(1);
  }

  if (companyId) {
    const hit = candidates.find((c) => c.id === companyId);
    if (!hit) {
      console.error(`No customer with open tickets has id "${companyId}".`);
      process.exit(1);
    }
    return hit;
  }

  if (companyName) {
    const needle = companyName.toLowerCase();
    const exact = candidates.filter((c) => (c.company ?? '').trim().toLowerCase() === needle);
    const matches = exact.length ? exact : candidates.filter((c) => (c.company ?? '').toLowerCase().includes(needle));

    if (matches.length === 0) {
      console.error(`No customer with open tickets matches "${companyName}".`);
      process.exit(1);
    }
    // Never guess between customers — deleting the wrong client's tickets is
    // not something a dry run would necessarily catch, since the report would
    // look perfectly plausible.
    if (matches.length > 1) {
      console.error(`"${companyName}" matches ${matches.length} customers — narrow it down or use --company-id=:\n`);
      for (const m of matches) console.error(`  ${m.id}  ${m.company}`);
      process.exit(1);
    }
    return matches[0];
  }

  console.log('\nCustomers with open corporate pipeline tickets:\n');
  candidates.forEach((c, i) =>
    console.log(`  ${String(i + 1).padStart(3)}. ${(c.company ?? '(unnamed)').trim()}  (${c.openCount} open)`)
  );
  const answer = await ask('\nSelect a customer (number): ');
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    console.error(`Invalid selection: "${answer}"`);
    process.exit(1);
  }
  return candidates[index];
}

/**
 * Services with open tickets, optionally for one customer, each with the
 * number of open tickets and how many of those pass the age filter — so the
 * picker shows up front when a service has open work that this run would skip
 * as too new.
 */
async function servicesWithOpenTickets(cutoff: Date, company?: Company) {
  return db
    .select({
      name: servicesCorporate.name,
      openCount: sql<number>`count(*)::int`,
      staleCount: sql<number>`count(*) filter (where ${corporatePipelineTickets.createdAt} < ${cutoff})::int`,
    })
    .from(corporatePipelineTickets)
    .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
    .where(
      and(isOpen, company ? eq(corporatePipelineTickets.corporationId, company.id) : undefined)
    )
    .groupBy(servicesCorporate.name)
    .orderBy(servicesCorporate.name);
}

async function main() {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const company = wantsCompanyScope ? await resolveCompany() : undefined;

  let selectedServices: string[];

  if (serviceNames) {
    selectedServices = serviceNames;
  } else {
    const available = await servicesWithOpenTickets(cutoff, company);

    if (available.length === 0) {
      console.error(
        company
          ? `${company.company?.trim()} has no open corporate pipeline tickets.`
          : 'No corporate services with pipeline tickets found.'
      );
      process.exit(1);
    }

    if (allServices) {
      selectedServices = available.map((s) => s.name);
    } else {
      console.log(
        company
          ? `\nOpen services for ${company.company?.trim()}:\n`
          : '\nServices with corporate pipeline tickets:\n'
      );
      available.forEach((s, i) =>
        console.log(
          `  ${String(i + 1).padStart(3)}. ${s.name.padEnd(32)} ${s.openCount} open` +
            (s.staleCount === s.openCount ? '' : `, ${s.staleCount} older than ${days}d`)
        )
      );

      // Customer-scoped runs are the "clean up this client" case, so they take
      // a multi-select. Without a customer this stays a single choice, as it
      // has always been — deleting one service's tickets across every customer
      // is a much broader action to widen by accident.
      if (company) {
        const answer = await ask(
          '\nWhich services should be cleaned? (comma list and/or ranges, e.g. "1,3-5", or "all"): '
        );
        selectedServices = [...parseSelection(answer, available.length)].sort((a, b) => a - b).map(
          (i) => available[i].name
        );
      } else {
        const answer = await ask('\nSelect a service (number): ');
        const index = Number(answer) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= available.length) {
          console.error(`Invalid selection: "${answer}"`);
          process.exit(1);
        }
        selectedServices = [available[index].name];
      }
    }
  }

  const scope = and(
    inArray(servicesCorporate.name, selectedServices),
    isOpen,
    company ? eq(corporatePipelineTickets.corporationId, company.id) : undefined
  );

  const selectRows = (extra?: ReturnType<typeof lt>) =>
    db
      .select({
        id: corporatePipelineTickets.id,
        status: corporatePipelineTickets.status,
        createdAt: corporatePipelineTickets.createdAt,
        company: corporations.company,
        service: servicesCorporate.name,
      })
      .from(corporatePipelineTickets)
      .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
      .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
      .where(extra ? and(scope, extra) : scope)
      .orderBy(corporatePipelineTickets.createdAt);

  const rows = await selectRows(lt(corporatePipelineTickets.createdAt, cutoff));
  const allOpen = await selectRows();

  console.log(
    `\nCustomer: ${company ? company.company?.trim() : '(all customers)'}` +
      `\nService(s): ${selectedServices.map((s) => `"${s}"`).join(', ')}` +
      `\nAge filter: older than ${days} day(s)  |  cutoff: ${cutoff.toISOString()}\n`
  );
  console.log(`Found ${rows.length} open ticket(s) to delete:\n`);

  for (const row of rows) {
    const ageDays = Math.floor((Date.now() - row.createdAt!.getTime()) / 86_400_000);
    console.log(
      `  ${row.id}  company="${row.company ?? '(none)'}"  service="${row.service}"  status=${row.status ?? '(null)'}  created=${row.createdAt?.toISOString()}  age=${ageDays}d`
    );
  }

  const tooNew = allOpen.length - rows.length;
  if (tooNew > 0) {
    console.log(
      `\n  (${tooNew} more open ticket(s) matched the customer/service filter but are newer than ` +
        `${days} day(s) — re-run with --days=0 to include them.)`
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
