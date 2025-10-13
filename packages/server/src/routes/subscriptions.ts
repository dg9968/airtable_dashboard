/**
 * Subscriptions Routes
 */

import { Hono } from 'hono';
import Airtable from 'airtable';

const app = new Hono();

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
app.post('/', async (c) => {
  try {
    const { subscriptionName, status, price } = await c.req.json();

    console.log('Creating subscription with data:', { subscriptionName, status, price });

    if (!subscriptionName) {
      return c.json(
        { success: false, error: 'Missing required field: subscriptionName' },
        400
      );
    }

    const recordData: any = {
      'Name': subscriptionName,
    };

    if (status !== undefined) {
      recordData['Status'] = status;
    }

    if (price !== undefined) {
      recordData['Billing Amount'] = price;
    }

    console.log('Creating record with data:', recordData);

    const record = await base('Subscriptions Corporate').create(recordData);

    return c.json({
      success: true,
      data: {
        id: (record as any).id,
        fields: (record as any).fields
      }
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      500
    );
  }
});

/**
 * PATCH /api/subscriptions
 * Update an existing subscription
 */
app.patch('/', async (c) => {
  try {
    const { subscriptionId, status, price } = await c.req.json();

    console.log('Updating subscription with data:', { subscriptionId, status, price });

    if (!subscriptionId) {
      return c.json(
        { success: false, error: 'Missing required field: subscriptionId' },
        400
      );
    }

    const updateFields: any = {};

    if (status !== undefined) {
      if (status === '' || status === null) {
        updateFields['Status'] = [];
        console.log('Clearing Status field (setting to empty array)');
      } else {
        updateFields['Status'] = [status];
        console.log('Setting Status to:', [status]);
      }
    }

    if (price !== undefined) {
      updateFields['Billing Amount'] = price;
    }

    console.log('Updating record with fields:', updateFields);

    const record = await base('Subscriptions Corporate').update(subscriptionId, updateFields);

    return c.json({
      success: true,
      data: {
        id: (record as any).id,
        fields: (record as any).fields
      }
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      500
    );
  }
});

/**
 * DELETE /api/subscriptions?id=recordId
 * Delete a subscription
 */
app.delete('/', async (c) => {
  try {
    const subscriptionId = c.req.query('id');

    if (!subscriptionId) {
      return c.json(
        { success: false, error: 'Missing subscription ID' },
        400
      );
    }

    await base('Subscriptions Corporate').destroy(subscriptionId);

    return c.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete subscription'
      },
      500
    );
  }
});

export default app;
