# packages/server/scripts

One-off and maintenance scripts that run against `DATABASE_URL` (from
`packages/server/.env`) outside the API server. Run everything with `bun run`
from the repo root unless noted otherwise.

Convention shared by the data-maintenance scripts below: **dry run by
default** (full report, zero writes), pass `--apply` to actually write. Each
unit of work runs in its own transaction, so a failure partway through never
leaves a half-merged record. `migrate-to-billing-bundles.ts` is the one
exception — read its section before running it.

## Database migrations

### `db-migrate.ts`
Applies pending Drizzle migrations from `./drizzle` to `DATABASE_URL`. This is
what `bun run db:migrate` (from `packages/server`) actually runs — a
journal-compatible replacement for `drizzle-kit migrate`, whose CLI spinner
swallows error output on Windows. Uses the same bookkeeping table
(`drizzle.__drizzle_migrations`) so it's interchangeable with the real CLI.

```
bun run db:migrate          # from packages/server
```

Never use `drizzle-kit push` instead — the same database also holds Better
Auth tables owned by `packages/client/scripts/run-migrations.ts`.

## Corporation data-maintenance scripts

These three share repoint/scoring helpers from `lib/corporation-merge-helpers.ts`
(not run directly — it's a library, not a script). `cleanup-stale-tickets.ts`
and `reassign-tickets.ts` likewise share `lib/selection.ts`, which parses the
numbered-list answers both of them accept (`1,3-5` / `all`).

### `dedupe-corporations.ts`
Finds `corporations` rows duplicated by EIN (normalized to digits-only, so
`"39-4567263"` and `"394567263"` match) and merges each group into one row.
Only auto-merges when company names also match after normalization — anything
else is reported as `NEEDS REVIEW` and never merged, even with `--apply`.
Skips a group if keeper and loser both have an active billing bundle.

Repoints every FK-linked table (pipeline tickets, billing bundles, contacts,
sales tax certificates, signing envelopes, communications) to the keeper, and
rewrites `documents.client_code` from loser to keeper (that link is a plain
text column, not a FK, so it needs its own UPDATE). Then deletes the loser row.

```
bun run packages/server/scripts/dedupe-corporations.ts                     # report only
bun run packages/server/scripts/dedupe-corporations.ts --apply             # y/n prompt per group, writes confirmed ones
bun run packages/server/scripts/dedupe-corporations.ts --apply --only=EIN1,EIN2,recABC123
```

`--only` restricts which groups are even eligible (matched against the
normalized EIN or any row's corporation id); everything else still shows in
the report but is marked skipped. With `--apply`, every eligible group still
gets an interactive `Merge this group? [y/N]` prompt before anything is
written — nothing merges without an explicit `y`.

### `consolidate-multilocation-corporations.ts`
Folds back 4 specific, human-confirmed `corporations` pairs that were
duplicated as a UI workaround (a company with multiple physical locations
needs one `sales_tax_certificates` row + one `corporate_pipeline_tickets` row
per location; staff used to create a whole second corporation row to get a
second ticket path before `certificate_id` existed). Unlike
`dedupe-corporations.ts`, the pair list is **hardcoded** in the script
(`PAIRS`), not re-derived — this is a one-time cleanup, not a repeatable check.

Per pair: picks a keeper the same way `dedupe-corporations.ts` does (richer
related-row count wins, oldest breaks ties), backfills the loser's single
sales-tax certificate with the loser's address and repoints its tickets'
`certificate_id` to it, repoints all other FK tables + `documents.client_code`,
appends "Also operates as: {loser name}" to the keeper's notes, then deletes
the loser. Skipped on active-bundle conflict, same as dedupe.

```
bun run packages/server/scripts/consolidate-multilocation-corporations.ts           # report only
bun run packages/server/scripts/consolidate-multilocation-corporations.ts --apply   # write changes
```

### `cleanup-stale-tickets.ts`
Deletes open `corporate_pipeline_tickets` rows older than a given age (default
10 days) — for when a batch of tickets is being manually replaced by a fresh
batch and the stale ones would otherwise sit open forever. Two ways to choose
what to delete:

- **By service, across every customer** — `--service="Payroll"`, or several at
  once with `--service="Payroll,Bookkeeping Clients"`. Without `--service`,
  prompts with a numbered list of every service that currently has at least one
  corporate pipeline ticket, and takes a single choice.
- **Scoped to one customer** — `--company="NOE USA"` (or `--company-id=rec...`,
  or a bare `--company` to pick the customer from a numbered list of those with
  open tickets). Without `--service`, prompts with a numbered list of just that
  customer's services, each showing its open-ticket count and how many pass the
  age filter, and accepts a **multi-select** (`1,3-5` or `all`) — the "clean up
  everything we have open for this client" case. `--all-services` skips the
  prompt and takes all of them.

The multi-select is only offered when scoped to a customer; without one it
stays a single choice, since deleting a service's tickets across every customer
is a much broader action to widen by accident. An ambiguous `--company` lists
the candidates and exits rather than guessing which client was meant.

The age filter applies in **both** modes, so scoping to a customer does not by
itself mean "every ticket regardless of age" — pass `--days=0` for that. When
the age filter is what's hiding rows, the report says how many were excluded
instead of just printing "Nothing to do".

"Open" matches `open-tickets-dashboard.ts`: status is NULL or not the corporate
terminal status (`Complete Service`). `corporate_pipeline_notes` has
`ON DELETE SET NULL` on its ticket FK and `billing_records` has no FK at all,
so deleting a ticket never cascades or fails. Each row deletes in its own
transaction; `--apply` requires typing `yes` at a single confirmation prompt.

```
bun run packages/server/scripts/cleanup-stale-tickets.ts                       # prompts for service, report only, >10 days
bun run packages/server/scripts/cleanup-stale-tickets.ts --apply
bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll" --days=10 --apply
bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll,Extensions"
bun run packages/server/scripts/cleanup-stale-tickets.ts --company="NOE USA" --days=0            # pick services interactively
bun run packages/server/scripts/cleanup-stale-tickets.ts --company                                # pick the customer too
bun run packages/server/scripts/cleanup-stale-tickets.ts --company="NOE USA" --all-services --days=0 --apply
```

### `backfill-extension-followups.ts`
Finds every `corporate_pipeline_tickets` / `personal_pipeline_tickets` row
with `extension_status = 'Filed'` and no linked follow-up ticket yet, and
creates one via `ensureCorporateExtensionFollowUp` /
`ensurePersonalExtensionFollowUp` (`../src/lib/extension-followup.ts`) — the
same logic the live `PATCH /api/extensions[-personal]` routes run when an
extension is marked Filed, so results are identical either way. Needed
because that auto-linking only fires on a fresh PATCH; extensions already
marked Filed before the feature shipped never got one. Each ticket's
follow-up creation runs in its own transaction; `--apply` requires typing
`yes` at a single confirmation prompt.

```
bun run packages/server/scripts/backfill-extension-followups.ts             # dry run
bun run packages/server/scripts/backfill-extension-followups.ts --apply
```

### `normalize-legacy-billing-statuses.ts`
Rewrites legacy `billing_records.billing_status` values to their current
equivalent, driven by a `LEGACY_STATUS_MAP` constant at the top of the file
(currently just `'Part of Subscription'` -> `'Covered by Bundle'`, the one
vocabulary change noted on `WIRE_BILLING_STATUSES` in
`src/db/serializers-subscriptions.ts`). Not cosmetic:
`BillingStatusBadge.tsx` falls back to `statusConfig['Unbilled']` for any
unrecognized status, so legacy-valued rows render to staff as "Unbilled" —
bundle-covered work that looks like it still needs invoicing — and the
billing page's status dropdown has no option to filter to them. Rows whose
`amount_charged` is non-zero are reported as `NEEDS REVIEW` and never
rewritten by default, since a bundle-covered charge should be $0 — pass
`--clear-amounts` to rewrite those too and zero the amount, which is only
correct once someone has confirmed the amount was a data-entry mistake rather
than the status being wrong. Writes run in one transaction, and every
affected row id is printed so the run output doubles as a reversal record.

Ran 2026-08-02: 91 rows rewritten, then the 2 flagged rows rewritten with
`--clear-amounts` after confirming their $45.00/$45.01 amounts were entered by
mistake. No `Part of Subscription` rows remain.

```
bun run packages/server/scripts/normalize-legacy-billing-statuses.ts                          # dry run
bun run packages/server/scripts/normalize-legacy-billing-statuses.ts --apply
bun run packages/server/scripts/normalize-legacy-billing-statuses.ts --clear-amounts --apply  # also zero mistaken amounts
```

### `backfill-bundle-accrual-items.ts`
Reconciles `corporate_billing_bundles` against "Presupuesto para Airtable.xlsm",
the budget workbook staff maintain by hand, in three independently selectable
stages (`--stage=cadence,annual-report,tax-returns`, all by default):

1. **cadence** — fixes `services_corporate.billing_cycle` values that make
   ticket generation behave wrongly. `Annual Report` is `'One-time'`, for which
   `isFilingMonth()` ([../src/lib/billing-cadence.ts](../src/lib/billing-cadence.ts))
   returns false in *every* month, so its January ticket is never generated;
   `1099 Filing`, `Registered Agent` and `Quickbooks Software` are NULL and
   `Vault Management` and `PO Box - 1414` are `'Monthly'`, all of which produce
   twelve tickets a year for work that happens once. Cadence controls ticket
   generation only, never billing — the dollar amounts on all affected bundle
   line items are untouched and keep charging monthly.
2. **annual-report** — adds the missing $4.25/mo `Annual Report` line item to
   25 bundles.
3. **tax-returns** — adds the missing `Tax Returns` line item ($50/$70/$90 per
   client) to 13 bundles.
4. **sales-tax** — adds the missing `Sales Tax Monthly` (8 bundles) /
   `Sales Tax Quarterly` (2 bundles) line item.

Stages 2 and 3 add **accruals**: a bundle line item's amount is billed every
month, while ticket generation is gated separately by the service's
`billing_cycle`. An Annual-cadence line item means "the client pays toward this
all year, and one ticket generates each January." What that January ticket is
*for* varies by service — a return filed against the prior tax year, a renewal
for the year starting, or a contract renegotiation — so its note text comes
from `ANNUAL_NOTE_BY_SERVICE` in
[../src/lib/billing-cadence.ts](../src/lib/billing-cadence.ts) rather than from
the cadence alone. **Add a service there whenever you set it to `Annual`**, or
it inherits the "Covers tax year N-1" wording that only suits the filing pair.

Stage 1 is a hard prerequisite for stage 2 and the script enforces it — adding
$4.25/mo while `Annual Report` is still `'One-time'` would bill 25 clients for
work that could never be ticketed. Running stage 2 without stage 1 reports
`BLOCKED` and writes nothing; running them together (the default) satisfies it,
and a dry run previews the combined result.

Sales tax is billed per filing, so the monthly accrual encodes the client's
filing frequency: $540/yr → **$45.00/mo** is a monthly filer (12 × $45), $180/yr
→ **$15.00/mo** is a quarterly filer (4 × $45). The workbook titles the column
"Monthly Sales Tax" for both, which is what hid two quarterly filers (Hedman,
Yoni) behind the monthly service — Yoni's bundle still carries a removed
`Sales Tax Monthly` item. Stage 4 therefore picks the service from
`sales_tax_certificates.frequency`, not from the column title, and multi-location
clients (Autoclub, General Distributors — two certificates each) accrue
certificate count × $45. Before writing, it re-derives both the count and the
frequency from the live table and reports `NEEDS REVIEW` instead of writing if
either contradicts the planned amount or service.

The per-client lists are **hardcoded** in the script, like
`consolidate-multilocation-corporations.ts`'s `PAIRS` — a one-time human-confirmed
reconciliation against one version of a spreadsheet, not a repeatable check.
Purely additive: only INSERTs line items and UPDATEs the service catalog's
`billing_cycle`; never edits an existing amount, deletes, or touches tickets or
`billing_records`. Every row is re-verified against live DB state before writing,
so it's safe to re-run and safe after someone fixes some by hand — clients are
skipped and reported if the bundle is no longer active, the item already exists,
or the service was previously soft-removed from that bundle. Amount conflicts
(NECESS-IT, Douglas Castellano, Integrity) are reported as `NEEDS REVIEW` and
never written in either direction. Each stage runs in its own transaction and
every inserted row id is printed, so the output doubles as a reversal record.

After applying, generate the resulting tickets from the bundle screen or
`POST /api/corporate-billing-bundles/generate-tickets` with `{ period: "YYYY-01" }`.

```
bun run packages/server/scripts/backfill-bundle-accrual-items.ts                          # dry run, all stages
bun run packages/server/scripts/backfill-bundle-accrual-items.ts --apply
bun run packages/server/scripts/backfill-bundle-accrual-items.ts --stage=cadence --apply
bun run packages/server/scripts/backfill-bundle-accrual-items.ts --stage=tax-returns --apply
bun run packages/server/scripts/backfill-bundle-accrual-items.ts --stage=sales-tax --apply
```

### `merge-corporate-services.ts`
Merges duplicate `services_corporate` catalog rows: repoints everything that
references the loser at the keeper, then deletes the loser. The pair list is
**hardcoded** in `MERGES`, like `consolidate-multilocation-corporations.ts`'s
`PAIRS` — whether two catalog entries were ever really different services is a
human judgement, not something to re-derive by name matching.

Repoints `corporate_pipeline_tickets.service_id` (FK, `ON DELETE SET NULL`),
`corporate_billing_bundle_items.service_id` (FK, `ON DELETE RESTRICT` — so the
loser genuinely cannot be deleted until these move), and
`billing_records.service_type`. That last one is a stored text label rather
than an FK, kept as text by design so it survives a rename — but a *merge*
means both labels were always the same service, and leaving the old string
would orphan those records from the catalog, so it is rewritten too.

**Refuses on collision.** `corporate_billing_bundle_items` has a partial unique
index on `(bundle_id, service_id) WHERE status = 'active'`, so a bundle holding
an *active* line item for both services would break on repoint — and which
amount survives is a billing decision. Those bundles are reported and the merge
stops before writing. One active + one soft-removed is fine, since the index
only covers active rows. It also refuses if the loser carries catalog fields
(`price`/`description`/`category`/`billing_cycle`) the keeper lacks, rather than
discarding them with the row. The whole merge runs in one transaction and every
repointed row id is printed, so the output is a reversal record.

Note the code side is **not** automatic: service names are matched exactly in
places like `CorporateClientIntake`'s hardcoded service list, which fails with
"service not found in Services Corporate table" if left stale. Grep for the
loser's name and fix those *before* applying.

Ran 2026-08-03 for `Bookkeeping` → `Bookkeeping Clients`: 4 tickets, 3 line
items and 1 billing record repointed, 1 catalog row deleted. That duplicate was
why the lone `Bookkeeping` bundle generated an *unassigned* bookkeeping ticket —
`SERVICES_REQUIRING_PROCESSOR` only listed `Bookkeeping Clients`, so the rule
never saw it. It also removed the long-standing ambiguity where the legacy view
named "Bookkeeping" selects the service "Bookkeeping Clients" while a separate
service literally named "Bookkeeping" also existed.

```
bun run packages/server/scripts/merge-corporate-services.ts             # dry run
bun run packages/server/scripts/merge-corporate-services.ts --apply
```

### `reassign-tickets.ts`
Reassigns the Processor on specific `corporate_pipeline_tickets` rows — e.g.
filling in a freshly-recreated batch of tickets after a
`cleanup-stale-tickets.ts` run, or moving a handful of one processor's open
tickets to someone else. Writes `processor_id` directly via Drizzle,
**bypassing `PATCH /api/subscriptions-corporate/:id` entirely** — that route
is the only place the "you've been assigned" email
([notify-processor-assigned.ts](../src/lib/notify-processor-assigned.ts)) is
wired in, so this never emails anyone, no matter how many tickets.

Pick exactly one way to select which tickets to touch:
- `--ids=id1,id2,...` — reassign exactly these rows, no service needed.
- `--service="X" --all` — every open ticket for service X (explicit opt-in;
  there's no bare default that reassigns a whole service, since blanket
  "reassign everything to one processor" is rarely what you actually want).
- `--service="X"` alone — lists that service's open tickets numbered and
  prompts which ones to touch (comma list and/or ranges, e.g. `1,3-5`, or
  `all`).
- neither flag — prompts for a service first, then the picker above.

If `--processor` isn't passed, prompts interactively (list matches
`GET /api/teams`). Tickets already on the target processor are reported but
skipped as no-ops. Each row updates in its own transaction; `--apply`
requires typing `yes`.

```
bun run packages/server/scripts/reassign-tickets.ts --ids=rec1,rec2 --processor="Jane Doe" --apply
bun run packages/server/scripts/reassign-tickets.ts --service="Payroll"                       # pick tickets + processor, report only
bun run packages/server/scripts/reassign-tickets.ts --service="Payroll" --all --processor="Jane Doe" --apply
```

### `migrate-to-billing-bundles.ts`
⚠️ **Default is live-write, not dry-run** — pass `--dry-run` to preview instead.

One-time carry-forward for the billing/bookkeeping redesign: for every
`corporate_pipeline_tickets` row still carrying a legacy `billing_amount`,
creates or reuses that corporation's recurring billing bundle + a bundle line
item for the amount, then points the ticket's `bundle_item_id` at it. Purely
additive — never deletes or mutates `billing_amount` (that column is dropped
in a later migration once this carry-forward is confirmed complete). Idempotent:
tickets that already have a `bundle_item_id` are skipped, so re-running is safe.

```
bun run packages/server/scripts/migrate-to-billing-bundles.ts             # writes immediately
bun run packages/server/scripts/migrate-to-billing-bundles.ts --dry-run   # preview only
```

## ETL (historical — Airtable → Postgres migration, complete)

`etl/phase1-catalogs.ts` through `etl/phase6-sales-tax-certificates.ts`, plus
shared toolkit `etl/lib.ts`. Each phase migrated one domain from Airtable to
its Postgres table, upserting on the preserved Airtable `rec...` ID as primary
key, so every phase is idempotent and safe to re-run. All 6 phases are
complete and the server has zero Airtable SDK dependencies at runtime; these
are kept only in case a corrective re-import is ever needed.

| Script | Domain |
|---|---|
| `phase1-catalogs.ts` | Personal/Corporate services, message + signing templates, knowledge base |
| `phase2-entities.ts` | Personal, Corporations, Company Contacts (+ client-code duplicate report) |
| `phase3-subscriptions.ts` | Subscriptions (personal/corporate), Services Rendered, Ledger, pipeline/billing notes |
| `phase4-documents-notices.ts` | Documents (metadata only — binaries stay in Google Drive), Tax Notices + notes/attachments |
| `phase5-comms-envelopes.ts` | Messages, Communications Corporate, Signing Envelopes |
| `phase6-sales-tax-certificates.ts` | Sales Tax Certificate Info (late addition, discovered while retiring Airtable) |

```
bun run packages/server/scripts/etl/phaseN-*.ts [--dry-run]
```

Requires `AIRTABLE_PERSONAL_ACCESS_TOKEN` / `AIRTABLE_BASE_ID` in the
environment (no longer needed at runtime by the app itself — only by these
scripts).

## Testing

### `smoke.ts`
No test framework — hits a list of GET endpoints against a running server and
asserts status 200 + expected response keys/shape. Exits 1 on any failure.
Grows with each migration phase.

```
bun run scripts/smoke.ts                          # against http://localhost:3001
bun run scripts/smoke.ts https://vault-api.onrender.com
```

## Utilities

### `inspect-pdf-fields.ts`
Lists every AcroForm field name in a PDF, for mapping IRS form fields when
building fillable-PDF generation.

```
bun run scripts/inspect-pdf-fields.ts <path-to-pdf>
```

## Stale / likely broken

These predate the Postgres migration and reference things that no longer
exist. Kept for reference, not expected to run as-is — check before using.

- **`setup-auth.js`** — creates/updates an admin user in an Airtable "Users"
  table via `require('airtable')`. Auth is now Better Auth backed by Postgres
  (see root `CLAUDE.md`); this script has no bearing on the current auth
  system.
- **`create-exact-qbo.js`**, **`fix-qbo-format.js`**, **`process-wells-fargo.js`**
  — ad hoc Wells Fargo bank-statement → QBO/IIF conversion scripts with
  hardcoded paths into a `Wells Fargo Doc converter/` directory that no longer
  exists in the repo. One-off fixups from a specific historical data-correction
  task, not general-purpose tools.
