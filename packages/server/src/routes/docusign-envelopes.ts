/**
 * DocuSign/SignNow Envelopes API Routes (Postgres-backed)
 * Handles sending documents for signing and receiving status updates
 */

import { Hono } from 'hono';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  signingEnvelopes,
  signingTemplates,
  personal,
  corporations,
} from '../db/schema';
import { uploadSignedDocument } from '../googleDrive';

const app = new Hono();

type EnvelopeRow = typeof signingEnvelopes.$inferSelect;

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

/** Legacy response shape: { id, ...fields } flattened at top level. */
function flattenEnvelope(row: EnvelopeRow): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row.id };
  const put = (name: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    out[name] = value;
  };
  put('Status', row.status);
  put('Client Type', row.clientType);
  put('Signer Email', row.signerEmail);
  put('Signer Name', row.signerName);
  put('Signer 2 Email', row.signer2Email);
  put('Signer 2 Name', row.signer2Name);
  put('Tax Year', row.taxYear);
  put('Document Type', row.documentType);
  put('Source Drive File ID', row.sourceDriveFileId);
  put('Created By', row.createdBy);
  put('Document', row.documentId ? [row.documentId] : null);
  put('Personal', row.personalId ? [row.personalId] : null);
  put('Corporation', row.corporationId ? [row.corporationId] : null);
  put('Template Used', row.templateUsedId);
  put('Envelope ID', row.envelopeId);
  put('Error Message', row.errorMessage);
  put('Sent At', row.sentAt);
  put('Completed At', row.completedAt);
  put('Signed Drive File ID', row.signedDriveFileId);
  put('Voided At', row.voidedAt);
  put('Void Reason', row.voidReason);
  return out;
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

    if (!documentRecordId || !clientType || !clientId || !signerEmail || !signerName || !taxYear || !driveFileId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: documentRecordId, clientType, clientId, signerEmail, signerName, taxYear, driveFileId',
        },
        400
      );
    }

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

    const db = getDb();

    // Look up template to get Dropbox Sign template ID
    let dropboxSignTemplateId: string | undefined;
    let numberOfSigners = 1;
    if (templateId) {
      const [templateRow] = await db
        .select()
        .from(signingTemplates)
        .where(eq(signingTemplates.id, templateId))
        .limit(1);
      if (templateRow) {
        dropboxSignTemplateId = templateRow.dropboxSignTemplateId ?? undefined;
        numberOfSigners = templateRow.numberOfSigners ?? 1;
        console.log(`Using template: ${templateRow.templateName}, Dropbox Sign ID: ${dropboxSignTemplateId}`);
      }
    }

    if (numberOfSigners === 2 && (!signer2Email || !signer2Name)) {
      return c.json(
        {
          success: false,
          error: 'This template requires two signers. Please provide signer2Email and signer2Name.',
        },
        400
      );
    }

    const [envelopeRow] = await db
      .insert(signingEnvelopes)
      .values({
        status: 'Created',
        clientType: clientType === 'personal' ? 'Personal' : 'Corporate',
        signerEmail,
        signerName,
        signer2Email: signer2Email || null,
        signer2Name: signer2Name || null,
        taxYear,
        documentType: documentType || 'Other',
        sourceDriveFileId: driveFileId,
        createdBy: triggeredBy,
        documentId: documentRecordId,
        personalId: clientType === 'personal' ? clientId : null,
        corporationId: clientType === 'corporate' ? clientId : null,
        templateUsedId: templateId || null,
      })
      .returning();

    console.log(`Created envelope record: ${envelopeRow.id}`);

    const webhookPayload: Record<string, any> = {
      action: 'send',
      airtableRecordId: envelopeRow.id,
      documentRecordId,
      clientType,
      clientId,
      signerEmail,
      signerName,
      taxYear,
      documentType: documentType || 'Other',
      templateId,
      dropboxSignTemplateId,
      numberOfSigners,
      driveFileId,
      triggeredBy,
      timestamp: new Date().toISOString(),
    };

    if (signer2Email && signer2Name) {
      webhookPayload.signer2Email = signer2Email;
      webhookPayload.signer2Name = signer2Name;
    }

    console.log('Triggering n8n Dropbox Sign workflow:', { airtableRecordId: envelopeRow.id, signerEmail, dropboxSignTemplateId });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook failed:', errorText);

      await db
        .update(signingEnvelopes)
        .set({ status: 'Created', errorMessage: `Webhook failed: ${response.statusText} - ${errorText}` })
        .where(eq(signingEnvelopes.id, envelopeRow.id));

      return c.json(
        {
          success: false,
          error: `Failed to trigger signing workflow: ${response.statusText}`,
          envelopeRecordId: envelopeRow.id,
        },
        500
      );
    }

    const webhookResponse = await response.json().catch(() => ({}));

    return c.json({
      success: true,
      message: 'Signing request initiated',
      envelopeRecordId: envelopeRow.id,
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
      errorMessage,
    } = payload;

    console.log('Received DocuSign webhook - full payload:', JSON.stringify(payload, null, 2));
    console.log('Extracted values:', { envelopeId, airtableRecordId, status });

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

    const db = getDb();

    // Find the envelope record
    let recordId = airtableRecordId;

    if (recordId) {
      console.log(`Looking up record by airtableRecordId: ${recordId}`);
      const [existing] = await db.select({ id: signingEnvelopes.id }).from(signingEnvelopes).where(eq(signingEnvelopes.id, recordId)).limit(1);
      if (!existing) {
        console.log(`Record ${recordId} not found`);
        recordId = undefined;
      } else {
        console.log(`Found record: ${recordId}`);
      }
    }

    if (!recordId && envelopeId) {
      console.log(`Searching by Envelope ID: ${envelopeId}`);
      const [found] = await db
        .select({ id: signingEnvelopes.id })
        .from(signingEnvelopes)
        .where(eq(signingEnvelopes.envelopeId, envelopeId))
        .limit(1);
      if (found) {
        recordId = found.id;
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

    const statusMap: Record<string, EnvelopeStatus> = {
      'sent': 'Sent',
      'delivered': 'Delivered',
      'viewed': 'Viewed',
      'signed': 'Signed',
      'completed': 'Completed',
      'declined': 'Declined',
      'voided': 'Voided',
    };

    const normalizedStatus = statusMap[status.toLowerCase()] || (status as EnvelopeStatus);

    const values: Partial<typeof signingEnvelopes.$inferInsert> = {
      status: normalizedStatus,
    };

    if (envelopeId) values.envelopeId = envelopeId;

    if (normalizedStatus === 'Sent') {
      values.sentAt = timestamp;
    } else if (normalizedStatus === 'Completed' || normalizedStatus === 'Signed') {
      values.completedAt = timestamp;
    } else if (normalizedStatus === 'Voided') {
      values.voidedAt = timestamp;
    }

    if (signedDocumentDriveId) values.signedDriveFileId = signedDocumentDriveId;
    if (errorMessage) values.errorMessage = errorMessage;

    await db.update(signingEnvelopes).set(values).where(eq(signingEnvelopes.id, recordId));
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

    const conditions = [];
    if (status) conditions.push(eq(signingEnvelopes.status, status as EnvelopeStatus));
    if (clientType) conditions.push(eq(signingEnvelopes.clientType, clientType === 'personal' ? 'Personal' : 'Corporate'));
    if (taxYear) conditions.push(eq(signingEnvelopes.taxYear, taxYear));

    const db = getDb();
    const rows = await db
      .select()
      .from(signingEnvelopes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(signingEnvelopes.sentAt));

    return c.json({
      success: true,
      envelopes: rows.map(flattenEnvelope),
      total: rows.length,
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
    const [row] = await getDb().select().from(signingEnvelopes).where(eq(signingEnvelopes.id, id)).limit(1);

    if (!row) {
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
      envelope: flattenEnvelope(row),
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

    const db = getDb();
    const rows = await db
      .select()
      .from(signingEnvelopes)
      .where(
        clientType === 'personal'
          ? eq(signingEnvelopes.personalId, clientId)
          : eq(signingEnvelopes.corporationId, clientId)
      )
      .orderBy(desc(signingEnvelopes.sentAt));

    return c.json({
      success: true,
      envelopes: rows.map(flattenEnvelope),
      total: rows.length,
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

    const db = getDb();
    const [row] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, envelopeId)).limit(1);
    if (!row) {
      return c.json(
        {
          success: false,
          error: 'Envelope not found',
        },
        404
      );
    }

    if (row.status === 'Completed' || row.status === 'Voided') {
      return c.json(
        {
          success: false,
          error: `Cannot void envelope with status: ${row.status}`,
        },
        400
      );
    }

    const webhookUrl = process.env.N8N_DOCUSIGN_WEBHOOK_URL;
    if (webhookUrl && row.envelopeId) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'void',
            envelopeId: row.envelopeId,
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

    await db
      .update(signingEnvelopes)
      .set({
        status: 'Voided',
        voidedAt: new Date().toISOString(),
        voidReason: reason || 'Voided by user',
      })
      .where(eq(signingEnvelopes.id, envelopeId));

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

    const [row] = await getDb().select().from(signingEnvelopes).where(eq(signingEnvelopes.id, envelopeId)).limit(1);
    if (!row) {
      return c.json(
        {
          success: false,
          error: 'Envelope not found',
        },
        404
      );
    }

    if (!['Sent', 'Delivered', 'Viewed'].includes(row.status)) {
      return c.json(
        {
          success: false,
          error: `Cannot resend envelope with status: ${row.status}`,
        },
        400
      );
    }

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
        envelopeId: row.envelopeId,
        airtableRecordId: envelopeId,
        signerEmail: row.signerEmail,
        signerName: row.signerName,
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

    const [row] = await getDb()
      .select()
      .from(signingEnvelopes)
      .where(eq(signingEnvelopes.documentId, documentId))
      .orderBy(desc(signingEnvelopes.sentAt))
      .limit(1);

    if (!row) {
      return c.json({
        success: true,
        hasEnvelope: false,
        envelope: null,
      });
    }

    return c.json({
      success: true,
      hasEnvelope: true,
      envelope: {
        id: row.id,
        status: row.status,
        sentAt: row.sentAt,
        completedAt: row.completedAt,
        signerEmail: row.signerEmail,
        signerName: row.signerName,
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

    const conditions = [eq(signingTemplates.status, 'Active')];
    if (documentType) {
      // documentTypes is text[]; match if the array contains the requested type
      conditions.push(sql`${documentType} = ANY(${signingTemplates.documentTypes})`);
    }
    if (clientType) {
      const formattedType = clientType === 'personal' ? 'Personal' : 'Corporate';
      conditions.push(or(eq(signingTemplates.clientType, formattedType), eq(signingTemplates.clientType, 'Both'))!);
    }

    const rows = await getDb()
      .select()
      .from(signingTemplates)
      .where(and(...conditions))
      .orderBy(signingTemplates.sortOrder);

    const templates: SigningTemplate[] = rows.map(row => ({
      id: row.id,
      templateName: row.templateName || '',
      templateCode: row.templateCode || '',
      dropboxSignTemplateId: row.dropboxSignTemplateId || '',
      documentTypes: row.documentTypes || [],
      clientType: (row.clientType as SigningTemplate['clientType']) || 'Both',
      numberOfSigners: row.numberOfSigners || 1,
      description: row.description || '',
      status: (row.status as SigningTemplate['status']) || 'Draft',
      sortOrder: row.sortOrder || 0,
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
    const [row] = await getDb().select().from(signingTemplates).where(eq(signingTemplates.id, id)).limit(1);

    if (!row) {
      return c.json(
        {
          success: false,
          error: 'Template not found',
        },
        404
      );
    }

    const template: SigningTemplate = {
      id: row.id,
      templateName: row.templateName || '',
      templateCode: row.templateCode || '',
      dropboxSignTemplateId: row.dropboxSignTemplateId || '',
      documentTypes: row.documentTypes || [],
      clientType: (row.clientType as SigningTemplate['clientType']) || 'Both',
      numberOfSigners: row.numberOfSigners || 1,
      description: row.description || '',
      status: (row.status as SigningTemplate['status']) || 'Draft',
      sortOrder: row.sortOrder || 0,
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
      fileBase64,
      fileName,
      clientCode,
      taxYear,
      clientType,
    } = body;

    if (!fileBase64) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: fileBase64 (base64-encoded PDF)',
        },
        400
      );
    }

    const db = getDb();

    // If clientCode/taxYear not provided, look up from envelope record
    if ((!clientCode || !taxYear) && airtableRecordId) {
      console.log(`Looking up client info from envelope record: ${airtableRecordId}`);
      const [envelopeRow] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, airtableRecordId)).limit(1);

      if (envelopeRow) {
        taxYear = taxYear || envelopeRow.taxYear;
        clientType = clientType || envelopeRow.clientType;

        if (envelopeRow.personalId) {
          const [personalRow] = await db.select({ clientCode: personal.clientCode }).from(personal).where(eq(personal.id, envelopeRow.personalId)).limit(1);
          if (personalRow) clientCode = personalRow.clientCode;
        } else if (envelopeRow.corporationId) {
          const [corpRow] = await db.select({ clientCode: corporations.clientCode }).from(corporations).where(eq(corporations.id, envelopeRow.corporationId)).limit(1);
          if (corpRow) clientCode = corpRow.clientCode;
        }
      }
    }

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

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const finalFileName = fileName || `signed_${Date.now()}.pdf`;
    const isCorporate = clientType === 'corporate' || clientType === 'Corporate';

    const uploadResult = await uploadSignedDocument(
      fileBuffer,
      finalFileName,
      'application/pdf',
      clientCode,
      taxYear,
      isCorporate
    );

    console.log(`Signed document uploaded: ${uploadResult.fileId}`);

    if (airtableRecordId) {
      try {
        await db
          .update(signingEnvelopes)
          .set({
            signedDriveFileId: uploadResult.fileId,
            status: 'Completed',
            completedAt: new Date().toISOString(),
          })
          .where(eq(signingEnvelopes.id, airtableRecordId));
        console.log(`Updated envelope record ${airtableRecordId} with signed document`);
      } catch (updateError) {
        console.error('Failed to update envelope record:', updateError);
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
 * 3. Update envelope record
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

    if (!signatureRequestId) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: signatureRequestId',
        },
        400
      );
    }

    const db = getDb();

    // If clientCode/taxYear not provided, look up from envelope record
    if ((!clientCode || !taxYear) && airtableRecordId) {
      console.log(`Looking up client info from envelope record: ${airtableRecordId}`);
      const [envelopeRow] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, airtableRecordId)).limit(1);

      if (envelopeRow) {
        taxYear = taxYear || envelopeRow.taxYear;
        clientType = clientType || envelopeRow.clientType;

        if (envelopeRow.personalId) {
          const [personalRow] = await db.select({ clientCode: personal.clientCode }).from(personal).where(eq(personal.id, envelopeRow.personalId)).limit(1);
          if (personalRow) clientCode = personalRow.clientCode;
        } else if (envelopeRow.corporationId) {
          const [corpRow] = await db.select({ clientCode: corporations.clientCode }).from(corporations).where(eq(corporations.id, envelopeRow.corporationId)).limit(1);
          if (corpRow) clientCode = corpRow.clientCode;
        }
      }
    }

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

    const signNowApiUrl = process.env.SIGNNOW_API_URL || 'https://api.signnow.com';
    const accessToken = await getSignNowAccessToken();

    const signNowResponse = await fetch(
      `${signNowApiUrl}/document/${signatureRequestId}/download?type=collapsed`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
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

    const finalFileName = fileName || `signed_${signatureRequestId}.pdf`;
    const isCorporate = clientType === 'corporate' || clientType === 'Corporate';

    const uploadResult = await uploadSignedDocument(
      fileBuffer,
      finalFileName,
      'application/pdf',
      clientCode,
      taxYear,
      isCorporate
    );

    console.log(`Signed document uploaded: ${uploadResult.fileId}`);

    if (airtableRecordId) {
      try {
        await db
          .update(signingEnvelopes)
          .set({
            signedDriveFileId: uploadResult.fileId,
            status: 'Completed',
            completedAt: new Date().toISOString(),
          })
          .where(eq(signingEnvelopes.id, airtableRecordId));
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
