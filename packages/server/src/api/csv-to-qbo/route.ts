import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Helper functions from csv-to-qbo.py logic
function parseDate(s: string): Date | null {
  s = (s || '').trim().replace(/^'|'$/g, '')
  if (!s) return null

  // Handle month/day format (assume 2024)
  if (s.includes('/') && s.split('/').length === 2) {
    try {
      const [month, day] = s.split('/')
      const m = parseInt(month)
      const d = parseInt(day)
      if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const date = new Date(2024, m - 1, d)
        // Validate the date is correct
        if (date.getFullYear() === 2024 && date.getMonth() === m - 1 && date.getDate() === d) {
          return date
        }
      }
    } catch {
      // Continue to other formats
    }
  }

  // Try standard formats
  const formats = [
    { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ['y', 'm', 'd'] }, // YYYY-MM-DD or YYYY-M-D
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['m', 'd', 'y'] }, // MM/DD/YYYY or M/D/YYYY
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, order: ['m', 'd', 'y'] }, // MM/DD/YY or M/D/YY
  ]

  for (const fmt of formats) {
    const match = s.match(fmt.pattern)
    if (match) {
      const parts: Record<string, number> = {}
      fmt.order.forEach((key, i) => {
        parts[key] = parseInt(match[i + 1])
      })

      const year = parts.y < 100 ? 2000 + parts.y : parts.y
      const month = (parts.m || 1) - 1
      const day = parts.d || 1

      // Validate values
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day)
        // Check if date is valid (handles things like Feb 31)
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date
        }
      }
    }
  }

  return null
}

function parseAmount(s: string): number | null {
  if (!s) return null
  let txt = String(s).trim().replace(/^'|'$/g, '')
  if (!txt) return null

  // Handle parentheses negatives
  let neg = false
  if (txt.startsWith('(') && txt.endsWith(')')) {
    neg = true
    txt = txt.slice(1, -1)
  }

  // Remove currency symbols and commas
  txt = txt.replace(/[\$,USD]/g, '').trim()

  try {
    const val = parseFloat(txt)
    return neg ? -val : val
  } catch {
    return null
  }
}

function makeFitid(date: Date, desc: string, amt: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const amtStr = amt.toFixed(2)
  const input = `${dateStr}${amtStr}${desc}`

  // Simple hash function (MD5 equivalent not needed for this use case)
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).slice(0, 12).padStart(12, '0')
}

function buildQbo(transactions: Array<{ date: Date; desc: string; amount: number }>): string {
  const BANK_ID = '072000326'
  const ACCT_ID = '891536836'
  const ACCT_TYPE = 'CHECKING'
  const FI_ORG = 'B1'
  const FI_FID = '10898'
  const INTU_BID = '2430'

  const crlf = (lines: string[]) => lines.join('\r\n') + '\r\n'

  const header = crlf([
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'SECURITY:NONE',
    'ENCODING:USASCII',
    'CHARSET:1252',
    'COMPRESSION:NONE',
    'OLDFILEUID:NONE',
    'NEWFILEUID:NONE',
    ''
  ])

  const now = new Date()
  const dtserver = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const trnuid = Math.random().toString(16).slice(2, 18)

  // Date range (no time suffix)
  let dtstart: string
  let dtend: string
  if (transactions.length > 0) {
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime())
    dtstart = dates[0].toISOString().slice(0, 10).replace(/-/g, '')
    dtend = dates[dates.length - 1].toISOString().slice(0, 10).replace(/-/g, '')
  } else {
    dtstart = now.toISOString().slice(0, 10).replace(/-/g, '')
    dtend = dtstart
  }

  // Calculate ending balance
  const endingBalance = transactions.reduce((sum, t) => sum + t.amount, 0)
  const dtasof = dtend + '120000'

  const lines: string[] = []
  lines.push('<OFX>')

  // Sign-on message (single-line format like table-3.qbo)
  lines.push(
    '<SIGNONMSGSRSV1><SONRS>',
    '<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>',
    `<DTSERVER>${dtserver}</DTSERVER>`,
    '<LANGUAGE>ENG</LANGUAGE>',
    `<FI><ORG>${FI_ORG}</ORG><FID>${FI_FID}</FID></FI>`,
    `<INTU.BID>${INTU_BID}</INTU.BID>`,
    '</SONRS></SIGNONMSGSRSV1>'
  )

  // Banking message (single-line format)
  lines.push(
    '<BANKMSGSRSV1><STMTTRNRS>',
    `<TRNUID>${trnuid}</TRNUID>`,
    '<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>',
    '<STMTRS>',
    '<CURDEF>USD</CURDEF>',
    `<BANKACCTFROM><BANKID>${BANK_ID}</BANKID><ACCTID>${ACCT_ID}</ACCTID><ACCTTYPE>${ACCT_TYPE}</ACCTTYPE></BANKACCTFROM>`,
    `<BANKTRANLIST><DTSTART>${dtstart}</DTSTART><DTEND>${dtend}</DTEND>`
  )

  // Transactions (exactly like table-3.qbo)
  for (const t of transactions) {
    const trntype = t.amount > 0 ? 'CREDIT' : 'DEBIT'
    const dt = t.date.toISOString().slice(0, 10).replace(/-/g, '')
    const amt = t.amount.toFixed(2)

    // Clean up description - remove common prefixes
    let cleanDesc = t.desc || ''

    console.log(`Original desc: "${cleanDesc}"`)

    // Remove prefixes with proper regex patterns
    const patterns = [
      /^Purchase authorized on \d{1,2}\/\d{1,2}\s+/i,
      /^Purchase Return authorized on \d{1,2}\/\d{1,2}\s+/i,
      /^ATM Withdrawal authorized on \d{1,2}\/\d{1,2}\s+/i,
      /^Non-WF ATM Withdrawal authorized on \d{1,2}\/\d{1,2}\s+/i,
      /^Recurring Payment authorized on \d{1,2}\/\d{1,2}\s+/i,
      /^Online Transfer to\s+/i,
      /^Online Transfer from\s+/i
    ]

    for (const pattern of patterns) {
      const before = cleanDesc
      cleanDesc = cleanDesc.replace(pattern, '')
      if (before !== cleanDesc) {
        console.log(`Removed prefix, now: "${cleanDesc}"`)
        break // Stop after first match
      }
    }

    const name = cleanDesc.slice(0, 32).trim()
    console.log(`Final NAME: "${name}"`)

    const fitid = makeFitid(t.date, name, t.amount)

    lines.push(
      '<STMTTRN>',
      `<TRNTYPE>${trntype}</TRNTYPE>`,
      `<DTPOSTED>${dt}</DTPOSTED>`,
      `<TRNAMT>${amt}</TRNAMT>`,
      `<FITID>${fitid}</FITID>`,
      `<NAME>${name}</NAME>`,
      '</STMTTRN>'
    )
  }

  // Close and add balances (exactly like table-3.qbo)
  lines.push(
    '</BANKTRANLIST>',
    `<LEDGERBAL><BALAMT>${endingBalance.toFixed(2)}</BALAMT><DTASOF>${dtasof}</DTASOF></LEDGERBAL>`,
    `<AVAILBAL><BALAMT>${endingBalance.toFixed(2)}</BALAMT><DTASOF>${dtasof}</DTASOF></AVAILBAL>`,
    '</STMTRS></STMTTRNRS></BANKMSGSRSV1>',
    '</OFX>'
  )

  return header + crlf(lines)
}

async function parseCsvFile(file: File): Promise<Array<{ date: Date; desc: string; amount: number }>> {
  const text = await file.text()
  const lines = text.split('\n')
  const transactions: Array<{ date: Date; desc: string; amount: number }> = []

  console.log(`Parsing CSV file: ${file.name}`)
  console.log(`Total lines: ${lines.length}`)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Handle CSV with quoted fields
    const row: string[] = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    row.push(current.trim())

    if (row.length < 6) {
      console.log(`Line ${i}: Skipped (less than 6 columns, has ${row.length})`)
      continue
    }

    // Skip header and empty rows
    if (!row[0] || row[0].includes('Fecha') || row[0].includes('Confidence') || row[0].includes('Date')) {
      console.log(`Line ${i}: Skipped (header or empty)`)
      continue
    }

    const dateStr = row[0]
    const desc = row[2]
    const credit = row[3] // Deposits/Credits
    const debit = row[4]  // Withdrawals/Debits

    console.log(`Line ${i}: Date="${dateStr}", Desc="${desc}", Credit="${credit}", Debit="${debit}"`)

    // Parse date
    const dateVal = parseDate(dateStr)
    if (!dateVal) {
      console.log(`Line ${i}: Date parse failed for "${dateStr}"`)
      continue
    }

    // Parse amount (credit is positive, debit is negative)
    let amount: number | null = null

    if (credit && credit.trim()) {
      const creditVal = parseAmount(credit)
      if (creditVal !== null) {
        amount = Math.abs(creditVal)
      }
    }

    if (debit && debit.trim()) {
      const debitVal = parseAmount(debit)
      if (debitVal !== null) {
        amount = -Math.abs(debitVal)
      }
    }

    if (amount === null) {
      console.log(`Line ${i}: Amount parse failed - Credit="${credit}", Debit="${debit}"`)
      continue
    }

    // Clean description
    const descClean = (desc || '').trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '')
    if (!descClean) {
      console.log(`Line ${i}: Description is empty`)
      continue
    }

    console.log(`Line ${i}: ✓ Added transaction - Date: ${dateVal.toISOString().slice(0, 10)}, Amount: ${amount}, Desc: ${descClean}`)

    transactions.push({
      date: dateVal,
      desc: descClean,
      amount: amount
    })
  }

  console.log(`Total transactions parsed: ${transactions.length}`)
  return transactions
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const userRole = (session.user as any)?.role
    if (userRole !== 'staff' && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const csvFiles = formData.getAll('csvFiles') as File[]

    if (!csvFiles || csvFiles.length === 0) {
      return NextResponse.json(
        { error: 'No CSV files provided' },
        { status: 400 }
      )
    }

    // Parse all CSV files and combine transactions
    let allTransactions: Array<{ date: Date; desc: string; amount: number }> = []

    for (const file of csvFiles) {
      const transactions = await parseCsvFile(file)
      allTransactions = allTransactions.concat(transactions)
    }

    if (allTransactions.length === 0) {
      return NextResponse.json(
        { error: 'No valid transactions found in CSV files' },
        { status: 400 }
      )
    }

    // Sort transactions by date
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Build QBO file
    const qboContent = buildQbo(allTransactions)

    // Create a blob and return as downloadable file
    const blob = new Blob([qboContent], { type: 'application/vnd.intu.qbo' })

    // Convert blob to base64 for data URL
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:application/vnd.intu.qbo;base64,${base64}`

    return NextResponse.json({
      success: true,
      qboUrl: dataUrl,
      transactionCount: allTransactions.length,
      filesProcessed: csvFiles.length,
      message: `Successfully processed ${csvFiles.length} CSV file(s) with ${allTransactions.length} transaction(s)`
    })

  } catch (error) {
    console.error('CSV to QBO conversion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
