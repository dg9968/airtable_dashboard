import { Hono } from 'hono';
import { fetchAllRecords, createRecords, getRecord, deleteRecords } from '../lib/airtable-helpers';
import { uploadTaxNoticeLetter, downloadFileFromGoogleDrive, deleteFileFromGoogleDrive, getFileMetadata } from '../googleDrive';

const app = new Hono();
const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE = 'Tax Notice Attachments';

const VALID_FILE_TYPES = [
  'original-letter', 'additional-pages', 'response-draft',
  'signed-response', 'proof-of-submission', 'other',
];

function mapRecord(record: any) {
  return {
    id: record.id,
    noticeId: (record.fields['Tax Notice'] as string[] | undefined)?.[0] ?? null,
    fileName: record.fields['File Name'] || '',
    driveId: record.fields['Drive ID'] || null,
    viewUrl: record.fields['View URL'] || null,
    fileType: record.fields['File Type'] || 'other',
    uploadedBy: record.fields['Uploaded By'] || '',
    uploadedAt: record.createdTime || '',
  };
}

// GET /api/tax-notice-attachments/notice/:noticeId
app.get('/notice/:noticeId', async (c) => {
  try {
    const noticeId = c.req.param('noticeId');
    const all = await fetchAllRecords(BASE_ID, TABLE);
    const filtered = all
      .filter(r => {
        const linked = r.fields['Tax Notice'];
        return Array.isArray(linked) && linked.includes(noticeId);
      })
      .sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
    return c.json({ success: true, data: filtered.map(mapRecord) });
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

    const records = await createRecords(BASE_ID, TABLE, [{
      fields: {
        'Tax Notice': [noticeId],
        'File Name': file.name,
        'Drive ID': fileId,
        'View URL': webViewLink,
        'File Type': fileType,
        'Uploaded By': uploadedBy,
      },
    }]);

    return c.json({ success: true, data: mapRecord(records[0]) });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
});

// GET /api/tax-notice-attachments/:attachmentId/download
app.get('/:attachmentId/download', async (c) => {
  try {
    const attachmentId = c.req.param('attachmentId');
    const record = await getRecord(BASE_ID, TABLE, attachmentId);
    const driveId = record.fields['Drive ID'] as string | undefined;
    const fileName = record.fields['File Name'] as string | undefined;

    if (!driveId) return c.json({ success: false, error: 'No file attached' }, 404);

    const metadata = await getFileMetadata(driveId);
    const buffer = await downloadFileFromGoogleDrive(driveId);

    c.header('Content-Type', (metadata.mimeType as string) || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName || 'attachment')}"`);
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
    const record = await getRecord(BASE_ID, TABLE, attachmentId);
    const driveId = record.fields['Drive ID'] as string | undefined;

    if (driveId) {
      try { await deleteFileFromGoogleDrive(driveId); } catch { /* already deleted */ }
    }

    await deleteRecords(BASE_ID, TABLE, [attachmentId]);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Delete failed' }, 500);
  }
});

export default app;
