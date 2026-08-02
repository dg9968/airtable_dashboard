/**
 * Blocks a pipeline ticket from being marked done without a charge recorded.
 *
 * Completing work is supposed to go through POST /api/service-completion,
 * which writes the billing record and the terminal status in one transaction.
 * A bare `PATCH /:id` setting the status directly would bypass billing
 * entirely — that is exactly the leak the billing reconciliation report's
 * "completed-not-billed" check keeps finding. This guard closes it at the
 * source.
 *
 * 'Filed Elsewhere' is deliberately NOT treated as terminal here: it records
 * that the client filed with someone else, so there is genuinely nothing of
 * ours to bill. The reconciliation report makes the same exclusion.
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema';
import { billingRecords } from '../db/schema';
import type { SubscriptionType } from './billing-record';

type Db = NodePgDatabase<typeof schema>;

// Corporate carries a legacy 'Completed' spelling alongside the current
// 'Complete Service' on rows imported from Airtable; both mean done.
const TERMINAL_STATUSES: Record<SubscriptionType, string[]> = {
  corporate: ['Complete Service', 'Completed'],
  personal: ['File Return'],
};

export function isTerminalStatus(subscriptionType: SubscriptionType, status: unknown): boolean {
  return typeof status === 'string' && TERMINAL_STATUSES[subscriptionType].includes(status);
}

/**
 * Returns an error message when the update would mark this ticket done with no
 * billing record attached, or null when the update is allowed. Read-only.
 */
export async function blockUnbilledCompletion(
  db: Db,
  subscriptionType: SubscriptionType,
  ticketId: string,
  status: unknown
): Promise<string | null> {
  if (!isTerminalStatus(subscriptionType, status)) return null;

  const column =
    subscriptionType === 'corporate'
      ? billingRecords.subscriptionCorporateId
      : billingRecords.subscriptionPersonalId;

  const [existing] = await db
    .select({ id: billingRecords.id })
    .from(billingRecords)
    .where(and(eq(column, ticketId), isNotNull(column)))
    .limit(1);

  if (existing) return null;

  return (
    `Refusing to set status "${status}" on a ticket with no billing record — ` +
    `completing work must go through POST /api/service-completion so the ` +
    `charge and the status are recorded together.`
  );
}
