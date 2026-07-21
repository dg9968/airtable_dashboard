/**
 * One-time data-carry script for the billing/bookkeeping redesign (phase 1).
 *
 * For every subscriptions_corporate row (a "corporate pipeline ticket") that
 * still carries a legacy billing_amount, this creates or reuses that
 * corporation's recurring billing bundle and a bundle line item carrying the
 * amount, then points the ticket's bundle_item_id at it. This is a
 * mechanical, lossless carry-forward — not the deeper judgment-call cleanup
 * (deduping tickets, deciding which historical rows "really" represent
 * recurring vs. one-off relationships), which is explicitly a phase 2 task.
 * Without this step, the dashboard and Bookkeeping Billing report would
 * regress to $0 the moment billing_amount stops being read by app code.
 *
 * Idempotent: tickets that already have a bundle_item_id are skipped, so
 * re-running is always safe. Purely additive — never deletes or mutates
 * billing_amount (that column is dropped in a later migration, once this
 * carry-forward is confirmed complete).
 *
 * Usage: bun run packages/server/scripts/migrate-to-billing-bundles.ts [--dry-run]
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNotNull } from 'drizzle-orm';
import * as schema from '../src/db/schema';

config({ path: resolve(__dirname, '../.env') });

const isDryRun = process.argv.includes('--dry-run');

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

const { corporatePipelineTickets, corporateBillingBundles, corporateBillingBundleItems } = schema;

async function main() {
  const tickets = await db
    .select()
    .from(corporatePipelineTickets)
    .where(isNotNull(corporatePipelineTickets.billingAmount));

  console.log(`Found ${tickets.length} corporate pipeline tickets with a legacy billing amount.`);

  const bundleByCorp = new Map<string, string>();
  let bundlesCreated = 0;
  let itemsCreated = 0;
  let itemsReused = 0;
  let ticketsLinked = 0;
  let ticketsSkippedAlreadyLinked = 0;
  let ticketsSkippedMissingRefs = 0;

  for (const ticket of tickets) {
    if (ticket.bundleItemId) {
      ticketsSkippedAlreadyLinked++;
      continue;
    }
    if (!ticket.corporationId || !ticket.serviceId) {
      console.warn(`  skip ${ticket.id}: missing corporationId or serviceId`);
      ticketsSkippedMissingRefs++;
      continue;
    }

    let bundleId = bundleByCorp.get(ticket.corporationId);
    if (!bundleId) {
      const [existing] = await db
        .select({ id: corporateBillingBundles.id })
        .from(corporateBillingBundles)
        .where(
          and(
            eq(corporateBillingBundles.corporationId, ticket.corporationId),
            eq(corporateBillingBundles.status, 'active')
          )
        )
        .limit(1);

      if (existing) {
        bundleId = existing.id;
      } else if (isDryRun) {
        console.log(`  [dry-run] would create bundle for corporation ${ticket.corporationId}`);
        bundleId = `dry-run-bundle-${ticket.corporationId}`;
        bundlesCreated++;
      } else {
        const [created] = await db
          .insert(corporateBillingBundles)
          .values({ corporationId: ticket.corporationId, billingCycle: 'monthly' })
          .returning({ id: corporateBillingBundles.id });
        bundleId = created.id;
        bundlesCreated++;
      }
      bundleByCorp.set(ticket.corporationId, bundleId);
    }

    const [existingItem] = await db
      .select({ id: corporateBillingBundleItems.id })
      .from(corporateBillingBundleItems)
      .where(
        and(
          eq(corporateBillingBundleItems.bundleId, bundleId),
          eq(corporateBillingBundleItems.serviceId, ticket.serviceId),
          eq(corporateBillingBundleItems.status, 'active')
        )
      )
      .limit(1);

    let itemId: string;
    if (existingItem) {
      // Another ticket for the same client already created an active line
      // item for this service (duplicate/overlapping historical tickets) —
      // link this ticket to that item rather than violating the
      // one-active-line-per-service constraint. Reconciling which amount is
      // authoritative across duplicates is a phase 2 concern.
      itemId = existingItem.id;
      itemsReused++;
    } else if (isDryRun) {
      console.log(
        `  [dry-run] would create bundle item: corp=${ticket.corporationId} service=${ticket.serviceId} amount=${ticket.billingAmount}`
      );
      itemId = `dry-run-item-${ticket.id}`;
      itemsCreated++;
    } else {
      const [created] = await db
        .insert(corporateBillingBundleItems)
        .values({ bundleId, serviceId: ticket.serviceId, amount: ticket.billingAmount! })
        .returning({ id: corporateBillingBundleItems.id });
      itemId = created.id;
      itemsCreated++;
    }

    if (!isDryRun) {
      await db
        .update(corporatePipelineTickets)
        .set({ bundleItemId: itemId })
        .where(eq(corporatePipelineTickets.id, ticket.id));
    }
    ticketsLinked++;
  }

  console.log('\n========== BUNDLE BACKFILL REPORT ==========');
  console.log(`tickets with legacy billing_amount        : ${tickets.length}`);
  console.log(`  already linked (idempotent skip)         : ${ticketsSkippedAlreadyLinked}`);
  console.log(`  skipped (missing corporation/service)    : ${ticketsSkippedMissingRefs}`);
  console.log(`  linked this run                          : ${ticketsLinked}${isDryRun ? ' (dry-run)' : ''}`);
  console.log(`bundles created                            : ${bundlesCreated}`);
  console.log(`bundle line items created                  : ${itemsCreated}`);
  console.log(`bundle line items reused (duplicate ticket) : ${itemsReused}`);
  console.log('=============================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Bundle backfill failed:', err);
  process.exit(1);
});
