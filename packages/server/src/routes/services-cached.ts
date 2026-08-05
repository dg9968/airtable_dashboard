/**
 * Services Cached Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { servicesCorporate } from '../db/schema';
import { requiresProcessor } from '../lib/billing-cadence';

const app = new Hono();

// Simple in-memory cache
let servicesCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/services-cached
 * Fetch services with caching for better performance
 */
app.get('/', async (c) => {
  try {
    const now = Date.now();

    if (servicesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached services data');
      return c.json({
        success: true,
        data: servicesCache,
        cached: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    console.log('Fetching fresh services data from Postgres');

    const rows = await getDb()
      .select()
      .from(servicesCorporate)
      .where(eq(servicesCorporate.status, 'Active'))
      .orderBy(asc(servicesCorporate.createdAt));

    const services = rows.map((row) => ({
      id: row.id,
      name: row.name || 'Unnamed Service',
      price: row.price != null ? Number(row.price) : 0,
      description: row.description || '',
      category: row.category || null,
      billingCycle: row.billingCycle || null,
      // Lets the bundle UI mark the standing-processor field mandatory when
      // adding this service, without duplicating the server's service list.
      requiresProcessor: requiresProcessor(row.name)
    }));

    servicesCache = services;
    cacheTimestamp = now;

    console.log(`Cached ${services.length} services`);

    return c.json({
      success: true,
      data: services,
      cached: false,
      totalServices: services.length
    });

  } catch (error) {
    console.error('Error fetching services:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services'
      },
      500
    );
  }
});

// Shared with services-catalog.ts, which calls this after every corporate
// mutation so an edit is reflected immediately instead of waiting out
// CACHE_DURATION.
export function clearServicesCache(): void {
  servicesCache = null;
  cacheTimestamp = 0;
}

/**
 * DELETE /api/services-cached
 * Clear the services cache
 */
app.delete('/', async (c) => {
  clearServicesCache();

  return c.json({
    success: true,
    message: 'Services cache cleared'
  });
});

export default app;
