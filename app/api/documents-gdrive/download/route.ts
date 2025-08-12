// app/api/documents-gdrive/download/route.ts
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

// GET - Download document from Google Drive
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

    let fileIdToDownload = googleDriveFileId;
    let originalName = 'document';
    let mimeType = 'application/octet-stream';

    // If we have recordId but not googleDriveFileId, try to get it from Airtable
    if (recordId && !googleDriveFileId) {
      try {
        const record = await base(DOCUMENTS_TABLE).find(recordId);
        fileIdToDownload = record.fields['Google Drive File ID'] as string || record.fields['File Name'] as string;
        originalName = record.fields['Original Name'] as string || 'document';
        mimeType = record.fields['File Type'] as string || 'application/octet-stream';
      } catch (airtableError) {
        console.error('Airtable lookup failed:', airtableError);
        // If recordId looks like a Google Drive file ID, use it directly
        if (recordId.length > 20) {
          fileIdToDownload = recordId;
        }
      }
    }

    if (!fileIdToDownload) {
      return NextResponse.json({ error: 'Could not determine file ID to download' }, { status: 400 });
    }

    try {
      // Get file metadata if we don't have it
      if (!originalName || originalName === 'document') {
        const metadata = await getFileMetadata(fileIdToDownload);
        originalName = metadata.name?.replace(/^\d+_/, '') || 'document';
        mimeType = metadata.mimeType || 'application/octet-stream';
      }

      // Download file from Google Drive
      const fileBuffer = await downloadFileFromGoogleDrive(fileIdToDownload);

      // Return file with appropriate headers for download
      const response = new NextResponse(fileBuffer);
      response.headers.set('Content-Type', mimeType);
      response.headers.set('Content-Disposition', `attachment; filename="${originalName}"`);
      
      return response;

    } catch (driveError) {
      console.error('Google Drive download failed:', driveError);
      return NextResponse.json({ 
        error: 'Failed to download from Google Drive',
        details: driveError instanceof Error ? driveError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error downloading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}