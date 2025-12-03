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

    // Create/get "Corporate" folder
    const corporateFolderName = 'Corporate';
    let corporateFolderId: string;

    const corporateSearchResponse = await drive.files.list({
      q: `name='${corporateFolderName}' and parents in '${rootFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (corporateSearchResponse.data.files && corporateSearchResponse.data.files.length > 0) {
      corporateFolderId = corporateSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: corporateFolderName,
          parents: [rootFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      corporateFolderId = createResponse.data.id!;
    }

    // Create/get client folder under Corporate
    const clientFolderName = `Client ${clientCode}`;
    let clientFolderId: string;

    const clientSearchResponse = await drive.files.list({
      q: `name='${clientFolderName}' and parents in '${corporateFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (clientSearchResponse.data.files && clientSearchResponse.data.files.length > 0) {
      clientFolderId = clientSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: clientFolderName,
          parents: [corporateFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      clientFolderId = createResponse.data.id!;
    }

    // Create/get category folder under client
    const categoryFolderName = category === 'business-credentials' ? 'Business Credentials' :
                               category === 'notices-letters' ? 'Notices and Letters' :
                               category;

    const categorySearchResponse = await drive.files.list({
      q: `name='${categoryFolderName}' and parents in '${clientFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (categorySearchResponse.data.files && categorySearchResponse.data.files.length > 0) {
      return categorySearchResponse.data.files[0].id!;
    }

    const createResponse = await drive.files.create({
      requestBody: {
        name: categoryFolderName,
        parents: [clientFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      },
      supportsAllDrives: true,
    });

    return createResponse.data.id!;
  } catch (error) {
    console.error('Error getting/creating corporate category folder:', error);
    throw error;
  }
}

// Get or create financial statements folder (organized by bank, then year)
export async function getOrCreateFinancialStatementsFolder(clientCode: string, bankName: string, taxYear: string): Promise<string> {
  try {
    const rootFolderId = await getRootFolderId();

    // Create/get "Corporate" folder
    const corporateFolderName = 'Corporate';
    let corporateFolderId: string;

    const corporateSearchResponse = await drive.files.list({
      q: `name='${corporateFolderName}' and parents in '${rootFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (corporateSearchResponse.data.files && corporateSearchResponse.data.files.length > 0) {
      corporateFolderId = corporateSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: corporateFolderName,
          parents: [rootFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      corporateFolderId = createResponse.data.id!;
    }

    // Create/get client folder under Corporate
    const clientFolderName = `Client ${clientCode}`;
    let clientFolderId: string;

    const clientSearchResponse = await drive.files.list({
      q: `name='${clientFolderName}' and parents in '${corporateFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (clientSearchResponse.data.files && clientSearchResponse.data.files.length > 0) {
      clientFolderId = clientSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: clientFolderName,
          parents: [corporateFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      clientFolderId = createResponse.data.id!;
    }

    // Create/get "Financial Statements" folder under client
    const statementsFolderName = 'Financial Statements';
    let statementsFolderId: string;

    const statementsSearchResponse = await drive.files.list({
      q: `name='${statementsFolderName}' and parents in '${clientFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (statementsSearchResponse.data.files && statementsSearchResponse.data.files.length > 0) {
      statementsFolderId = statementsSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: statementsFolderName,
          parents: [clientFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      statementsFolderId = createResponse.data.id!;
    }

    // Create/get bank folder under Financial Statements
    let bankFolderId: string;

    const bankSearchResponse = await drive.files.list({
      q: `name='${bankName}' and parents in '${statementsFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (bankSearchResponse.data.files && bankSearchResponse.data.files.length > 0) {
      bankFolderId = bankSearchResponse.data.files[0].id!;
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: bankName,
          parents: [statementsFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        },
        supportsAllDrives: true,
      });
      bankFolderId = createResponse.data.id!;
    }

    // Create/get year folder under bank
    const yearSearchResponse = await drive.files.list({
      q: `name='${taxYear}' and parents in '${bankFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (yearSearchResponse.data.files && yearSearchResponse.data.files.length > 0) {
      return yearSearchResponse.data.files[0].id!;
    }

    const createResponse = await drive.files.create({
      requestBody: {
        name: taxYear,
        parents: [bankFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      },
      supportsAllDrives: true,
    });

    return createResponse.data.id!;
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

    if (!corporateSearchResponse.data.files || corporateSearchResponse.data.files.length === 0) {
      console.log(`[listClientBanks] Corporate folder not found`);
      return [];
    }
    const corporateFolderId = corporateSearchResponse.data.files[0].id!;
    console.log(`[listClientBanks] Corporate folder ID: ${corporateFolderId}`);

    // Find client folder
    const clientFolderName = `Client ${clientCode}`;
    const clientSearchResponse = await drive.files.list({
      q: `name='${clientFolderName}' and parents in '${corporateFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (!clientSearchResponse.data.files || clientSearchResponse.data.files.length === 0) {
      console.log(`[listClientBanks] Client folder '${clientFolderName}' not found`);
      return [];
    }
    const clientFolderId = clientSearchResponse.data.files[0].id!;
    console.log(`[listClientBanks] Client folder ID: ${clientFolderId}`);

    // Find Financial Statements folder
    const statementsSearchResponse = await drive.files.list({
      q: `name='Financial Statements' and parents in '${clientFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (!statementsSearchResponse.data.files || statementsSearchResponse.data.files.length === 0) {
      console.log(`[listClientBanks] Financial Statements folder not found for client ${clientCode}`);
      return [];
    }
    const statementsFolderId = statementsSearchResponse.data.files[0].id!;
    console.log(`[listClientBanks] Financial Statements folder ID: ${statementsFolderId}`);

    // List all bank folders
    const banksSearchResponse = await drive.files.list({
      q: `parents in '${statementsFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (!banksSearchResponse.data.files) {
      console.log(`[listClientBanks] No bank folders found`);
      return [];
    }

    const banks = banksSearchResponse.data.files.map(file => file.name!);
    console.log(`[listClientBanks] Found ${banks.length} banks:`, banks);
    return banks;
  } catch (error) {
    console.error('[listClientBanks] Error listing client banks:', error);
    return [];
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