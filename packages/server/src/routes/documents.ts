/**
 * Documents API Routes
 *
 * Handles document upload, retrieval, and management
 */

import { Hono } from 'hono';
import {
  getDocuments,
  saveDocument,
  deleteDocument,
  generateUniqueClientCode,
  getDocumentById,
} from '../services/documentService';
import {
  isValidClientCode,
  isValidTaxYear,
  isAllowedFileType,
  isValidFileSize,
} from '../utils/helpers';

const app = new Hono();

/**
 * GET /api/documents
 * Retrieve documents by client code and tax year
 */
app.get('/', async (c) => {
  try {
    // TODO: Add session/auth check
    // For now, allowing unauthenticated access

    const clientCode = c.req.query('clientCode');
    const taxYear = c.req.query('taxYear');

    console.log(`Fetching documents for clientCode: ${clientCode}, taxYear: ${taxYear}`);

    if (!clientCode) {
      return c.json({ error: 'Client code is required' }, 400);
    }

    if (!taxYear) {
      return c.json({ error: 'Tax year is required' }, 400);
    }

    const documents = await getDocuments(clientCode, taxYear);

    console.log(`Found ${documents.length} documents for clientCode: ${clientCode}, taxYear: ${taxYear}`);

    return c.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/documents
 * Upload a new document
 */
app.post('/', async (c) => {
  try {
    // TODO: Add session/auth check
    // const session = await getSession(c);
    // if (!session) return c.json({ error: 'Unauthorized' }, 401);

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const clientCode = formData.get('clientCode') as string;
    const taxYear = formData.get('taxYear') as string;
    const documentCategory = formData.get('documentCategory') as string;
    const isCorporate = formData.get('isCorporate') === 'true';

    // Validation
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!clientCode || !clientCode.trim()) {
      return c.json({ error: 'Client code is required' }, 400);
    }

    if (!isValidClientCode(clientCode)) {
      return c.json({ error: 'Client code must be exactly 4 digits' }, 400);
    }

    if (!isValidTaxYear(taxYear)) {
      return c.json({ error: 'Valid tax year is required (2022-2025 or N/A)' }, 400);
    }

    // Business credentials should use N/A as tax year
    const isBusinessCredentials = isCorporate && documentCategory === 'business-credentials';
    if (isBusinessCredentials && taxYear !== 'N/A') {
      return c.json({ error: 'Business credentials should use N/A as tax year' }, 400);
    }

    if (!isAllowedFileType(file.type)) {
      return c.json({ error: 'File type not allowed' }, 400);
    }

    if (!isValidFileSize(file.size)) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    // Save document
    const result = await saveDocument(
      file,
      clientCode.trim(),
      taxYear,
      'system' // TODO: Replace with actual user email from session
    );

    return c.json({
      success: true,
      clientCode: clientCode.trim(),
      fileName: result.fileName,
      recordId: result.id,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/documents
 * Delete a document by record ID
 */
app.delete('/', async (c) => {
  try {
    // TODO: Add session/auth check

    const recordId = c.req.query('recordId');

    if (!recordId) {
      return c.json({ error: 'Record ID is required' }, 400);
    }

    await deleteDocument(recordId);

    return c.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);

    if (error instanceof Error && error.message === 'Document not found') {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/documents/view
 * View a document by record ID (opens in browser)
 */
app.get('/view', async (c) => {
  try {
    const recordId = c.req.query('recordId');

    if (!recordId) {
      return c.json({ error: 'Record ID is required' }, 400);
    }

    const document = await getDocumentById(recordId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!document.webViewLink) {
      console.error('Document missing webViewLink:', {
        recordId,
        fileName: document.fileName,
        googleDriveFileId: document.googleDriveFileId,
      });
      return c.json({
        error: 'Document view link not available',
        details: 'This document may not have been uploaded to Google Drive. Please contact support.',
        fileName: document.originalName,
      }, 404);
    }

    // Redirect to Google Drive view link
    return c.redirect(document.webViewLink);
  } catch (error) {
    console.error('Error viewing document:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/documents/download
 * Download a document by record ID
 */
app.get('/download', async (c) => {
  try {
    const recordId = c.req.query('recordId');

    if (!recordId) {
      return c.json({ error: 'Record ID is required' }, 400);
    }

    const document = await getDocumentById(recordId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (!document.webContentLink) {
      console.error('Document missing webContentLink:', {
        recordId,
        fileName: document.fileName,
        googleDriveFileId: document.googleDriveFileId,
      });
      return c.json({
        error: 'Document download link not available',
        details: 'This document may not have been uploaded to Google Drive. Please contact support.',
        fileName: document.originalName,
      }, 404);
    }

    // Redirect to Google Drive download link
    return c.redirect(document.webContentLink);
  } catch (error) {
    console.error('Error downloading document:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/documents/generate-code
 * Generate a unique client code
 */
app.get('/generate-code', async (c) => {
  try {
    const code = await generateUniqueClientCode();
    return c.json({ clientCode: code });
  } catch (error) {
    console.error('Error generating client code:', error);
    return c.json({ error: 'Failed to generate unique client code' }, 500);
  }
});

/**
 * GET /api/documents/schema
 * Debug endpoint to check Airtable Documents table field names
 */
app.get('/schema', async (c) => {
  try {
    const Airtable = require('airtable');
    const airtable = new Airtable({
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    });
    const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

    // Fetch one record to see what fields exist
    const records = await base('Documents').select({ maxRecords: 1 }).firstPage();

    if (records.length > 0) {
      const sampleRecord = records[0];
      const fieldNames = Object.keys(sampleRecord.fields);

      return c.json({
        success: true,
        tableName: 'Documents',
        fieldNames: fieldNames,
        sampleRecord: {
          id: sampleRecord.id,
          fields: sampleRecord.fields,
        },
      });
    }

    return c.json({
      success: true,
      message: 'No records found in Documents table',
      fieldNames: [],
    });
  } catch (error) {
    console.error('Error fetching Documents schema:', error);
    return c.json({ error: 'Failed to fetch schema', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

export default app;
