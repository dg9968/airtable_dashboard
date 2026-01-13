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
 * Create a new ledger entry when a file return is completed or corporate service is rendered
 *
 * Expected body:
 * {
 *   subscriptionId: string,         // Airtable record ID from Subscriptions Personal or Subscriptions Corporate table
 *   subscriptionType: "personal" | "corporate",  // Type of subscription
 *   clientName: string,             // Full name of the client or company name
 *   serviceType: string,            // Service type (e.g., "Personal Tax Return", "Reconciling Banks for Tax Prep", "Payroll", etc.)
 *   amountCharged: number,          // Amount charged for the service
 *   receiptDate: string,            // ISO date string for when the service was rendered
 *   paymentMethod: string           // Payment method used (Credit Card, Cash, Zelle, Check, ACH, Other)
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

    const { subscriptionId, subscriptionType, clientName, serviceType, amountCharged, receiptDate, paymentMethod } = await c.req.json();

    // Validate required fields
    if (!subscriptionId || !clientName || !amountCharged || !receiptDate || !paymentMethod) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, clientName, amountCharged, receiptDate, paymentMethod',
        },
        400
      );
    }

    // Default to personal if subscriptionType not provided (backwards compatibility)
    const type = subscriptionType || 'personal';
    const service = serviceType || 'Personal Tax Return';

    console.log('Creating Ledger entry:', { subscriptionId, subscriptionType: type, clientName, serviceType: service, amountCharged, receiptDate, paymentMethod });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Get the subscription record to verify it exists
    const tableName = type === 'corporate' ? 'Subscriptions Corporate' : 'Subscriptions Personal';
    const subscriptions = await fetchAllRecords(baseId, tableName);
    const subscription = subscriptions.find((s: any) => s.id === subscriptionId);

    if (!subscription) {
      return c.json(
        {
          success: false,
          error: `Subscription not found in ${tableName}`,
        },
        404
      );
    }

    // Create the ledger record
    // Field names: "Service Rendered" (text), "Receipt Date" (date), "Amount Charged" (currency), "Name of Client" (text), "Payment Method" (single select), "Subscription" (link to Subscriptions Personal/Corporate)
    const recordData: any = {
      'Service Rendered': service,
      'Receipt Date': receiptDate,
      'Amount Charged': amountCharged,
      'Name of Client': clientName,
      'Payment Method': paymentMethod,
      'Subscription': [subscriptionId], // Link to subscription table (works for both Personal and Corporate)
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
