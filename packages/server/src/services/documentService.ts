/**
 * Document Service
 *
 * Handles document storage, retrieval, and management
 */

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
import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../db/client';
import {
  personal,
  personalRelationships,
  documents,
  personalServices,
  subscriptionsPersonal,
} from '../db/schema';
import { personalToAirtableRecord, loadPersonalRelationships } from '../db/serializers';

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
  documentCategory?: string;
  bankName?: string;
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

    const existing = await getDb()
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.clientCode, code))
      .limit(1);

    if (existing.length === 0) {
      return code;
    }

    attempts++;
  }

  throw new Error('Unable to generate unique client code');
}

/**
 * Get spouse client code from the personal table (bidirectional).
 * Spouse relationships are stored as two rows in personal_relationships, so a
 * single lookup covers both the primary→spouse and spouse→primary directions.
 */
export async function getSpouseClientCode(clientCode: string): Promise<string | null> {
  try {
    const db = getDb();
    const [person] = await db
      .select({ id: personal.id })
      .from(personal)
      .where(eq(personal.clientCode, clientCode))
      .limit(1);

    if (!person) return null;

    const spouse = alias(personal, 'spouse');
    const [rel] = await db
      .select({ spouseClientCode: spouse.clientCode })
      .from(personalRelationships)
      .innerJoin(spouse, eq(personalRelationships.relatedPersonalId, spouse.id))
      .where(
        and(
          eq(personalRelationships.personalId, person.id),
          eq(personalRelationships.relationship, 'spouse')
        )
      )
      .limit(1);

    if (rel?.spouseClientCode) {
      console.log(`[documentService] Found spouse code ${rel.spouseClientCode} for ${clientCode}`);
      return rel.spouseClientCode;
    }

    return null;
  } catch (error) {
    console.error('[documentService] Error finding spouse:', error);
    return null;
  }
}

/**
 * Get dependent client codes from the personal table
 */
export async function getDependentClientCodes(clientCode: string): Promise<string[]> {
  try {
    const db = getDb();
    const [person] = await db
      .select({ id: personal.id })
      .from(personal)
      .where(eq(personal.clientCode, clientCode))
      .limit(1);

    if (!person) return [];

    const dependent = alias(personal, 'dependent');
    const rels = await db
      .select({ code: dependent.clientCode })
      .from(personalRelationships)
      .innerJoin(dependent, eq(personalRelationships.relatedPersonalId, dependent.id))
      .where(
        and(
          eq(personalRelationships.personalId, person.id),
          eq(personalRelationships.relationship, 'dependent')
        )
      );

    return rels.map((r) => r.code).filter((code): code is string => Boolean(code));
  } catch (error) {
    console.error('[documentService] Error finding dependents:', error);
    return [];
  }
}

/**
 * Get personal record by client code (legacy Airtable record shape)
 */
export async function getPersonalRecordByClientCode(clientCode: string): Promise<{ id: string; fields: any } | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(personal)
      .where(eq(personal.clientCode, clientCode))
      .limit(1);

    if (!row) return null;

    const { relMap, lookup } = await loadPersonalRelationships(db, [row.id]);
    const record = personalToAirtableRecord(row, relMap.get(row.id), lookup);
    return { id: record.id, fields: record.fields };
  } catch (error) {
    console.error('[documentService] Error finding personal record:', error);
    return null;
  }
}

/**
 * Check if this is the first document for a client
 */
export async function isFirstDocumentForClient(clientCode: string): Promise<boolean> {
  try {
    const existing = await getDb()
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.clientCode, clientCode))
      .limit(1);
    return existing.length === 0;
  } catch (error) {
    console.error('[documentService] Error checking existing documents:', error);
    return false; // Assume not first to avoid duplicates
  }
}

/**
 * Add client to Tax Prep Pipeline if not already present
 */
export async function addClientToPipelineIfNeeded(personalId: string): Promise<boolean> {
  const SERVICE_NAME = 'Tax Prep Pipeline';

  try {
    const db = getDb();

    // 1. Find the "Tax Prep Pipeline" service
    const [service] = await db
      .select({ id: personalServices.id })
      .from(personalServices)
      .where(eq(personalServices.name, SERVICE_NAME))
      .limit(1);

    if (!service) {
      console.warn(`[documentService] Service "${SERVICE_NAME}" not found in personal_services`);
      return false;
    }

    // 2. Check if client already has this subscription
    const [existing] = await db
      .select({ id: subscriptionsPersonal.id })
      .from(subscriptionsPersonal)
      .where(
        and(
          eq(subscriptionsPersonal.personalId, personalId),
          eq(subscriptionsPersonal.serviceId, service.id)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`[documentService] Client ${personalId} already in ${SERVICE_NAME}`);
      return true;
    }

    // 3. Create junction record
    await db.insert(subscriptionsPersonal).values({ personalId, serviceId: service.id });

    console.log(`[documentService] Added client ${personalId} to ${SERVICE_NAME}`);
    return true;
  } catch (error) {
    console.error('[documentService] Pipeline addition failed:', error);
    return false;
  }
}

/**
 * Get documents by client code and tax year
 */
function rowToMetadata(row: typeof documents.$inferSelect): DocumentMetadata {
  return {
    id: row.id,
    fileName: row.fileName as string,
    originalName: row.originalName as string,
    uploadDate: row.uploadDate as string,
    fileSize: row.fileSize as number,
    fileType: row.fileType as string,
    clientCode: row.clientCode as string,
    taxYear: row.taxYear as string,
    uploadedBy: row.uploadedBy ?? undefined,
    googleDriveFileId: row.googleDriveFileId ?? undefined,
    webViewLink: row.webViewLink ?? undefined,
    webContentLink: row.webContentLink ?? undefined,
    documentCategory: row.documentCategory ?? undefined,
    bankName: row.bankName ?? undefined,
  };
}

export async function getDocuments(
  clientCode: string,
  taxYear: string,
  includeSpouse: boolean = false,
  documentCategory?: string,
  bankName?: string,
  includeDependents: boolean = false
): Promise<DocumentMetadata[]> {
  try {
    console.log(`[documentService] getDocuments called with clientCode: "${clientCode}", taxYear: "${taxYear}", includeSpouse: ${includeSpouse}, includeDependents: ${includeDependents}, category: "${documentCategory}", bankName: "${bankName}"`);

    const clientCodesToInclude: string[] = [clientCode];

    // If includeSpouse, get spouse's client code and include their documents
    if (includeSpouse) {
      const spouseClientCode = await getSpouseClientCode(clientCode);
      if (spouseClientCode) {
        console.log(`[documentService] Found spouse client code: ${spouseClientCode}`);
        clientCodesToInclude.push(spouseClientCode);
      }
    }

    // If includeDependents, get all dependent client codes
    if (includeDependents) {
      const dependentCodes = await getDependentClientCodes(clientCode);
      if (dependentCodes.length > 0) {
        console.log(`[documentService] Found ${dependentCodes.length} dependent client codes`);
        clientCodesToInclude.push(...dependentCodes);
      }
    }

    const conditions = [
      inArray(documents.clientCode, clientCodesToInclude),
      eq(documents.taxYear, taxYear),
    ];
    if (documentCategory) conditions.push(eq(documents.documentCategory, documentCategory));
    if (bankName) conditions.push(eq(documents.bankName, bankName));

    const rows = await getDb()
      .select()
      .from(documents)
      .where(and(...conditions));

    console.log(`[documentService] Found ${rows.length} documents`);

    return rows.map(rowToMetadata);
  } catch (error) {
    console.error('[documentService] Postgres fetch failed, using local metadata:', error);
    console.error('[documentService] Error details:', error instanceof Error ? error.message : String(error));
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
  uploadedBy: string,
  documentCategory?: string,
  isCorporate?: boolean,
  bankName?: string
): Promise<{ id: string; fileName: string; googleDriveFileId?: string }> {
  // Check if this is the first document BEFORE saving (for personal docs only)
  const isFirstUpload = !isCorporate && await isFirstDocumentForClient(clientCode);

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
      taxYear,
      documentCategory,
      isCorporate,
      bankName
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
    // Save metadata row to Postgres
    const [row] = await getDb()
      .insert(documents)
      .values({
        clientCode,
        taxYear,
        fileName,
        originalName: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: file.size,
        fileType: file.type,
        uploadedBy,
        googleDriveFileId: googleDriveFileId || null,
        webViewLink: webViewLink || null,
        webContentLink: webContentLink || null,
        documentCategory: documentCategory || null,
        bankName: bankName || null,
      })
      .returning({ id: documents.id });

    recordId = row.id;
    documentMetadata.id = recordId;
  } catch (error) {
    console.error('Postgres save failed:', error);
    // Still return the Google Drive ID if upload succeeded
  }

  // Add to pipeline if this is the first personal document
  if (isFirstUpload) {
    try {
      const personalRecord = await getPersonalRecordByClientCode(clientCode);
      if (personalRecord) {
        await addClientToPipelineIfNeeded(personalRecord.id);
      } else {
        console.warn(`[documentService] No Personal record for client ${clientCode}, skipping pipeline addition`);
      }
    } catch (pipelineError) {
      console.error('[documentService] Pipeline addition failed (non-fatal):', pipelineError);
    }
  }

  return { id: recordId, fileName, googleDriveFileId };
}

/**
 * Get document metadata by record ID
 */
export async function getDocumentById(recordId: string): Promise<DocumentMetadata | null> {
  try {
    const [row] = await getDb().select().from(documents).where(eq(documents.id, recordId)).limit(1);
    return row ? rowToMetadata(row) : null;
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
    const db = getDb();

    // Get document metadata first
    const [row] = await db.select().from(documents).where(eq(documents.id, recordId)).limit(1);
    if (!row) {
      throw new Error('Document not found');
    }

    // Rename in Google Drive if file ID exists
    if (row.googleDriveFileId) {
      try {
        await renameFileInGoogleDrive(row.googleDriveFileId, newFileName);
        console.log('Successfully renamed in Google Drive:', row.googleDriveFileId);
      } catch (error) {
        console.error('Google Drive rename failed:', error);
        throw new Error('Failed to rename file in Google Drive');
      }
    }

    const [updated] = await db
      .update(documents)
      .set({ originalName: newFileName })
      .where(eq(documents.id, recordId))
      .returning();

    return rowToMetadata(updated);
  } catch (error) {
    console.error('Error renaming document:', error);
    throw new Error(error instanceof Error ? error.message : 'Document not found');
  }
}

/**
 * Delete document
 */
export async function deleteDocument(recordId: string): Promise<boolean> {
  try {
    const db = getDb();

    // Get document metadata first
    const [row] = await db.select().from(documents).where(eq(documents.id, recordId)).limit(1);
    if (!row) {
      throw new Error('Document not found');
    }

    // Delete from Google Drive if file ID exists
    if (row.googleDriveFileId) {
      try {
        await deleteFileFromGoogleDrive(row.googleDriveFileId);
        console.log('Successfully deleted from Google Drive:', row.googleDriveFileId);
      } catch (error) {
        console.error('Google Drive deletion failed:', error);
        // Continue with metadata deletion even if Google Drive fails
      }
    }

    await db.delete(documents).where(eq(documents.id, recordId));
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Document not found');
  }
}
