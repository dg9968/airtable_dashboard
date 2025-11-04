// lib/onedrive.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

// Initialize Microsoft Graph client
function getAuthenticatedClient(): Client {
  if (!process.env.ONEDRIVE_CLIENT_ID ||
      !process.env.ONEDRIVE_CLIENT_SECRET ||
      !process.env.ONEDRIVE_TENANT_ID) {
    throw new Error('OneDrive credentials are not configured. Please set ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, and ONEDRIVE_TENANT_ID in your .env file.');
  }

  const credential = new ClientSecretCredential(
    process.env.ONEDRIVE_TENANT_ID,
    process.env.ONEDRIVE_CLIENT_ID,
    process.env.ONEDRIVE_CLIENT_SECRET
  );

  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        return token?.token || '';
      }
    }
  });

  return client;
}

export interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  '@microsoft.graph.downloadUrl'?: string;
}

// List items in a OneDrive folder
export async function listOneDriveItems(
  folderId: string = 'root',
  userId?: string
): Promise<OneDriveItem[]> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';
    const endpoint = folderId === 'root'
      ? `${userPath}/drive/root/children`
      : `${userPath}/drive/items/${folderId}/children`;

    const response = await client
      .api(endpoint)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,@microsoft.graph.downloadUrl')
      .get();

    return response.value || [];
  } catch (error) {
    console.error('Error listing OneDrive items:', error);
    throw error;
  }
}

// List all items recursively
export async function listOneDriveItemsRecursive(
  folderId: string = 'root',
  userId?: string,
  parentPath: string = ''
): Promise<Array<OneDriveItem & { path: string }>> {
  try {
    const items = await listOneDriveItems(folderId, userId);
    const results: Array<OneDriveItem & { path: string }> = [];

    for (const item of items) {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;

      // Add current item with path
      results.push({ ...item, path: itemPath });

      // If it's a folder, recursively get its contents
      if (item.folder) {
        const childItems = await listOneDriveItemsRecursive(item.id, userId, itemPath);
        results.push(...childItems);
      }
    }

    return results;
  } catch (error) {
    console.error('Error listing OneDrive items recursively:', error);
    throw error;
  }
}

// Download a file from OneDrive
export async function downloadOneDriveFile(
  fileId: string,
  userId?: string
): Promise<Buffer> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';

    // Get download URL
    const fileInfo = await client
      .api(`${userPath}/drive/items/${fileId}`)
      .select('@microsoft.graph.downloadUrl')
      .get();

    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl'];

    if (!downloadUrl) {
      throw new Error('No download URL available for this file');
    }

    // Download the file content
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading OneDrive file:', error);
    throw error;
  }
}

// Get file metadata
export async function getOneDriveFileMetadata(
  fileId: string,
  userId?: string
): Promise<OneDriveItem> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';

    const response = await client
      .api(`${userPath}/drive/items/${fileId}`)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,@microsoft.graph.downloadUrl')
      .get();

    return response;
  } catch (error) {
    console.error('Error getting OneDrive file metadata:', error);
    throw error;
  }
}

// Get root folder ID
export async function getOneDriveRootFolder(userId?: string): Promise<string> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';

    const response = await client
      .api(`${userPath}/drive/root`)
      .select('id')
      .get();

    return response.id;
  } catch (error) {
    console.error('Error getting OneDrive root folder:', error);
    throw error;
  }
}

// Test OneDrive connection
export async function testOneDriveConnection(userId?: string): Promise<{ success: boolean; message: string; user?: any }> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';

    const response = await client
      .api(`${userPath}/drive`)
      .select('id,driveType,owner')
      .get();

    return {
      success: true,
      message: 'OneDrive connection successful',
      user: response.owner
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}

// Search for files in OneDrive
export async function searchOneDriveFiles(
  query: string,
  userId?: string
): Promise<OneDriveItem[]> {
  try {
    const client = getAuthenticatedClient();
    const userPath = userId ? `/users/${userId}` : '/me';

    const response = await client
      .api(`${userPath}/drive/root/search(q='${query}')`)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,@microsoft.graph.downloadUrl')
      .get();

    return response.value || [];
  } catch (error) {
    console.error('Error searching OneDrive files:', error);
    throw error;
  }
}
