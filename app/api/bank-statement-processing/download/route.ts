import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    // TODO: Replace with actual AWS S3 SDK implementation
    // In a real implementation, you would:
    // 1. Check if the processed QBO file exists in S3 parsed directory
    // 2. Generate a pre-signed URL or stream the file directly
    // 3. Return the actual QBO file content
    
    // For demo purposes, generate a sample QBO file content
    const qboContent = generateSampleQboContent(fileKey)
    
    // Create response with QBO file
    const response = new NextResponse(qboContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.intu.qbo',
        'Content-Disposition': `attachment; filename="bank_statement_${Date.now()}.qbo"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

    return response

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