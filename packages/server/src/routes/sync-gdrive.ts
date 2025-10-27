/**
 * Google Drive Sync Route
 *
 * Scans Google Drive and syncs file metadata to Airtable
 */

import { Hono } from 'hono';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import Airtable from 'airtable';

const app = new Hono();

// Initialize Google Auth
const auth = new GoogleAuth({
  credentials: process.env.GOOGLE_DRIVE_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON)
    : undefined,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// Initialize Airtable
import { getTable } from '../lib/airtable-service';
const DOCUMENTS_TABLE = 'Documents';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
  webContentLink: string;
  parents: string[];
}

/**
 * Recursively scan a folder and all subfolders
 */
async function scanFolder(folderId: string, path: string = ''): Promise<GoogleDriveFile[]> {
  const allFiles: GoogleDriveFile[] = [];

  try {
    let pageToken: string | undefined = undefined;

    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink, webContentLink, parents)',
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];

      for (const file of files) {
        const filePath = path ? `${path}/${file.name}` : file.name;

        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively scan subfolder
          console.log(`Scanning folder: ${filePath}`);
          const subfolderFiles = await scanFolder(file.id!, filePath);
          allFiles.push(...subfolderFiles);
        } else {
          // Regular file
          allFiles.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: file.size!,
            createdTime: file.createdTime!,
            webViewLink: file.webViewLink!,
            webContentLink: file.webContentLink!,
            parents: file.parents!,
          });
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return allFiles;
  } catch (error) {
    console.error(`Error scanning folder ${folderId}:`, error);
    throw error;
  }
}

/**
 * Parse client code and tax year from folder structure
 * Expected structure: Tax Year YYYY/Client XXXX/filename.pdf
 */
function parseFileMetadata(fileName: string, folderPath: string): {
  clientCode: string | null;
  taxYear: string | null;
} {
  // Try to extract from folder path
  // Pattern: "Tax Year 2023/Client 1234"
  const taxYearMatch = folderPath.match(/Tax Year (\d{4}|N\/A)/i);
  const clientCodeMatch = folderPath.match(/Client (\d{4})/i);

  return {
    clientCode: clientCodeMatch ? clientCodeMatch[1] : null,
    taxYear: taxYearMatch ? taxYearMatch[1] : null,
  };
}

/**
 * Get parent folder path for a file
 */
async function getFolderPath(fileParents: string[]): Promise<string> {
  if (!fileParents || fileParents.length === 0) return '';

  try {
    const folderId = fileParents[0];
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'name, parents',
      supportsAllDrives: true,
    });

    const folderName = folderResponse.data.name || '';
    const grandparents = folderResponse.data.parents;

    if (grandparents && grandparents.length > 0) {
      const parentPath = await getFolderPath(grandparents);
      return parentPath ? `${parentPath}/${folderName}` : folderName;
    }

    return folderName;
  } catch (error) {
    console.error('Error getting folder path:', error);
    return '';
  }
}

/**
 * POST /api/sync-gdrive
 * Scan Google Drive and sync to Airtable
 */
app.post('/', async (c) => {
  try {
    if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
      return c.json({ error: 'Google Drive credentials not configured' }, 500);
    }

    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return c.json({ error: 'Google Drive folder ID not configured' }, 500);
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('Starting Google Drive scan...');
    const files = await scanFolder(rootFolderId);
    console.log(`Found ${files.length} files in Google Drive`);

    const results = {
      scanned: files.length,
      updated: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    // Process each file
    for (const file of files) {
      try {
        // Get folder path to extract metadata
        const folderPath = await getFolderPath(file.parents);
        const metadata = parseFileMetadata(file.name, folderPath);

        if (!metadata.clientCode || !metadata.taxYear) {
          results.skipped++;
          results.details.push({
            fileName: file.name,
            status: 'skipped',
            reason: 'Could not parse client code or tax year from folder structure',
            folderPath,
          });
          continue;
        }

        // Extract original filename (remove timestamp prefix if exists)
        const originalName = file.name.replace(/^\d+_/, '');

        // Check if record already exists in Airtable
        const existingRecords = await base(DOCUMENTS_TABLE)
          .select({
            filterByFormula: `{Google Drive File ID} = '${file.id}'`,
            maxRecords: 1,
          })
          .firstPage();

        if (existingRecords.length > 0) {
          // Update existing record
          const recordId = existingRecords[0].id;
          await base(DOCUMENTS_TABLE).update([
            {
              id: recordId,
              fields: {
                'Web View Link': file.webViewLink || '',
                'Web Content Link': file.webContentLink || '',
                'File Size': parseInt(file.size) || 0,
              },
            },
          ]);

          results.updated++;
          results.details.push({
            fileName: file.name,
            status: 'updated',
            recordId,
            clientCode: metadata.clientCode,
            taxYear: metadata.taxYear,
          });
        } else {
          // Create new record
          const newRecord = await base(DOCUMENTS_TABLE).create([
            {
              fields: {
                'Client Code': metadata.clientCode,
                'Tax Year': metadata.taxYear,
                'File Name': file.name,
                'Original Name': originalName,
                'Upload Date': file.createdTime.split('T')[0],
                'File Size': parseInt(file.size) || 0,
                'File Type': file.mimeType,
                'Google Drive File ID': file.id,
                'Web View Link': file.webViewLink || '',
                'Web Content Link': file.webContentLink || '',
                'Uploaded By': 'system-sync',
              },
            },
          ]);

          results.created++;
          results.details.push({
            fileName: file.name,
            status: 'created',
            recordId: newRecord[0].id,
            clientCode: metadata.clientCode,
            taxYear: metadata.taxYear,
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          fileName: file.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    console.log('Sync complete:', results);
    return c.json({
      success: true,
      message: 'Google Drive sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing Google Drive:', error);
    return c.json(
      {
        error: 'Failed to sync Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/sync-gdrive/preview
 * Preview what would be synced without making changes
 */
app.get('/preview', async (c) => {
  try {
    if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
      return c.json({ error: 'Google Drive credentials not configured' }, 500);
    }

    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return c.json({ error: 'Google Drive folder ID not configured' }, 500);
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('Previewing Google Drive files...');
    const files = await scanFolder(rootFolderId);

    const preview = [];
    for (const file of files.slice(0, 20)) {
      // Preview first 20 files
      const folderPath = await getFolderPath(file.parents);
      const metadata = parseFileMetadata(file.name, folderPath);

      preview.push({
        fileName: file.name,
        folderPath,
        clientCode: metadata.clientCode,
        taxYear: metadata.taxYear,
        fileSize: parseInt(file.size) || 0,
        hasViewLink: !!file.webViewLink,
        hasContentLink: !!file.webContentLink,
      });
    }

    return c.json({
      success: true,
      totalFiles: files.length,
      preview,
      message: `Found ${files.length} files. Showing first ${preview.length}.`,
    });
  } catch (error) {
    console.error('Error previewing Google Drive:', error);
    return c.json(
      {
        error: 'Failed to preview Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
