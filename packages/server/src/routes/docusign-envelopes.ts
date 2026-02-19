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
import { uploadSignedDocument } from '../googleDrive';

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

// Table names
const ENVELOPES_TABLE = 'Signing Envelopes';
const TEMPLATES_TABLE = 'Signing Templates';

// SignNow OAuth token cache
let signNowAccessToken: string | null = null;
let signNowTokenExpiry: number = 0;

/**
 * Get a valid SignNow access token, refreshing if needed
 * Uses OAuth 2.0 password grant flow
 */
async function getSignNowAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (signNowAccessToken && Date.now() < signNowTokenExpiry) {
    return signNowAccessToken;
  }

  const clientId = process.env.SIGNNOW_CLIENT_ID;
  const clientSecret = process.env.SIGNNOW_CLIENT_SECRET;
  const username = process.env.SIGNNOW_USERNAME;
  const password = process.env.SIGNNOW_PASSWORD;
  const apiUrl = process.env.SIGNNOW_API_URL || 'https://api.signnow.com';

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('SignNow credentials not configured');
  }

  const response = await fetch(`${apiUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SignNow auth failed:', errorText);
    throw new Error(`SignNow auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  signNowAccessToken = data.access_token;
  // Expire token 1 minute early to avoid edge cases
  signNowTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

  console.log('SignNow access token obtained successfully');
  return signNowAccessToken;
}

// Status values for envelopes
export type EnvelopeStatus = 'Created' | 'Sent' | 'Delivered' | 'Viewed' | 'Signed' | 'Completed' | 'Declined' | 'Voided';

// Document types
export type DocumentType = '1040' | '1120' | '1120S' | '1065' | '990' | '8879' | 'Other';

// Template interface
export interface SigningTemplate {
  id: string;
  templateName: string;
  templateCode: string;
  dropboxSignTemplateId: string;
  documentTypes: string[];
  clientType: 'Personal' | 'Corporate' | 'Both';
  numberOfSigners: number;
  description?: string;
  status: 'Active' | 'Draft' | 'Archived';
  sortOrder?: number;
}

interface SendForSigningRequest {
  documentRecordId: string;
  clientType: 'personal' | 'corporate';
  clientId: string;
  signerEmail: string;
  signerName: string;
  // Second signer for MFJ templates
  signer2Email?: string;
  signer2Name?: string;
  taxYear: string;
  documentType: DocumentType;
  templateId?: string;  // Airtable record ID of the template
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
      signer2Email,
      signer2Name,
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

    // Look up template to get Dropbox Sign template ID
    let dropboxSignTemplateId: string | undefined;
    let numberOfSigners = 1;
    if (templateId) {
      const templateRecord = await getRecord(TEMPLATES_TABLE, templateId);
      if (templateRecord) {
        dropboxSignTemplateId = templateRecord.fields['Dropbox Sign Template ID'];
        numberOfSigners = templateRecord.fields['Number of Signers'] || 1;
        console.log(`Using template: ${templateRecord.fields['Template Name']}, Dropbox Sign ID: ${dropboxSignTemplateId}`);
      }
    }

    // Validate second signer if template requires 2 signers
    if (numberOfSigners === 2 && (!signer2Email || !signer2Name)) {
      return c.json(
        {
          success: false,
          error: 'This template requires two signers. Please provide signer2Email and signer2Name.',
        },
        400
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

    // Add second signer info if provided
    if (signer2Email && signer2Name) {
      envelopeFields['Signer 2 Email'] = signer2Email;
      envelopeFields['Signer 2 Name'] = signer2Name;
    }

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
    const webhookPayload: Record<string, any> = {
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
      dropboxSignTemplateId,  // The actual Dropbox Sign template ID for n8n to use
      numberOfSigners,
      driveFileId,
      triggeredBy,
      timestamp: new Date().toISOString(),
    };

    // Add second signer to payload if provided
    if (signer2Email && signer2Name) {
      webhookPayload.signer2Email = signer2Email;
      webhookPayload.signer2Name = signer2Name;
    }

    console.log('Triggering n8n Dropbox Sign workflow:', { airtableRecordId: envelopeRecord.id, signerEmail, dropboxSignTemplateId });

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

/**
 * GET /api/docusign/templates
 * List all active signing templates with optional filtering
 */
app.get('/templates', async (c) => {
  try {
    const documentType = c.req.query('documentType');
    const clientType = c.req.query('clientType');

    const filterParts: string[] = [];

    // Always filter for active templates
    filterParts.push(`{Status} = 'Active'`);

    // Filter by document type if provided
    if (documentType) {
      filterParts.push(`FIND('${documentType}', ARRAYJOIN({Document Types}, ','))`);
    }

    // Filter by client type if provided (Personal, Corporate, or Both)
    if (clientType) {
      const formattedType = clientType === 'personal' ? 'Personal' : 'Corporate';
      filterParts.push(`OR({Client Type} = '${formattedType}', {Client Type} = 'Both')`);
    }

    const options: SelectOptions = {
      filterByFormula: filterParts.length === 1
        ? filterParts[0]
        : `AND(${filterParts.join(', ')})`,
      sort: [{ field: 'Sort Order', direction: 'asc' }],
    };

    const records = await getAllRecords(TEMPLATES_TABLE, options);

    const templates: SigningTemplate[] = records.map(record => ({
      id: record.id,
      templateName: record.fields['Template Name'] || '',
      templateCode: record.fields['Template Code'] || '',
      dropboxSignTemplateId: record.fields['Dropbox Sign Template ID'] || '',
      documentTypes: record.fields['Document Types'] || [],
      clientType: record.fields['Client Type'] || 'Both',
      numberOfSigners: record.fields['Number of Signers'] || 1,
      description: record.fields['Description'] || '',
      status: record.fields['Status'] || 'Draft',
      sortOrder: record.fields['Sort Order'] || 0,
    }));

    return c.json({
      success: true,
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error('Error fetching signing templates:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      },
      500
    );
  }
});

/**
 * GET /api/docusign/templates/:id
 * Get single template details
 */
app.get('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await getRecord(TEMPLATES_TABLE, id);

    if (!record) {
      return c.json(
        {
          success: false,
          error: 'Template not found',
        },
        404
      );
    }

    const template: SigningTemplate = {
      id: record.id,
      templateName: record.fields['Template Name'] || '',
      templateCode: record.fields['Template Code'] || '',
      dropboxSignTemplateId: record.fields['Dropbox Sign Template ID'] || '',
      documentTypes: record.fields['Document Types'] || [],
      clientType: record.fields['Client Type'] || 'Both',
      numberOfSigners: record.fields['Number of Signers'] || 1,
      description: record.fields['Description'] || '',
      status: record.fields['Status'] || 'Draft',
      sortOrder: record.fields['Sort Order'] || 0,
    };

    return c.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      },
      500
    );
  }
});

/**
 * POST /api/docusign/upload-signed
 * Upload signed document to Google Drive (called by n8n workflow)
 *
 * This endpoint allows n8n to upload signed PDFs through the app's Google Drive credentials,
 * solving the 403 permission error when n8n tries to upload directly.
 *
 * If clientCode/taxYear not provided, looks them up from the envelope record.
 */
app.post('/upload-signed', async (c) => {
  try {
    const body = await c.req.json();
    let {
      airtableRecordId,
      signatureRequestId,
      fileBase64,
      fileName,
      clientCode,
      taxYear,
      clientType,
    } = body;

    // Validate required fields
    if (!fileBase64) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: fileBase64 (base64-encoded PDF)',
        },
        400
      );
    }

    // If clientCode/taxYear not provided, look up from envelope record
    if ((!clientCode || !taxYear) && airtableRecordId) {
      console.log(`Looking up client info from envelope record: ${airtableRecordId}`);
      const envelopeRecord = await getRecord(ENVELOPES_TABLE, airtableRecordId);

      if (envelopeRecord) {
        taxYear = taxYear || envelopeRecord.fields['Tax Year'];
        clientType = clientType || envelopeRecord.fields['Client Type'];

        // Get client code from linked Personal or Corporation record
        const personalIds = envelopeRecord.fields['Personal'] as string[] | undefined;
        const corporationIds = envelopeRecord.fields['Corporation'] as string[] | undefined;

        if (personalIds && personalIds.length > 0) {
          const personalRecord = await getRecord('Personal', personalIds[0]);
          if (personalRecord) {
            clientCode = personalRecord.fields['Client Code'] || personalRecord.fields['Code'];
          }
        } else if (corporationIds && corporationIds.length > 0) {
          const corpRecord = await getRecord('Corporations', corporationIds[0]);
          if (corpRecord) {
            clientCode = corpRecord.fields['Client Code'] || corpRecord.fields['Code'];
          }
        }
      }
    }

    // Still missing required fields?
    if (!clientCode || !taxYear) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: clientCode and taxYear. Provide them directly or include airtableRecordId to look them up.',
        },
        400
      );
    }

    console.log(`Uploading signed document for client ${clientCode}, tax year ${taxYear}`);

    // Decode base64 to buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // Generate filename if not provided
    const finalFileName = fileName || `signed_${Date.now()}.pdf`;

    // Determine if corporate based on clientType
    const isCorporate = clientType === 'corporate' || clientType === 'Corporate';

    // Upload to Google Drive using the app's credentials
    const uploadResult = await uploadSignedDocument(
      fileBuffer,
      finalFileName,
      'application/pdf',
      clientCode,
      taxYear,
      isCorporate
    );

    console.log(`Signed document uploaded: ${uploadResult.fileId}`);

    // If airtableRecordId provided, update the envelope record
    if (airtableRecordId) {
      try {
        await updateRecord(ENVELOPES_TABLE, airtableRecordId, {
          'Signed Drive File ID': uploadResult.fileId,
          'Status': 'Completed',
          'Completed At': new Date().toISOString(),
        });
        console.log(`Updated envelope record ${airtableRecordId} with signed document`);
      } catch (updateError) {
        console.error('Failed to update envelope record:', updateError);
        // Don't fail the whole request if Airtable update fails
      }
    }

    return c.json({
      success: true,
      fileId: uploadResult.fileId,
      webViewLink: uploadResult.webViewLink,
      webContentLink: uploadResult.webContentLink,
      message: 'Signed document uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading signed document:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload signed document',
      },
      500
    );
  }
});

/**
 * POST /api/docusign/download-and-upload
 * Download signed document from SignNow and upload to Google Drive
 *
 * Alternative endpoint that handles the full flow:
 * 1. Download signed PDF from SignNow using document ID
 * 2. Upload to Google Drive
 * 3. Update Airtable record
 *
 * Note: This requires SignNow credentials to be configured
 * If clientCode/taxYear not provided, looks them up from the envelope record.
 */
app.post('/download-and-upload', async (c) => {
  try {
    const body = await c.req.json();
    let {
      airtableRecordId,
      signatureRequestId,
      clientCode,
      taxYear,
      clientType,
      fileName,
    } = body;

    // Validate required fields
    if (!signatureRequestId) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: signatureRequestId',
        },
        400
      );
    }

    // If clientCode/taxYear not provided, look up from envelope record
    if ((!clientCode || !taxYear) && airtableRecordId) {
      console.log(`Looking up client info from envelope record: ${airtableRecordId}`);
      const envelopeRecord = await getRecord(ENVELOPES_TABLE, airtableRecordId);

      if (envelopeRecord) {
        taxYear = taxYear || envelopeRecord.fields['Tax Year'];
        clientType = clientType || envelopeRecord.fields['Client Type'];

        // Get client code from linked Personal or Corporation record
        const personalIds = envelopeRecord.fields['Personal'] as string[] | undefined;
        const corporationIds = envelopeRecord.fields['Corporation'] as string[] | undefined;

        if (personalIds && personalIds.length > 0) {
          const personalRecord = await getRecord('Personal', personalIds[0]);
          if (personalRecord) {
            clientCode = personalRecord.fields['Client Code'] || personalRecord.fields['Code'];
          }
        } else if (corporationIds && corporationIds.length > 0) {
          const corpRecord = await getRecord('Corporations', corporationIds[0]);
          if (corpRecord) {
            clientCode = corpRecord.fields['Client Code'] || corpRecord.fields['Code'];
          }
        }
      }
    }

    // Still missing required fields?
    if (!clientCode || !taxYear) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: clientCode and taxYear. Provide them directly or include airtableRecordId to look them up.',
        },
        400
      );
    }

    const signNowConfigured = process.env.SIGNNOW_CLIENT_ID && process.env.SIGNNOW_CLIENT_SECRET;
    if (!signNowConfigured) {
      return c.json(
        {
          success: false,
          error: 'SignNow credentials not configured. Use /upload-signed with base64 data instead.',
        },
        500
      );
    }

    console.log(`Downloading signed document from SignNow: ${signatureRequestId}`);

    // Get SignNow access token and download PDF
    const signNowApiUrl = process.env.SIGNNOW_API_URL || 'https://api.signnow.com';
    const accessToken = await getSignNowAccessToken();

    // In SignNow, signatureRequestId is the document ID
    const signNowResponse = await fetch(
      `${signNowApiUrl}/document/${signatureRequestId}/download?type=collapsed`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!signNowResponse.ok) {
      const errorText = await signNowResponse.text();
      console.error('SignNow download failed:', errorText);
      return c.json(
        {
          success: false,
          error: `Failed to download from SignNow: ${signNowResponse.statusText}`,
        },
        500
      );
    }

    const fileBuffer = Buffer.from(await signNowResponse.arrayBuffer());
    console.log(`Downloaded ${fileBuffer.length} bytes from SignNow`);

    // Generate filename
    const finalFileName = fileName || `signed_${signatureRequestId}.pdf`;

    // Determine if corporate
    const isCorporate = clientType === 'corporate' || clientType === 'Corporate';

    // Upload to Google Drive
    const uploadResult = await uploadSignedDocument(
      fileBuffer,
      finalFileName,
      'application/pdf',
      clientCode,
      taxYear,
      isCorporate
    );

    console.log(`Signed document uploaded: ${uploadResult.fileId}`);

    // Update Airtable record if provided
    if (airtableRecordId) {
      try {
        await updateRecord(ENVELOPES_TABLE, airtableRecordId, {
          'Signed Drive File ID': uploadResult.fileId,
          'Status': 'Completed',
          'Completed At': new Date().toISOString(),
        });
        console.log(`Updated envelope record ${airtableRecordId}`);
      } catch (updateError) {
        console.error('Failed to update envelope record:', updateError);
      }
    }

    return c.json({
      success: true,
      fileId: uploadResult.fileId,
      webViewLink: uploadResult.webViewLink,
      webContentLink: uploadResult.webContentLink,
      message: 'Signed document downloaded and uploaded successfully',
    });
  } catch (error) {
    console.error('Error in download-and-upload:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process signed document',
      },
      500
    );
  }
});

export default app;
