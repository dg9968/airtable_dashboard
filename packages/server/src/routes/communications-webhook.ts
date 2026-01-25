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
 * Supports two modes:
 * 1. Single mode (backward compatible):
 * {
 *   messageId: string,
 *   corporateId: string,
 *   emailSubject: string,
 *   emailContent: string,
 *   junctionRecordId: string,
 *   timestamp?: string
 * }
 *
 * 2. Batch mode:
 * {
 *   mode: 'batch',
 *   batchId: string,
 *   timestamp: string,
 *   totalClients: number,
 *   templateUsed?: { id: string, name: string, category: string },
 *   clients: Array<{
 *     messageId: string,
 *     corporateId: string,
 *     junctionRecordId: string,
 *     clientData: {...},
 *     emailSubject: string,
 *     emailContent: string,
 *     variableValues: {...}
 *   }>
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

    // Detect mode (batch or single)
    const mode = payload.mode || 'single';

    if (mode === 'batch') {
      // Validate batch payload
      const { batchId, clients } = payload;

      if (!batchId || !clients || !Array.isArray(clients) || clients.length === 0) {
        return c.json(
          {
            success: false,
            error: 'Batch mode requires batchId and clients array',
          },
          400
        );
      }

      console.log(`Triggering n8n webhook (BATCH mode): ${batchId} with ${clients.length} clients`);

      const webhookPayload = {
        mode: 'batch',
        batchId,
        timestamp: payload.timestamp || new Date().toISOString(),
        totalClients: clients.length,
        ...(payload.templateUsed ? { templateUsed: payload.templateUsed } : {}),
        clients,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook failed: ${response.statusText} - ${errorText}`);
      }

      const webhookResponse = await response.json().catch(() => ({}));

      return c.json({
        success: true,
        message: `Batch webhook triggered successfully for ${clients.length} clients`,
        webhookResponse,
      });
    } else {
      // Single mode (backward compatible)
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

      console.log('Triggering n8n webhook (SINGLE mode):', { messageId, corporateId, emailSubject });

      const webhookPayload = {
        mode: 'single',
        messageId,
        corporateId,
        emailSubject,
        emailContent,
        junctionRecordId,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
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
    }
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
