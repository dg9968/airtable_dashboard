// lib/googleDrive.ts
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';

// Initialize Google Auth
const auth = new GoogleAuth({
  credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 
    JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : undefined,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

// Initialize Google Drive API
const drive = google.drive({ version: 'v3', auth });

// Validate environment variables
function validateGoogleDriveEnvironment() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required. Please set it in your .env.local file.');
  }
  if (!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is required. Please set it in your .env.local file.');
  }
}

// Get or create tax year folder
export async function getOrCreateTaxYearFolder(taxYear: string): Promise<string> {
  try {
    validateGoogleDriveEnvironment();
    
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
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

// Get or create client folder within tax year folder
export async function getOrCreateClientFolder(clientCode: string, taxYear: string): Promise<string> {
  try {
    const taxYearFolderId = await getOrCreateTaxYearFolder(taxYear);
    const folderName = `Client ${clientCode}`;

    // Search for existing client folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and parents in '${taxYearFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id!;
    }

    // Create client folder if it doesn't exist
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        parents: [taxYearFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      },
      supportsAllDrives: true,
    });

    return createResponse.data.id!;
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
  taxYear: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  try {
    const clientFolderId = await getOrCreateClientFolder(clientCode, taxYear);

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