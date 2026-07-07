/**
 * Services Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { servicesCorporate } from '../db/schema';

const app = new Hono();

// Rebuild the Airtable-style fields object from columns (legacy response shape).
function toFieldData(row: typeof servicesCorporate.$inferSelect): Record<string, unknown> {
  const fields: Record<string, unknown> = { 'Services': row.name };
  if (row.price != null) fields['Price'] = Number(row.price);
  if (row.description) fields['Description'] = row.description;
  if (row.category) fields['Category'] = row.category;
  if (row.billingCycle) fields['Billing Cycle'] = row.billingCycle;
  return fields;
}

/**
 * GET /api/services
 * Fetch all services from the services_corporate table
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(servicesCorporate)
      .orderBy(asc(servicesCorporate.createdAt));

    const services = rows.map((row) => {
      const fieldData = toFieldData(row);
      return {
        id: row.id,
        name: row.name || 'Unnamed Service',
        nameField: 'Services',
        allFields: Object.keys(fieldData),
        allFieldData: fieldData,
      };
    });

    const bookkeepingService = services.find(service =>
      service.name === 'Bookkeeping Clients' ||
      service.name.toLowerCase() === 'bookkeeping clients'
    );

    return c.json({
      success: true,
      data: {
        services: services,
        tableName: 'Services Corporate',
        totalServices: services.length,
        bookkeepingServiceExists: !!bookkeepingService,
        bookkeepingService: bookkeepingService || null,
        serviceNames: services.map(s => s.name),
        fieldAnalysis: {
          nameFields: services.map(s => ({ id: s.id, nameField: s.nameField, allFields: s.allFields })),
          allUniqueFields: [...new Set(services.flatMap(s => s.allFields))]
        },
        message: bookkeepingService
          ? 'Found "Bookkeeping Clients" service in your Services table'
          : 'Could not find "Bookkeeping Clients" service in your Services table'
      }
    });

  } catch (error) {
    console.error('Error in services API route:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services data',
        suggestion: 'Check the database connection'
      },
      500
    );
  }
});

/**
 * POST /api/services
 * Create a new service record
 *
 * Expected body: { name: string }
 */
app.post('/', async (c) => {
  try {
    const { name } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ success: false, error: 'Missing required field: name' }, 400);
    }

    const [row] = await getDb()
      .insert(servicesCorporate)
      .values({ name: name.trim() })
      .returning();

    // Legacy Airtable record shape
    return c.json({
      success: true,
      data: {
        id: row.id,
        createdTime: row.createdAt.toISOString(),
        fields: { Services: row.name },
      },
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create service' },
      500
    );
  }
});

export default app;
