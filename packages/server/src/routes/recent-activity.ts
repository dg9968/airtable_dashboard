/**
 * GET /api/recent-activity
 *
 * Merged timeline for the Business Management hub's "Recent Business
 * Activity" panel. Takes each of the 3 sources' top 5 independently and only
 * then interleaves them by timestamp, so a quiet source (e.g. new clients,
 * which sign up far less often than work gets billed) still shows up instead
 * of being crowded out of a single pooled top-15.
 *
 * Every business table only has created_at (no updated_at anywhere except
 * staff_directory), so this only surfaces events that a created_at can
 * actually prove happened:
 *
 *   - New clients        — corporations / personal insert
 *   - Work completed      — a billing_records row insert. service-completion.ts
 *                            is documented as "the only way to complete
 *                            work" and inserts the billing record and flips
 *                            the pipeline ticket to its terminal status in
 *                            ONE transaction — so "ticket completed" and
 *                            "bill created" are the same event here, not two.
 *   - Payment received    — a billing_records row reaching billing_status
 *                            'Billed - Paid', dated by its receipt_date. This
 *                            is a genuinely later event than the row's
 *                            created_at (rows are typically created Unbilled,
 *                            then patched when payment lands), but there's no
 *                            timestamp column for the patch itself — only the
 *                            business-entered receipt_date, which has no
 *                            time-of-day component.
 */

import { Hono } from 'hono';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporations, personal, billingRecords } from '../db/schema';

const app = new Hono();

// Each of the 3 conceptual sources (new clients, work completed, payments
// received) contributes its own top N, so a quiet source still shows
// something instead of being crowded out by a busier one. "New clients" is
// itself two DB queries (corporations + personal) merged before this cap is
// applied, since it's one source, not two.
const PER_SOURCE_LIMIT = 5;

type ActivityEvent =
  | {
      type: 'new_client';
      id: string;
      timestamp: string;
      clientName: string;
      clientType: 'corporate' | 'personal';
    }
  | {
      type: 'work_completed';
      id: string;
      timestamp: string;
      clientName: string | null;
      serviceType: string | null;
      billingStatus: string | null;
      amountCharged: number | null;
    }
  | {
      type: 'payment_received';
      id: string;
      timestamp: string;
      clientName: string | null;
      amountCharged: number | null;
    };

app.get('/', async (c) => {
  try {
    const db = getDb();

    const [newCorporate, newPersonal, workCompleted, paymentsReceived] = await Promise.all([
      db
        .select({ id: corporations.id, company: corporations.company, createdAt: corporations.createdAt })
        .from(corporations)
        .orderBy(desc(corporations.createdAt))
        .limit(PER_SOURCE_LIMIT),
      db
        .select({
          id: personal.id,
          firstName: personal.firstName,
          lastName: personal.lastName,
          createdAt: personal.createdAt,
        })
        .from(personal)
        .orderBy(desc(personal.createdAt))
        .limit(PER_SOURCE_LIMIT),
      db
        .select({
          id: billingRecords.id,
          clientName: billingRecords.clientName,
          serviceType: billingRecords.serviceType,
          billingStatus: billingRecords.billingStatus,
          amountCharged: billingRecords.amountCharged,
          createdAt: billingRecords.createdAt,
        })
        .from(billingRecords)
        .orderBy(desc(billingRecords.createdAt))
        .limit(PER_SOURCE_LIMIT),
      db
        .select({
          id: billingRecords.id,
          clientName: billingRecords.clientName,
          amountCharged: billingRecords.amountCharged,
          receiptDate: billingRecords.receiptDate,
        })
        .from(billingRecords)
        .where(and(eq(billingRecords.billingStatus, 'Billed - Paid'), isNotNull(billingRecords.receiptDate)))
        .orderBy(desc(billingRecords.receiptDate))
        .limit(PER_SOURCE_LIMIT),
    ]);

    const byRecency = (a: ActivityEvent, b: ActivityEvent) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

    const newClientEvents: ActivityEvent[] = [
      ...newCorporate.map((r): ActivityEvent => ({
        type: 'new_client',
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        clientName: r.company?.trim() || 'Unnamed business',
        clientType: 'corporate',
      })),
      ...newPersonal.map((r): ActivityEvent => ({
        type: 'new_client',
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        clientName: [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unnamed client',
        clientType: 'personal',
      })),
    ]
      .sort(byRecency)
      .slice(0, PER_SOURCE_LIMIT);

    const workCompletedEvents: ActivityEvent[] = workCompleted
      .map((r): ActivityEvent => ({
        type: 'work_completed',
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        clientName: r.clientName?.trim() || null,
        serviceType: r.serviceType,
        billingStatus: r.billingStatus,
        amountCharged: r.amountCharged !== null ? Number(r.amountCharged) : null,
      }));

    const paymentEvents: ActivityEvent[] = paymentsReceived.map((r): ActivityEvent => ({
      type: 'payment_received',
      id: r.id,
      // receipt_date is a plain date (mode: 'string') — midnight UTC on the
      // payment's business date, not the moment it was recorded.
      timestamp: new Date(`${r.receiptDate}T00:00:00Z`).toISOString(),
      clientName: r.clientName?.trim() || null,
      amountCharged: r.amountCharged !== null ? Number(r.amountCharged) : null,
    }));

    // Each source already contributes at most PER_SOURCE_LIMIT — this sort is
    // purely to interleave the 3 sources into one chronological timeline.
    const events = [...newClientEvents, ...workCompletedEvents, ...paymentEvents].sort(byRecency);

    return c.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent activity',
      },
      500
    );
  }
});

export default app;
