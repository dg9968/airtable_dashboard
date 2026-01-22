// lib/googleDrive.ts
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';

// Initialize Google Auth
const auth = new GoogleAuth({
  credentials: process.env.GOOGLE_DRIVE_CREDENTIALS_JSON ?
    JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) : undefined,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

// Initialize Google Drive API
const drive = google.drive({ version: 'v3', auth });

// In-memory lock to prevent duplicate folder creation during concurrent uploads
const folderLocks = new Map<string, Promise<string>>();

/**
 * Get or create folder with lock to prevent race conditions
 */
async function getOrCreateFolderWithLock(
  lockKey: string,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  // If there's already a lock for this folder, wait for it
  const existingLock = folderLocks.get(lockKey);
  if (existingLock) {
    console.log(`[Lock] Waiting for existing lock: ${lockKey}`);
    return existingLock;
  }

  // Create new lock
  const lockPromise = (async () => {
    try {
      // Search for existing folder (check for duplicates too)
      const searchResponse = await drive.files.list({
        q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      // If multiple folders found, use the first one and log warning
      if (searchResponse.data.files && searchResponse.data.files.length > 1) {
        console.warn(`[Dedup] Found ${searchResponse.data.files.length} folders named "${folderName}" in parent ${parentFolderId}. Using first one.`);
        return searchResponse.data.files[0].id!;
      }

      // If folder exists, return it
      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id!;
      }

      // Create folder if it doesn't exist
      console.log(`[Lock] Creating new folder: ${folderName} in ${parentFolderId}`);
      const createResponse = await drive.files.create({
        requestBody: {
          name: folderName,
          parents: [parentFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });

      return createResponse.data.id!;
    } finally {
      // Remove lock after operation completes
      folderLocks.delete(lockKey);
    }
  })();

  // Store the lock
  folderLocks.set(lockKey, lockPromise);

  return lockPromise;
}

// Validate environment variables
function validateGoogleDriveEnvironment() {
  if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_DRIVE_CREDENTIALS_JSON is required. Please set it in your .env file.');
  }
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is required. Please set it in your .env file.');
  }
}

// Get root folder ID from environment
async function getRootFolderId(): Promise<string> {
  validateGoogleDriveEnvironment();
  return process.env.GOOGLE_DRIVE_FOLDER_ID!;
}

// Get or create tax year folder
export async function getOrCreateTaxYearFolder(taxYear: string): Promise<string> {
  try {
    validateGoogleDriveEnvironment();

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const folderName = `Tax Year ${taxYear}`;

    // Search for existing tax year folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and parents in '${rootFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id!;
    }

    // Create tax year folder if it doesn't exist
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        parents: [rootFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      },
      supportsAllDrives: true,
    });

    return createResponse.data.id!;
  } catch (error) {
    console.error('Error getting/creating tax year folder:', error);
    throw error;
  }
}

// Get or create corporate category folder (for year-independent categories like business-credentials, notices-letters)
export async function getOrCreateCorporateCategoryFolder(clientCode: string, category: string): Promise<string> {
  try {
    const rootFolderId = await getRootFolderId();

    // Create/get "Corporate" folder with lock
    const corporateFolderId = await getOrCreateFolderWithLock(
      `corporate-${rootFolderId}`,
      'Corporate',
      rootFolderId
    );

    // Create/get client folder under Corporate with lock
    const clientFolderName = `Client ${clientCode}`;
    const clientFolderId = await getOrCreateFolderWithLock(
      `client-${clientCode}-${corporateFolderId}`,
      clientFolderName,
      corporateFolderId
    );

    // Create/get category folder under client with lock
    const categoryFolderName = category === 'business-credentials' ? 'Business Credentials' :
                               category === 'notices-letters' ? 'Notices and Letters' :
                               category;

    const categoryFolderId = await getOrCreateFolderWithLock(
      `category-${category}-${clientFolderId}`,
      categoryFolderName,
      clientFolderId
    );

    return categoryFolderId;
  } catch (error) {
    console.error('Error getting/creating corporate category folder:', error);
    throw error;
  }
}

// Get or create financial statements folder (organized by bank, then year)
export async function getOrCreateFinancialStatementsFolder(clientCode: string, bankName: string, taxYear: string): Promise<string> {
  try {
    const rootFolderId = await getRootFolderId();

    // Create/get "Corporate" folder with lock
    const corporateFolderId = await getOrCreateFolderWithLock(
      `corporate-${rootFolderId}`,
      'Corporate',
      rootFolderId
    );

    // Create/get client folder under Corporate with lock
    const clientFolderName = `Client ${clientCode}`;
    const clientFolderId = await getOrCreateFolderWithLock(
      `client-${clientCode}-${corporateFolderId}`,
      clientFolderName,
      corporateFolderId
    );

    // Create/get "Financial Statements" folder under client with lock
    const statementsFolderId = await getOrCreateFolderWithLock(
      `statements-${clientCode}-${clientFolderId}`,
      'Financial Statements',
      clientFolderId
    );

    // Create/get bank folder under Financial Statements with lock
    const bankFolderId = await getOrCreateFolderWithLock(
      `bank-${bankName}-${statementsFolderId}`,
      bankName,
      statementsFolderId
    );

    // Create/get year folder under bank with lock
    const yearFolderId = await getOrCreateFolderWithLock(
      `year-${taxYear}-${bankFolderId}`,
      taxYear,
      bankFolderId
    );

    return yearFolderId;
  } catch (error) {
    console.error('Error getting/creating financial statements folder:', error);
    throw error;
  }
}

// List existing banks for a client in Financial Statements
export async function listClientBanks(clientCode: string): Promise<string[]> {
  try {
    console.log(`[listClientBanks] Fetching banks for client code: ${clientCode}`);
    const rootFolderId = await getRootFolderId();
    console.log(`[listClientBanks] Root folder ID: ${rootFolderId}`);

    // Find Corporate folder
    const corporateSearchResponse = await drive.files.list({
      q: `name='Corporate' and parents in '${rootFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    console.log(`[listClientBanks] Found ${corporateSearchResponse.data.files?.length || 0} Corporate folder(s)`);
    if (corporateSearchResponse.data.files && corporateSearchResponse.data.files.length > 1) {
      console.log(`[listClientBanks] WARNING: Multiple Corporate folders found:`, corporateSearchResponse.data.files.map(f => ({ id: f.id, name: f.name })));
    }

    if (!corporateSearchResponse.data.files || corporateSearchResponse.data.files.length === 0) {
      console.log(`[listClientBanks] Corporate folder not found`);
      return [];
    }
    const corporateFolderId = corporateSearchResponse.data.files[0].id!;
    console.log(`[listClientBanks] Using Corporate folder ID: ${corporateFolderId}`);

    // Find client folder - with proper pagination handling
    const clientFolderName = `Client ${clientCode}`;

    // Fetch ALL folders with pagination
    let allFolders: any[] = [];
    let pageToken: string | null | undefined = undefined;

    do {
      const response = await drive.files.list({
        q: `'${corporateFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken: pageToken || undefined,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
      });

      if (response.data.files) {
        allFolders = allFolders.concat(response.data.files);
      }

      pageToken = response.data.nextPageToken;
      console.log(`[listClientBanks] Fetched ${response.data.files?.length || 0} folders, total so far: ${allFolders.length}, hasMore: ${!!pageToken}`);
    } while (pageToken);

    console.log(`[listClientBanks] Total folders in Corporate after pagination:`, allFolders.length);
    console.log(`[listClientBanks] Looking for: '${clientFolderName}'`);

    const matchingFolder = allFolders.find(f => f.name === clientFolderName);
    if (!matchingFolder) {
      console.log(`[listClientBanks] No matching folder found. All folders:`, allFolders.map(f => f.name).sort());
      return [];
    }

    console.log(`[listClientBanks] Found matching folder:`, matchingFolder.name, matchingFolder.id);
    const clientFolderId = matchingFolder.id;

    // Find Financial Statements folder
    const statementsSearchResponse = await drive.files.list({
      q: `name='Financial Statements' and '${clientFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
    });

    if (!statementsSearchResponse.data.files || statementsSearchResponse.data.files.length === 0) {
      console.log(`[listClientBanks] Financial Statements folder not found for client ${clientCode}`);
      return [];
    }
    const statementsFolderId = statementsSearchResponse.data.files[0].id!;
    console.log(`[listClientBanks] Financial Statements folder ID: ${statementsFolderId}`);

    // List all bank folders with pagination
    let allBanks: any[] = [];
    let bankPageToken: string | null | undefined = undefined;

    do {
      const banksSearchResponse = await drive.files.list({
        q: `'${statementsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken: bankPageToken || undefined,
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
      });

      if (banksSearchResponse.data.files) {
        allBanks = allBanks.concat(banksSearchResponse.data.files);
      }

      bankPageToken = banksSearchResponse.data.nextPageToken;
      console.log(`[listClientBanks] Fetched ${banksSearchResponse.data.files?.length || 0} banks, total so far: ${allBanks.length}, hasMore: ${!!bankPageToken}`);
    } while (bankPageToken);

    const banks = allBanks.map(file => file.name!);
    console.log(`[listClientBanks] Total banks found after pagination: ${banks.length}:`, banks);
    return banks;
  } catch (error) {
    console.error('[listClientBanks] Error listing client banks:', error);
    return [];
  }
}

// Get or create client folder within Personal folder, then tax year folder inside it
export async function getOrCreateClientFolder(clientCode: string, taxYear: string): Promise<string> {
  try {
    const rootFolderId = await getRootFolderId();

    // Create/get "Personal" folder with lock
    const personalFolderId = await getOrCreateFolderWithLock(
      `personal-${rootFolderId}`,
      'Personal',
      rootFolderId
    );

    // Create/get client folder under Personal with lock
    const clientFolderName = `Client ${clientCode}`;
    const clientFolderId = await getOrCreateFolderWithLock(
      `personal-client-${clientCode}-${personalFolderId}`,
      clientFolderName,
      personalFolderId
    );

    // Create/get tax year folder under client folder with lock
    const taxYearFolderName = `Tax Year ${taxYear}`;
    const taxYearFolderId = await getOrCreateFolderWithLock(
      `personal-year-${taxYear}-${clientFolderId}`,
      taxYearFolderName,
      clientFolderId
    );

    return taxYearFolderId;
  } catch (error) {
    console.error('Error getting/creating client folder:', error);
    throw error;
  }
}

// Upload file to Google Drive
export async function uploadFileToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  clientCode: string,
  taxYear: string,
  documentCategory?: string,
  isCorporate?: boolean,
  bankName?: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  try {
    let clientFolderId: string;

    // For financial statements, use bank-organized folder structure
    if (isCorporate && documentCategory === 'statements' && bankName) {
      clientFolderId = await getOrCreateFinancialStatementsFolder(clientCode, bankName, taxYear);
    }
    // For year-independent corporate categories, use a different folder structure
    else if (isCorporate && documentCategory && ['business-credentials', 'notices-letters'].includes(documentCategory)) {
      clientFolderId = await getOrCreateCorporateCategoryFolder(clientCode, documentCategory);
    }
    else {
      clientFolderId = await getOrCreateClientFolder(clientCode, taxYear);
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const uniqueFileName = `${timestamp}_${fileName}`;

    const uploadResponse = await drive.files.create({
      requestBody: {
        name: uniqueFileName,
        parents: [clientFolderId],
      },
      media: {
        mimeType: mimeType,
        body: Readable.from(file),
      },
      supportsAllDrives: true,
    });

    const fileId = uploadResponse.data.id!;

    // Make file accessible with link sharing (optional - remove if you want private files)
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
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw error;
  }
}

// Download file from Google Drive
export async function downloadFileFromGoogleDrive(fileId: string): Promise<Buffer> {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
      supportsAllDrives: true,
    }, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    throw error;
  }
}

// Get file metadata from Google Drive
export async function getFileMetadata(fileId: string) {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return response.data;
  } catch (error) {
    console.error('Error getting file metadata from Google Drive:', error);
    throw error;
  }
}

// Delete file from Google Drive
export async function deleteFileFromGoogleDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true,
    });
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    throw error;
  }
}

// List files in client folder
export async function listClientFiles(clientCode: string, taxYear: string) {
  try {
    const clientFolderId = await getOrCreateClientFolder(clientCode, taxYear);

    const response = await drive.files.list({
      q: `parents in '${clientFolderId}' and trashed=false`,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error listing client files:', error);
    throw error;
  }
}

// Rename file in Google Drive
export async function renameFileInGoogleDrive(fileId: string, newFileName: string): Promise<void> {
  try {
    await drive.files.update({
      fileId: fileId,
      requestBody: {
        name: newFileName,
      },
      supportsAllDrives: true,
    });
  } catch (error) {
    console.error('Error renaming file in Google Drive:', error);
    throw error;
  }
}

// Test Google Drive connection
export async function testGoogleDriveConnection() {
  try {
    validateGoogleDriveEnvironment();

    const response = await drive.about.get({
      fields: 'user, storageQuota',
    });

    return {
      success: true,
      message: 'Google Drive connection successful',
      user: response.data.user,
      storageQuota: response.data.storageQuota
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}