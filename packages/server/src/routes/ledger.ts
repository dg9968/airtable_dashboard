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
    // Field names: "Service Rendered" (text), "Receipt Date" (date), "Amount Charged" (currency), "Name of Client" (text), "Payment Method" (single select)
    // For subscriptions: "Subscription" (link to Subscriptions Personal) OR "Related Corporate Subscriptions" (link to Subscriptions Corporate)
    const recordData: any = {
      'Service Rendered': service,
      'Receipt Date': receiptDate,
      'Amount Charged': amountCharged,
      'Name of Client': clientName,
      'Payment Method': paymentMethod,
    };

    // Link to the appropriate subscription table
    if (type === 'corporate') {
      recordData['Related Corporate Subscriptions'] = [subscriptionId];
    } else {
      recordData['Subscription'] = [subscriptionId];
    }

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
 * Fetch ledger entries with filtering and grouping
 *
 * Query params:
 * - startDate: Entries after this date
 * - endDate: Entries before this date
 * - clientName: Filter by client name (partial match)
 * - paymentMethod: Filter by payment method
 * - groupBy: "client" | "date" | "payment" (default: "client")
 */
app.get('/', async (c) => {
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

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Get query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const clientName = c.req.query('clientName');
    const paymentMethod = c.req.query('paymentMethod');
    const groupBy = c.req.query('groupBy') || 'client';

    // Build filter formula
    const filters: string[] = [];

    if (startDate) {
      filters.push(`IS_AFTER({Receipt Date}, '${startDate}')`);
    }

    if (endDate) {
      filters.push(`IS_BEFORE({Receipt Date}, '${endDate}')`);
    }

    if (paymentMethod) {
      filters.push(`{Payment Method} = "${paymentMethod}"`);
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    // Fetch all ledger records
    const records = await fetchAllRecords(baseId, 'Ledger', {
      filterByFormula,
      sort: [{ field: 'Receipt Date', direction: 'desc' }]
    });

    console.log(`Fetched ${records.length} Ledger records`);

    // Process records
    let processedEntries = records.map(record => {
      const clientNameRaw = record.fields['Name of Client'];
      const clientNameStr = Array.isArray(clientNameRaw) ? clientNameRaw[0] : clientNameRaw;

      const serviceRenderedRaw = record.fields['Service Rendered'];
      const serviceRenderedStr = Array.isArray(serviceRenderedRaw) ? serviceRenderedRaw[0] : serviceRenderedRaw;

      const paymentMethodRaw = record.fields['Payment Method'];
      const paymentMethodStr = Array.isArray(paymentMethodRaw) ? paymentMethodRaw[0] : paymentMethodRaw;

      return {
        id: record.id,
        fields: record.fields,
        clientName: clientNameStr || 'Unknown Client',
        serviceRendered: serviceRenderedStr || 'Service',
        receiptDate: record.fields['Receipt Date'] || '',
        amountCharged: record.fields['Amount Charged'] || 0,
        paymentMethod: paymentMethodStr || 'Unknown',
        createdTime: record.fields['Created Time'],
      };
    });

    // Apply client name filter if provided
    if (clientName) {
      const lowerClientName = clientName.toLowerCase();
      processedEntries = processedEntries.filter(e =>
        e.clientName.toLowerCase().includes(lowerClientName)
      );
    }

    // Calculate summary statistics
    const summary = {
      totalRevenue: processedEntries.reduce((sum, e) => sum + (e.amountCharged || 0), 0),
      totalEntries: processedEntries.length,
      uniqueClients: new Set(processedEntries.map(e => e.clientName)).size,
    };

    // Group records based on groupBy parameter
    const grouped = groupRecords(processedEntries, groupBy as 'client' | 'date' | 'payment');

    return c.json({
      success: true,
      data: {
        entries: processedEntries,
        summary,
        groupedBy: groupBy,
        grouped,
      },
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ledger',
      },
      500
    );
  }
});

/**
 * Helper function to group records
 */
function groupRecords(records: any[], groupBy: 'client' | 'date' | 'payment') {
  const grouped: any = {};

  records.forEach(record => {
    let key = '';

    switch (groupBy) {
      case 'client':
        key = record.clientName;
        break;
      case 'date':
        // Group by month
        const date = new Date(record.receiptDate);
        key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        break;
      case 'payment':
        key = record.paymentMethod;
        break;
    }

    if (!grouped[key]) {
      grouped[key] = {
        groupName: key,
        entries: [],
        totalAmount: 0,
        count: 0,
      };
    }

    grouped[key].entries.push(record);
    grouped[key].totalAmount += record.amountCharged || 0;
    grouped[key].count++;
  });

  // Convert to array and sort by total amount (descending)
  return Object.values(grouped).sort((a: any, b: any) =>
    b.totalAmount - a.totalAmount
  );
}

export default app;
