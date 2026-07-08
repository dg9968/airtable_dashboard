/**
 * Tax Notice Attachments API Routes (Postgres-backed)
 * Files live in Google Drive; this table stores the pointers.
 */

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { taxNoticeAttachments } from '../db/schema';
import { uploadTaxNoticeLetter, downloadFileFromGoogleDrive, deleteFileFromGoogleDrive, getFileMetadata } from '../googleDrive';

const app = new Hono();

const VALID_FILE_TYPES = [
  'original-letter', 'additional-pages', 'response-draft',
  'signed-response', 'proof-of-submission', 'other',
];

type AttachmentRow = typeof taxNoticeAttachments.$inferSelect;

function mapRow(row: AttachmentRow) {
  return {
    id: row.id,
    noticeId: row.taxNoticeId ?? null,
    fileName: row.fileName || '',
    driveId: row.driveId || null,
    viewUrl: row.viewUrl || null,
    fileType: row.fileType || 'other',
    uploadedBy: row.uploadedBy || '',
    uploadedAt: row.createdAt.toISOString(),
  };
}

// GET /api/tax-notice-attachments/notice/:noticeId
app.get('/notice/:noticeId', async (c) => {
  try {
    const noticeId = c.req.param('noticeId');
    const rows = await getDb()
      .select()
      .from(taxNoticeAttachments)
      .where(eq(taxNoticeAttachments.taxNoticeId, noticeId))
      .orderBy(asc(taxNoticeAttachments.createdAt));
    return c.json({ success: true, data: rows.map(mapRow) });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch attachments' }, 500);
  }
});

// POST /api/tax-notice-attachments/notice/:noticeId
app.post('/notice/:noticeId', async (c) => {
  try {
    const noticeId = c.req.param('noticeId');
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const fileType = (formData.get('fileType') as string) || 'other';
    const uploadedBy = (formData.get('uploadedBy') as string) || '';

    if (!file) return c.json({ success: false, error: 'No file provided' }, 400);
    if (!VALID_FILE_TYPES.includes(fileType)) return c.json({ success: false, error: 'Invalid fileType' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId, webViewLink } = await uploadTaxNoticeLetter(
      buffer, file.name, file.type || 'application/octet-stream', noticeId,
    );

    const [row] = await getDb()
      .insert(taxNoticeAttachments)
      .values({
        taxNoticeId: noticeId,
        fileName: file.name,
        driveId: fileId,
        viewUrl: webViewLink,
        fileType,
        uploadedBy,
      })
      .returning();

    return c.json({ success: true, data: mapRow(row) });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
});

// GET /api/tax-notice-attachments/:attachmentId/download
app.get('/:attachmentId/download', async (c) => {
  try {
    const attachmentId = c.req.param('attachmentId');
    const [row] = await getDb()
      .select()
      .from(taxNoticeAttachments)
      .where(eq(taxNoticeAttachments.id, attachmentId))
      .limit(1);

    if (!row) return c.json({ success: false, error: 'Attachment not found' }, 404);
    if (!row.driveId) return c.json({ success: false, error: 'No file attached' }, 404);

    const metadata = await getFileMetadata(row.driveId);
    const buffer = await downloadFileFromGoogleDrive(row.driveId);

    c.header('Content-Type', (metadata.mimeType as string) || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(row.fileName || 'attachment')}"`);
    c.header('Content-Length', buffer.length.toString());
    return c.body(buffer);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Download failed' }, 500);
  }
});

// DELETE /api/tax-notice-attachments/:attachmentId
app.delete('/:attachmentId', async (c) => {
  try {
    const attachmentId = c.req.param('attachmentId');
    const db = getDb();
    const [row] = await db
      .select()
      .from(taxNoticeAttachments)
      .where(eq(taxNoticeAttachments.id, attachmentId))
      .limit(1);

    if (!row) return c.json({ success: false, error: 'Attachment not found' }, 404);

    if (row.driveId) {
      try { await deleteFileFromGoogleDrive(row.driveId); } catch { /* already deleted */ }
    }

    await db.delete(taxNoticeAttachments).where(eq(taxNoticeAttachments.id, attachmentId));
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Delete failed' }, 500);
  }
});

export default app;
