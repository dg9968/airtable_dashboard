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
import {
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  getFileMetadata,
  renameFileInGoogleDrive,
} from '../googleDrive';

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
  googleDriveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
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
 * Get spouse client code from Personal table
 */
export async function getSpouseClientCode(clientCode: string): Promise<string | null> {
  try {
    const PERSONAL_TABLE = 'Personal';

    // Find the person with this client code
    const records = await base(PERSONAL_TABLE)
      .select({
        filterByFormula: `{Client Code} = '${clientCode}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const person = records[0];
    const spouseClientCode = person.fields['Spouse Client Code'] as string;

    if (!spouseClientCode) {
      return null;
    }

    return spouseClientCode;
  } catch (error) {
    console.error('[documentService] Error finding spouse:', error);
    return null;
  }
}

/**
 * Get documents by client code and tax year
 */
export async function getDocuments(
  clientCode: string,
  taxYear: string,
  includeSpouse: boolean = false
): Promise<DocumentMetadata[]> {
  let filterFormula = `AND({Client Code} = '${clientCode}', {Tax Year} = '${taxYear}')`;

  try {
    console.log(`[documentService] getDocuments called with clientCode: "${clientCode}", taxYear: "${taxYear}", includeSpouse: ${includeSpouse}`);
    console.log(`[documentService] Using Airtable base: ${process.env.AIRTABLE_BASE_ID?.substring(0, 8)}...`);

    // If includeSpouse, get spouse's client code and include their documents
    if (includeSpouse) {
      const spouseClientCode = await getSpouseClientCode(clientCode);
      if (spouseClientCode) {
        console.log(`[documentService] Found spouse client code: ${spouseClientCode}`);
        filterFormula = `AND(OR({Client Code} = '${clientCode}', {Client Code} = '${spouseClientCode}'), {Tax Year} = '${taxYear}')`;
      }
    }

    console.log(`[documentService] Filter formula: ${filterFormula}`);

    // Try Airtable first
    const records = await base(DOCUMENTS_TABLE)
      .select({
        filterByFormula: filterFormula,
      })
      .firstPage();

    console.log(`[documentService] Found ${records.length} records from Airtable`);

    if (records.length > 0) {
      console.log(`[documentService] Sample record fields:`, Object.keys(records[0].fields));
      console.log(`[documentService] First record Client Code: "${records[0].fields['Client Code']}", Tax Year: "${records[0].fields['Tax Year']}"`);
    }

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
      googleDriveFileId: record.fields['Google Drive File ID'] as string,
      webViewLink: record.fields['Web View Link'] as string,
      webContentLink: record.fields['Web Content Link'] as string,
    }));
  } catch (error) {
    console.error('[documentService] Airtable fetch failed, using local metadata:', error);
    console.error('[documentService] Error details:', error instanceof Error ? error.message : String(error));
    console.error('[documentService] Filter formula was:', filterFormula);
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
): Promise<{ id: string; fileName: string; googleDriveFileId?: string }> {
  // Generate unique filename
  const timestamp = Date.now();
  const fileExtension = path.extname(file.name);
  const fileName = `${timestamp}${fileExtension}`;

  // Convert File to Buffer for Google Drive upload
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let googleDriveFileId: string | undefined;
  let webViewLink: string | undefined;
  let webContentLink: string | undefined;

  try {
    // Upload to Google Drive
    const driveUpload = await uploadFileToGoogleDrive(
      buffer,
      file.name,
      file.type,
      clientCode,
      taxYear
    );

    googleDriveFileId = driveUpload.fileId;
    webViewLink = driveUpload.webViewLink;
    webContentLink = driveUpload.webContentLink;

    console.log('Successfully uploaded to Google Drive:', googleDriveFileId);
  } catch (error) {
    console.error('Google Drive upload failed:', error);
    // Continue without Google Drive - will save locally
  }

  // Create metadata
  const documentMetadata: DocumentMetadata = {
    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName,
    originalName: file.name,
    uploadDate: new Date().toISOString(),
    fileSize: file.size,
    fileType: file.type,
    clientCode,
    taxYear,
    uploadedBy,
    googleDriveFileId,
    webViewLink,
    webContentLink,
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
          ...(googleDriveFileId && { 'Google Drive File ID': googleDriveFileId }),
          ...(webViewLink && { 'Web View Link': webViewLink }),
          ...(webContentLink && { 'Web Content Link': webContentLink }),
        }
      }
    ]);

    recordId = record[0].id;
    documentMetadata.id = recordId;
  } catch (error) {
    console.error('Airtable save failed:', error);
    // Still return the Google Drive ID if upload succeeded
  }

  return { id: recordId, fileName, googleDriveFileId };
}

/**
 * Get document metadata by record ID
 */
export async function getDocumentById(recordId: string): Promise<DocumentMetadata | null> {
  try {
    const record = await base(DOCUMENTS_TABLE).find(recordId);

    return {
      id: record.id,
      fileName: record.fields['File Name'] as string,
      originalName: record.fields['Original Name'] as string,
      uploadDate: record.fields['Upload Date'] as string,
      fileSize: record.fields['File Size'] as number,
      fileType: record.fields['File Type'] as string,
      clientCode: record.fields['Client Code'] as string,
      taxYear: record.fields['Tax Year'] as string,
      uploadedBy: record.fields['Uploaded By'] as string,
      googleDriveFileId: record.fields['Google Drive File ID'] as string,
      webViewLink: record.fields['Web View Link'] as string,
      webContentLink: record.fields['Web Content Link'] as string,
    };
  } catch (error) {
    console.error('Error fetching document:', error);
    return null;
  }
}

/**
 * Rename document
 */
export async function renameDocument(recordId: string, newFileName: string): Promise<DocumentMetadata> {
  try {
    // Get document metadata first
    const record = await base(DOCUMENTS_TABLE).find(recordId);
    const googleDriveFileId = record.fields['Google Drive File ID'] as string;

    // Rename in Google Drive if file ID exists
    if (googleDriveFileId) {
      try {
        await renameFileInGoogleDrive(googleDriveFileId, newFileName);
        console.log('Successfully renamed in Google Drive:', googleDriveFileId);
      } catch (error) {
        console.error('Google Drive rename failed:', error);
        throw new Error('Failed to rename file in Google Drive');
      }
    }

    // Update in Airtable
    const updatedRecord = await base(DOCUMENTS_TABLE).update(recordId, {
      'Original Name': newFileName,
    });

    return {
      id: updatedRecord.id,
      fileName: updatedRecord.fields['File Name'] as string,
      originalName: updatedRecord.fields['Original Name'] as string,
      uploadDate: updatedRecord.fields['Upload Date'] as string,
      fileSize: updatedRecord.fields['File Size'] as number,
      fileType: updatedRecord.fields['File Type'] as string,
      clientCode: updatedRecord.fields['Client Code'] as string,
      taxYear: updatedRecord.fields['Tax Year'] as string,
      uploadedBy: updatedRecord.fields['Uploaded By'] as string,
      googleDriveFileId: updatedRecord.fields['Google Drive File ID'] as string,
      webViewLink: updatedRecord.fields['Web View Link'] as string,
      webContentLink: updatedRecord.fields['Web Content Link'] as string,
    };
  } catch (error) {
    console.error('Error renaming document:', error);
    throw new Error(error instanceof Error ? error.message : 'Document not found');
  }
}

/**
 * Delete document
 */
export async function deleteDocument(recordId: string): Promise<boolean> {
  let googleDriveFileId: string | undefined;

  try {
    // Get document metadata first
    const record = await base(DOCUMENTS_TABLE).find(recordId);
    googleDriveFileId = record.fields['Google Drive File ID'] as string;

    // Delete from Google Drive if file ID exists
    if (googleDriveFileId) {
      try {
        await deleteFileFromGoogleDrive(googleDriveFileId);
        console.log('Successfully deleted from Google Drive:', googleDriveFileId);
      } catch (error) {
        console.error('Google Drive deletion failed:', error);
        // Continue with Airtable deletion even if Google Drive fails
      }
    }

    // Delete from Airtable
    await base(DOCUMENTS_TABLE).destroy([recordId]);
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Document not found');
  }
}
