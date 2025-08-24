import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const fileKey = searchParams.get('fileKey')

    if (!fileKey) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 })
    }

    // Convert incoming file key to parsed directory key
    // incoming/timestamp_id.pdf -> parsed/timestamp_id.qbo
    const parsedFileKey = fileKey
      .replace('incoming/', 'parsed/')
      .replace(/\.(pdf|csv|xlsx?)$/i, '.qbo')

    const bucketName = process.env.AWS_S3_BUCKET_NAME
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS S3 bucket not configured' }, { status: 500 })
    }

    try {
      // Try to get the processed QBO file from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: parsedFileKey
      })

      const s3Response = await s3Client.send(getObjectCommand)
      
      if (!s3Response.Body) {
        return NextResponse.json({ error: 'QBO file not found or empty' }, { status: 404 })
      }

      // Convert S3 stream to buffer
      const chunks: Uint8Array[] = []
      const reader = s3Response.Body.transformToWebStream().getReader()
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }

      const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        buffer.set(chunk, offset)
        offset += chunk.length
      }

      // Get original filename from metadata or generate one
      const originalName = s3Response.Metadata?.originalname || 'bank_statement'
      const filename = `${originalName.replace(/\.[^/.]+$/, '')}_${Date.now()}.qbo`

      console.log('QBO file downloaded from S3:', {
        parsedFileKey,
        bucket: bucketName,
        size: buffer.length,
        user: session.user?.email
      })

      // Return the QBO file
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.intu.qbo',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Length': buffer.length.toString()
        }
      })

    } catch (s3Error: any) {
      console.error('S3 download failed:', s3Error)
      
      // If file not found, return helpful error
      if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        return NextResponse.json({ 
          error: 'QBO file not ready yet. Processing may still be in progress.',
          parsedFileKey,
          details: process.env.NODE_ENV === 'development' ? String(s3Error) : undefined
        }, { status: 404 })
      }

      // Other S3 errors
      return NextResponse.json({ 
        error: 'Failed to download QBO file from S3.',
        details: process.env.NODE_ENV === 'development' ? String(s3Error) : undefined
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error downloading QBO file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateSampleQboContent(fileKey: string): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const transactionId = Math.random().toString(36).substring(2, 15).toUpperCase()
  
  // Generate a basic QBO file structure
  // This is a simplified version - real QBO files have more complex structure
  const qboContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${timestamp}120000
<LANGUAGE>ENG
<DTPROFUP>${timestamp}120000
<DTACCTUP>${timestamp}120000
<FI>
<ORG>Bank Statement Processor
<FID>12345
</FI>
</SONRS>
</SIGNONMSGSRSV1>

<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${transactionId}
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>0123456789
<ACCTTYPE>CHECKING
</BANKACCTFROM>

<BANKTRANLIST>
<DTSTART>${timestamp}120000
<DTEND>${timestamp}120000

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>${timestamp}120000
<TRNAMT>-45.67
<FITID>TXN001${transactionId}
<NAME>Sample Transaction 1
<MEMO>Processed from bank statement upload: ${fileKey}
</STMTTRN>

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>${timestamp}120000
<TRNAMT>1250.00
<FITID>TXN002${transactionId}
<NAME>Sample Deposit
<MEMO>Sample credit transaction
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>${timestamp}120000
<TRNAMT>-89.32
<FITID>TXN003${transactionId}
<NAME>Sample Purchase
<MEMO>Sample debit transaction
</STMTTRN>

</BANKTRANLIST>

<LEDGERBAL>
<BALAMT>1115.01
<DTASOF>${timestamp}120000
</LEDGERBAL>

<AVAILBAL>
<BALAMT>1115.01
<DTASOF>${timestamp}120000
</AVAILBAL>

</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>

</OFX>`

  return qboContent
}