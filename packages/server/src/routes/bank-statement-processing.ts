/**
 * Bank Statement Processing Routes
 */

import { Hono } from 'hono';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const app = new Hono();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * POST /api/bank-statement-processing
 * Upload bank statement for processing
 */
app.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const processingType = formData.get('processingType') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (processingType !== 'bank-statement') {
      return c.json({ error: 'Invalid processing type' }, 400);
    }

    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'File type not supported. Please upload PDF or CSV files.' }, 400);
    }

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: 'File too large (max 25MB)' }, 400);
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileKey = `incoming/${timestamp}_${randomId}.${fileExtension}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return c.json({ error: 'AWS S3 bucket not configured' }, 500);
    }

    try {
      const result = await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          uploadedBy: 'system',
          processingType: 'bank-statement',
          uploadedAt: new Date().toISOString()
        }
      }));

      return c.json({
        success: true,
        fileKey,
        bucket: bucketName,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        s3ETag: result.ETag,
        s3Location: `s3://${bucketName}/${fileKey}`
      });

    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error);
      return c.json({
        error: 'Failed to upload file to S3. Please check AWS configuration.'
      }, 500);
    }

  } catch (error) {
    console.error('Error processing bank statement upload:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/bank-statement-processing
 * Check service health
 */
app.get('/', async (c) => {
  return c.json({
    service: 'Bank Statement Processing',
    status: 'operational',
    timestamp: new Date().toISOString(),
    message: 'Service is ready to process bank statements'
  });
});

/**
 * GET /api/bank-statement-processing/status
 * Check processing status
 */
app.get('/status', async (c) => {
  try {
    const fileKey = c.req.query('fileKey');
    if (!fileKey) {
      return c.json({ error: 'File key is required' }, 400);
    }

    const parsedFileKey = fileKey
      .replace('incoming/', 'parsed/')
      .replace(/\.(pdf|csv|xlsx?)$/i, '.qbo');

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return c.json({ error: 'AWS S3 bucket not configured' }, 500);
    }

    const uploadTime = extractTimestampFromFileKey(fileKey);
    const elapsedTime = Date.now() - uploadTime;

    let processed = false;
    let qboUrl: string | null = null;
    let status: string;

    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: parsedFileKey
      }));

      processed = true;
      status = 'Processing complete';
      qboUrl = `/api/bank-statement-processing/download?fileKey=${encodeURIComponent(fileKey)}`;

    } catch (s3Error: any) {
      if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        if (elapsedTime < 10000) status = 'Processing bank statement...';
        else if (elapsedTime < 30000) status = 'Extracting transaction data...';
        else if (elapsedTime < 60000) status = 'Converting to QBO format...';
        else status = 'Processing taking longer than expected';
      } else {
        status = 'Status check failed';
      }
    }

    return c.json({
      fileKey,
      parsedFileKey,
      status,
      processed,
      qboUrl,
      elapsedTime: Math.floor(elapsedTime / 1000),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking processing status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/bank-statement-processing/download
 * Download processed QBO file
 */
app.get('/download', async (c) => {
  try {
    const fileKey = c.req.query('fileKey');
    if (!fileKey) {
      return c.json({ error: 'File key is required' }, 400);
    }

    const parsedFileKey = fileKey
      .replace('incoming/', 'parsed/')
      .replace(/\.(pdf|csv|xlsx?)$/i, '.qbo');

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return c.json({ error: 'AWS S3 bucket not configured' }, 500);
    }

    try {
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: parsedFileKey
      }));

      if (!s3Response.Body) {
        return c.json({ error: 'QBO file not found or empty' }, 404);
      }

      const chunks: Uint8Array[] = [];
      const reader = s3Response.Body.transformToWebStream().getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const originalName = s3Response.Metadata?.originalname || 'bank_statement';
      const filename = `${originalName.replace(/\.[^/.]+$/, '')}_${Date.now()}.qbo`;

      return c.body(buffer, 200, {
        'Content-Type': 'application/vnd.intu.qbo',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'Content-Length': buffer.length.toString()
      });

    } catch (s3Error: any) {
      if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        return c.json({
          error: 'QBO file not ready yet. Processing may still be in progress.'
        }, 404);
      }

      return c.json({ error: 'Failed to download QBO file from S3.' }, 500);
    }

  } catch (error) {
    console.error('Error downloading QBO file:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function extractTimestampFromFileKey(fileKey: string): number {
  try {
    const parts = fileKey.split('/');
    if (parts.length > 1) {
      const filename = parts[parts.length - 1];
      const timestampPart = filename.split('_')[0];
      return parseInt(timestampPart, 10);
    }
  } catch {}
  return Date.now() - 30000;
}

export default app;
