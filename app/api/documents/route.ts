// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Airtable from 'airtable';

// Configure Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

// Define the documents table name - you may need to adjust this
const DOCUMENTS_TABLE = 'Documents';

// Generate a 4-digit code
function generateClientCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Ensure unique 4-digit code (fallback to local check if Airtable fails)
async function generateUniqueClientCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10; // Reduced attempts for faster fallback

  while (attempts < maxAttempts) {
    const code = generateClientCode();
    
    try {
      // Try to check if code already exists in Airtable
      const records = await base(DOCUMENTS_TABLE)
        .select({
          filterByFormula: `{Client Code} = '${code}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return code;
      }
      
      attempts++;
    } catch (error) {
      console.error('Airtable check failed, using local directory check:', error);
      
      // Fallback: check if directory exists locally
      const clientDir = path.join(process.cwd(), 'documents', code);
      if (!existsSync(clientDir)) {
        return code;
      }
      
      attempts++;
    }
  }

  throw new Error('Unable to generate unique client code');
}

// Local metadata file functions
async function getLocalMetadata(clientCode: string, taxYear: string) {
  const metadataPath = path.join(process.cwd(), 'documents', taxYear, clientCode, 'metadata.json');
  
  try {
    if (!existsSync(metadataPath)) {
      return [];
    }
    
    const metadataContent = await readFile(metadataPath, 'utf8');
    return JSON.parse(metadataContent);
  } catch (error) {
    console.error('Error reading local metadata:', error);
    return [];
  }
}

async function saveLocalMetadata(clientCode: string, taxYear: string, metadata: any[]) {
  const clientDir = path.join(process.cwd(), 'documents', taxYear, clientCode);
  const metadataPath = path.join(clientDir, 'metadata.json');
  
  if (!existsSync(clientDir)) {
    await mkdir(clientDir, { recursive: true });
  }
  
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

// GET - Retrieve documents by client code
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

    let documents = [];

    try {
      // Try to fetch documents from Airtable first
      const records = await base(DOCUMENTS_TABLE)
        .select({
          filterByFormula: `AND({Client Code} = '${clientCode}', {Tax Year} = '${taxYear}')`,
        })
        .firstPage();

      documents = records.map(record => ({
        id: record.id,
        fileName: record.fields['File Name'],
        originalName: record.fields['Original Name'],
        uploadDate: record.fields['Upload Date'],
        fileSize: record.fields['File Size'],
        fileType: record.fields['File Type'],
        clientCode: record.fields['Client Code'],
        taxYear: record.fields['Tax Year']
      }));

    } catch (airtableError) {
      console.error('Airtable fetch failed, using local metadata:', airtableError);
      
      // Fallback to local metadata
      documents = await getLocalMetadata(clientCode, taxYear);
    }

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload document
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

    // Create documents directory structure: documents/taxYear/clientCode/
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!existsSync(documentsDir)) {
      await mkdir(documentsDir, { recursive: true });
    }

    // Create tax year directory
    const taxYearDir = path.join(documentsDir, taxYear);
    if (!existsSync(taxYearDir)) {
      await mkdir(taxYearDir, { recursive: true });
    }

    // Create client-specific directory within tax year
    const clientDir = path.join(taxYearDir, finalClientCode);
    if (!existsSync(clientDir)) {
      await mkdir(clientDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const fileName = `${timestamp}${fileExtension}`;
    const filePath = path.join(clientDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create document metadata
    const documentMetadata = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName,
      originalName: file.name,
      uploadDate: new Date().toISOString(),
      fileSize: file.size,
      fileType: file.type,
      clientCode: finalClientCode,
      taxYear: taxYear,
      uploadedBy: session.user?.email || 'Unknown'
    };

    let recordId = documentMetadata.id;

    try {
      // Try to save metadata to Airtable
      const record = await base(DOCUMENTS_TABLE).create([
        {
          fields: {
            'Client Code': finalClientCode,
            'Tax Year': taxYear,
            'File Name': fileName,
            'Original Name': file.name,
            'Upload Date': new Date().toISOString(),
            'File Size': file.size,
            'File Type': file.type,
            'Uploaded By': session.user?.email || 'Unknown'
          }
        }
      ]);

      recordId = record[0].id;
      documentMetadata.id = recordId;

    } catch (airtableError) {
      console.error('Airtable save failed, using local metadata storage:', airtableError);
      
      // Fallback to local metadata storage
      const existingMetadata = await getLocalMetadata(finalClientCode, taxYear);
      existingMetadata.push(documentMetadata);
      await saveLocalMetadata(finalClientCode, taxYear, existingMetadata);
    }

    return NextResponse.json({
      success: true,
      clientCode: finalClientCode,
      fileName,
      recordId
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete document
export async function DELETE(request: NextRequest) {
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
    let taxYear: string;
    let documentMetadata: any;

    try {
      // Try to get document metadata from Airtable first
      const record = await base(DOCUMENTS_TABLE).find(recordId);
      
      if (!record) {
        throw new Error('Document not found in Airtable');
      }

      clientCode = record.fields['Client Code'] as string;
      fileName = record.fields['File Name'] as string;
      taxYear = record.fields['Tax Year'] as string;

      // Delete from Airtable
      await base(DOCUMENTS_TABLE).destroy([recordId]);

    } catch (airtableError) {
      console.error('Airtable deletion failed, trying local metadata:', airtableError);
      
      // Search in local metadata
      const documentsDir = path.join(process.cwd(), 'documents');
      
      if (existsSync(documentsDir)) {
        const fs = await import('fs/promises');
        const taxYearDirs = await fs.readdir(documentsDir);
        
        for (const taxYearDir of taxYearDirs) {
          const taxYearPath = path.join(documentsDir, taxYearDir);
          
          try {
            const stat = await fs.lstat(taxYearPath);
            if (!stat.isDirectory()) continue;
            
            const clientDirs = await fs.readdir(taxYearPath);
            
            for (const clientDir of clientDirs) {
              const metadataPath = path.join(taxYearPath, clientDir, 'metadata.json');
              
              if (existsSync(metadataPath)) {
                const metadataContent = await readFile(metadataPath, 'utf8');
                const metadata = JSON.parse(metadataContent);
                const docIndex = metadata.findIndex((doc: any) => doc.id === recordId);
                
                if (docIndex !== -1) {
                  documentMetadata = metadata[docIndex];
                  clientCode = documentMetadata.clientCode;
                  fileName = documentMetadata.fileName;
                  taxYear = documentMetadata.taxYear;
                  
                  // Remove from metadata
                  metadata.splice(docIndex, 1);
                  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
                  break;
                }
              }
            }
          } catch (error) {
            console.error(`Error processing tax year directory ${taxYearDir}:`, error);
          }
        }
      }
      
      if (!documentMetadata) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
    }

    // Delete the actual file
    const filePath = path.join(process.cwd(), 'documents', taxYear, clientCode, fileName);
    
    if (existsSync(filePath)) {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
    }

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}