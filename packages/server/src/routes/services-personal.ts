/**
 * Personal Services Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { personalServices } from '../db/schema';

const app = new Hono();

/**
 * GET /api/services-personal
 * Fetch all services from the personal_services table
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(personalServices)
      .orderBy(asc(personalServices.createdAt));

    const services = rows.map((row) => ({
      id: row.id,
      name: row.name || 'Unnamed Service',
      nameField: 'Service Name',
      allFields: { 'Service Name': row.name },
      createdTime: row.createdAt.toISOString(),
    }));

    return c.json({
      success: true,
      services: services,
      tableName: 'Personal Services',
      totalServices: services.length,
      nameField: services[0]?.nameField || null
    });

  } catch (error) {
    console.error('Error in personal services API route:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch personal services',
        suggestion: 'Check the database connection'
      },
      500
    );
  }
});

export default app;
