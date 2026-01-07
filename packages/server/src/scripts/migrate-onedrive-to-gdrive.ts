/**
 * Migration Script: OneDrive to Google Drive
 *
 * This script migrates documents from OneDrive to Google Drive while
 * maintaining Airtable database records with new Google Drive file IDs.
 *
 * Prerequisites:
 * 1. OneDrive files downloaded to local directory
 * 2. Google Drive API credentials configured
 * 3. Airtable base access
 *
 * Usage:
 * bun run src/scripts/migrate-onedrive-to-gdrive.ts --source-dir=/path/to/onedrive --dry-run
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

// Configuration
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN!;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const DOCUMENTS_TABLE = 'Documents';

// Command line arguments
const args = process.argv.slice(2);
const sourceDir = args.find(arg => arg.startsWith('--source-dir='))?.split('=')[1];
const dryRun = args.includes('--dry-run');
const skipExisting = args.includes('--skip-existing');

if (!sourceDir) {
  console.error('❌ Error: --source-dir parameter is required');
  console.log('\nUsage:');
  console.log('  bun run src/scripts/migrate-onedrive-to-gdrive.ts --source-dir=/path/to/onedrive [options]');
  console.log('\nOptions:');
  console.log('  --dry-run        Simulate migration without actually uploading files');
  console.log('  --skip-existing  Skip files that already have Google Drive File ID in Airtable');
  process.exit(1);
}

// Initialize Google Drive
const auth = new GoogleAuth({
  credentials: process.env.GOOGLE_DRIVE_CREDENTIALS_JSON ?
    JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) : undefined,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

interface MigrationStats {
  totalFiles: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

interface FileMetadata {
  clientCode: string;
  taxYear: string;
  fileName: string;
  filePath: string;
  isCorporate: boolean;
  documentCategory?: string;
  bankName?: string;
}

/**
 * Parse file path to extract metadata
 * Supports both old and new folder structures
 */
function parseFilePath(filePath: string, sourceDir: string): FileMetadata | null {
  const relativePath = path.relative(sourceDir, filePath);
  const parts = relativePath.split(path.sep);

  // Try to match patterns:
  // Pattern 1: Tax Year XXXX/Client XXXX/filename
  // Pattern 2: Corporate/Client XXXX/Category/filename
  // Pattern 3: Corporate/Client XXXX/Financial Statements/Bank Name/Tax Year XXXX/filename
  // Pattern 4: Personal/Client XXXX/Tax Year XXXX/filename

  let clientCode: string | null = null;
  let taxYear: string | null = null;
  let isCorporate = false;
  let documentCategory: string | undefined;
  let bankName: string | undefined;

  // Check if corporate
  if (parts[0] === 'Corporate') {
    isCorporate = true;

    // Extract client code
    const clientMatch = parts[1]?.match(/Client\s+(\d{4})/i);
    if (clientMatch) {
      clientCode = clientMatch[1];
    }

    // Check for Financial Statements with bank structure
    if (parts[2] === 'Financial Statements' && parts.length >= 5) {
      bankName = parts[3];
      const yearMatch = parts[4]?.match(/Tax Year\s+(\d{4})/i);
      if (yearMatch) {
        taxYear = yearMatch[1];
      }
      documentCategory = 'statements';
    } else if (parts[2]) {
      // Other categories
      documentCategory = parts[2].toLowerCase().replace(/\s+/g, '-');

      // Extract tax year from folder if present
      const yearMatch = parts[3]?.match(/Tax Year\s+(\d{4})/i);
      if (yearMatch) {
        taxYear = yearMatch[1];
      }
    }
  } else {
    // Personal documents
    // Try pattern: Tax Year XXXX/Client XXXX/filename
    if (parts[0]?.match(/Tax Year\s+(\d{4})/i)) {
      const yearMatch = parts[0].match(/Tax Year\s+(\d{4})/i);
      if (yearMatch) {
        taxYear = yearMatch[1];
      }

      const clientMatch = parts[1]?.match(/Client\s+(\d{4})/i);
      if (clientMatch) {
        clientCode = clientMatch[1];
      }
    }
    // Try pattern: Personal/Client XXXX/Tax Year XXXX/filename
    else if (parts[0] === 'Personal') {
      const clientMatch = parts[1]?.match(/Client\s+(\d{4})/i);
      if (clientMatch) {
        clientCode = clientMatch[1];
      }

      const yearMatch = parts[2]?.match(/Tax Year\s+(\d{4})/i);
      if (yearMatch) {
        taxYear = yearMatch[1];
      }
    }
  }

  if (!clientCode) {
    return null;
  }

  return {
    clientCode,
    taxYear: taxYear || 'N/A',
    fileName: path.basename(filePath),
    filePath,
    isCorporate,
    documentCategory,
    bankName,
  };
}

/**
 * Get or create folder in Google Drive
 */
async function getOrCreateFolder(folderName: string, parentFolderId: string): Promise<string> {
  // Search for existing folder
  const searchResponse = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0].id!;
  }

  // Create folder
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      parents: [parentFolderId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    supportsAllDrives: true,
  });

  return createResponse.data.id!;
}

/**
 * Upload file to Google Drive
 */
async function uploadToGoogleDrive(
  fileMetadata: FileMetadata,
  rootFolderId: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  let targetFolderId: string;

  if (fileMetadata.isCorporate) {
    // Corporate structure: Corporate/Client XXXX/Category/[Bank Name]/[Tax Year XXXX]
    const corporateFolderId = await getOrCreateFolder('Corporate', rootFolderId);
    const clientFolderId = await getOrCreateFolder(`Client ${fileMetadata.clientCode}`, corporateFolderId);

    if (fileMetadata.documentCategory === 'statements' && fileMetadata.bankName) {
      // Financial Statements: Corporate/Client XXXX/Financial Statements/Bank Name/Tax Year XXXX
      const statementsFolderId = await getOrCreateFolder('Financial Statements', clientFolderId);
      const bankFolderId = await getOrCreateFolder(fileMetadata.bankName, statementsFolderId);
      targetFolderId = await getOrCreateFolder(`Tax Year ${fileMetadata.taxYear}`, bankFolderId);
    } else if (fileMetadata.documentCategory) {
      // Other categories: Corporate/Client XXXX/Category/[Tax Year XXXX if needed]
      const categoryFolderId = await getOrCreateFolder(
        fileMetadata.documentCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        clientFolderId
      );

      // Year-independent categories
      if (['business-credentials', 'notices-letters'].includes(fileMetadata.documentCategory)) {
        targetFolderId = categoryFolderId;
      } else {
        targetFolderId = await getOrCreateFolder(`Tax Year ${fileMetadata.taxYear}`, categoryFolderId);
      }
    } else {
      targetFolderId = clientFolderId;
    }
  } else {
    // Personal structure: Personal/Client XXXX/Tax Year XXXX
    const personalFolderId = await getOrCreateFolder('Personal', rootFolderId);
    const clientFolderId = await getOrCreateFolder(`Client ${fileMetadata.clientCode}`, personalFolderId);
    targetFolderId = await getOrCreateFolder(`Tax Year ${fileMetadata.taxYear}`, clientFolderId);
  }

  // Upload file
  const fileBuffer = fs.readFileSync(fileMetadata.filePath);
  const mimeType = getMimeType(fileMetadata.fileName);

  const uploadResponse = await drive.files.create({
    requestBody: {
      name: fileMetadata.fileName,
      parents: [targetFolderId],
    },
    media: {
      mimeType: mimeType,
      body: Readable.from(fileBuffer),
    },
    supportsAllDrives: true,
  });

  const fileId = uploadResponse.data.id!;

  // Make file accessible with link sharing
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  // Get file links
  const fileResponse = await drive.files.get({
    fileId: fileId,
    fields: 'webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  return {
    fileId,
    webViewLink: fileResponse.data.webViewLink!,
    webContentLink: fileResponse.data.webContentLink!,
  };
}

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Create or update Airtable record
 */
async function updateAirtableRecord(
  fileMetadata: FileMetadata,
  googleDriveData: { fileId: string; webViewLink: string; webContentLink: string }
): Promise<void> {
  // Search for existing record
  const records = await base(DOCUMENTS_TABLE)
    .select({
      filterByFormula: `AND({Client Code}='${fileMetadata.clientCode}', {Original Name}='${fileMetadata.fileName.replace(/'/g, "\\'")}', {Tax Year}='${fileMetadata.taxYear}')`,
      maxRecords: 1,
    })
    .firstPage();

  const fields = {
    'Client Code': fileMetadata.clientCode,
    'Tax Year': fileMetadata.taxYear,
    'File Name': fileMetadata.fileName,
    'Original Name': fileMetadata.fileName,
    'Upload Date': new Date().toISOString().split('T')[0],
    'File Size': fs.statSync(fileMetadata.filePath).size,
    'File Type': getMimeType(fileMetadata.fileName),
    'Google Drive File ID': googleDriveData.fileId,
    'Web View Link': googleDriveData.webViewLink,
    'Web Content Link': googleDriveData.webContentLink,
    ...(fileMetadata.documentCategory && { 'Document Category': fileMetadata.documentCategory }),
    ...(fileMetadata.bankName && { 'Bank Name': fileMetadata.bankName }),
  };

  if (records.length > 0) {
    // Update existing record
    await base(DOCUMENTS_TABLE).update([
      {
        id: records[0].id,
        fields,
      },
    ]);
    console.log(`  ✅ Updated Airtable record: ${records[0].id}`);
  } else {
    // Create new record
    const newRecord = await base(DOCUMENTS_TABLE).create([{ fields }]);
    console.log(`  ✅ Created Airtable record: ${newRecord[0].id}`);
  }
}

/**
 * Scan directory recursively for files
 */
function scanDirectory(dir: string): string[] {
  let files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(scanDirectory(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main migration function
 */
async function migrateFiles() {
  console.log('🚀 Starting OneDrive to Google Drive Migration\n');
  console.log(`📂 Source Directory: ${sourceDir}`);
  console.log(`🌐 Google Drive Root: ${GOOGLE_DRIVE_FOLDER_ID}`);
  console.log(`${dryRun ? '🔍 DRY RUN MODE - No files will be uploaded' : '✅ LIVE MODE - Files will be uploaded'}\n`);

  const stats: MigrationStats = {
    totalFiles: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Scan source directory
  console.log('📊 Scanning source directory...');
  const files = scanDirectory(sourceDir);
  stats.totalFiles = files.length;
  console.log(`Found ${files.length} files\n`);

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    console.log(`\n[${i + 1}/${files.length}] Processing: ${path.relative(sourceDir, filePath)}`);

    try {
      // Parse file metadata
      const fileMetadata = parseFilePath(filePath, sourceDir);

      if (!fileMetadata) {
        console.log(`  ⚠️  Skipped: Could not parse client code from path`);
        stats.skipped++;
        continue;
      }

      console.log(`  📋 Client: ${fileMetadata.clientCode} | Year: ${fileMetadata.taxYear} | ${fileMetadata.isCorporate ? 'Corporate' : 'Personal'}`);

      // Check if file already has Google Drive ID (skip if requested)
      if (skipExisting) {
        const existingRecords = await base(DOCUMENTS_TABLE)
          .select({
            filterByFormula: `AND({Client Code}='${fileMetadata.clientCode}', {Original Name}='${fileMetadata.fileName.replace(/'/g, "\\'")}', {Tax Year}='${fileMetadata.taxYear}', {Google Drive File ID}!='')`,
            maxRecords: 1,
          })
          .firstPage();

        if (existingRecords.length > 0) {
          console.log(`  ⏭️  Skipped: Already has Google Drive File ID`);
          stats.skipped++;
          continue;
        }
      }

      if (dryRun) {
        console.log(`  🔍 Would upload to Google Drive and update Airtable`);
        stats.successful++;
        continue;
      }

      // Upload to Google Drive
      console.log(`  ⬆️  Uploading to Google Drive...`);
      const googleDriveData = await uploadToGoogleDrive(fileMetadata, GOOGLE_DRIVE_FOLDER_ID);
      console.log(`  ✅ Uploaded: ${googleDriveData.fileId}`);

      // Update Airtable
      console.log(`  📝 Updating Airtable...`);
      await updateAirtableRecord(fileMetadata, googleDriveData);

      stats.successful++;
    } catch (error) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.failed++;
      stats.errors.push({
        file: path.relative(sourceDir, filePath),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Files:       ${stats.totalFiles}`);
  console.log(`✅ Successful:     ${stats.successful}`);
  console.log(`⏭️  Skipped:        ${stats.skipped}`);
  console.log(`❌ Failed:         ${stats.failed}`);
  console.log('='.repeat(60));

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORS:\n');
    stats.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. ${err.file}`);
      console.log(`   Error: ${err.error}\n`);
    });
  }

  if (dryRun) {
    console.log('\n🔍 This was a DRY RUN. Remove --dry-run flag to perform actual migration.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

// Run migration
migrateFiles().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
