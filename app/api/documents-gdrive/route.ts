// app/api/documents-gdrive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  uploadFileToGoogleDrive, 
  listClientFiles, 
  deleteFileFromGoogleDrive,
  testGoogleDriveConnection 
} from '@/lib/googleDrive';
import Airtable from 'airtable';

// Configure Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const DOCUMENTS_TABLE = 'Documents';

// GET - Retrieve documents by client code and tax year (from Google Drive)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');
    const taxYear = searchParams.get('taxYear');

    if (!clientCode) {
      return NextResponse.json({ error: 'Client code is required' }, { status: 400 });
    }

    if (!taxYear) {
      return NextResponse.json({ error: 'Tax year is required' }, { status: 400 });
    }

    try {
      // Get files from Google Drive
      const driveFiles = await listClientFiles(clientCode, taxYear);
      
      const documents = driveFiles.map(file => ({
        id: file.id,
        fileName: file.name,
        originalName: file.name?.replace(/^\d+_/, '') || file.name, // Remove timestamp prefix
        uploadDate: file.createdTime,
        fileSize: parseInt(file.size || '0'),
        fileType: file.mimeType,
        clientCode: clientCode,
        taxYear: taxYear,
        webViewLink: file.webViewLink,
        source: 'google-drive'
      }));

      return NextResponse.json({ documents });

    } catch (driveError) {
      console.error('Google Drive fetch failed:', driveError);
      return NextResponse.json({ 
        error: 'Failed to fetch documents from Google Drive',
        details: driveError instanceof Error ? driveError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload document to Google Drive
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientCode = formData.get('clientCode') as string;
    const taxYear = formData.get('taxYear') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate client code is provided and is exactly 4 digits
    if (!clientCode || !clientCode.trim()) {
      return NextResponse.json({ error: 'Client code is required' }, { status: 400 });
    }

    if (!/^\d{4}$/.test(clientCode.trim())) {
      return NextResponse.json({ error: 'Client code must be exactly 4 digits' }, { status: 400 });
    }

    // Validate tax year is provided and valid
    const validTaxYears = ['2022', '2023', '2024', '2025'];
    if (!taxYear || !validTaxYears.includes(taxYear)) {
      return NextResponse.json({ error: 'Valid tax year is required (2022-2025)' }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const finalClientCode = clientCode.trim();

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    try {
      // Upload to Google Drive
      const driveResult = await uploadFileToGoogleDrive(
        buffer,
        file.name,
        file.type,
        finalClientCode,
        taxYear
      );

      // Create document metadata for Airtable
      const documentMetadata = {
        'Client Code': finalClientCode,
        'Tax Year': taxYear,
        'File Name': driveResult.fileId, // Store Google Drive file ID
        'Original Name': file.name,
        'Upload Date': new Date().toISOString(),
        'File Size': file.size,
        'File Type': file.type,
        'Google Drive File ID': driveResult.fileId,
        'Web View Link': driveResult.webViewLink,
        'Uploaded By': session.user?.email || 'Unknown'
      };

      let recordId = driveResult.fileId;

      try {
        // Try to save metadata to Airtable
        const record = await base(DOCUMENTS_TABLE).create([
          { fields: documentMetadata }
        ]);

        recordId = record[0].id;

      } catch (airtableError) {
        console.error('Airtable save failed, but Google Drive upload succeeded:', airtableError);
        // Continue without Airtable - Google Drive is the primary storage
      }

      return NextResponse.json({
        success: true,
        clientCode: finalClientCode,
        taxYear: taxYear,
        fileName: file.name,
        recordId: recordId,
        googleDriveFileId: driveResult.fileId,
        webViewLink: driveResult.webViewLink,
        source: 'google-drive'
      });

    } catch (driveError) {
      console.error('Google Drive upload failed:', driveError);
      return NextResponse.json({ 
        error: 'Failed to upload to Google Drive',
        details: driveError instanceof Error ? driveError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete document from Google Drive
export async function DELETE(request: NextRequest) {
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

    let fileIdToDelete = googleDriveFileId;

    // If we have recordId but not googleDriveFileId, try to get it from Airtable
    if (recordId && !googleDriveFileId) {
      try {
        const record = await base(DOCUMENTS_TABLE).find(recordId);
        fileIdToDelete = record.fields['Google Drive File ID'] as string || record.fields['File Name'] as string;
        
        // Also delete from Airtable
        await base(DOCUMENTS_TABLE).destroy([recordId]);
      } catch (airtableError) {
        console.error('Airtable deletion failed:', airtableError);
        // If recordId looks like a Google Drive file ID, use it directly
        if (recordId.length > 20) {
          fileIdToDelete = recordId;
        }
      }
    }

    if (!fileIdToDelete) {
      return NextResponse.json({ error: 'Could not determine file ID to delete' }, { status: 400 });
    }

    try {
      // Delete from Google Drive
      await deleteFileFromGoogleDrive(fileIdToDelete);

      return NextResponse.json({ 
        success: true, 
        message: 'Document deleted successfully from Google Drive' 
      });

    } catch (driveError) {
      console.error('Google Drive deletion failed:', driveError);
      return NextResponse.json({ 
        error: 'Failed to delete from Google Drive',
        details: driveError instanceof Error ? driveError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}