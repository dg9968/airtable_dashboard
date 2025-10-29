/**
 * CSV to QBO Conversion Routes
 * Based on Wells Fargo Doc converter scripts
 */

import { Hono } from 'hono';
import { authMiddleware, requireStaff } from '../middleware/auth';
import { parse } from 'csv-parse/sync';

const app = new Hono();

// Apply authentication middleware
app.use('*', authMiddleware);
app.use('*', requireStaff);

// Configuration matching bank_statement_01_2024.qbo
const BANK_ID = "072000326";
const ACCT_ID = "891536836";
const ACCT_TYPE = "CHECKING";
const FI_ORG = "B1";
const FI_FID = "10898";
const INTU_BID = "2430";

function parseDate(s: string): Date | null {
  s = (s || "").trim().replace(/^'/, '').replace(/'$/, '');
  if (!s) return null;

  // Handle month/day format (assume current year)
  if (s.includes("/") && s.split("/").length === 2) {
    try {
      const [month, day] = s.split("/").map(Number);
      return new Date(new Date().getFullYear(), month - 1, day);
    } catch {
      return null;
    }
  }

  // Try standard formats
  const formats = [
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // MM/DD/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
  ];

  for (const regex of formats) {
    const match = s.match(regex);
    if (match) {
      if (regex.source.includes('\\d{4}.*\\d{2}.*\\d{2}')) {
        // YYYY-MM-DD
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      } else if (regex.source.includes('\\d{1,2}.*\\d{1,2}.*\\d{4}')) {
        // MM/DD/YYYY
        return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
      } else if (regex.source.includes('\\d{1,2}.*\\d{1,2}.*\\d{2}')) {
        // MM/DD/YY
        const year = Number(match[3]) + 2000;
        return new Date(year, Number(match[1]) - 1, Number(match[2]));
      }
    }
  }

  return null;
}

function parseAmount(s: string): number | null {
  if (!s) return null;

  let txt = String(s).trim().replace(/^'/, '').replace(/'$/, '');
  if (!txt) return null;

  // Handle parentheses negatives
  let neg = false;
  if (txt.startsWith("(") && txt.endsWith(")")) {
    neg = true;
    txt = txt.slice(1, -1);
  }

  // Remove currency symbols and commas
  txt = txt.replace(/[$,USD]/g, "").trim();

  try {
    const val = parseFloat(txt);
    return neg ? -val : val;
  } catch {
    return null;
  }
}

function makeFitId(date: Date, desc: string, amt: number): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const input = `${dateStr}${amt.toFixed(2)}${desc}`;

  // Simple hash function (for production, use crypto)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 12);
}

function buildQbo(transactions: Array<{date: Date, desc: string, amount: number}>): string {
  const crlf = (lines: string[]) => lines.join("\r\n") + "\r\n";

  const header = crlf([
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "SECURITY:NONE",
    "ENCODING:USASCII",
    "CHARSET:1252",
    "COMPRESSION:NONE",
    "OLDFILEUID:NONE",
    "NEWFILEUID:NONE",
    ""
  ]);

  const now = new Date();
  const dtserver = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
  const trnuid = Math.random().toString(36).substring(2, 18);

  // Date range
  let dtstart: string, dtend: string;
  if (transactions.length > 0) {
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    dtstart = dates[0].toISOString().split('T')[0].replace(/-/g, '');
    dtend = dates[dates.length - 1].toISOString().split('T')[0].replace(/-/g, '');
  } else {
    dtstart = now.toISOString().split('T')[0].replace(/-/g, '');
    dtend = dtstart;
  }

  // Calculate ending balance
  const endingBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
  const dtasof = dtend + "120000";

  const lines: string[] = [];
  lines.push("<OFX>");

  // Sign-on message
  lines.push(
    "<SIGNONMSGSRSV1><SONRS>",
    "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
    `<DTSERVER>${dtserver}</DTSERVER>`,
    "<LANGUAGE>ENG</LANGUAGE>",
    `<FI><ORG>${FI_ORG}</ORG><FID>${FI_FID}</FID></FI>`,
    `<INTU.BID>${INTU_BID}</INTU.BID>`,
    "</SONRS></SIGNONMSGSRSV1>"
  );

  // Banking message
  lines.push(
    "<BANKMSGSRSV1><STMTTRNRS>",
    `<TRNUID>${trnuid}</TRNUID>`,
    "<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>",
    "<STMTRS>",
    "<CURDEF>USD</CURDEF>",
    `<BANKACCTFROM><BANKID>${BANK_ID}</BANKID><ACCTID>${ACCT_ID}</ACCTID><ACCTTYPE>${ACCT_TYPE}</ACCTTYPE></BANKACCTFROM>`,
    `<BANKTRANLIST><DTSTART>${dtstart}</DTSTART><DTEND>${dtend}</DTEND>`
  );

  // Transactions
  for (const t of transactions) {
    const trntype = t.amount > 0 ? "CREDIT" : "DEBIT";
    const dt = t.date.toISOString().split('T')[0].replace(/-/g, '');
    const amt = t.amount.toFixed(2);
    const name = t.desc.substring(0, 30);
    const fitid = makeFitId(t.date, name, t.amount);

    lines.push(
      "<STMTTRN>",
      `<TRNTYPE>${trntype}</TRNTYPE>`,
      `<DTPOSTED>${dt}</DTPOSTED>`,
      `<TRNAMT>${amt}</TRNAMT>`,
      `<FITID>${fitid}</FITID>`,
      `<NAME>${name}</NAME>`,
      "</STMTTRN>"
    );
  }

  // Close and add balances
  lines.push(
    "</BANKTRANLIST>",
    `<LEDGERBAL><BALAMT>${endingBalance.toFixed(2)}</BALAMT><DTASOF>${dtasof}</DTASOF></LEDGERBAL>`,
    `<AVAILBAL><BALAMT>${endingBalance.toFixed(2)}</BALAMT><DTASOF>${dtasof}</DTASOF></AVAILBAL>`,
    "</STMTRS></STMTTRNRS></BANKMSGSRSV1>"
  );
  lines.push("</OFX>");

  return header + crlf(lines);
}

/**
 * POST /api/csv-to-qbo
 * Convert CSV files to QBO format
 */
app.post('/', async (c) => {
  try {
    console.log('CSV to QBO conversion started');

    const formData = await c.req.formData();
    console.log('FormData received');

    const csvFiles = formData.getAll('csvFiles') as File[];
    console.log(`Number of files: ${csvFiles ? csvFiles.length : 0}`);

    if (!csvFiles || csvFiles.length === 0) {
      console.error('No CSV files in request');
      return c.json({ error: 'No CSV files provided' }, 400);
    }

    const allTransactions: Array<{date: Date, desc: string, amount: number}> = [];

    // Process each CSV file
    for (let i = 0; i < csvFiles.length; i++) {
      const file = csvFiles[i];
      console.log(`Processing file ${i + 1}/${csvFiles.length}: size=${file.size} bytes`);

      const text = await file.text();
      console.log(`File text length: ${text.length} characters`);

      // Parse CSV
      let records: string[][];
      try {
        records = parse(text, {
          skip_empty_lines: true,
          relax_column_count: true,
        }) as string[][];
        console.log(`Parsed ${records.length} rows from CSV`);
      } catch (parseError) {
        console.error('CSV parse error:', parseError);
        return c.json({
          error: 'Failed to parse CSV file',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        }, 400);
      }

      for (const row of records) {
        if (row.length < 6) continue;

        // Skip header and empty rows
        if (!row[0] || row[0].includes("Fecha") || row[0].includes("Confidence")) {
          continue;
        }

        const dateStr = row[0];
        const desc = row[2];
        const credit = row[3];  // Depósitos/Créditos
        const debit = row[4];   // Retiros/Débitos

        // Parse date
        const dateVal = parseDate(dateStr);
        if (!dateVal) continue;

        // Parse amount (credit is positive, debit is negative)
        let amount: number | null = null;
        if (credit) {
          const creditVal = parseAmount(credit);
          if (creditVal !== null) {
            amount = Math.abs(creditVal);
          }
        }
        if (debit) {
          const debitVal = parseAmount(debit);
          if (debitVal !== null) {
            amount = -Math.abs(debitVal);
          }
        }

        if (amount === null) continue;

        // Clean description
        const descClean = (desc || "").trim().replace(/^'/, '').replace(/'$/, '');
        if (!descClean) continue;

        allTransactions.push({
          date: dateVal,
          desc: descClean,
          amount: amount
        });
      }
    }

    console.log(`Total transactions parsed: ${allTransactions.length}`);

    if (allTransactions.length === 0) {
      console.error('No valid transactions found');
      return c.json({ error: 'No valid transactions found in CSV files' }, 400);
    }

    // Sort by date
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    console.log('Transactions sorted by date');

    // Build QBO
    console.log('Building QBO file...');
    const qboContent = buildQbo(allTransactions);
    console.log(`QBO file built: ${qboContent.length} bytes`);

    // Return QBO file
    const filename = `combined_${Date.now()}.qbo`;
    console.log(`Returning QBO file: ${filename}`);

    return c.body(qboContent, 200, {
      'Content-Type': 'application/vnd.intu.qbo',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    console.error('Error converting CSV to QBO:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({
      error: 'Failed to convert CSV to QBO',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, 500);
  }
});

export default app;
