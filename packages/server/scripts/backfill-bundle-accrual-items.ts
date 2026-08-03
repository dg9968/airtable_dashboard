/**
 * Reconciles corporate billing bundles against "Presupuesto para Airtable.xlsm"
 * (the budget workbook staff maintain by hand), in three independent stages:
 *
 *   1. cadence  — fix `services_corporate.billing_cycle` values that make
 *                 ticket generation behave wrongly (see CADENCE_FIXES).
 *   2. annual-report — add the missing $4.25/mo "Annual Report" line item.
 *   3. tax-returns   — add the missing "Tax Returns" line item.
 *   4. sales-tax     — add the missing "Sales Tax Monthly" / "Sales Tax
 *                      Quarterly" line item, choosing the service from the
 *                      client's certificate filing frequency.
 *
 * Why stages 2 and 3 are accruals, not one-off charges: a bundle line item's
 * dollar amount is billed every month, but ticket generation is gated
 * separately by the *service's* billing_cycle (src/lib/billing-cadence.ts).
 * "Annual Report" and "Tax Returns" are Annual-cadence: the client pays
 * $4.25/mo and $70/mo toward them all year, and exactly one pipeline ticket
 * is generated each January for the work.
 *
 * Stage 1 is therefore a prerequisite for stage 2, and the script enforces
 * that ordering: "Annual Report" currently has billing_cycle = 'One-time',
 * for which isFilingMonth() returns false in every month of the year. Adding
 * the $4.25 line items while that's still true would bill 25 clients for work
 * that could never be ticketed. Stage 2 refuses to run until it's 'Annual'.
 *
 * The per-client lists below are hardcoded rather than re-derived from the
 * workbook, the same way consolidate-multilocation-corporations.ts hardcodes
 * its PAIRS: this is a one-time human-confirmed reconciliation against a
 * specific version of a spreadsheet, not a repeatable check. Amounts come
 * from the workbook's Table2 (columns R:AF), which decomposes each client's
 * monthly charge into per-service line items.
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - With --apply, requires typing "yes" at a single confirmation prompt.
 * - Purely additive: only ever INSERTs new bundle line items and UPDATEs
 *   billing_cycle on the service catalog. Never edits an existing line item's
 *   amount, never deletes, never touches tickets or billing_records.
 * - Every row is re-verified against live DB state before writing. A client
 *   is skipped (and reported) if its bundle is no longer active, if the line
 *   item already exists, or if the corporation has gone missing — so this is
 *   safe to re-run and safe to run after someone has fixed some by hand.
 * - Clients whose workbook amount conflicts with an existing line item are
 *   reported as NEEDS REVIEW and never written, by any stage.
 * - The sales-tax stage additionally re-derives each client's certificate
 *   count and filing frequency from sales_tax_certificates and refuses to
 *   write when they contradict the planned amount or service.
 * - Each stage runs in its own transaction, so a failure in one leaves the
 *   others intact.
 * - Prints every inserted row id, so the run output is a reversal record.
 *
 * Usage:
 *   bun run packages/server/scripts/backfill-bundle-accrual-items.ts                    # dry run, all stages
 *   bun run packages/server/scripts/backfill-bundle-accrual-items.ts --apply
 *   bun run packages/server/scripts/backfill-bundle-accrual-items.ts --stage=cadence --apply
 *   bun run packages/server/scripts/backfill-bundle-accrual-items.ts --stage=annual-report,tax-returns --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, type PoolClient } from 'pg';
import * as readline from 'node:readline/promises';

config({ path: resolve(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// Stage 1: service cadence corrections
// ---------------------------------------------------------------------------

/**
 * Services whose billing_cycle makes isFilingMonth() (src/lib/billing-cadence.ts)
 * generate tickets on the wrong schedule. A null billing_cycle defaults to
 * 'Monthly' there, so an annual service left null silently produces twelve
 * tickets a year instead of one.
 *
 * Deliberately NOT included, because the fix isn't a cadence value:
 *  - Extensions: annual work, but files ~March/April. ANNUAL_FILING_MONTH is a
 *    single hardcoded constant (January) shared by every Annual service, so
 *    setting this to 'Annual' would generate its ticket in the wrong month.
 *    Needs a per-service filing month first.
 *  - Vault Management / Quickbooks Software / PO Box - 1414: pass-through fees
 *    with no work product, currently generating a ticket every month. There is
 *    no cadence value meaning "bill monthly, never ticket" — 'One-time' is the
 *    closest lever but reads wrong, and would be indistinguishable from the
 *    Annual Report bug this script exists to fix.
 */
const CADENCE_FIXES: { service: string; from: string | null; to: string; why: string }[] = [
  {
    service: 'Annual Report',
    from: 'One-time',
    to: 'Annual',
    why: "isFilingMonth('one-time') is false in every month — the January ticket is never generated",
  },
  {
    service: '1099 Filing',
    from: null,
    to: 'Annual',
    why: 'null defaults to Monthly — 1099s are filed once, in January',
  },
  {
    service: 'Registered Agent',
    from: null,
    to: 'Annual',
    why: 'null defaults to Monthly — registered agent renews once a year',
  },
];

// ---------------------------------------------------------------------------
// Stages 2 & 3: missing bundle line items
// ---------------------------------------------------------------------------

type PlannedItem = {
  corpId: string;
  company: string;
  amount: string;
  sheetRow: number;
  /** Appended to the inserted row's notes, for amounts whose derivation isn't obvious. */
  note?: string;
  /**
   * Sales-tax stage only: the sales_tax_certificates state this amount was
   * derived from. Re-verified against the live table before writing — if the
   * certificates have changed, the amount is no longer trustworthy.
   */
  certs?: { count: number; frequency: 'Monthly' | 'Quarterly' };
};

/**
 * $4.25/mo accrual toward the Florida annual report. Uniform across every
 * client in the workbook. APEXLUXE INC already has its line item and is
 * absent here; so are the three clients whose bundle is 'cancelled'
 * (BONI'S COFFE SHOP, EL SITIO COFFEE BAR, Raices Produce DR) — reactivating
 * a cancelled bundle is a billing decision, not a backfill.
 */
const ANNUAL_REPORT_ITEMS: PlannedItem[] = [
  { corpId: 'recAMsQxaVcplnjN3', company: 'AUTOCLUB DORAL LLC', amount: '4.25', sheetRow: 5 },
  { corpId: 'recmI5hXI5o4tDJHq', company: 'BE INK CREATIVE LLC', amount: '4.25', sheetRow: 6 },
  { corpId: 'recVPEXQxPRhbFK33', company: 'BEXTRATEGIC LLC', amount: '4.25', sheetRow: 7 },
  { corpId: 'rec9LJrsBAFR4guT4', company: 'CERTUS INDUSTRIES CORP', amount: '4.25', sheetRow: 10 },
  { corpId: 'recAFgQMYDWZ5Aecc', company: 'CONVECA LLC', amount: '4.25', sheetRow: 11 },
  { corpId: 'recxJaJJ6zowR5vtN', company: 'CONVECA VZLA LLC', amount: '4.25', sheetRow: 12 },
  { corpId: 'recIfmSjOG1Kwpm4e', company: 'DELPHINE BREYNE LLC', amount: '4.25', sheetRow: 13 },
  { corpId: 'recKVreSNUIxMFet9', company: 'G&O RENT A CAR LLC', amount: '4.25', sheetRow: 14 },
  { corpId: 'rec7l6OPyWKpNmWpl', company: 'GENERAL DISTRIBUTORS INC', amount: '4.25', sheetRow: 16 },
  { corpId: 'recf9xqG1t6WR6wv6', company: 'GRUPO BORGES LLC', amount: '4.25', sheetRow: 17 },
  { corpId: 'recsfMUqBgZ4PVrkB', company: 'GW SENSORS LLC', amount: '4.25', sheetRow: 18 },
  { corpId: 'recwth8BZQPLV9oyu', company: 'HENKO A&T LLC', amount: '4.25', sheetRow: 20 },
  { corpId: 'recHGjagPPT75f53Y', company: 'INTEGRITY TECHNOLOGY SOLUTIONS GROUP, INC', amount: '4.25', sheetRow: 23 },
  { corpId: 'recGCqxz3DHK6S8Jc', company: 'MBT HVAC SERVICES INC', amount: '4.25', sheetRow: 27 },
  { corpId: 'recUvFIUMFzyrCHIU', company: 'NECESS-IT INC', amount: '4.25', sheetRow: 29 },
  { corpId: 'rec7Ff0U7RI1En7Ai', company: 'NOE USA LLC', amount: '4.25', sheetRow: 30 },
  { corpId: 'recYPwqKRLHxW9RU3', company: 'PROBAG INC', amount: '4.25', sheetRow: 32 },
  { corpId: 'recJcKdGwGqJIYHN0', company: 'REYES-MARTI BROTHERS LANDSCAPING LLC', amount: '4.25', sheetRow: 35 },
  { corpId: 'reccXKPgvA3IKwc6w', company: 'ROCA HOME SERVICES LLC', amount: '4.25', sheetRow: 37 },
  { corpId: 'recoBR5Ok7gPa0Kly', company: 'TRANQUILITY AT DORAL INC', amount: '4.25', sheetRow: 39 },
  { corpId: 'reckd2UrbWt26Qb8w', company: 'UN SOLO DOLAR LLC', amount: '4.25', sheetRow: 40 },
  { corpId: 'recGr3uw1rkB9X1qm', company: 'UNION DESIGN & REMODELING LLC', amount: '4.25', sheetRow: 41 },
  { corpId: 'recfHcdAj9nfbDqo2', company: 'SG GLASS INDUSTRIES LLC', amount: '4.25', sheetRow: 43 },
  { corpId: 'reciVUHFnBqYf7ZBF', company: 'MIAMI CAR US CORP', amount: '4.25', sheetRow: 44 },
  { corpId: 'reclTN5FKum30GpZk', company: 'DOUGLAS M CASTELLANO MD LLC', amount: '4.25', sheetRow: 45 },
];

/**
 * Monthly accrual toward the client's annual return — the workbook's
 * FILING PER + FILING CORP, which varies per client ($50 / $70 / $90).
 * NECESS-IT INC and DOUGLAS M CASTELLANO MD LLC are absent on purpose: they
 * already have a Tax Returns line item at a different amount than the
 * workbook, so they surface as NEEDS REVIEW instead (see REVIEW_ONLY).
 */
const TAX_RETURNS_ITEMS: PlannedItem[] = [
  { corpId: 'recAMsQxaVcplnjN3', company: 'AUTOCLUB DORAL LLC', amount: '70.00', sheetRow: 5 },
  { corpId: 'recmI5hXI5o4tDJHq', company: 'BE INK CREATIVE LLC', amount: '70.00', sheetRow: 6 },
  { corpId: 'recVPEXQxPRhbFK33', company: 'BEXTRATEGIC LLC', amount: '70.00', sheetRow: 7 },
  { corpId: 'rec9LJrsBAFR4guT4', company: 'CERTUS INDUSTRIES CORP', amount: '70.00', sheetRow: 10 },
  { corpId: 'recAFgQMYDWZ5Aecc', company: 'CONVECA LLC', amount: '70.00', sheetRow: 11 },
  { corpId: 'recxJaJJ6zowR5vtN', company: 'CONVECA VZLA LLC', amount: '50.00', sheetRow: 12 },
  { corpId: 'recIfmSjOG1Kwpm4e', company: 'DELPHINE BREYNE LLC', amount: '70.00', sheetRow: 13 },
  { corpId: 'recKVreSNUIxMFet9', company: 'G&O RENT A CAR LLC', amount: '70.00', sheetRow: 14 },
  { corpId: 'recf9xqG1t6WR6wv6', company: 'GRUPO BORGES LLC', amount: '90.00', sheetRow: 17 },
  { corpId: 'recHGjagPPT75f53Y', company: 'INTEGRITY TECHNOLOGY SOLUTIONS GROUP, INC', amount: '70.00', sheetRow: 23 },
  { corpId: 'recGCqxz3DHK6S8Jc', company: 'MBT HVAC SERVICES INC', amount: '70.00', sheetRow: 27 },
  { corpId: 'rec7Ff0U7RI1En7Ai', company: 'NOE USA LLC', amount: '50.00', sheetRow: 30 },
  { corpId: 'reckd2UrbWt26Qb8w', company: 'UN SOLO DOLAR LLC', amount: '90.00', sheetRow: 40 },
];

// ---------------------------------------------------------------------------
// Stage 4: sales tax
// ---------------------------------------------------------------------------

/**
 * Sales tax is billed at a flat rate per filing, accrued monthly. The
 * workbook's column F is the annual total and column X divides it by 12, so
 * the monthly accrual decodes the client's filing frequency exactly:
 *
 *   $540/yr -> $45.00/mo  = Monthly filer   (12 filings x $45)
 *   $180/yr -> $15.00/mo  = Quarterly filer ( 4 filings x $45)
 *
 * Confirmed against sales_tax_certificates.frequency for every client: every
 * $45 row has a Monthly certificate and every $15 row a Quarterly one. That
 * matters because the workbook column is titled "Monthly Sales Tax" for both,
 * which is what hid two quarterly filers (Hedman, Yoni) behind the monthly
 * service — Yoni's bundle even carried a now-removed *Sales Tax Monthly* item.
 *
 * A client with several locations holds one certificate per location and
 * files once per location per period, so the accrual is
 * certificate count x rate. planSalesTax() re-derives both the count and the
 * frequency from the live table and refuses to write when either contradicts
 * the amount below.
 */
const SALES_TAX_RATE_PER_FILING = 45;

const SALES_TAX_MONTHLY_ITEMS: PlannedItem[] = [
  // Two locations, two certificates, two filings a month — confirmed 2026-08-03.
  { corpId: 'recAMsQxaVcplnjN3', company: 'AUTOCLUB DORAL LLC', amount: '90.00', sheetRow: 5, note: '2 locations x $45/filing', certs: { count: 2, frequency: 'Monthly' } },
  { corpId: 'rec9LJrsBAFR4guT4', company: 'CERTUS INDUSTRIES CORP', amount: '45.00', sheetRow: 10, certs: { count: 1, frequency: 'Monthly' } },
  // Two locations, same as Autoclub. Both certificates currently have a NULL
  // frequency, so planSalesTax() reports that rather than treating it as agreement.
  { corpId: 'rec7l6OPyWKpNmWpl', company: 'GENERAL DISTRIBUTORS INC', amount: '90.00', sheetRow: 16, note: '2 locations x $45/filing', certs: { count: 2, frequency: 'Monthly' } },
  { corpId: 'recwth8BZQPLV9oyu', company: 'HENKO A&T LLC', amount: '45.00', sheetRow: 20, certs: { count: 1, frequency: 'Monthly' } },
  { corpId: 'rec7Ff0U7RI1En7Ai', company: 'NOE USA LLC', amount: '45.00', sheetRow: 30, certs: { count: 1, frequency: 'Monthly' } },
  { corpId: 'recoBR5Ok7gPa0Kly', company: 'TRANQUILITY AT DORAL INC', amount: '45.00', sheetRow: 39, certs: { count: 1, frequency: 'Monthly' } },
  { corpId: 'recfHcdAj9nfbDqo2', company: 'SG GLASS INDUSTRIES LLC', amount: '45.00', sheetRow: 43, certs: { count: 1, frequency: 'Monthly' } },
  // Workbook row 44's Company cell is hardcoded text reading "SG Glass",
  // typed over the =Table1[[#This Row],[CLIENTE]] formula every other row has.
  // Column A of that row is the real client: Miami Car US Corp.
  { corpId: 'reciVUHFnBqYf7ZBF', company: 'MIAMI CAR US CORP', amount: '45.00', sheetRow: 44, note: 'workbook row 44 Company cell mislabelled "SG Glass"', certs: { count: 1, frequency: 'Monthly' } },
];

/**
 * The two $15/mo rows. Both are quarterly filers, so they take
 * Sales Tax Quarterly — isFilingMonth() then generates their ticket in
 * Jan/Apr/Jul/Oct covering the prior three months, while the $15 is still
 * billed every month.
 */
const SALES_TAX_QUARTERLY_ITEMS: PlannedItem[] = [
  { corpId: 'recL7q1dawapDNKan', company: 'HEDMAN DESIGN INC', amount: '15.00', sheetRow: 19, note: '$180/yr = 4 quarterly filings x $45', certs: { count: 1, frequency: 'Quarterly' } },
  // Workbook row 42 is labelled "SR STONE" but its other figures match this
  // client exactly (bookkeeping $79.05, vault management $18.70) and its
  // certificate is Quarterly, matching the $15. SR STONE DESIGN INC is a
  // separate corporation with no certificate and no bundle.
  { corpId: 'recxnWjz3W8KQZJJM', company: 'YONI WANDERLAND LLC', amount: '15.00', sheetRow: 42, note: 'workbook row 42 mislabelled "SR STONE"; replaces a removed Sales Tax Monthly item', certs: { count: 1, frequency: 'Quarterly' } },
];

/**
 * Conflicts the workbook can't settle on its own — an existing line item
 * disagrees with the sheet, or work is happening with nothing to bill it
 * against. Never written by this script in either direction; listed so the
 * run output names them explicitly rather than silently omitting them.
 */
const REVIEW_ONLY: { company: string; service: string; sheet?: string; app?: string; note: string }[] = [
  {
    company: 'NECESS-IT INC',
    service: 'Tax Returns',
    sheet: '90.00',
    app: '81.87',
    note: 'workbook bookkeeping plug for this client is negative (-3.12), so its split is unreliable',
  },
  {
    company: 'DOUGLAS M CASTELLANO MD LLC',
    service: 'Tax Returns',
    sheet: '90.00',
    app: '70.00',
    note: "workbook row 45 does not balance (residual $94.50), so the sheet's own split is suspect",
  },
  {
    company: 'INTEGRITY TECHNOLOGY SOLUTIONS GROUP, INC',
    service: 'Sales Tax Monthly',
    sheet: '45.00',
    app: '50.00',
    note: "app charges $5/mo more than the workbook's $45/filing rate; also services_corporate.price for this service is $50 — decide which is real",
  },
  {
    company: 'VAMEL CORPORATION',
    service: 'Sales Tax Monthly',
    app: '50.00',
    note: "not in the workbook at all (newer client); billed at $50 rather than the workbook's $45/filing rate",
  },
  {
    company: 'DOUGLAS M CASTELLANO MD LLC',
    service: 'Sales Tax Monthly',
    sheet: '36.25',
    note: 'workbook value is hardcoded (every other row is a formula), column F is empty, and the client has NO sales tax certificate. $36.25 x 12 = $435 fits neither the $540 nor $180 pattern — most likely bogus',
  },
  {
    company: 'Acquality Pool Service, Corp',
    service: 'Sales Tax Monthly',
    note: 'workbook column F says $450/yr (= $37.50/mo) but column X shows $0 — its formula is missing. No certificate and no billing bundle either',
  },
  {
    company: 'EL SITIO COFFEE BAR INC',
    service: 'Sales Tax Monthly',
    sheet: '45.00',
    note: 'Monthly certificate on file and the workbook bills $45, but the billing bundle is cancelled — reactivating it is a billing decision',
  },
  {
    company: 'PROBAG INC',
    service: 'Sales Tax Quarterly',
    note: 'Quarterly certificate + an open quarterly ticket, but the workbook shows $0 and the bundle has no sales tax item — quarterly work being done unbilled (~$15/mo)',
  },
  {
    company: 'UNION DESIGN & REMODELING LLC',
    service: 'Sales Tax Quarterly',
    note: 'Quarterly certificate + an open quarterly ticket, but the workbook shows $0 and the bundle has no sales tax item — quarterly work being done unbilled (~$15/mo)',
  },
  {
    company: 'THOMAS FUCHS CREATIVE LLC',
    service: 'Sales Tax Quarterly',
    note: 'Quarterly certificate and an active bundle, but no sales tax item and no workbook row at all (~$15/mo)',
  },
  {
    company: 'CARIBBEAN CATAMARANS TRADING CORP',
    service: 'Sales Tax Quarterly',
    app: '0.00',
    note: 'Quarterly certificate + open ticket, and a Sales Tax Quarterly line item deliberately set to $0.00 — intentional freebie, or an unfinished entry?',
  },
];

const STAGES = ['cadence', 'annual-report', 'tax-returns', 'sales-tax'] as const;
type Stage = (typeof STAGES)[number];

const isApply = process.argv.includes('--apply');
const stageArg = process.argv.find((a) => a.startsWith('--stage='))?.slice('--stage='.length);
const selectedStages: Stage[] = stageArg
  ? stageArg.split(',').map((s) => s.trim()) as Stage[]
  : [...STAGES];

const badStage = selectedStages.find((s) => !STAGES.includes(s));
if (badStage) {
  console.error(`Unknown --stage "${badStage}". Valid: ${STAGES.join(', ')}`);
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

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === 'yes';
}

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

// ---------------------------------------------------------------------------

type CadencePlan = { service: string; id: string; current: string | null; to: string; why: string };

async function planCadence(): Promise<{ todo: CadencePlan[]; skipped: string[] }> {
  const todo: CadencePlan[] = [];
  const skipped: string[] = [];

  for (const fix of CADENCE_FIXES) {
    const { rows } = await pool.query(
      'select id, billing_cycle from services_corporate where name = $1',
      [fix.service]
    );
    if (rows.length === 0) {
      skipped.push(`${fix.service}: no such service in services_corporate`);
      continue;
    }
    if (rows.length > 1) {
      skipped.push(`${fix.service}: ${rows.length} services share this name — resolve by hand`);
      continue;
    }
    const [svc] = rows;
    if (svc.billing_cycle === fix.to) {
      skipped.push(`${fix.service}: already '${fix.to}'`);
      continue;
    }
    if (svc.billing_cycle !== fix.from) {
      skipped.push(
        `${fix.service}: expected billing_cycle ${fix.from === null ? 'NULL' : `'${fix.from}'`}, found ` +
          `${svc.billing_cycle === null ? 'NULL' : `'${svc.billing_cycle}'`} — changed since this script was written, left alone`
      );
      continue;
    }
    todo.push({ service: fix.service, id: svc.id, current: svc.billing_cycle, to: fix.to, why: fix.why });
  }

  return { todo, skipped };
}

function reportCadence(plan: { todo: CadencePlan[]; skipped: string[] }) {
  console.log('\n=== Stage 1: service cadence ===\n');
  if (plan.todo.length === 0 && plan.skipped.length === 0) {
    console.log('  nothing to do.');
    return;
  }
  for (const t of plan.todo) {
    console.log(`  ${t.service}: ${t.current === null ? 'NULL (-> Monthly)' : `'${t.current}'`} -> '${t.to}'`);
    console.log(`      ${t.why}`);
  }
  for (const s of plan.skipped) console.log(`  SKIP  ${s}`);
}

async function applyCadence(client: PoolClient, todo: CadencePlan[]) {
  for (const t of todo) {
    await client.query('update services_corporate set billing_cycle = $2 where id = $1', [t.id, t.to]);
    console.log(`  updated ${t.service} (${t.id}) -> '${t.to}'`);
  }
}

// ---------------------------------------------------------------------------

type ItemPlan = PlannedItem & { bundleId: string; serviceId: string };
type ItemSkip = { company: string; reason: string };

/**
 * Sales-tax only: re-derives certificate count and frequency from the live
 * table and reports any disagreement with the hardcoded amount, instead of
 * writing a figure whose basis has since changed. Returns a NEEDS REVIEW
 * reason, or null when the certificates still support the amount.
 *
 * A NULL frequency is reported but not treated as a contradiction — five
 * certificates currently have one, and a missing value is not the same as a
 * conflicting one.
 */
async function checkCertificates(w: PlannedItem, serviceName: string): Promise<string | null> {
  if (!w.certs) return null;

  const { rows } = await pool.query(
    'select frequency from sales_tax_certificates where corporation_id = $1',
    [w.corpId]
  );

  if (rows.length !== w.certs.count) {
    return (
      `NEEDS REVIEW — amount ${money(w.amount)} assumes ${w.certs.count} certificate(s) at ` +
      `$${SALES_TAX_RATE_PER_FILING}/filing, but the corporation now has ${rows.length}`
    );
  }

  const expected = serviceName === 'Sales Tax Quarterly' ? 'Quarterly' : 'Monthly';
  const conflicting = rows.filter((r) => r.frequency != null && r.frequency !== expected);
  if (conflicting.length) {
    return (
      `NEEDS REVIEW — planned as ${serviceName}, but ${conflicting.length} of ${rows.length} ` +
      `certificate(s) say frequency='${conflicting[0].frequency}'. Filing frequency decides the service, ` +
      `so confirm before billing`
    );
  }

  return null;
}

async function planItems(
  serviceName: string,
  wanted: PlannedItem[]
): Promise<{ todo: ItemPlan[]; skipped: ItemSkip[]; serviceId: string | null }> {
  const todo: ItemPlan[] = [];
  const skipped: ItemSkip[] = [];

  const { rows: svcRows } = await pool.query('select id from services_corporate where name = $1', [
    serviceName,
  ]);
  if (svcRows.length !== 1) {
    return {
      todo,
      skipped: [
        {
          company: '(all)',
          reason: `service "${serviceName}" matched ${svcRows.length} rows in services_corporate — cannot proceed`,
        },
      ],
      serviceId: null,
    };
  }
  const serviceId: string = svcRows[0].id;

  for (const w of wanted) {
    // Re-derive live state per client rather than trusting the hardcoded list:
    // the bundle may have been cancelled, or the item added by hand, since
    // this list was generated.
    const { rows: bundleRows } = await pool.query(
      `select b.id, b.status, c.company
         from corporate_billing_bundles b
         join corporations c on c.id = b.corporation_id
        where b.corporation_id = $1`,
      [w.corpId]
    );

    if (bundleRows.length === 0) {
      skipped.push({ company: w.company, reason: 'corporation has no billing bundle (or no longer exists)' });
      continue;
    }

    const active = bundleRows.filter((b) => b.status === 'active');
    if (active.length === 0) {
      skipped.push({
        company: w.company,
        reason: `no active bundle (status: ${bundleRows.map((b) => b.status).join(', ')})`,
      });
      continue;
    }
    if (active.length > 1) {
      // Should be impossible — corporate_billing_bundles has a partial unique
      // index on (corporation_id) where status = 'active' — but never guess.
      skipped.push({ company: w.company, reason: `${active.length} active bundles — resolve by hand` });
      continue;
    }
    const bundle = active[0];

    const { rows: existing } = await pool.query(
      `select id, amount, status
         from corporate_billing_bundle_items
        where bundle_id = $1 and service_id = $2`,
      [bundle.id, serviceId]
    );

    const activeItem = existing.find((i) => i.status === 'active');
    if (activeItem) {
      const same = Math.abs(Number(activeItem.amount) - Number(w.amount)) < 0.005;
      skipped.push({
        company: w.company,
        reason: same
          ? `already has ${serviceName} at ${money(activeItem.amount)}`
          : `NEEDS REVIEW — already has ${serviceName} at ${money(activeItem.amount)}, workbook says ${money(w.amount)}`,
      });
      continue;
    }

    const removedItem = existing.find((i) => i.status === 'removed');
    if (removedItem) {
      // A soft-deleted item means someone deliberately took this service off
      // the bundle. Re-adding it is a billing decision, not a backfill.
      skipped.push({
        company: w.company,
        reason: `NEEDS REVIEW — ${serviceName} was previously removed from this bundle (item ${removedItem.id} at ${money(removedItem.amount)})`,
      });
      continue;
    }

    const certProblem = await checkCertificates(w, serviceName);
    if (certProblem) {
      skipped.push({ company: w.company, reason: certProblem });
      continue;
    }

    todo.push({ ...w, company: bundle.company?.trim() || w.company, bundleId: bundle.id, serviceId });
  }

  return { todo, skipped, serviceId };
}

function reportItems(stageName: string, serviceName: string, plan: { todo: ItemPlan[]; skipped: ItemSkip[] }) {
  console.log(`\n=== Stage ${stageName}: add missing "${serviceName}" line items ===\n`);
  if (plan.todo.length === 0) {
    console.log('  nothing to add.');
  } else {
    const total = plan.todo.reduce((s, t) => s + Number(t.amount), 0);
    for (const t of plan.todo) {
      console.log(
        `  + ${t.company.padEnd(45)} ${money(t.amount).padStart(9)}   (workbook row ${t.sheetRow})` +
          (t.note ? `\n      ${t.note}` : '')
      );
    }
    console.log(`\n  ${plan.todo.length} line item(s), ${money(total)}/mo, ${money(total * 12)}/yr`);
  }
  const review = plan.skipped.filter((s) => s.reason.startsWith('NEEDS REVIEW'));
  const plain = plan.skipped.filter((s) => !s.reason.startsWith('NEEDS REVIEW'));
  if (plain.length) {
    console.log('');
    for (const s of plain) console.log(`  SKIP  ${s.company}: ${s.reason}`);
  }
  if (review.length) {
    console.log('');
    for (const s of review) console.log(`  ${s.reason.replace('NEEDS REVIEW — ', 'NEEDS REVIEW  ' + s.company + ': ')}`);
  }
}

async function applyItems(client: PoolClient, serviceName: string, todo: ItemPlan[], effectiveDate: string) {
  for (const t of todo) {
    const { rows } = await client.query(
      `insert into corporate_billing_bundle_items
         (id, bundle_id, service_id, amount, status, effective_date, notes)
       values ($1, $2, $3, $4, 'active', $5, $6)
       returning id`,
      [
        crypto.randomUUID(),
        t.bundleId,
        t.serviceId,
        t.amount,
        effectiveDate,
        `Backfilled from "Presupuesto para Airtable.xlsm" row ${t.sheetRow} (${effectiveDate})` +
          (t.note ? ` — ${t.note}` : ''),
      ]
    );
    console.log(`  inserted ${rows[0].id}  ${t.company} — ${serviceName} ${money(t.amount)}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const run = (s: Stage) => selectedStages.includes(s);

  console.log(
    `\nBundle accrual reconciliation — ${isApply ? 'APPLY' : 'dry run'} — stages: ${selectedStages.join(', ')}`
  );

  const cadencePlan = run('cadence') ? await planCadence() : { todo: [], skipped: [] };
  if (run('cadence')) reportCadence(cadencePlan);

  // Annual Report line items are only safe once the service files annually —
  // see the header. Determine the cycle the service will have after this run.
  let annualReportBlocked: string | null = null;
  let annualReportPendingCadence = false;
  if (run('annual-report')) {
    const { rows } = await pool.query(
      "select billing_cycle from services_corporate where name = 'Annual Report'"
    );
    const currentCycle: string | null | undefined = rows[0]?.billing_cycle;
    // Stage 1 runs before stage 2 within a single --apply run, so a queued
    // cadence fix satisfies the prerequisite. Evaluated the same way in a dry
    // run, so the preview shows what that combined run would actually do.
    annualReportPendingCadence = cadencePlan.todo.some((t) => t.service === 'Annual Report');
    const effectiveCycle = annualReportPendingCadence ? 'Annual' : currentCycle ?? null;
    if (rows.length === 0) {
      annualReportBlocked = 'no "Annual Report" service exists in services_corporate';
    } else if (effectiveCycle !== 'Annual') {
      annualReportBlocked =
        `"Annual Report" billing_cycle is ${currentCycle === null ? 'NULL' : `'${currentCycle}'`}, not 'Annual'. ` +
        `Adding these line items now would bill clients for a ticket that never generates. ` +
        `Run the "cadence" stage first (or together with this one).`;
    }
  }

  const arPlan =
    run('annual-report') && !annualReportBlocked
      ? await planItems('Annual Report', ANNUAL_REPORT_ITEMS)
      : { todo: [] as ItemPlan[], skipped: [] as ItemSkip[], serviceId: null };
  if (run('annual-report')) {
    if (annualReportBlocked) {
      console.log('\n=== Stage 2: add missing "Annual Report" line items ===\n');
      console.log(`  BLOCKED — ${annualReportBlocked}`);
    } else {
      reportItems('2', 'Annual Report', arPlan);
      if (annualReportPendingCadence) {
        console.log("\n  (depends on stage 1 setting \"Annual Report\" to 'Annual' first — same run)");
      }
    }
  }

  const trPlan = run('tax-returns')
    ? await planItems('Tax Returns', TAX_RETURNS_ITEMS)
    : { todo: [] as ItemPlan[], skipped: [] as ItemSkip[], serviceId: null };
  if (run('tax-returns')) reportItems('3', 'Tax Returns', trPlan);

  const empty = { todo: [] as ItemPlan[], skipped: [] as ItemSkip[], serviceId: null };
  const stmPlan = run('sales-tax') ? await planItems('Sales Tax Monthly', SALES_TAX_MONTHLY_ITEMS) : empty;
  const stqPlan = run('sales-tax') ? await planItems('Sales Tax Quarterly', SALES_TAX_QUARTERLY_ITEMS) : empty;
  if (run('sales-tax')) {
    reportItems('4a', 'Sales Tax Monthly', stmPlan);
    reportItems('4b', 'Sales Tax Quarterly', stqPlan);
  }

  if (REVIEW_ONLY.length) {
    console.log('\n=== Never written by this script — decide by hand ===\n');
    for (const r of REVIEW_ONLY) {
      const amounts =
        r.sheet && r.app
          ? `workbook ${money(r.sheet)} vs app ${money(r.app)}`
          : r.sheet
            ? `workbook ${money(r.sheet)}, nothing in the app`
            : r.app
              ? `app ${money(r.app)}, nothing in the workbook`
              : 'no amount on either side';
      console.log(`  ${r.company} — ${r.service}: ${amounts}`);
      console.log(`      ${r.note}`);
    }
  }

  const writeCount =
    cadencePlan.todo.length + arPlan.todo.length + trPlan.todo.length + stmPlan.todo.length + stqPlan.todo.length;
  if (writeCount === 0) {
    console.log('\nNothing to write.\n');
    await pool.end();
    return;
  }

  if (!isApply) {
    console.log(
      `\n[dry-run] no changes written. Re-run with --apply to write ` +
        `${cadencePlan.todo.length} cadence fix(es) and ` +
        `${arPlan.todo.length + trPlan.todo.length + stmPlan.todo.length + stqPlan.todo.length} bundle line item(s).\n`
    );
    await pool.end();
    return;
  }

  const ok = await confirm(`\nType "yes" to write ${writeCount} change(s): `);
  if (!ok) {
    console.log('Aborted, nothing written.\n');
    await pool.end();
    return;
  }

  // One transaction per stage: a failure in the item stages leaves the cadence
  // fix applied, which is correct on its own and a prerequisite for a re-run.
  if (cadencePlan.todo.length) {
    console.log('\nStage 1 — cadence:');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await applyCadence(client, cadencePlan.todo);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  for (const [label, serviceName, plan] of [
    ['Stage 2 — Annual Report', 'Annual Report', arPlan],
    ['Stage 3 — Tax Returns', 'Tax Returns', trPlan],
    ['Stage 4a — Sales Tax Monthly', 'Sales Tax Monthly', stmPlan],
    ['Stage 4b — Sales Tax Quarterly', 'Sales Tax Quarterly', stqPlan],
  ] as const) {
    if (!plan.todo.length) continue;
    console.log(`\n${label}:`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await applyItems(client, serviceName, plan.todo, today);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone. ${writeCount} change(s) written.`);
  if (arPlan.todo.length || trPlan.todo.length || stmPlan.todo.length || stqPlan.todo.length) {
    console.log(
      'Generate the resulting tickets from the bundle screen, or ' +
        'POST /api/corporate-billing-bundles/generate-tickets with { period: "YYYY-01" }.'
    );
  }
  console.log();
  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
