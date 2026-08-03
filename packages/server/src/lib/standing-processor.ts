/**
 * Keeps a bundle line item's standing assignee in step with the tickets it
 * generates.
 *
 * `corporate_billing_bundle_items.processor_id` is the durable "who does this
 * recurring work for this client" — for Bookkeeping Clients, the client's
 * bookkeeper. generate-tickets copies it onto every ticket it creates, so
 * without a write-back, reassigning a ticket would silently revert next
 * period. Routing every reassignment through here means there is one action to
 * change a bookkeeper, not two.
 *
 * Deliberately narrow about which line items it touches. It writes back only
 * when the line item genuinely has a standing-assignee relationship:
 *
 *   - its service is in SERVICES_REQUIRING_PROCESSOR (bookkeeping), or
 *   - it already carries a processor, i.e. someone opted this line in.
 *
 * Everything else keeps today's behaviour, where reassigning a ticket is a
 * one-off (covering a holiday, balancing a week's load) and must not quietly
 * rewrite a standing arrangement.
 *
 * Clearing a ticket's processor clears the standing one too, symmetrically —
 * for a service that requires an assignee that leaves the next period blocked
 * until someone is chosen, which is the intended signal rather than a silent
 * fallback to whoever happened to hold it before.
 */

import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema';
import {
  corporateBillingBundleItems,
  corporatePipelineTickets,
  servicesCorporate,
} from '../db/schema';
import { requiresProcessor } from './billing-cadence';

/**
 * Point the standing processor of every eligible bundle line item behind these
 * tickets at `processorId`. Returns how many line items were updated.
 */
export async function syncStandingProcessor(
  db: NodePgDatabase<typeof schema>,
  ticketIds: string[],
  processorId: string | null
): Promise<number> {
  if (ticketIds.length === 0) return 0;

  const rows = await db
    .select({
      itemId: corporateBillingBundleItems.id,
      itemProcessorId: corporateBillingBundleItems.processorId,
      serviceName: servicesCorporate.name,
    })
    .from(corporatePipelineTickets)
    .innerJoin(
      corporateBillingBundleItems,
      eq(corporatePipelineTickets.bundleItemId, corporateBillingBundleItems.id)
    )
    .leftJoin(servicesCorporate, eq(corporateBillingBundleItems.serviceId, servicesCorporate.id))
    .where(inArray(corporatePipelineTickets.id, ticketIds));

  const targets = [
    ...new Set(
      rows
        .filter((r) => requiresProcessor(r.serviceName) || r.itemProcessorId != null)
        .filter((r) => r.itemProcessorId !== processorId) // already correct: skip
        .map((r) => r.itemId)
    ),
  ];

  if (targets.length === 0) return 0;

  await db
    .update(corporateBillingBundleItems)
    .set({ processorId })
    .where(inArray(corporateBillingBundleItems.id, targets));

  return targets.length;
}
