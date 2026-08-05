/**
 * Services Catalog Management API (Postgres-backed)
 *
 * Full CRUD for the two service catalogs (servicesCorporate, personalServices)
 * — the admin surface that services.ts / services-personal.ts / services-cached.ts
 * never had (those three are read-mostly compatibility routes for existing
 * dropdown consumers; see their file headers). Corporate and personal share
 * this one file since they're the same five-handler shape, just with a
 * narrower field set on the personal side (no price/vendor/billing-cycle —
 * personal clients are billed per-service via billing_records, never bundled).
 *
 * "Delete" is always a soft archive (status -> 'Inactive'), never a hard
 * delete: corporate_billing_bundle_items.service_id is ON DELETE RESTRICT
 * and bundle items are never hard-deleted, so the DB already permanently
 * blocks removing a corporate service that's ever been bundled. Reactivating
 * is just PATCH { status: 'Active' } — no separate endpoint.
 */

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { servicesCorporate, personalServices } from '../db/schema';
import { clearServicesCache } from './services-cached';

const app = new Hono();

type CorporateRow = typeof servicesCorporate.$inferSelect;
type PersonalRow = typeof personalServices.$inferSelect;

function mapCorporateRow(row: CorporateRow) {
  return {
    id: row.id,
    name: row.name,
    price: row.price != null ? Number(row.price) : null,
    description: row.description,
    category: row.category,
    billingCycle: row.billingCycle,
    vendorCost: row.vendorCost != null ? Number(row.vendorCost) : null,
    vendorName: row.vendorName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPersonalRow(row: PersonalRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Corporate — /api/services-catalog/corporate
// ---------------------------------------------------------------------------

/** GET /corporate?includeInactive=true */
app.get('/corporate', async (c) => {
  try {
    const includeInactive = c.req.query('includeInactive') === 'true';
    const db = getDb();

    const rows = includeInactive
      ? await db.select().from(servicesCorporate).orderBy(asc(servicesCorporate.name))
      : await db
          .select()
          .from(servicesCorporate)
          .where(eq(servicesCorporate.status, 'Active'))
          .orderBy(asc(servicesCorporate.name));

    return c.json({ success: true, data: rows.map(mapCorporateRow) });
  } catch (error) {
    console.error('Error listing corporate services:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list corporate services' },
      500
    );
  }
});

app.get('/corporate/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const [row] = await getDb().select().from(servicesCorporate).where(eq(servicesCorporate.id, id)).limit(1);

    if (!row) return c.json({ success: false, error: 'Corporate service not found' }, 404);
    return c.json({ success: true, data: mapCorporateRow(row) });
  } catch (error) {
    console.error('Error fetching corporate service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch corporate service' },
      500
    );
  }
});

app.post('/corporate', async (c) => {
  try {
    const body = await c.req.json();
    const { name, price, description, category, billingCycle, vendorCost, vendorName } = body;

    if (!name || !String(name).trim()) {
      return c.json({ success: false, error: 'Missing required field: name' }, 400);
    }

    const [row] = await getDb()
      .insert(servicesCorporate)
      .values({
        name: String(name).trim(),
        price: price != null ? String(price) : null,
        description: description || null,
        category: category || null,
        billingCycle: billingCycle || null,
        vendorCost: vendorCost != null ? String(vendorCost) : null,
        vendorName: vendorName || null,
        status: 'Active',
      })
      .returning();

    clearServicesCache();
    return c.json({ success: true, data: mapCorporateRow(row) });
  } catch (error) {
    console.error('Error creating corporate service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create corporate service' },
      500
    );
  }
});

app.patch('/corporate/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const values: Partial<typeof servicesCorporate.$inferInsert> = {};
    if (body.name !== undefined) values.name = String(body.name).trim();
    if (body.price !== undefined) values.price = body.price != null ? String(body.price) : null;
    if (body.description !== undefined) values.description = body.description;
    if (body.category !== undefined) values.category = body.category;
    if (body.billingCycle !== undefined) values.billingCycle = body.billingCycle;
    if (body.vendorCost !== undefined) values.vendorCost = body.vendorCost != null ? String(body.vendorCost) : null;
    if (body.vendorName !== undefined) values.vendorName = body.vendorName;
    if (body.status !== undefined) values.status = body.status;

    const [row] = await getDb()
      .update(servicesCorporate)
      .set(values)
      .where(eq(servicesCorporate.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Corporate service not found' }, 404);

    clearServicesCache();
    return c.json({ success: true, data: mapCorporateRow(row) });
  } catch (error) {
    console.error('Error updating corporate service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update corporate service' },
      500
    );
  }
});

app.delete('/corporate/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const [row] = await getDb()
      .update(servicesCorporate)
      .set({ status: 'Inactive' })
      .where(eq(servicesCorporate.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Corporate service not found' }, 404);

    clearServicesCache();
    return c.json({ success: true, message: 'Corporate service deactivated', data: mapCorporateRow(row) });
  } catch (error) {
    console.error('Error deactivating corporate service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate corporate service' },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// Personal — /api/services-catalog/personal
// ---------------------------------------------------------------------------

/** GET /personal?includeInactive=true */
app.get('/personal', async (c) => {
  try {
    const includeInactive = c.req.query('includeInactive') === 'true';
    const db = getDb();

    const rows = includeInactive
      ? await db.select().from(personalServices).orderBy(asc(personalServices.name))
      : await db
          .select()
          .from(personalServices)
          .where(eq(personalServices.status, 'Active'))
          .orderBy(asc(personalServices.name));

    return c.json({ success: true, data: rows.map(mapPersonalRow) });
  } catch (error) {
    console.error('Error listing personal services:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list personal services' },
      500
    );
  }
});

app.get('/personal/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const [row] = await getDb().select().from(personalServices).where(eq(personalServices.id, id)).limit(1);

    if (!row) return c.json({ success: false, error: 'Personal service not found' }, 404);
    return c.json({ success: true, data: mapPersonalRow(row) });
  } catch (error) {
    console.error('Error fetching personal service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch personal service' },
      500
    );
  }
});

app.post('/personal', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, category } = body;

    if (!name || !String(name).trim()) {
      return c.json({ success: false, error: 'Missing required field: name' }, 400);
    }

    const [row] = await getDb()
      .insert(personalServices)
      .values({
        name: String(name).trim(),
        description: description || null,
        category: category || null,
        status: 'Active',
      })
      .returning();

    return c.json({ success: true, data: mapPersonalRow(row) });
  } catch (error) {
    console.error('Error creating personal service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create personal service' },
      500
    );
  }
});

app.patch('/personal/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const values: Partial<typeof personalServices.$inferInsert> = {};
    if (body.name !== undefined) values.name = String(body.name).trim();
    if (body.description !== undefined) values.description = body.description;
    if (body.category !== undefined) values.category = body.category;
    if (body.status !== undefined) values.status = body.status;

    const [row] = await getDb()
      .update(personalServices)
      .set(values)
      .where(eq(personalServices.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Personal service not found' }, 404);

    return c.json({ success: true, data: mapPersonalRow(row) });
  } catch (error) {
    console.error('Error updating personal service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update personal service' },
      500
    );
  }
});

app.delete('/personal/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const [row] = await getDb()
      .update(personalServices)
      .set({ status: 'Inactive' })
      .where(eq(personalServices.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Personal service not found' }, 404);

    return c.json({ success: true, message: 'Personal service deactivated', data: mapPersonalRow(row) });
  } catch (error) {
    console.error('Error deactivating personal service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate personal service' },
      500
    );
  }
});

export default app;
