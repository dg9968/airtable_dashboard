// app/api/documents/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Airtable from 'airtable';

// Configure Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const DOCUMENTS_TABLE = 'Documents';

// Local metadata search function
async function findDocumentInLocalMetadata(recordId: string): Promise<any> {
  const documentsDir = path.join(process.cwd(), 'documents');
  
  if (!existsSync(documentsDir)) {
    return null;
  }

  // Check if documents directory exists
  try {
    const fs = await import('fs/promises');
    await fs.access(documentsDir);
  } catch {
    return null;
  }

  // Search through all tax year directories, then client directories for the document
  try {
    const fs = await import('fs/promises');
    const taxYearDirs = await fs.readdir(documentsDir);
    
    for (const taxYearDir of taxYearDirs) {
      const taxYearPath = path.join(documentsDir, taxYearDir);
      
      if (!fs.lstat) continue;
      const stat = await fs.lstat(taxYearPath);
      if (!stat.isDirectory()) continue;
      
      try {
        const clientDirs = await fs.readdir(taxYearPath);
        
        for (const clientDir of clientDirs) {
          const metadataPath = path.join(taxYearPath, clientDir, 'metadata.json');
          
          if (existsSync(metadataPath)) {
            try {
              const metadataContent = await readFile(metadataPath, 'utf8');
              const metadata = JSON.parse(metadataContent);
              const document = metadata.find((doc: any) => doc.id === recordId);
              
              if (document) {
                return document;
              }
            } catch (error) {
              console.error(`Error reading metadata for ${taxYearDir}/${clientDir}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading tax year directory ${taxYearDir}:`, error);
      }
    }
  } catch (error) {
    console.error('Error searching local metadata:', error);
  }

  return null;
}

// GET - Download document
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    let clientCode: string;
    let fileName: string;
    let originalName: string;
    let fileType: string;
    let taxYear: string;

    try {
      // Try to get document metadata from Airtable first
      const record = await base(DOCUMENTS_TABLE).find(recordId);
      
      if (!record) {
        throw new Error('Document not found in Airtable');
      }

      clientCode = record.fields['Client Code'] as string;
      fileName = record.fields['File Name'] as string;
      originalName = record.fields['Original Name'] as string;
      fileType = record.fields['File Type'] as string;
      taxYear = record.fields['Tax Year'] as string;

    } catch (airtableError) {
      console.error('Airtable lookup failed, trying local metadata:', airtableError);
      
      // Fallback to local metadata
      const localDocument = await findDocumentInLocalMetadata(recordId);
      
      if (!localDocument) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      clientCode = localDocument.clientCode;
      fileName = localDocument.fileName;
      originalName = localDocument.originalName;
      fileType = localDocument.fileType;
      taxYear = localDocument.taxYear;
    }

    // Construct file path with tax year
    const filePath = path.join(process.cwd(), 'documents', taxYear, clientCode, fileName);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Return file with appropriate headers
    const response = new NextResponse(fileBuffer);
    response.headers.set('Content-Type', fileType);
    response.headers.set('Content-Disposition', `attachment; filename="${originalName}"`);
    
    return response;

  } catch (error) {
    console.error('Error downloading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}