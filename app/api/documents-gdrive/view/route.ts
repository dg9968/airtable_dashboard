// app/api/documents-gdrive/view/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { downloadFileFromGoogleDrive, getFileMetadata } from '@/lib/googleDrive';
import Airtable from 'airtable';

// Configure Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const DOCUMENTS_TABLE = 'Documents';

// GET - View document from Google Drive (inline display)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const googleDriveFileId = searchParams.get('googleDriveFileId');

    if (!recordId && !googleDriveFileId) {
      return NextResponse.json({ error: 'Record ID or Google Drive File ID is required' }, { status: 400 });
    }

    let fileIdToView = googleDriveFileId;
    let originalName = 'document';
    let mimeType = 'application/octet-stream';

    // If we have recordId but not googleDriveFileId, try to get it from Airtable
    if (recordId && !googleDriveFileId) {
      try {
        const record = await base(DOCUMENTS_TABLE).find(recordId);
        fileIdToView = record.fields['Google Drive File ID'] as string || record.fields['File Name'] as string;
        originalName = record.fields['Original Name'] as string || 'document';
        mimeType = record.fields['File Type'] as string || 'application/octet-stream';
      } catch (airtableError) {
        console.error('Airtable lookup failed:', airtableError);
        // If recordId looks like a Google Drive file ID, use it directly
        if (recordId.length > 20) {
          fileIdToView = recordId;
        }
      }
    }

    if (!fileIdToView) {
      return NextResponse.json({ error: 'Could not determine file ID to view' }, { status: 400 });
    }

    try {
      // Get file metadata if we don't have it
      if (!originalName || originalName === 'document') {
        const metadata = await getFileMetadata(fileIdToView);
        originalName = metadata.name?.replace(/^\d+_/, '') || 'document';
        mimeType = metadata.mimeType || 'application/octet-stream';
      }

      // For Google Drive, we can also redirect to the web view link for better viewing experience
      const useDirectView = searchParams.get('direct') === 'true';
      
      if (useDirectView) {
        const metadata = await getFileMetadata(fileIdToView);
        if (metadata.webViewLink) {
          return NextResponse.redirect(metadata.webViewLink);
        }
      }

      // Download file from Google Drive for inline viewing
      const fileBuffer = await downloadFileFromGoogleDrive(fileIdToView);

      // Return file with appropriate headers for inline viewing
      const response = new NextResponse(fileBuffer);
      response.headers.set('Content-Type', mimeType);
      
      // For inline viewing instead of download
      if (mimeType.includes('pdf')) {
        response.headers.set('Content-Disposition', `inline; filename="${originalName}"`);
      } else if (mimeType.includes('image')) {
        response.headers.set('Content-Disposition', `inline; filename="${originalName}"`);
      } else if (mimeType.includes('text')) {
        response.headers.set('Content-Disposition', `inline; filename="${originalName}"`);
      } else {
        // For other file types, still allow inline viewing
        response.headers.set('Content-Disposition', `inline; filename="${originalName}"`);
      }
      
      return response;

    } catch (driveError) {
      console.error('Google Drive view failed:', driveError);
      return NextResponse.json({ 
        error: 'Failed to view from Google Drive',
        details: driveError instanceof Error ? driveError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error viewing document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}