#!/usr/bin/env node
/**
 * OneDrive to Google Drive Backup Script
 *
 * This script backs up files from OneDrive to Google Drive, preserving folder structure.
 * It can run as a one-time backup or be scheduled to run periodically.
 *
 * Usage:
 *   bun run src/scripts/onedrive-to-gdrive-backup.ts [options]
 *
 * Options:
 *   --dry-run          Show what would be backed up without actually uploading
 *   --folder-id=ID     Backup specific OneDrive folder (default: root)
 *   --user-id=EMAIL    OneDrive user email (for service accounts)
 *   --exclude=PATTERN  Exclude files matching pattern (can be used multiple times)
 *   --help             Show this help message
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';
import {
  listOneDriveItemsRecursive,
  downloadOneDriveFile,
  testOneDriveConnection,
  OneDriveItem
} from '../onedrive';

// Parse command line arguments
interface BackupOptions {
  dryRun: boolean;
  folderId: string;
  userId?: string;
  exclude: string[];
  help: boolean;
}

function parseArgs(): BackupOptions {
  const args = process.argv.slice(2);
  const options: BackupOptions = {
    dryRun: false,
    folderId: 'root',
    exclude: [],
    help: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--folder-id=')) {
      options.folderId = arg.split('=')[1];
    } else if (arg.startsWith('--user-id=')) {
      options.userId = arg.split('=')[1];
    } else if (arg.startsWith('--exclude=')) {
      options.exclude.push(arg.split('=')[1]);
    } else if (arg === '--help') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
OneDrive to Google Drive Backup Script

Usage:
  bun run src/scripts/onedrive-to-gdrive-backup.ts [options]

Options:
  --dry-run          Show what would be backed up without actually uploading
  --folder-id=ID     Backup specific OneDrive folder (default: root)
  --user-id=EMAIL    OneDrive user email (for service accounts)
  --exclude=PATTERN  Exclude files matching pattern (can be used multiple times)
  --help             Show this help message

Environment Variables Required:
  # OneDrive Configuration
  ONEDRIVE_CLIENT_ID         - Azure AD Application Client ID
  ONEDRIVE_CLIENT_SECRET     - Azure AD Application Client Secret
  ONEDRIVE_TENANT_ID         - Azure AD Tenant ID

  # Google Drive Configuration
  GOOGLE_DRIVE_CREDENTIALS_JSON - Google Service Account credentials
  GOOGLE_DRIVE_BACKUP_FOLDER_ID - Target folder ID in Google Drive

Examples:
  # Dry run to see what would be backed up
  bun run src/scripts/onedrive-to-gdrive-backup.ts --dry-run

  # Backup specific folder
  bun run src/scripts/onedrive-to-gdrive-backup.ts --folder-id=ABC123

  # Backup with exclusions
  bun run src/scripts/onedrive-to-gdrive-backup.ts --exclude="*.tmp" --exclude="~$*"

  # Backup specific user's OneDrive
  bun run src/scripts/onedrive-to-gdrive-backup.ts --user-id=user@company.com
`);
}

// Initialize Google Drive client
function initGoogleDrive() {
  if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_DRIVE_CREDENTIALS_JSON is required');
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// Create or get folder in Google Drive
async function getOrCreateGoogleDriveFolder(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> {
  try {
    // Search for existing folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName.replace(/'/g, "\\'")}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id!;
    }

    // Create folder if it doesn't exist
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        parents: [parentId],
        mimeType: 'application/vnd.google-apps.folder',
      },
      supportsAllDrives: true,
    });

    return createResponse.data.id!;
  } catch (error) {
    console.error(`Error creating folder ${folderName}:`, error);
    throw error;
  }
}

// Upload file to Google Drive
async function uploadToGoogleDrive(
  drive: any,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  parentFolderId: string
): Promise<string> {
  try {
    // Check if file already exists
    const searchResponse = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and parents in '${parentFolderId}' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    // If file exists, update it
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const fileId = searchResponse.data.files[0].id!;
      await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: mimeType,
          body: Readable.from(fileBuffer),
        },
        supportsAllDrives: true,
      });
      return fileId;
    }

    // Create new file
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: {
        mimeType: mimeType,
        body: Readable.from(fileBuffer),
      },
      supportsAllDrives: true,
    });

    return uploadResponse.data.id!;
  } catch (error) {
    console.error(`Error uploading file ${fileName}:`, error);
    throw error;
  }
}

// Check if file should be excluded
function shouldExclude(fileName: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    if (regex.test(fileName)) {
      return true;
    }
  }
  return false;
}

// Format file size for display
function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Main backup function
async function backupOneDriveToGoogleDrive(options: BackupOptions) {
  console.log('🚀 Starting OneDrive to Google Drive backup...\n');

  // Validate environment variables
  if (!process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_BACKUP_FOLDER_ID is required. Set this to the target Google Drive folder ID.');
  }

  // Test connections
  console.log('🔍 Testing OneDrive connection...');
  const oneDriveTest = await testOneDriveConnection(options.userId);
  if (!oneDriveTest.success) {
    throw new Error(`OneDrive connection failed: ${oneDriveTest.message}`);
  }
  console.log('✅ OneDrive connection successful');

  if (!options.dryRun) {
    console.log('🔍 Testing Google Drive connection...');
    const drive = initGoogleDrive();
    const gdriveTest = await drive.about.get({ fields: 'user' });
    console.log('✅ Google Drive connection successful');
  }

  // List all OneDrive items
  console.log(`\n📂 Scanning OneDrive folder${options.userId ? ` for ${options.userId}` : ''}...`);
  const items = await listOneDriveItemsRecursive(options.folderId, options.userId);

  const files = items.filter(item => !item.folder);
  const folders = items.filter(item => item.folder);

  console.log(`\n📊 Found ${files.length} files and ${folders.length} folders`);

  // Filter out excluded files
  const filesToBackup = files.filter(file => !shouldExclude(file.name, options.exclude));
  const excludedCount = files.length - filesToBackup.length;

  if (excludedCount > 0) {
    console.log(`⚠️  Excluded ${excludedCount} files based on patterns`);
  }

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - No files will be uploaded\n');
    console.log('Files to be backed up:');
    for (const file of filesToBackup) {
      console.log(`  ${file.path} (${formatFileSize(file.size)})`);
    }
    console.log(`\nTotal: ${filesToBackup.length} files, ${formatFileSize(filesToBackup.reduce((sum, f) => sum + (f.size || 0), 0))}`);
    return;
  }

  // Initialize Google Drive
  const drive = initGoogleDrive();
  const rootFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID!;

  // Create folder structure
  console.log('\n📁 Creating folder structure in Google Drive...');
  const folderMap = new Map<string, string>();
  folderMap.set('', rootFolderId); // Root mapping

  // Sort folders by path depth to create parent folders first
  const sortedFolders = [...new Set(filesToBackup.map(f => {
    const parts = f.path.split('/');
    parts.pop(); // Remove filename
    return parts;
  }).filter(parts => parts.length > 0))]
    .map(parts => parts.join('/'))
    .sort((a, b) => a.split('/').length - b.split('/').length);

  for (const folderPath of sortedFolders) {
    const parts = folderPath.split('/');
    let currentPath = '';

    for (const part of parts) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        const parentId = folderMap.get(parentPath) || rootFolderId;
        const folderId = await getOrCreateGoogleDriveFolder(drive, part, parentId);
        folderMap.set(currentPath, folderId);
        console.log(`  ✓ ${currentPath}`);
      }
    }
  }

  // Upload files
  console.log('\n📤 Uploading files to Google Drive...');
  let successCount = 0;
  let errorCount = 0;
  let totalSize = 0;

  for (let i = 0; i < filesToBackup.length; i++) {
    const file = filesToBackup[i];
    const progress = `[${i + 1}/${filesToBackup.length}]`;

    try {
      console.log(`${progress} Downloading ${file.path}...`);
      const fileBuffer = await downloadOneDriveFile(file.id, options.userId);

      // Determine parent folder
      const pathParts = file.path.split('/');
      const fileName = pathParts.pop()!;
      const folderPath = pathParts.join('/');
      const parentFolderId = folderMap.get(folderPath) || rootFolderId;

      console.log(`${progress} Uploading ${file.path} (${formatFileSize(file.size)})...`);
      const mimeType = file.file?.mimeType || 'application/octet-stream';
      await uploadToGoogleDrive(drive, fileName, fileBuffer, mimeType, parentFolderId);

      successCount++;
      totalSize += file.size || 0;
      console.log(`${progress} ✅ ${file.path}`);
    } catch (error) {
      errorCount++;
      console.error(`${progress} ❌ Failed to backup ${file.path}:`, error instanceof Error ? error.message : error);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backup Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successfully backed up: ${successCount} files`);
  console.log(`❌ Failed: ${errorCount} files`);
  console.log(`💾 Total size: ${formatFileSize(totalSize)}`);
  console.log(`📁 Target folder: ${rootFolderId}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n🎉 Backup completed successfully!');
  } else {
    console.log('\n⚠️  Backup completed with errors. Please check the log above.');
  }
}

// Run the script
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    await backupOneDriveToGoogleDrive(options);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupOneDriveToGoogleDrive };
