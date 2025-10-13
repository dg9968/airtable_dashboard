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

    if (!clientCode) {
      return c.json({ error: 'Client code is required' }, 400);
    }

    if (!taxYear) {
      return c.json({ error: 'Tax year is required' }, 400);
    }

    const documents = await getDocuments(clientCode, taxYear);

    return c.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
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

export default app;
