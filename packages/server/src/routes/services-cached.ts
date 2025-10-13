/**
 * Services Cached Routes
 */

import { Hono } from 'hono';
import { fetchAllTableData } from '../airtable';

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

    console.log('Fetching fresh services data from Airtable');

    const records = await fetchAllTableData('Services Corporate');

    const services = records.map((record) => ({
      id: record.id,
      name: record.fields['Services'] || 'Unnamed Service',
      price: record.fields['Price'] || 0,
      description: record.fields['Description'] || '',
      category: record.fields['Category'] || null,
      billingCycle: record.fields['Billing Cycle'] || null
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

/**
 * DELETE /api/services-cached
 * Clear the services cache
 */
app.delete('/', async (c) => {
  servicesCache = null;
  cacheTimestamp = 0;

  return c.json({
    success: true,
    message: 'Services cache cleared'
  });
});

export default app;
