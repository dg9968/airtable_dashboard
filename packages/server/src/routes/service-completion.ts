/**
 * POST /api/service-completion
 *
 * Completes a pipeline ticket: records the charge and moves the ticket to its
 * terminal status, in ONE transaction.
 *
 * Previously the browser did this as two independent requests — POST
 * /api/services-rendered, then PATCH the ticket's status — and the second was
 * explicitly non-fatal, so a failure between them left work marked done with
 * no charge recorded, or a charge with the ticket still sitting open. The
 * billing reconciliation report exists partly to find the first case after the
 * fact; this route makes it impossible in the first place.
 *
 * Paired with the terminal-status guard in subscriptions-corporate.ts /
 * subscriptions-personal.ts, which rejects a bare status PATCH to a terminal
 * value when no billing record exists, so this route is the only way to
 * complete work.
 *
 * Note this is the first use of db.transaction() in the codebase.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { billingRecords, corporatePipelineTickets, personalPipelineTickets } from '../db/schema';
import { billingRecordToAirtableRecord } from '../db/serializers-subscriptions';
import {
  buildBillingRecordValues,
  TicketNotFoundError,
  type SubscriptionType,
} from '../lib/billing-record';

const app = new Hono();

// The status each pipeline lands on once its work is done. Corporate also has
// a legacy 'Completed' spelling on older rows, but new completions always
// write the current value.
const TERMINAL_STATUS: Record<SubscriptionType, string> = {
  corporate: 'Complete Service',
  personal: 'File Return',
};

app.post('/', async (c) => {
  try {
    const { subscriptionId, subscriptionType, serviceDate, amountCharged, notes, billingStatus } =
      await c.req.json();

    if (!subscriptionId || !subscriptionType || !serviceDate) {
      return c.json(
        { success: false, error: 'Missing required fields: subscriptionId, subscriptionType, serviceDate' },
        400
      );
    }
    if (subscriptionType !== 'personal' && subscriptionType !== 'corporate') {
      return c.json({ success: false, error: 'subscriptionType must be "personal" or "corporate"' }, 400);
    }

    const db = getDb();

    let result;
    try {
      result = await db.transaction(async (tx) => {
        // Reads the ticket and throws TicketNotFoundError if it's gone, so a
        // bad id aborts before anything is written.
        const values = await buildBillingRecordValues(tx, {
          subscriptionId,
          subscriptionType,
          serviceDate,
          amountCharged,
          notes,
          billingStatus,
        });

        const [record] = await tx.insert(billingRecords).values(values).returning();

        const status = TERMINAL_STATUS[subscriptionType as SubscriptionType];
        if (subscriptionType === 'corporate') {
          await tx
            .update(corporatePipelineTickets)
            .set({ status })
            .where(eq(corporatePipelineTickets.id, subscriptionId));
        } else {
          await tx
            .update(personalPipelineTickets)
            .set({ status })
            .where(eq(personalPipelineTickets.id, subscriptionId));
        }

        return { record, status };
      });
    } catch (err) {
      if (err instanceof TicketNotFoundError) {
        return c.json({ success: false, error: err.message }, 404);
      }
      throw err;
    }

    const serialized = billingRecordToAirtableRecord(result.record);
    return c.json({
      success: true,
      data: {
        billingRecord: {
          id: serialized.id,
          fields: serialized.fields,
          createdTime: serialized.createdTime,
        },
        ticket: { id: subscriptionId, status: result.status },
      },
    });
  } catch (error) {
    console.error('POST /api/service-completion error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete service',
      },
      500
    );
  }
});

export default app;
