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
  renameDocument,
  generateUniqueClientCode,
  getDocumentById,
} from '../services/documentService';
import { listClientBanks, downloadFileFromGoogleDrive, getFileMetadata } from '../googleDrive';
import {
  isValidClientCode,
  isValidTaxYear,
  isAllowedFileType,
  isAllowedFileExtension,
  isValidFileSize,
} from '../utils/helpers';

const app = new Hono();

/**
 * GET /api/documents
 * Retrieve documents by client code and tax year
 * Optional: includeSpouse=true to include spouse's documents
 * Optional: includeDependents=true to include dependents' documents
 */
app.get('/', async (c) => {
  try {
    // TODO: Add session/auth check
    // For now, allowing unauthenticated access

    const clientCode = c.req.query('clientCode');
    const taxYear = c.req.query('taxYear');
    const includeSpouse = c.req.query('includeSpouse') === 'true';
    const includeDependents = c.req.query('includeDependents') === 'true';
    const documentCategory = c.req.query('documentCategory');
    const bankName = c.req.query('bankName');

    console.log(`Fetching documents for clientCode: ${clientCode}, taxYear: ${taxYear}, includeSpouse: ${includeSpouse}, includeDependents: ${includeDependents}, category: ${documentCategory}, bankName: ${bankName}`);

    if (!clientCode) {
      return c.json({ error: 'Client code is required' }, 400);
    }

    if (!taxYear) {
      return c.json({ error: 'Tax year is required' }, 400);
    }

    const documents = await getDocuments(clientCode, taxYear, includeSpouse, documentCategory, bankName, includeDependents);

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
    const bankName = formData.get('bankName') as string;

    // Validation
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!clientCode || !clientCode.trim()) {
      return c.json({ error: 'Client code is required' }, 400);
    }

    if (!isValidClientCode(clientCode)) {
      return c.json({ error: 'Client code must be 4-6 digits' }, 400);
    }

    if (!isValidTaxYear(taxYear)) {
      return c.json({ error: 'Valid tax year is required (2022-2026 or N/A)' }, 400);
    }

    // Year-independent categories should use N/A as tax year
    const yearIndependentCategories = ['business-credentials', 'notices-letters'];
    const isYearIndependent = isCorporate && yearIndependentCategories.includes(documentCategory);
    if (isYearIndependent && taxYear !== 'N/A') {
      return c.json({ error: `${documentCategory} should use N/A as tax year` }, 400);
    }

    // Validate by MIME type or file extension (fallback for when MIME type is incorrect)
    if (!isAllowedFileType(file.type) && !isAllowedFileExtension(file.name)) {
      return c.json({
        error: 'File type not allowed',
        details: `File type "${file.type}" or extension not supported. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, CSV, XLS, XLSX, QBO`
      }, 400);
    }

    if (!isValidFileSize(file.size)) {
      return c.json({ error: 'File too large (max 20MB)' }, 400);
    }

    // Validate bank name for financial statements
    if (isCorporate && documentCategory === 'statements' && (!bankName || !bankName.trim())) {
      return c.json({ error: 'Bank name is required for financial statements' }, 400);
    }

    // Save document
    const result = await saveDocument(
      file,
      clientCode.trim(),
      taxYear,
      'system', // TODO: Replace with actual user email from session
      documentCategory,
      isCorporate,
      bankName?.trim()
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
 * PATCH /api/documents/rename
 * Rename a document by record ID
 */
app.patch('/rename', async (c) => {
  try {
    // TODO: Add session/auth check

    const body = await c.req.json();
    const { recordId, newFileName } = body;

    if (!recordId) {
      return c.json({ error: 'Record ID is required' }, 400);
    }

    if (!newFileName || !newFileName.trim()) {
      return c.json({ error: 'New file name is required' }, 400);
    }

    const updatedDocument = await renameDocument(recordId, newFileName.trim());

    return c.json({
      success: true,
      message: 'Document renamed successfully',
      document: updatedDocument,
    });
  } catch (error) {
    console.error('Error renaming document:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
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

    if (!document.googleDriveFileId) {
      console.error('Document missing googleDriveFileId:', {
        recordId,
        fileName: document.fileName,
      });
      return c.json({
        error: 'Document not available',
        details: 'This document may not have been uploaded to Google Drive. Please contact support.',
        fileName: document.originalName,
      }, 404);
    }

    // Get file metadata to determine content type
    const metadata = await getFileMetadata(document.googleDriveFileId);

    // Download file from Google Drive
    const fileBuffer = await downloadFileFromGoogleDrive(document.googleDriveFileId);

    // Set response headers for file download
    c.header('Content-Type', metadata.mimeType || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
    c.header('Content-Length', fileBuffer.length.toString());

    // Return the file buffer
    return c.body(fileBuffer);
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

/**
 * GET /api/documents/debug-all
 * Debug endpoint to list all documents in Airtable (production debugging)
 */
app.get('/debug-all', async (c) => {
  try {
    const Airtable = require('airtable');
    const airtable = new Airtable({
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    });
    const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

    const clientCodeFilter = c.req.query('clientCode');
    const maxRecords = parseInt(c.req.query('maxRecords') || '50');

    let selectOptions: any = { maxRecords };
    if (clientCodeFilter) {
      selectOptions.filterByFormula = `{Client Code} = '${clientCodeFilter}'`;
    }

    const records = await base('Documents').select(selectOptions).firstPage();

    return c.json({
      success: true,
      count: records.length,
      records: records.map(r => ({
        id: r.id,
        clientCode: r.fields['Client Code'],
        taxYear: r.fields['Tax Year'],
        fileName: r.fields['Original Name'],
        uploadDate: r.fields['Upload Date'],
      })),
    });
  } catch (error) {
    console.error('Error fetching all documents:', error);
    return c.json({ error: 'Failed to fetch documents', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * GET /api/documents/banks/:clientCode
 * Get list of existing banks for a client
 */
app.get('/banks/:clientCode', async (c) => {
  try {
    const clientCode = c.req.param('clientCode');
    console.log(`[API] Fetching banks for client code: ${clientCode}`);

    if (!clientCode || !isValidClientCode(clientCode)) {
      console.log(`[API] Invalid client code: ${clientCode}`);
      return c.json({ error: 'Valid client code is required' }, 400);
    }

    const banks = await listClientBanks(clientCode);
    console.log(`[API] Returning ${banks.length} banks for client ${clientCode}`);

    return c.json({
      success: true,
      banks,
    });
  } catch (error) {
    console.error('[API] Error fetching banks:', error);
    return c.json({ error: 'Failed to fetch banks' }, 500);
  }
});

export default app;
