/**
 * Batch Communications API Routes
 * Handle multi-client batch messaging operations
 */

import { Hono } from 'hono';
import { createRecords, getRecord } from '../lib/airtable-helpers.js';
import { renderMessage, type CorporateClient, type VariableDefinition } from '../lib/template-engine.js';

const app = new Hono();

const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const MESSAGES_TABLE = 'Messages';
const COMMUNICATIONS_CORPORATE_TABLE = 'Communications Corporate';
const TEMPLATES_TABLE = 'Message Templates';

interface BatchClient {
  corporateId: string;
  clientData: CorporateClient;
  variableValues: Record<string, any>;
  personalizedSubject: string;
  personalizedContent: string;
}

/**
 * POST /api/communications/render-template
 * Render template with variable replacement for preview
 *
 * Body:
 * {
 *   subjectTemplate: string,
 *   contentTemplate: string,
 *   variableValues: Record<string, any>,
 *   clientData: CorporateClient,
 *   variableDefinitions: VariableDefinition[]
 * }
 */
app.post('/render-template', async (c) => {
  try {
    const {
      subjectTemplate,
      contentTemplate,
      variableValues,
      clientData,
      variableDefinitions,
    } = await c.req.json();

    if (!subjectTemplate || !contentTemplate) {
      return c.json(
        {
          success: false,
          error: 'Subject template and content template are required',
        },
        400
      );
    }

    const result = renderMessage(
      subjectTemplate,
      contentTemplate,
      variableValues || {},
      clientData || {},
      variableDefinitions || []
    );

    return c.json({
      success: true,
      data: {
        renderedSubject: result.subject,
        renderedContent: result.content,
        missingVariables: result.missingVariables,
      },
    });
  } catch (error) {
    console.error('Error rendering template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to render template',
      },
      500
    );
  }
});

/**
 * POST /api/communications/validate-batch
 * Validate batch before sending (dry run)
 *
 * Body:
 * {
 *   clients: BatchClient[]
 * }
 */
app.post('/validate-batch', async (c) => {
  try {
    const { clients } = await c.req.json();

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Clients array is required and must not be empty',
        },
        400
      );
    }

    const warnings: Array<{
      clientId: string;
      clientName: string;
      issues: string[];
    }> = [];

    let validClients = 0;

    clients.forEach((client: BatchClient) => {
      const issues: string[] = [];

      // Check for missing email
      if (!client.clientData.email) {
        issues.push('Missing email address');
      }

      // Check for missing company name
      if (!client.clientData.name) {
        issues.push('Missing company name');
      }

      // Check for unreplaced variables in subject
      const subjectVars = client.personalizedSubject.match(/\{\{(\w+)\}\}/g);
      if (subjectVars) {
        issues.push(`Unreplaced variables in subject: ${subjectVars.join(', ')}`);
      }

      // Check for unreplaced variables in content
      const contentVars = client.personalizedContent.match(/\{\{(\w+)\}\}/g);
      if (contentVars) {
        issues.push(`Unreplaced variables in content: ${contentVars.join(', ')}`);
      }

      if (issues.length > 0) {
        warnings.push({
          clientId: client.corporateId,
          clientName: client.clientData.name || 'Unknown',
          issues,
        });
      } else {
        validClients++;
      }
    });

    return c.json({
      success: true,
      validClients,
      invalidClients: warnings.length,
      totalClients: clients.length,
      warnings,
    });
  } catch (error) {
    console.error('Error validating batch:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate batch',
      },
      500
    );
  }
});

/**
 * POST /api/communications/batch
 * Create batch communication with multiple clients
 *
 * Body:
 * {
 *   templateId?: string,
 *   batchId: string,
 *   clients: BatchClient[]
 * }
 */
app.post('/batch', async (c) => {
  try {
    const { templateId, batchId, clients } = await c.req.json();

    if (!batchId) {
      return c.json(
        {
          success: false,
          error: 'Batch ID is required',
        },
        400
      );
    }

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Clients array is required and must not be empty',
        },
        400
      );
    }

    console.log(`[Batch ${batchId}] Creating batch communication for ${clients.length} clients`);

    // Get template if provided
    let templateData = null;
    if (templateId) {
      try {
        const templateRecord = await getRecord(BASE_ID, TEMPLATES_TABLE, templateId);
        templateData = {
          id: templateRecord.id,
          name: templateRecord.fields['Template Name'],
          category: templateRecord.fields['Category'],
        };
      } catch (error) {
        console.warn(`Template ${templateId} not found, proceeding without template link`);
      }
    }

    // Step 1: Create Message records for each client
    const messageRecords = clients.map((client: BatchClient) => ({
      fields: {
        'Email Subject': client.personalizedSubject,
        'Email Content': client.personalizedContent,
        'Is Batch Message': true,
        'Batch ID': batchId,
        'Variables Used': JSON.stringify(client.variableValues),
        ...(templateData ? { 'Template Used': [templateId] } : {}),
      },
    }));

    console.log(`[Batch ${batchId}] Creating ${messageRecords.length} message records...`);
    const createdMessages = await createRecords(BASE_ID, MESSAGES_TABLE, messageRecords);
    console.log(`[Batch ${batchId}] Created ${createdMessages.length} message records`);

    // Step 2: Create junction records linking messages to corporations
    const junctionRecords = clients.map((client: BatchClient, index: number) => ({
      fields: {
        Message: [createdMessages[index].id],
        Corporate: [client.corporateId],
        'Batch ID': batchId,
        'Personalized Subject': client.personalizedSubject,
        'Personalized Content': client.personalizedContent,
        'Variable Values': JSON.stringify(client.variableValues),
        Status: 'Pending',
      },
    }));

    console.log(`[Batch ${batchId}] Creating ${junctionRecords.length} junction records...`);
    const createdJunctions = await createRecords(
      BASE_ID,
      COMMUNICATIONS_CORPORATE_TABLE,
      junctionRecords
    );
    console.log(`[Batch ${batchId}] Created ${createdJunctions.length} junction records`);

    // Small delay to ensure Airtable has committed all records
    // This prevents race conditions with n8n trying to update records immediately
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Trigger webhook with batch payload
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    let webhookTriggered = false;
    let webhookError = null;

    if (webhookUrl) {
      try {
        console.log(`[Batch ${batchId}] Triggering webhook...`);

        const webhookPayload = {
          mode: 'batch',
          batchId,
          timestamp: new Date().toISOString(),
          totalClients: clients.length,
          ...(templateData ? { templateUsed: templateData } : {}),
          clients: clients.map((client: BatchClient, index: number) => ({
            messageId: createdMessages[index].id,
            corporateId: client.corporateId,
            junctionRecordId: createdJunctions[index].id,
            clientData: {
              name: client.clientData.name || '',
              email: client.clientData.email || '',
              ein: client.clientData.ein || '',
              phone: client.clientData.phone || '',
              address: client.clientData.address || '',
              city: client.clientData.city || '',
              state: client.clientData.state || '',
              zipCode: client.clientData.zipCode || '',
              clientCode: client.clientData.clientCode || '',
            },
            emailSubject: client.personalizedSubject,
            emailContent: client.personalizedContent,
            variableValues: client.variableValues,
          })),
        };

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          webhookTriggered = true;
          console.log(`[Batch ${batchId}] Webhook triggered successfully`);
        } else {
          const errorText = await webhookResponse.text();
          webhookError = `Webhook failed: ${webhookResponse.statusText} - ${errorText}`;
          console.error(`[Batch ${batchId}] ${webhookError}`);
        }
      } catch (error) {
        webhookError = error instanceof Error ? error.message : 'Unknown webhook error';
        console.error(`[Batch ${batchId}] Webhook error:`, error);
      }
    } else {
      webhookError = 'N8N_WEBHOOK_URL not configured';
      console.warn(`[Batch ${batchId}] ${webhookError}`);
    }

    return c.json({
      success: true,
      data: {
        batchId,
        messagesCreated: createdMessages.length,
        junctionsCreated: createdJunctions.length,
        webhookTriggered,
        webhookError,
        messageIds: createdMessages.map((m) => m.id),
        junctionIds: createdJunctions.map((j) => j.id),
        errors: [],
      },
    });
  } catch (error) {
    console.error('Error creating batch communication:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch communication',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

export default app;
