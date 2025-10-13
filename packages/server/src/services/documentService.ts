/**
 * Document Service
 *
 * Handles document storage, retrieval, and management
 */

import Airtable from 'airtable';
import { existsSync } from 'fs';
import { writeFile, readFile, mkdir, unlink, readdir, lstat } from 'fs/promises';
import path from 'path';
import { generateClientCode, isValidClientCode } from '../utils/helpers';

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || 'dummy',
});
const base = airtable.base(process.env.AIRTABLE_BASE_ID || 'dummy');
const DOCUMENTS_TABLE = 'Documents';

export interface DocumentMetadata {
  id: string;
  fileName: string;
  originalName: string;
  uploadDate: string;
  fileSize: number;
  fileType: string;
  clientCode: string;
  taxYear: string;
  uploadedBy?: string;
}

/**
 * Get local metadata file path
 */
function getMetadataPath(clientCode: string, taxYear: string): string {
  return path.join(process.cwd(), 'documents', taxYear, clientCode, 'metadata.json');
}

/**
 * Read local metadata
 */
export async function getLocalMetadata(clientCode: string, taxYear: string): Promise<DocumentMetadata[]> {
  const metadataPath = getMetadataPath(clientCode, taxYear);

  try {
    if (!existsSync(metadataPath)) {
      return [];
    }

    const content = await readFile(metadataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading local metadata:', error);
    return [];
  }
}

/**
 * Save local metadata
 */
export async function saveLocalMetadata(
  clientCode: string,
  taxYear: string,
  metadata: DocumentMetadata[]
): Promise<void> {
  const clientDir = path.join(process.cwd(), 'documents', taxYear, clientCode);
  const metadataPath = getMetadataPath(clientCode, taxYear);

  if (!existsSync(clientDir)) {
    await mkdir(clientDir, { recursive: true });
  }

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Generate unique client code
 */
export async function generateUniqueClientCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateClientCode();

    try {
      // Check if code exists in Airtable
      const records = await base(DOCUMENTS_TABLE)
        .select({
          filterByFormula: `{Client Code} = '${code}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return code;
      }

      attempts++;
    } catch (error) {
      console.error('Airtable check failed, using local check:', error);

      // Fallback: check if directory exists locally
      const clientDir = path.join(process.cwd(), 'documents', code);
      if (!existsSync(clientDir)) {
        return code;
      }

      attempts++;
    }
  }

  throw new Error('Unable to generate unique client code');
}

/**
 * Get documents by client code and tax year
 */
export async function getDocuments(
  clientCode: string,
  taxYear: string
): Promise<DocumentMetadata[]> {
  try {
    // Try Airtable first
    const records = await base(DOCUMENTS_TABLE)
      .select({
        filterByFormula: `AND({Client Code} = '${clientCode}', {Tax Year} = '${taxYear}')`,
      })
      .firstPage();

    return records.map(record => ({
      id: record.id,
      fileName: record.fields['File Name'] as string,
      originalName: record.fields['Original Name'] as string,
      uploadDate: record.fields['Upload Date'] as string,
      fileSize: record.fields['File Size'] as number,
      fileType: record.fields['File Type'] as string,
      clientCode: record.fields['Client Code'] as string,
      taxYear: record.fields['Tax Year'] as string,
      uploadedBy: record.fields['Uploaded By'] as string,
    }));
  } catch (error) {
    console.error('Airtable fetch failed, using local metadata:', error);
    return await getLocalMetadata(clientCode, taxYear);
  }
}

/**
 * Save document file and metadata
 */
export async function saveDocument(
  file: File,
  clientCode: string,
  taxYear: string,
  uploadedBy: string
): Promise<{ id: string; fileName: string }> {
  // Create directory structure
  const documentsDir = path.join(process.cwd(), 'documents');
  if (!existsSync(documentsDir)) {
    await mkdir(documentsDir, { recursive: true });
  }

  const taxYearDir = path.join(documentsDir, taxYear);
  if (!existsSync(taxYearDir)) {
    await mkdir(taxYearDir, { recursive: true });
  }

  const clientDir = path.join(taxYearDir, clientCode);
  if (!existsSync(clientDir)) {
    await mkdir(clientDir, { recursive: true });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const fileExtension = path.extname(file.name);
  const fileName = `${timestamp}${fileExtension}`;
  const filePath = path.join(clientDir, fileName);

  // Save file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filePath, buffer);

  // Create metadata
  const documentMetadata: DocumentMetadata = {
    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName,
    originalName: file.name,
    uploadDate: new Date().toISOString(),
    fileSize: file.size,
    fileType: file.type,
    clientCode,
    taxYear,
    uploadedBy,
  };

  let recordId = documentMetadata.id;

  try {
    // Save to Airtable
    const record = await base(DOCUMENTS_TABLE).create([
      {
        fields: {
          'Client Code': clientCode,
          'Tax Year': taxYear,
          'File Name': fileName,
          'Original Name': file.name,
          'Upload Date': new Date().toISOString().split('T')[0],
          'File Size': file.size,
          'File Type': file.type,
          'Uploaded By': uploadedBy,
        }
      }
    ]);

    recordId = record[0].id;
    documentMetadata.id = recordId;
  } catch (error) {
    console.error('Airtable save failed, using local metadata:', error);

    // Fallback to local storage
    const existingMetadata = await getLocalMetadata(clientCode, taxYear);
    existingMetadata.push(documentMetadata);
    await saveLocalMetadata(clientCode, taxYear, existingMetadata);
  }

  return { id: recordId, fileName };
}

/**
 * Delete document
 */
export async function deleteDocument(recordId: string): Promise<boolean> {
  let clientCode = '';
  let fileName = '';
  let taxYear = '';
  let found = false;

  try {
    // Try Airtable first
    const record = await base(DOCUMENTS_TABLE).find(recordId);

    clientCode = record.fields['Client Code'] as string;
    fileName = record.fields['File Name'] as string;
    taxYear = record.fields['Tax Year'] as string;

    await base(DOCUMENTS_TABLE).destroy([recordId]);
    found = true;
  } catch (error) {
    console.error('Airtable deletion failed, trying local metadata:', error);

    // Search in local metadata
    const documentsDir = path.join(process.cwd(), 'documents');

    if (existsSync(documentsDir)) {
      const taxYearDirs = await readdir(documentsDir);

      for (const taxYearDir of taxYearDirs) {
        const taxYearPath = path.join(documentsDir, taxYearDir);

        try {
          const stat = await lstat(taxYearPath);
          if (!stat.isDirectory()) continue;

          const clientDirs = await readdir(taxYearPath);

          for (const clientDir of clientDirs) {
            const metadataPath = path.join(taxYearPath, clientDir, 'metadata.json');

            if (existsSync(metadataPath)) {
              const metadataContent = await readFile(metadataPath, 'utf8');
              const metadata = JSON.parse(metadataContent);
              const docIndex = metadata.findIndex((doc: DocumentMetadata) => doc.id === recordId);

              if (docIndex !== -1) {
                const doc = metadata[docIndex];
                clientCode = doc.clientCode;
                fileName = doc.fileName;
                taxYear = doc.taxYear;

                // Remove from metadata
                metadata.splice(docIndex, 1);
                await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
                found = true;
                break;
              }
            }
          }

          if (found) break;
        } catch (error) {
          console.error(`Error processing ${taxYearDir}:`, error);
        }
      }
    }
  }

  if (!found) {
    throw new Error('Document not found');
  }

  // Delete the actual file
  const filePath = path.join(process.cwd(), 'documents', taxYear, clientCode, fileName);

  if (existsSync(filePath)) {
    await unlink(filePath);
  }

  return true;
}
