/**
 * Corporate Billing Bundles API Routes (Postgres-backed)
 *
 * A corporate client's durable, client-level recurring billing relationship —
 * "a monthly subscription that pays for many of the services provided to
 * that client." One active bundle per client (enforced by a DB partial
 * unique index); the bundle itself never stores a total, it's always the
 * live sum of its active line items. Plain JSON responses, not the legacy
 * Airtable shape — this is a new domain, not a compat surface.
 */

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  corporateBillingBundles,
  corporateBillingBundleItems,
  servicesCorporate,
  corporations,
} from '../db/schema';

const app = new Hono();

function serializeItem(row: typeof corporateBillingBundleItems.$inferSelect, serviceName?: string | null) {
  return {
    id: row.id,
    bundleId: row.bundleId,
    serviceId: row.serviceId,
    serviceName: serviceName ?? null,
    amount: row.amount != null ? Number(row.amount) : 0,
    status: row.status,
    effectiveDate: row.effectiveDate,
    endDate: row.endDate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadBundleWithItems(bundleId: string) {
  const db = getDb();
  const [bundle] = await db
    .select()
    .from(corporateBillingBundles)
    .where(eq(corporateBillingBundles.id, bundleId))
    .limit(1);
  if (!bundle) return null;

  const items = await db
    .select({ item: corporateBillingBundleItems, serviceName: servicesCorporate.name })
    .from(corporateBillingBundleItems)
    .leftJoin(servicesCorporate, eq(corporateBillingBundleItems.serviceId, servicesCorporate.id))
    .where(eq(corporateBillingBundleItems.bundleId, bundleId));

  const activeItems = items.filter((i) => i.item.status === 'active');
  const totalAmount = activeItems.reduce((sum, i) => sum + (i.item.amount != null ? Number(i.item.amount) : 0), 0);

  return {
    id: bundle.id,
    corporationId: bundle.corporationId,
    name: bundle.name,
    status: bundle.status,
    billingCycle: bundle.billingCycle,
    startDate: bundle.startDate,
    endDate: bundle.endDate,
    notes: bundle.notes,
    createdAt: bundle.createdAt.toISOString(),
    totalAmount,
    items: items.map((i) => serializeItem(i.item, i.serviceName)),
  };
}

/**
 * GET /api/corporate-billing-bundles?corporationId=
 * List bundles for a corporation (or all bundles if omitted), each with its
 * items and a server-computed total.
 */
app.get('/', async (c) => {
  try {
    const corporationId = c.req.query('corporationId');
    const db = getDb();

    const bundleRows = await db
      .select()
      .from(corporateBillingBundles)
      .where(corporationId ? eq(corporateBillingBundles.corporationId, corporationId) : undefined)
      .orderBy(desc(corporateBillingBundles.createdAt));

    const bundles = await Promise.all(bundleRows.map((b) => loadBundleWithItems(b.id)));

    return c.json({ success: true, data: bundles.filter(Boolean) });
  } catch (error) {
    console.error('Error fetching corporate billing bundles:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch bundles' },
      500
    );
  }
});

/**
 * GET /api/corporate-billing-bundles/:id
 */
app.get('/:id', async (c) => {
  try {
    const bundle = await loadBundleWithItems(c.req.param('id'));
    if (!bundle) {
      return c.json({ success: false, error: 'Bundle not found' }, 404);
    }
    return c.json({ success: true, data: bundle });
  } catch (error) {
    console.error('Error fetching corporate billing bundle:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch bundle' },
      500
    );
  }
});

/**
 * POST /api/corporate-billing-bundles
 * Create a client's recurring billing bundle. Rejects a second active
 * bundle for the same client (matches the one-active-bundle-per-client rule;
 * the DB partial unique index is the real guard, this is a friendlier error).
 */
app.post('/', async (c) => {
  try {
    const { corporationId, name, billingCycle, startDate, notes } = await c.req.json();

    if (!corporationId) {
      return c.json({ success: false, error: 'Missing required field: corporationId' }, 400);
    }

    const db = getDb();
    const [corp] = await db.select({ id: corporations.id }).from(corporations).where(eq(corporations.id, corporationId)).limit(1);
    if (!corp) {
      return c.json({ success: false, error: 'Corporation not found' }, 404);
    }

    const [existingActive] = await db
      .select({ id: corporateBillingBundles.id })
      .from(corporateBillingBundles)
      .where(and(eq(corporateBillingBundles.corporationId, corporationId), eq(corporateBillingBundles.status, 'active')))
      .limit(1);
    if (existingActive) {
      return c.json({ success: false, error: 'This client already has an active billing bundle' }, 409);
    }

    const [row] = await db
      .insert(corporateBillingBundles)
      .values({
        corporationId,
        name: name || null,
        billingCycle: billingCycle || 'monthly',
        startDate: startDate || null,
        notes: notes || null,
      })
      .returning();

    const bundle = await loadBundleWithItems(row.id);
    return c.json({ success: true, data: bundle }, 201);
  } catch (error) {
    console.error('Error creating corporate billing bundle:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create bundle' },
      500
    );
  }
});

/**
 * PATCH /api/corporate-billing-bundles/:id
 * Update bundle-level fields (status, name, cycle, dates, notes).
 */
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const values: Partial<typeof corporateBillingBundles.$inferInsert> = {};
    if (body.status !== undefined) values.status = body.status;
    if (body.name !== undefined) values.name = body.name;
    if (body.billingCycle !== undefined) values.billingCycle = body.billingCycle;
    if (body.startDate !== undefined) values.startDate = body.startDate;
    if (body.endDate !== undefined) values.endDate = body.endDate;
    if (body.notes !== undefined) values.notes = body.notes;

    const db = getDb();
    const [row] = await db
      .update(corporateBillingBundles)
      .set(values)
      .where(eq(corporateBillingBundles.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Bundle not found' }, 404);
    }

    const bundle = await loadBundleWithItems(row.id);
    return c.json({ success: true, data: bundle });
  } catch (error) {
    console.error('Error updating corporate billing bundle:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update bundle' },
      500
    );
  }
});

/**
 * POST /api/corporate-billing-bundles/:id/items
 * Add a service line item to a bundle.
 */
app.post('/:id/items', async (c) => {
  try {
    const bundleId = c.req.param('id');
    const { serviceId, amount, effectiveDate, notes } = await c.req.json();

    if (!serviceId || amount == null) {
      return c.json({ success: false, error: 'Missing required fields: serviceId, amount' }, 400);
    }

    const db = getDb();
    const [bundle] = await db.select({ id: corporateBillingBundles.id }).from(corporateBillingBundles).where(eq(corporateBillingBundles.id, bundleId)).limit(1);
    if (!bundle) {
      return c.json({ success: false, error: 'Bundle not found' }, 404);
    }

    const [existingActive] = await db
      .select({ id: corporateBillingBundleItems.id })
      .from(corporateBillingBundleItems)
      .where(
        and(
          eq(corporateBillingBundleItems.bundleId, bundleId),
          eq(corporateBillingBundleItems.serviceId, serviceId),
          eq(corporateBillingBundleItems.status, 'active')
        )
      )
      .limit(1);
    if (existingActive) {
      return c.json({ success: false, error: 'This service is already an active line item on the bundle' }, 409);
    }

    await db.insert(corporateBillingBundleItems).values({
      bundleId,
      serviceId,
      amount: String(amount),
      effectiveDate: effectiveDate || null,
      notes: notes || null,
    });

    const updatedBundle = await loadBundleWithItems(bundleId);
    return c.json({ success: true, data: updatedBundle }, 201);
  } catch (error) {
    console.error('Error adding bundle item:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to add bundle item' },
      500
    );
  }
});

/**
 * PATCH /api/corporate-billing-bundles/:id/items/:itemId
 * Edit a line item's amount/notes, or soft-remove it (status: 'removed').
 * Removal is always soft — pipeline tickets and billing records may
 * reference a line item, and its billing history has standalone value.
 */
app.patch('/:id/items/:itemId', async (c) => {
  try {
    const { itemId } = c.req.param();
    const body = await c.req.json();
    const values: Partial<typeof corporateBillingBundleItems.$inferInsert> = {};
    if (body.amount != null) values.amount = String(body.amount);
    if (body.notes !== undefined) values.notes = body.notes;
    if (body.status !== undefined) {
      values.status = body.status;
      if (body.status === 'removed' && !body.endDate) {
        values.endDate = new Date().toISOString().split('T')[0];
      }
    }
    if (body.endDate !== undefined) values.endDate = body.endDate;

    const db = getDb();
    const [row] = await db
      .update(corporateBillingBundleItems)
      .set(values)
      .where(eq(corporateBillingBundleItems.id, itemId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Bundle item not found' }, 404);
    }

    const bundle = await loadBundleWithItems(row.bundleId);
    return c.json({ success: true, data: bundle });
  } catch (error) {
    console.error('Error updating bundle item:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update bundle item' },
      500
    );
  }
});

export default app;
