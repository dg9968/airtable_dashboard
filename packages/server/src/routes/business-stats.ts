/**
 * Business Stats API Routes
 * Provides aggregated statistics for the dashboard
 */

import { Hono } from 'hono';
import { testConnection, fetchRecords } from '../lib/airtable-service';

const app = new Hono();

/**
 * GET /api/business-stats
 * Get aggregated business statistics
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

    // Fetch all necessary data in parallel
    const [corporateRecords, personalRecords, teamsRecords] = await Promise.all([
      fetchRecords('Corporations', {}).catch(() => []),
      fetchRecords('Personal', {}).catch(() => []),
      fetchRecords('Team', {}).catch(() => [])
    ]);

    // Calculate stats
    // Total Clients = Corporations + Personal
    const corporateClients = corporateRecords.length;
    const personalClients = personalRecords.length;
    const totalClients = corporateClients + personalClients;

    // Count active processors (team members with role that includes "Processor" or "Tax Preparer")
    // Count all active team members if no specific role filtering is needed
    console.log(`Total Teams records: ${teamsRecords.length}`);

    const activeProcessors = teamsRecords.filter(record => {
      const role = record.fields['Role'] || record.fields['role'] || '';
      const status = record.fields['Status'] || record.fields['status'] || '';

      // Log first few records to debug
      if (teamsRecords.indexOf(record) < 3) {
        console.log('Team record:', { role, status, fields: Object.keys(record.fields) });
      }

      // If status field exists and is not Active, exclude
      if (status && status !== 'Active') {
        return false;
      }

      // If no role specified, count all active members
      if (!role) {
        return true;
      }

      // If role is specified, check if it's a processor/preparer
      if (typeof role === 'string') {
        const roleLower = role.toLowerCase();
        return roleLower.includes('processor') ||
               roleLower.includes('tax preparer') ||
               roleLower.includes('preparer') ||
               roleLower.includes('staff'); // Also count general staff
      }

      return true;
    }).length;

    console.log(`Active processors count: ${activeProcessors}`);

    // Calculate monthly revenue from Subscriptions Corporate
    let monthlyRevenue = 0;
    try {
      const subscriptionRecords = await fetchRecords('Subscriptions Corporate', {});
      monthlyRevenue = subscriptionRecords.reduce((total, record) => {
        const billingAmount = parseFloat(record.fields['Billing Amount'] || '0');
        return total + billingAmount;
      }, 0);
    } catch (error) {
      console.warn('Could not fetch subscription data for revenue calculation');
    }

    // Count tasks completed this month from Ledger
    // Tasks completed = entries in Ledger with Receipt Date in current month
    let tasksCompletedThisMonth = 0;
    let monthlyTaskRevenue = 0;
    try {
      const ledgerRecords = await fetchRecords('Ledger', {});

      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      ledgerRecords.forEach(record => {
        const receiptDate = record.fields['Receipt Date'];
        if (receiptDate) {
          const date = new Date(receiptDate);
          // Check if receipt date is in current month
          if (date >= startOfMonth && date <= endOfMonth) {
            tasksCompletedThisMonth++;
            // Sum up the amount charged for this month's tasks
            const amountCharged = parseFloat(record.fields['Amount Charged'] || '0');
            monthlyTaskRevenue += amountCharged;
          }
        }
      });
    } catch (error) {
      console.warn('Could not fetch ledger data for tasks completed count');
    }

    return c.json({
      success: true,
      data: {
        totalClients,
        corporateClients,
        personalClients,
        monthlyRevenue,
        activeProcessors,
        tasksCompletedThisMonth,
        monthlyTaskRevenue,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching business stats:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch business stats'
      },
      500
    );
  }
});

export default app;
