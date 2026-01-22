/**
 * Communications Webhook API Routes
 * Trigger n8n webhook for email sending
 */

import { Hono } from 'hono';

const app = new Hono();

/**
 * POST /api/communications-webhook/trigger
 * Trigger n8n webhook to send email
 *
 * Expected body:
 * {
 *   messageId: string,
 *   corporateId: string,
 *   emailSubject: string,
 *   emailContent: string,
 *   junctionRecordId: string,
 *   timestamp: string
 * }
 */
app.post('/trigger', async (c) => {
  try {
    const payload = await c.req.json();
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return c.json(
        {
          success: false,
          error: 'N8N_WEBHOOK_URL not configured',
        },
        500
      );
    }

    // Validate required fields
    const { messageId, corporateId, emailSubject, emailContent, junctionRecordId } = payload;

    if (!messageId || !corporateId || !emailSubject || !emailContent || !junctionRecordId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields in webhook payload',
        },
        400
      );
    }

    console.log('Triggering n8n webhook:', { messageId, corporateId, emailSubject });

    // Add timestamp if not provided
    const timestamp = payload.timestamp || new Date().toISOString();

    // Build URL with query parameters (n8n webhook expects GET request)
    const url = new URL(webhookUrl);
    url.searchParams.append('messageId', messageId);
    url.searchParams.append('corporateId', corporateId);
    url.searchParams.append('emailSubject', emailSubject);
    url.searchParams.append('emailContent', emailContent);
    url.searchParams.append('junctionRecordId', junctionRecordId);
    url.searchParams.append('timestamp', timestamp);

    // Trigger n8n webhook with GET request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.statusText} - ${errorText}`);
    }

    const webhookResponse = await response.json().catch(() => ({}));

    return c.json({
      success: true,
      message: 'Webhook triggered successfully',
      webhookResponse,
    });
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger webhook',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/communications-webhook/status
 * Check webhook configuration status
 */
app.get('/status', async (c) => {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  return c.json({
    success: true,
    configured: !!webhookUrl,
    webhookUrl: webhookUrl ? '***configured***' : 'not configured',
  });
});

export default app;
