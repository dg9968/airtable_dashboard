/**
 * Services Rendered API Routes
 *
 * Manages completed services that are awaiting billing or have been billed
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords, createRecords, updateRecords, getRecord } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * POST /api/services-rendered
 * Create a new unbilled service record when a service is completed
 *
 * Expected body:
 * {
 *   subscriptionId: string,
 *   subscriptionType: "personal" | "corporate",
 *   serviceDate: string,           // ISO date string
 *   amountCharged?: number,         // Optional amount
 *   notes?: string                  // Optional notes
 * }
 */
app.post('/', async (c) => {
  try {
    console.log('[Services Rendered API] POST / - Creating new service record');

    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      console.error('[Services Rendered API] Connection test failed:', connectionTest.message);
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
        },
        401
      );
    }

    const { subscriptionId, subscriptionType, serviceDate, amountCharged, notes } = await c.req.json();
    console.log('[Services Rendered API] Request data:', { subscriptionId, subscriptionType, serviceDate, amountCharged, notes });

    // Validate required fields
    if (!subscriptionId || !subscriptionType || !serviceDate) {
      console.error('[Services Rendered API] Missing required fields');
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, subscriptionType, serviceDate',
        },
        400
      );
    }

    // Validate subscription type
    if (subscriptionType !== 'personal' && subscriptionType !== 'corporate') {
      return c.json(
        {
          success: false,
          error: 'subscriptionType must be "personal" or "corporate"',
        },
        400
      );
    }

    console.log('Creating Services Rendered entry:', { subscriptionId, subscriptionType, serviceDate, amountCharged, notes });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Fetch the subscription record to extract actual values
    const tableName = subscriptionType === 'corporate' ? 'Subscriptions Corporate' : 'Subscriptions Personal';
    let subscriptionRecord;
    try {
      subscriptionRecord = await getRecord(baseId, tableName, subscriptionId);
      console.log('\n========================================');
      console.log('[Services Rendered API] Subscription record fetched');
      console.log('[Services Rendered API] Available field names:', Object.keys(subscriptionRecord.fields));
      console.log('[Services Rendered API] Subscription fields:', JSON.stringify(subscriptionRecord.fields, null, 2));
      console.log('========================================\n');
    } catch (error) {
      console.error('[Services Rendered API] Subscription not found:', error);
      return c.json(
        {
          success: false,
          error: `Subscription not found in ${tableName}`,
        },
        404
      );
    }

    // Extract actual values from subscription record
    // These will be stored directly in Services Rendered so they persist after subscription deletion
    let clientName = 'Unknown Client';
    let serviceType = 'Unknown Service';
    let processor = 'Unassigned';

    if (subscriptionType === 'corporate') {
      // Corporate subscriptions
      const companyNameRaw = subscriptionRecord.fields['Company Name'] ||
                            subscriptionRecord.fields['Company  (from Customer)'];
      clientName = Array.isArray(companyNameRaw) ? companyNameRaw[0] : companyNameRaw || 'Unknown Client';

      // Try multiple possible field names for service name
      const serviceNameRaw = subscriptionRecord.fields['Service Name'] ||
                            subscriptionRecord.fields['Service Name (from Service)'] ||
                            subscriptionRecord.fields['Service Name (from Services)'] ||
                            subscriptionRecord.fields['Services (from Services)'] ||
                            subscriptionRecord.fields['Service Name (from Services Corporate)'] ||
                            subscriptionRecord.fields['Name (from Services)'];
      serviceType = Array.isArray(serviceNameRaw) ? serviceNameRaw[0] : serviceNameRaw || 'Unknown Service';

      const processorRaw = subscriptionRecord.fields['Processor'] ||
                          subscriptionRecord.fields['Assigned To'];
      processor = Array.isArray(processorRaw) ? processorRaw[0] : processorRaw || 'Unassigned';
    } else {
      // Personal subscriptions
      const fullNameRaw = subscriptionRecord.fields['Full Name'];
      clientName = Array.isArray(fullNameRaw) ? fullNameRaw[0] : fullNameRaw || 'Unknown Client';

      // Try multiple possible field names for service name
      const serviceNameRaw = subscriptionRecord.fields['Service Name'] ||
                            subscriptionRecord.fields['Service Name (from Service)'] ||
                            subscriptionRecord.fields['Service Name (from Services)'] ||
                            subscriptionRecord.fields['Services (from Services)'] ||
                            subscriptionRecord.fields['Name (from Services)'];
      serviceType = Array.isArray(serviceNameRaw) ? serviceNameRaw[0] : serviceNameRaw || 'Unknown Service';

      const preparerRaw = subscriptionRecord.fields['Preparer'] ||
                         subscriptionRecord.fields['Processor'] ||
                         subscriptionRecord.fields['Assigned To'];
      processor = Array.isArray(preparerRaw) ? preparerRaw[0] : preparerRaw || 'Unassigned';
    }

    console.log('[Services Rendered API] Extracted values:', { clientName, serviceType, processor });

    // Create the Services Rendered record
    const recordData: any = {
      'Service Rendered Date': serviceDate.split('T')[0], // Extract date only
      'Billing Status': 'Unbilled',
      'Client Name': clientName,         // Store actual value, not lookup
      'Service Type': serviceType,       // Store actual value, not lookup
      'Processor': processor,            // Store actual value, not lookup
    };

    // Link to the appropriate subscription table
    if (subscriptionType === 'corporate') {
      recordData['Subscription Corporate'] = [subscriptionId];
    } else {
      recordData['Subscription Personal'] = [subscriptionId];
    }

    // Add optional fields
    if (amountCharged !== undefined && amountCharged !== null) {
      recordData['Amount Charged'] = amountCharged;
    }
    if (notes) {
      recordData['Notes'] = notes;
    }

    const records = await createRecords(baseId, 'Services Rendered', [
      { fields: recordData },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
        createdTime: records[0].createdTime,
      },
    });
  } catch (error) {
    console.error('Error creating Services Rendered entry:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create services rendered entry',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/services-rendered
 * Fetch services rendered with filtering and grouping
 *
 * Query params:
 * - status: Filter by billing status (default: "Unbilled")
 * - clientName: Filter by client/company name (partial match)
 * - startDate: Services rendered after this date
 * - endDate: Services rendered before this date
 * - processor: Filter by processor name
 * - groupBy: "client" | "processor" | "date" (default: "client")
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
    const status = c.req.query('status') || 'Unbilled';
    const clientName = c.req.query('clientName');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const processor = c.req.query('processor');
    const groupBy = c.req.query('groupBy') || 'client';

    // Build filter formula
    const filters: string[] = [];

    if (status && status !== 'All') {
      filters.push(`{Billing Status} = "${status}"`);
    }

    if (startDate) {
      filters.push(`IS_AFTER({Service Rendered Date}, '${startDate}')`);
    }

    if (endDate) {
      filters.push(`IS_BEFORE({Service Rendered Date}, '${endDate}')`);
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    // Fetch all records
    const records = await fetchAllRecords(baseId, 'Services Rendered', {
      filterByFormula,
      sort: [{ field: 'Service Rendered Date', direction: 'asc' }]
    });

    console.log(`Fetched ${records.length} Services Rendered records`);

    // Process and filter records
    let filteredRecords = records.map(record => {
      // Read from direct fields (not lookups) - these persist after subscription deletion
      const clientNameRaw = record.fields['Client Name'];
      const clientNameStr = Array.isArray(clientNameRaw) ? clientNameRaw[0] : clientNameRaw;

      const serviceTypeRaw = record.fields['Service Type'];
      const serviceTypeStr = Array.isArray(serviceTypeRaw) ? serviceTypeRaw[0] : serviceTypeRaw;

      const processorRaw = record.fields['Processor'];
      const processorStr = Array.isArray(processorRaw) ? processorRaw[0] : processorRaw;

      return {
        id: record.id,
        fields: record.fields,
        clientName: clientNameStr || 'Unknown Client',
        serviceType: serviceTypeStr || 'Unknown Service',
        processor: processorStr || 'Unassigned',
        amount: record.fields['Amount Charged'] || 0,
        serviceDate: record.fields['Service Rendered Date'],
        billingStatus: record.fields['Billing Status'],
        paymentMethod: record.fields['Payment Method'],
        receiptDate: record.fields['Receipt Date'],
        notes: record.fields['Notes'],
      };
    });

    // Apply client name filter if provided
    if (clientName) {
      const lowerClientName = clientName.toLowerCase();
      filteredRecords = filteredRecords.filter(r =>
        r.clientName.toLowerCase().includes(lowerClientName)
      );
    }

    // Apply processor filter if provided
    if (processor) {
      const lowerProcessor = processor.toLowerCase();
      filteredRecords = filteredRecords.filter(r =>
        r.processor.toLowerCase().includes(lowerProcessor)
      );
    }

    // Calculate summary statistics
    const summary = {
      totalServices: filteredRecords.length,
      totalAmount: filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
      unbilledCount: filteredRecords.filter(r => r.billingStatus === 'Unbilled').length,
    };

    // Group records based on groupBy parameter
    const grouped = groupRecords(filteredRecords, groupBy as 'client' | 'processor' | 'date');

    return c.json({
      success: true,
      data: {
        services: filteredRecords,
        summary,
        groupedBy: groupBy,
        grouped,
      },
    });
  } catch (error) {
    console.error('Error fetching services rendered:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services rendered',
      },
      500
    );
  }
});

/**
 * Helper function to group records
 */
function groupRecords(records: any[], groupBy: 'client' | 'processor' | 'date') {
  const grouped: any = {};

  records.forEach(record => {
    let key = '';

    switch (groupBy) {
      case 'client':
        key = record.clientName;
        break;
      case 'processor':
        key = record.processor;
        break;
      case 'date':
        key = record.serviceDate || 'No Date';
        break;
    }

    if (!grouped[key]) {
      grouped[key] = {
        groupName: key,
        services: [],
        totalAmount: 0,
        count: 0,
      };
    }

    grouped[key].services.push(record);
    grouped[key].totalAmount += record.amount || 0;
    grouped[key].count++;
  });

  // Convert to array and sort
  return Object.values(grouped).sort((a: any, b: any) =>
    a.groupName.localeCompare(b.groupName)
  );
}

/**
 * GET /api/services-rendered/:id
 * Get a single service record by ID
 */
app.get('/:id', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const recordId = c.req.param('id');

    const record = await getRecord(baseId, 'Services Rendered', recordId);

    return c.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Error fetching service record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch service record',
      },
      500
    );
  }
});

/**
 * PATCH /api/services-rendered/:id
 * Update a service record (e.g., add amount, update notes)
 */
app.patch('/:id', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const recordId = c.req.param('id');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json(
        {
          success: false,
          error: 'Missing fields object in request body',
        },
        400
      );
    }

    const updatedRecords = await updateRecords(baseId, 'Services Rendered', [
      { id: recordId, fields },
    ]);

    return c.json({
      success: true,
      data: updatedRecords[0],
    });
  } catch (error) {
    console.error('Error updating service record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service record',
      },
      500
    );
  }
});

/**
 * POST /api/services-rendered/:id/bill
 * Mark a service as billed and optionally create a Ledger entry
 *
 * Expected body:
 * {
 *   amountCharged: number,
 *   paymentMethod: string,
 *   receiptDate: string,
 *   createLedger: boolean,
 *   billingStatus: "Billed - Paid" | "Billed - Unpaid"
 * }
 */
app.post('/:id/bill', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const recordId = c.req.param('id');
    const { amountCharged, paymentMethod, receiptDate, createLedger, billingStatus } = await c.req.json();

    // Validate required fields
    if (!amountCharged || !paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: amountCharged, paymentMethod, receiptDate, billingStatus',
        },
        400
      );
    }

    // Get the service record
    const serviceRecord = await getRecord(baseId, 'Services Rendered', recordId);

    // Update the service record with billing information
    const updateFields: any = {
      'Billing Status': billingStatus,
      'Amount Charged': amountCharged,
      'Payment Method': paymentMethod,
      'Receipt Date': receiptDate.split('T')[0], // Extract date only
    };

    let ledgerEntry = null;

    // Create Ledger entry if requested and status is "Billed - Paid"
    if (createLedger && billingStatus === 'Billed - Paid') {
      // Extract necessary information from direct fields
      const clientNameRaw = serviceRecord.fields['Client Name'];
      const clientName = Array.isArray(clientNameRaw) ? clientNameRaw[0] : clientNameRaw;

      const serviceTypeRaw = serviceRecord.fields['Service Type'];
      const serviceType = Array.isArray(serviceTypeRaw) ? serviceTypeRaw[0] : serviceTypeRaw;

      // Determine subscription type and ID (may be null if subscription was deleted)
      const subscriptionCorporate = serviceRecord.fields['Subscription Corporate'];
      const subscriptionPersonal = serviceRecord.fields['Subscription Personal'];

      const subscriptionType = subscriptionCorporate ? 'corporate' : 'personal';
      const subscriptionId = subscriptionCorporate
        ? (Array.isArray(subscriptionCorporate) ? subscriptionCorporate[0] : subscriptionCorporate)
        : (Array.isArray(subscriptionPersonal) ? subscriptionPersonal[0] : subscriptionPersonal);

      // Create Ledger record
      const ledgerData: any = {
        'Service Rendered': serviceType || 'Service',
        'Receipt Date': receiptDate.split('T')[0],
        'Amount Charged': amountCharged,
        'Name of Client': clientName || 'Unknown Client',
        'Payment Method': paymentMethod,
      };

      // Only link to subscription if it still exists (not deleted)
      if (subscriptionId) {
        if (subscriptionType === 'corporate') {
          ledgerData['Related Corporate Subscriptions'] = [subscriptionId];
        } else {
          ledgerData['Subscription'] = [subscriptionId];
        }
      }

      const ledgerRecords = await createRecords(baseId, 'Ledger', [
        { fields: ledgerData },
      ]);

      ledgerEntry = ledgerRecords[0];

      // Link the ledger entry back to the service record
      updateFields['Ledger Entry'] = [ledgerEntry.id];
    }

    // Update the service record
    const updatedRecords = await updateRecords(baseId, 'Services Rendered', [
      { id: recordId, fields: updateFields },
    ]);

    return c.json({
      success: true,
      data: {
        serviceRendered: updatedRecords[0],
        ledgerEntry,
      },
    });
  } catch (error) {
    console.error('Error billing service:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bill service',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/services-rendered/batch-bill
 * Bill multiple services at once
 *
 * Expected body:
 * {
 *   serviceIds: string[],
 *   paymentMethod: string,
 *   receiptDate: string,
 *   totalAmount?: number,
 *   createLedger: boolean,
 *   billingStatus: "Billed - Paid" | "Billed - Unpaid",
 *   notes?: string
 * }
 */
app.post('/batch-bill', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const { serviceIds, paymentMethod, receiptDate, totalAmount, createLedger, billingStatus, notes } = await c.req.json();

    // Validate required fields
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return c.json(
        {
          success: false,
          error: 'serviceIds must be a non-empty array',
        },
        400
      );
    }

    if (!paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: paymentMethod, receiptDate, billingStatus',
        },
        400
      );
    }

    console.log(`Batch billing ${serviceIds.length} services`);

    // Fetch all service records
    const serviceRecords = await Promise.all(
      serviceIds.map(id => getRecord(baseId, 'Services Rendered', id))
    );

    // Calculate total amount if not provided
    let calculatedTotal = totalAmount;
    if (!calculatedTotal) {
      calculatedTotal = serviceRecords.reduce((sum, record) => {
        const amount = record.fields['Amount Charged'] || 0;
        return sum + amount;
      }, 0);
    }

    let ledgerEntry = null;

    // Create single Ledger entry if requested and status is "Billed - Paid"
    if (createLedger && billingStatus === 'Billed - Paid') {
      // Use the first service record to determine client and subscription type
      const firstService = serviceRecords[0];

      const clientNameRaw = firstService.fields['Client Name'];
      const clientName = Array.isArray(clientNameRaw) ? clientNameRaw[0] : clientNameRaw;

      const subscriptionCorporate = firstService.fields['Subscription Corporate'];
      const subscriptionPersonal = firstService.fields['Subscription Personal'];

      const subscriptionType = subscriptionCorporate ? 'corporate' : 'personal';
      const subscriptionId = subscriptionCorporate
        ? (Array.isArray(subscriptionCorporate) ? subscriptionCorporate[0] : subscriptionCorporate)
        : (Array.isArray(subscriptionPersonal) ? subscriptionPersonal[0] : subscriptionPersonal);

      // Create a combined service description
      const serviceDescriptions = serviceRecords.map(record => {
        const serviceTypeRaw = record.fields['Service Type'];
        return Array.isArray(serviceTypeRaw) ? serviceTypeRaw[0] : serviceTypeRaw;
      }).filter(Boolean);

      const serviceDescription = serviceDescriptions.length > 0
        ? `Batch: ${serviceDescriptions.join(', ')}`
        : 'Batch Billing';

      // Create Ledger record
      const ledgerData: any = {
        'Service Rendered': serviceDescription,
        'Receipt Date': receiptDate.split('T')[0],
        'Amount Charged': calculatedTotal,
        'Name of Client': clientName || 'Unknown Client',
        'Payment Method': paymentMethod,
      };

      // Only link to subscription if it still exists (not deleted)
      if (subscriptionId) {
        if (subscriptionType === 'corporate') {
          ledgerData['Related Corporate Subscriptions'] = [subscriptionId];
        } else {
          ledgerData['Subscription'] = [subscriptionId];
        }
      }

      const ledgerRecords = await createRecords(baseId, 'Ledger', [
        { fields: ledgerData },
      ]);

      ledgerEntry = ledgerRecords[0];
    }

    // Update all service records
    const updatePromises = serviceRecords.map(record => {
      const updateFields: any = {
        'Billing Status': billingStatus,
        'Payment Method': paymentMethod,
        'Receipt Date': receiptDate.split('T')[0],
      };

      // Only update amount if not already set
      if (!record.fields['Amount Charged']) {
        // Distribute total amount equally if not set per service
        updateFields['Amount Charged'] = calculatedTotal / serviceIds.length;
      }

      // Link to ledger entry if created
      if (ledgerEntry) {
        updateFields['Ledger Entry'] = [ledgerEntry.id];
      }

      // Add notes if provided
      if (notes) {
        const existingNotes = record.fields['Notes'] || '';
        updateFields['Notes'] = existingNotes
          ? `${existingNotes}\n\nBatch billing: ${notes}`
          : `Batch billing: ${notes}`;
      }

      return updateRecords(baseId, 'Services Rendered', [
        { id: record.id, fields: updateFields },
      ]);
    });

    const updatedRecords = await Promise.all(updatePromises);

    return c.json({
      success: true,
      data: {
        updatedServices: updatedRecords.flat(),
        ledgerEntry,
        summary: {
          totalBilled: serviceIds.length,
          totalAmount: calculatedTotal,
        },
      },
    });
  } catch (error) {
    console.error('Error batch billing services:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch bill services',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

export default app;
