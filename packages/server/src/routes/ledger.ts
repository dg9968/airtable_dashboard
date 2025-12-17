/**
 * Ledger API Routes
 *
 * Manages ledger entries for tracking service revenue
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords, createRecords } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * POST /api/ledger
 * Create a new ledger entry when a file return is completed
 *
 * Expected body:
 * {
 *   subscriptionId: string,  // Airtable record ID from Subscriptions Personal table
 *   clientName: string,      // Full name of the client
 *   amountCharged: number,   // Amount charged for the service
 *   receiptDate: string      // ISO date string for when the service was rendered
 * }
 */
app.post('/', async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
        },
        401
      );
    }

    const { subscriptionId, clientName, amountCharged, receiptDate } = await c.req.json();

    if (!subscriptionId || !clientName || !amountCharged || !receiptDate) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, clientName, amountCharged, receiptDate',
        },
        400
      );
    }

    console.log('Creating Ledger entry:', { subscriptionId, clientName, amountCharged, receiptDate });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // First, get the subscription record to extract necessary information
    const subscriptions = await fetchAllRecords(baseId, 'Subscriptions Personal');
    const subscription = subscriptions.find((s: any) => s.id === subscriptionId);

    if (!subscription) {
      return c.json(
        {
          success: false,
          error: 'Subscription not found',
        },
        404
      );
    }

    // Create the ledger record
    // Field names: "Service Rendered" (text), "Receipt Date" (date), "Amount Charged" (currency), "Name of Client" (text), "Subscription" (link to Subscriptions Personal)
    const recordData: any = {
      'Service Rendered': 'Personal Tax Return',
      'Receipt Date': receiptDate,
      'Amount Charged': amountCharged,
      'Name of Client': clientName,
      'Subscription': [subscriptionId], // Link to Subscriptions Personal table
    };

    const records = await createRecords(baseId, 'Ledger', [
      { fields: recordData },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
      },
    });
  } catch (error) {
    console.error('Error creating Ledger entry:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create ledger entry',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/ledger
 * Get all ledger entries
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, 'Ledger');

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching ledger entries:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ledger entries',
      },
      500
    );
  }
});

export default app;
