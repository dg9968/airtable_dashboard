/**
 * DocuSign Envelopes API Routes
 * Handles sending documents for signing and receiving status updates
 */

import { Hono } from 'hono';
import {
  fetchRecords,
  findRecord,
  createRecords,
  updateRecords,
  type AirtableRecord,
  type SelectOptions
} from '../lib/airtable-service';

const app = new Hono();

// Helper functions to wrap the airtable-service exports
async function createRecord(tableName: string, fields: Record<string, any>): Promise<AirtableRecord> {
  const records = await createRecords(tableName, [{ fields }]);
  return records[0];
}

async function updateRecord(tableName: string, recordId: string, fields: Record<string, any>): Promise<AirtableRecord> {
  const records = await updateRecords(tableName, [{ id: recordId, fields }]);
  return records[0];
}

async function getRecord(tableName: string, recordId: string): Promise<AirtableRecord | null> {
  try {
    return await findRecord(tableName, recordId);
  } catch (error) {
    return null;
  }
}

async function getAllRecords(tableName: string, options?: SelectOptions): Promise<AirtableRecord[]> {
  return fetchRecords(tableName, options);
}

// Table name for signing envelopes - create this table in Airtable
const ENVELOPES_TABLE = 'Signing Envelopes';

// Status values for envelopes
export type EnvelopeStatus = 'Created' | 'Sent' | 'Delivered' | 'Viewed' | 'Signed' | 'Completed' | 'Declined' | 'Voided';

// Document types
export type DocumentType = '1040' | '1120' | '1120S' | '1065' | '990' | '8879' | 'Other';

interface SendForSigningRequest {
  documentRecordId: string;
  clientType: 'personal' | 'corporate';
  clientId: string;
  signerEmail: string;
  signerName: string;
  taxYear: string;
  documentType: DocumentType;
  templateId?: string;
  triggeredBy: string;
  driveFileId: string;
}

interface WebhookPayload {
  envelopeId: string;
  airtableRecordId?: string;
  status: string;
  timestamp: string;
  signedDocumentDriveId?: string;
  signedDocumentWebViewLink?: string;
  errorMessage?: string;
}

/**
 * POST /api/docusign/send
 * Trigger n8n workflow to send document for signing
 */
app.post('/send', async (c) => {
  try {
    const payload: SendForSigningRequest = await c.req.json();
    const {
      documentRecordId,
      clientType,
      clientId,
      signerEmail,
      signerName,
      taxYear,
      documentType,
      templateId,
      triggeredBy,
      driveFileId,
    } = payload;

    // Validate required fields
    if (!documentRecordId || !clientType || !clientId || !signerEmail || !signerName || !taxYear || !driveFileId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: documentRecordId, clientType, clientId, signerEmail, signerName, taxYear, driveFileId',
        },
        400
      );
    }

    // Check webhook URL is configured
    const webhookUrl = process.env.N8N_DOCUSIGN_WEBHOOK_URL;
    if (!webhookUrl) {
      return c.json(
        {
          success: false,
          error: 'N8N_DOCUSIGN_WEBHOOK_URL not configured',
        },
        500
      );
    }

    // Create envelope record in Airtable with "Created" status
    const envelopeFields: Record<string, any> = {
      'Status': 'Created',
      'Client Type': clientType === 'personal' ? 'Personal' : 'Corporate',
      'Signer Email': signerEmail,
      'Signer Name': signerName,
      'Tax Year': taxYear,
      'Document Type': documentType || 'Other',
      'Source Drive File ID': driveFileId,
      'Created By': triggeredBy,
      'Document': [documentRecordId], // Link to Documents table
    };

    // Link to appropriate client table
    if (clientType === 'personal') {
      envelopeFields['Personal'] = [clientId];
    } else {
      envelopeFields['Corporation'] = [clientId];
    }

    if (templateId) {
      envelopeFields['Template Used'] = templateId;
    }

    const envelopeRecord = await createRecord(ENVELOPES_TABLE, envelopeFields);
    console.log(`Created envelope record: ${envelopeRecord.id}`);

    // Prepare webhook payload for n8n
    const webhookPayload = {
      action: 'send',
      airtableRecordId: envelopeRecord.id,
      documentRecordId,
      clientType,
      clientId,
      signerEmail,
      signerName,
      taxYear,
      documentType: documentType || 'Other',
      templateId,
      driveFileId,
      triggeredBy,
      timestamp: new Date().toISOString(),
    };

    console.log('Triggering n8n DocuSign workflow:', { airtableRecordId: envelopeRecord.id, signerEmail });

    // Trigger n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook failed:', errorText);

      // Update envelope status to indicate error
      await updateRecord(ENVELOPES_TABLE, envelopeRecord.id, {
        'Status': 'Created',
        'Error Message': `Webhook failed: ${response.statusText} - ${errorText}`,
      });

      return c.json(
        {
          success: false,
          error: `Failed to trigger signing workflow: ${response.statusText}`,
          envelopeRecordId: envelopeRecord.id,
        },
        500
      );
    }

    const webhookResponse = await response.json().catch(() => ({}));

    return c.json({
      success: true,
      message: 'Signing request initiated',
      envelopeRecordId: envelopeRecord.id,
      webhookResponse,
    });
  } catch (error) {
    console.error('Error sending document for signing:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send for signing',
      },
      500
    );
  }
});

/**
 * POST /api/docusign/webhook
 * Receive status updates from n8n/DocuSign
 */
app.post('/webhook', async (c) => {
  try {
    const payload: WebhookPayload = await c.req.json();
    const {
      envelopeId,
      airtableRecordId,
      status,
      timestamp,
      signedDocumentDriveId,
      signedDocumentWebViewLink,
      errorMessage,
    } = payload;

    console.log('Received DocuSign webhook - full payload:', JSON.stringify(payload, null, 2));
    console.log('Extracted values:', { envelopeId, airtableRecordId, status });

    // Validate payload
    if (!airtableRecordId && !envelopeId) {
      console.log('Webhook rejected: missing both airtableRecordId and envelopeId');
      return c.json(
        {
          success: false,
          error: 'Either airtableRecordId or envelopeId is required',
          receivedPayload: payload,
        },
        400
      );
    }

    // Find the envelope record
    let recordId = airtableRecordId;

    // If airtableRecordId provided, verify it exists
    if (recordId) {
      console.log(`Looking up record by airtableRecordId: ${recordId}`);
      const existingRecord = await getRecord(ENVELOPES_TABLE, recordId);
      if (!existingRecord) {
        console.log(`Record ${recordId} not found in Airtable`);
        // Clear recordId so we can try searching by envelopeId
        recordId = undefined;
      } else {
        console.log(`Found record: ${recordId}`);
      }
    }

    // If no valid recordId yet, search by envelope ID
    if (!recordId && envelopeId) {
      console.log(`Searching by Envelope ID: ${envelopeId}`);
      const records = await getAllRecords(ENVELOPES_TABLE, {
        filterByFormula: `{Envelope ID} = '${envelopeId}'`,
        maxRecords: 1,
      });
      if (records.length > 0) {
        recordId = records[0].id;
        console.log(`Found record by Envelope ID: ${recordId}`);
      } else {
        console.log(`No record found with Envelope ID: ${envelopeId}`);
      }
    }

    if (!recordId) {
      console.log('Webhook failed: no matching record found');
      return c.json(
        {
          success: false,
          error: 'Envelope record not found',
          searchedAirtableId: airtableRecordId,
          searchedEnvelopeId: envelopeId,
        },
        404
      );
    }

    // Map status to proper format
    const statusMap: Record<string, EnvelopeStatus> = {
      'sent': 'Sent',
      'delivered': 'Delivered',
      'viewed': 'Viewed',
      'signed': 'Signed',
      'completed': 'Completed',
      'declined': 'Declined',
      'voided': 'Voided',
    };

    const normalizedStatus = statusMap[status.toLowerCase()] || status;

    // Prepare update fields
    const updateFields: Record<string, any> = {
      'Status': normalizedStatus,
    };

    // Store envelope ID if provided
    if (envelopeId) {
      updateFields['Envelope ID'] = envelopeId;
    }

    // Set timestamp based on status
    if (normalizedStatus === 'Sent') {
      updateFields['Sent At'] = timestamp;
    } else if (normalizedStatus === 'Completed' || normalizedStatus === 'Signed') {
      updateFields['Completed At'] = timestamp;
    } else if (normalizedStatus === 'Voided') {
      updateFields['Voided At'] = timestamp;
    }

    // Handle signed document
    if (signedDocumentDriveId) {
      updateFields['Signed Drive File ID'] = signedDocumentDriveId;
    }

    // Handle errors
    if (errorMessage) {
      updateFields['Error Message'] = errorMessage;
    }

    // Update the envelope record
    await updateRecord(ENVELOPES_TABLE, recordId, updateFields);
    console.log(`Updated envelope ${recordId} to status: ${normalizedStatus}`);

    return c.json({
      success: true,
      updated: true,
      recordId,
      status: normalizedStatus,
    });
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process webhook',
      },
      500
    );
  }
});

/**
 * GET /api/docusign/envelopes
 * List all envelopes with optional filtering
 */
app.get('/envelopes', async (c) => {
  try {
    const status = c.req.query('status');
    const clientType = c.req.query('clientType');
    const taxYear = c.req.query('taxYear');

    const filterParts: string[] = [];

    if (status) {
      filterParts.push(`{Status} = '${status}'`);
    }
    if (clientType) {
      const formattedType = clientType === 'personal' ? 'Personal' : 'Corporate';
      filterParts.push(`{Client Type} = '${formattedType}'`);
    }
    if (taxYear) {
      filterParts.push(`{Tax Year} = '${taxYear}'`);
    }

    const options: any = {
      sort: [{ field: 'Sent At', direction: 'desc' }],
    };

    if (filterParts.length > 0) {
      options.filterByFormula = filterParts.length === 1
        ? filterParts[0]
        : `AND(${filterParts.join(', ')})`;
    }

    const records = await getAllRecords(ENVELOPES_TABLE, options);

    return c.json({
      success: true,
      envelopes: records.map(record => ({
        id: record.id,
        ...record.fields,
      })),
      total: records.length,
    });
  } catch (error) {
    console.error('Error fetching envelopes:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch envelopes',
      },
      500
    );
  }
});

/**
 * GET /api/docusign/envelopes/:id
 * Get single envelope details
 */
app.get('/envelopes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await getRecord(ENVELOPES_TABLE, id);

    if (!record) {
      return c.json(
        {
          success: false,
          error: 'Envelope not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      envelope: {
        id: record.id,
        ...record.fields,
      },
    });
  } catch (error) {
    console.error('Error fetching envelope:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch envelope',
      },
      500
    );
  }
});

/**
 * GET /api/docusign/client/:clientId
 * Get envelopes for a specific client
 */
app.get('/client/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    const clientType = c.req.query('clientType') || 'personal';

    const linkField = clientType === 'personal' ? 'Personal' : 'Corporation';

    const records = await getAllRecords(ENVELOPES_TABLE, {
      filterByFormula: `FIND('${clientId}', ARRAYJOIN({${linkField}}))`,
      sort: [{ field: 'Sent At', direction: 'desc' }],
    });

    return c.json({
      success: true,
      envelopes: records.map(record => ({
        id: record.id,
        ...record.fields,
      })),
      total: records.length,
    });
  } catch (error) {
    console.error('Error fetching client envelopes:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch client envelopes',
      },
      500
    );
  }
});

/**
 * POST /api/docusign/void/:envelopeId
 * Void an envelope
 */
app.post('/void/:envelopeId', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');
    const body = await c.req.json().catch(() => ({}));
    const { reason, voidedBy } = body;

    // Get the envelope record
    const record = await getRecord(ENVELOPES_TABLE, envelopeId);
    if (!record) {
      return c.json(
        {
          success: false,
          error: 'Envelope not found',
        },
        404
      );
    }

    // Check if envelope can be voided (not already completed or voided)
    const currentStatus = record.fields['Status'];
    if (currentStatus === 'Completed' || currentStatus === 'Voided') {
      return c.json(
        {
          success: false,
          error: `Cannot void envelope with status: ${currentStatus}`,
        },
        400
      );
    }

    // Trigger n8n to void in DocuSign
    const webhookUrl = process.env.N8N_DOCUSIGN_WEBHOOK_URL;
    if (webhookUrl && record.fields['Envelope ID']) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'void',
            envelopeId: record.fields['Envelope ID'],
            airtableRecordId: envelopeId,
            reason,
            voidedBy,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookError) {
        console.error('Failed to trigger void webhook:', webhookError);
      }
    }

    // Update the envelope record
    await updateRecord(ENVELOPES_TABLE, envelopeId, {
      'Status': 'Voided',
      'Voided At': new Date().toISOString(),
      'Void Reason': reason || 'Voided by user',
    });

    return c.json({
      success: true,
      message: 'Envelope voided successfully',
    });
  } catch (error) {
    console.error('Error voiding envelope:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to void envelope',
      },
      500
    );
  }
});

/**
 * POST /api/docusign/resend/:envelopeId
 * Resend envelope notification
 */
app.post('/resend/:envelopeId', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');

    // Get the envelope record
    const record = await getRecord(ENVELOPES_TABLE, envelopeId);
    if (!record) {
      return c.json(
        {
          success: false,
          error: 'Envelope not found',
        },
        404
      );
    }

    // Check if envelope can be resent (must be sent or delivered)
    const currentStatus = record.fields['Status'];
    if (!['Sent', 'Delivered', 'Viewed'].includes(currentStatus)) {
      return c.json(
        {
          success: false,
          error: `Cannot resend envelope with status: ${currentStatus}`,
        },
        400
      );
    }

    // Trigger n8n to resend
    const webhookUrl = process.env.N8N_DOCUSIGN_WEBHOOK_URL;
    if (!webhookUrl) {
      return c.json(
        {
          success: false,
          error: 'N8N_DOCUSIGN_WEBHOOK_URL not configured',
        },
        500
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resend',
        envelopeId: record.fields['Envelope ID'],
        airtableRecordId: envelopeId,
        signerEmail: record.fields['Signer Email'],
        signerName: record.fields['Signer Name'],
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return c.json(
        {
          success: false,
          error: 'Failed to trigger resend workflow',
        },
        500
      );
    }

    return c.json({
      success: true,
      message: 'Resend notification triggered',
    });
  } catch (error) {
    console.error('Error resending envelope:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend envelope',
      },
      500
    );
  }
});

/**
 * GET /api/docusign/status
 * Check DocuSign integration status
 */
app.get('/status', async (c) => {
  const webhookUrl = process.env.N8N_DOCUSIGN_WEBHOOK_URL;

  return c.json({
    success: true,
    configured: !!webhookUrl,
    webhookUrl: webhookUrl ? '***configured***' : 'not configured',
  });
});

/**
 * GET /api/docusign/document/:documentId/signing-status
 * Get signing status for a specific document
 */
app.get('/document/:documentId/signing-status', async (c) => {
  try {
    const documentId = c.req.param('documentId');

    const records = await getAllRecords(ENVELOPES_TABLE, {
      filterByFormula: `FIND('${documentId}', ARRAYJOIN({Document}))`,
      sort: [{ field: 'Sent At', direction: 'desc' }],
      maxRecords: 1,
    });

    if (records.length === 0) {
      return c.json({
        success: true,
        hasEnvelope: false,
        envelope: null,
      });
    }

    const record = records[0];
    return c.json({
      success: true,
      hasEnvelope: true,
      envelope: {
        id: record.id,
        status: record.fields['Status'],
        sentAt: record.fields['Sent At'],
        completedAt: record.fields['Completed At'],
        signerEmail: record.fields['Signer Email'],
        signerName: record.fields['Signer Name'],
      },
    });
  } catch (error) {
    console.error('Error fetching document signing status:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch signing status',
      },
      500
    );
  }
});

export default app;
