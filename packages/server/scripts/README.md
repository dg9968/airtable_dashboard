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
(not run directly — it's a library, not a script).

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
Deletes open `corporate_pipeline_tickets` rows for a given service older than
a given age (default 10 days) — for when a batch of tickets is being manually
replaced by a fresh batch and the stale ones would otherwise sit open
forever. If `--service` isn't passed, prompts interactively with a numbered
list of every service that currently has at least one corporate pipeline
ticket. "Open" matches `open-tickets-dashboard.ts`: status is NULL or not the
corporate terminal status (`Complete Service`). `corporate_pipeline_notes` has
`ON DELETE SET NULL` on its ticket FK and `billing_records` has no FK at all,
so deleting a ticket never cascades or fails. Each row deletes in its own
transaction; `--apply` requires typing `yes` at a single confirmation prompt.

```
bun run packages/server/scripts/cleanup-stale-tickets.ts                     # prompts for service, report only, >10 days
bun run packages/server/scripts/cleanup-stale-tickets.ts --apply
bun run packages/server/scripts/cleanup-stale-tickets.ts --service="Payroll" --days=10 --apply
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
