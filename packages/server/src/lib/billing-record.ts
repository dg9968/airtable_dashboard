/**
 * Builds the billing_records row for a completed pipeline ticket.
 *
 * Extracted from routes/services-rendered.ts so that route and the newer
 * routes/service-completion.ts derive the client/service/processor snapshot,
 * the billing status and the amount identically. The two must not drift: one
 * writes the billing record on its own, the other writes it in the same
 * transaction as the ticket's status change, but the resulting row has to be
 * the same either way or the billing reconciliation report starts reporting
 * differences that aren't real.
 *
 * Client/service/processor are stored as text on purpose (see the
 * billing_records comment in db/schema/subscriptions.ts) — they keep reading
 * correctly even if the client or service is renamed later.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema';
import {
  corporatePipelineTickets,
  corporations,
  personal,
  personalPipelineTickets,
  personalServices,
  servicesCorporate,
} from '../db/schema';
import { authUser } from '../db/auth-readonly';
import { WIRE_BILLING_STATUSES } from '../db/serializers-subscriptions';

type Db = NodePgDatabase<typeof schema>;

export type SubscriptionType = 'personal' | 'corporate';

export interface BillingRecordInput {
  subscriptionId: string;
  subscriptionType: SubscriptionType;
  serviceDate: string;
  amountCharged?: number | null;
  notes?: string | null;
  billingStatus?: string | null;
}

/** Shape accepted by `db.insert(billingRecords).values(...)`. */
export interface BillingRecordValues {
  serviceRenderedDate: string;
  billingStatus: string;
  clientName: string;
  serviceType: string;
  processor: string;
  clientType: SubscriptionType;
  subscriptionPersonalId: string | null;
  subscriptionCorporateId: string | null;
  amountCharged: string | null;
  notes: string | null;
}

export class TicketNotFoundError extends Error {
  constructor(subscriptionType: SubscriptionType) {
    super(
      subscriptionType === 'corporate'
        ? 'Pipeline ticket not found in Subscriptions Corporate'
        : 'Pipeline ticket not found in Subscriptions Personal'
    );
    this.name = 'TicketNotFoundError';
  }
}

/**
 * Reads the ticket and its related records, then returns the row to insert.
 * Throws TicketNotFoundError if the ticket doesn't exist, so callers can map
 * that to a 404. Performs no writes — the caller decides the transaction.
 */
export async function buildBillingRecordValues(
  db: Db,
  input: BillingRecordInput
): Promise<BillingRecordValues> {
  const { subscriptionId, subscriptionType, serviceDate, amountCharged, notes, billingStatus } = input;

  let clientName = 'Unknown Client';
  let serviceType = 'Unknown Service';
  let processor = 'Unassigned';
  let bundleItemId: string | null = null;

  // These are deliberately sequential single-row lookups rather than the
  // loadSubs*Context() loaders the routes use elsewhere. Those loaders fetch
  // every corporation, service, user, note, billing record and bundle item to
  // resolve three names, and they do it with Promise.all — which issues
  // concurrent queries on one connection. Inside db.transaction() that is a
  // single client, so the concurrency is unsafe (pg deprecates it and removes
  // it in v9). Three indexed point lookups are both correct and far cheaper.
  if (subscriptionType === 'corporate') {
    const [ticket] = await db
      .select()
      .from(corporatePipelineTickets)
      .where(eq(corporatePipelineTickets.id, subscriptionId))
      .limit(1);
    if (!ticket) throw new TicketNotFoundError('corporate');

    if (ticket.corporationId) {
      const [row] = await db
        .select({ company: corporations.company })
        .from(corporations)
        .where(eq(corporations.id, ticket.corporationId))
        .limit(1);
      clientName = row?.company || clientName;
    }
    if (ticket.serviceId) {
      const [row] = await db
        .select({ name: servicesCorporate.name })
        .from(servicesCorporate)
        .where(eq(servicesCorporate.id, ticket.serviceId))
        .limit(1);
      serviceType = row?.name || serviceType;
    }
    if (ticket.processorId) {
      const [row] = await db
        .select({ name: authUser.name })
        .from(authUser)
        .where(eq(authUser.id, ticket.processorId))
        .limit(1);
      processor = row?.name || processor;
    }
    bundleItemId = ticket.bundleItemId;
  } else {
    const [ticket] = await db
      .select()
      .from(personalPipelineTickets)
      .where(eq(personalPipelineTickets.id, subscriptionId))
      .limit(1);
    if (!ticket) throw new TicketNotFoundError('personal');

    if (ticket.personalId) {
      const [row] = await db
        .select({ firstName: personal.firstName, lastName: personal.lastName })
        .from(personal)
        .where(eq(personal.id, ticket.personalId))
        .limit(1);
      clientName = [row?.firstName, row?.lastName].filter(Boolean).join(' ') || clientName;
    }
    if (ticket.serviceId) {
      const [row] = await db
        .select({ name: personalServices.name })
        .from(personalServices)
        .where(eq(personalServices.id, ticket.serviceId))
        .limit(1);
      serviceType = row?.name || serviceType;
    }
    if (ticket.taxPreparerId) {
      const [row] = await db
        .select({ name: authUser.name })
        .from(authUser)
        .where(eq(authUser.id, ticket.taxPreparerId))
        .limit(1);
      processor = row?.name || processor;
    }
    // Personal clients are billed per service and never get a billing bundle.
  }

  const finalBillingStatus =
    billingStatus && WIRE_BILLING_STATUSES.includes(billingStatus)
      ? billingStatus
      : bundleItemId
        ? 'Covered by Bundle'
        : 'Unbilled';
  // Bundle-covered work is never charged standalone — the bundle's recurring
  // total already accounts for it.
  const finalAmount = finalBillingStatus === 'Covered by Bundle' ? null : amountCharged ?? null;

  return {
    serviceRenderedDate: serviceDate.split('T')[0],
    billingStatus: finalBillingStatus,
    clientName,
    serviceType,
    processor,
    clientType: subscriptionType,
    subscriptionPersonalId: subscriptionType === 'personal' ? subscriptionId : null,
    subscriptionCorporateId: subscriptionType === 'corporate' ? subscriptionId : null,
    amountCharged: finalAmount != null ? String(finalAmount) : null,
    notes: notes || null,
  };
}
