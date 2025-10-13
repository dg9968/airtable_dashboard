const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output', 'corrected-wells-fargo.qbo');
const outputFile = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output', 'fixed-wells-fargo.qbo');

// Read the malformed file
const content = fs.readFileSync(inputFile, 'utf8');

// Extract all transactions using regex - handle missing closing tags
const transactionRegex = /<STMTTRN>[^]*?(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/g;
const rawTransactions = content.match(transactionRegex) || [];

// Split any concatenated transactions on the same line
const transactions = [];
rawTransactions.forEach(raw => {
  // Check if this has multiple transactions concatenated
  if (raw.includes('/STMTTRN><STMTTRN>')) {
    // Split on the pattern
    const split = raw.split(/\/STMTTRN><STMTTRN>/g);
    split.forEach((part, i) => {
      if (i === 0) {
        transactions.push(part + '/STMTTRN>');
      } else if (i === split.length - 1) {
        transactions.push('<STMTTRN>' + part);
      } else {
        transactions.push('<STMTTRN>' + part + '/STMTTRN>');
      }
    });
  } else {
    transactions.push(raw);
  }
});

console.log(`Found ${transactions.length} transactions`);

// Parse and reformat each transaction
const formattedTransactions = transactions.map(txn => {
  // Extract fields
  const trnType = (txn.match(/<TRNTYPE>([^<]+)/) || [])[1] || '';
  let dtPosted = (txn.match(/<DTPOSTED>([^<]+)/) || [])[1] || '20240131120000';
  const trnAmt = (txn.match(/<TRNAMT>([^<]+)/) || [])[1] || '0.00';
  const fitId = (txn.match(/<FITID>([^<]+)/) || [])[1] || '';
  const name = (txn.match(/<NAME>([^<]+)/) || [])[1] || '';
  let memo = (txn.match(/<MEMO>([^<]+)/) || [])[1] || '';
  const checkNum = (txn.match(/<CHECKNUM>([^<]+)/) || [])[1];

  // Clean up date - remove timezone and milliseconds, and time portion (format should be YYYYMMDD)
  dtPosted = dtPosted.replace(/\.000\[-?\d+:[A-Z]+\]/, '').trim();
  // Remove time portion - keep only YYYYMMDD
  dtPosted = dtPosted.substring(0, 8);

  // Clean up memo field - remove any trailing /STMTTRN> artifacts
  memo = memo.replace(/\/STMTTRN>.*$/, '').trim();

  // Skip empty/invalid transactions
  if (!trnType || !fitId || !name) {
    console.log(`Skipping invalid transaction: FITID=${fitId}, TYPE=${trnType}, NAME=${name}`);
    return null;
  }

  // Build properly formatted transaction - matching working file format
  // NOTE: Working file does NOT include MEMO tags
  let formatted = '<STMTTRN>\n';
  if (trnType) formatted += `<TRNTYPE>${trnType.trim()}</TRNTYPE>\n`;
  formatted += `<DTPOSTED>${dtPosted.trim()}</DTPOSTED>\n`;
  formatted += `<TRNAMT>${trnAmt.trim()}</TRNAMT>\n`;
  if (fitId) formatted += `<FITID>${fitId.trim()}</FITID>\n`;
  if (checkNum) formatted += `<CHECKNUM>${checkNum.trim()}</CHECKNUM>\n`;
  if (name) formatted += `<NAME>${name.trim()}</NAME>\n`;
  // Don't include MEMO - working file doesn't have it
  formatted += '</STMTTRN>';

  return formatted;
}).filter(Boolean); // Remove null entries

// Build the complete QBO file
const output = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>20250109120000</DTSERVER>
<LANGUAGE>ENG</LANGUAGE>
<FI><ORG>B1</ORG><FID>10898</FID></FI>
<INTU.BID>2430</INTU.BID>
</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS>
<TRNUID>28a1653220174d0c</TRNUID>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS>
<CURDEF>USD</CURDEF>
<BANKACCTFROM><BANKID>121000248</BANKID><ACCTID>Imported-Checking</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20240102</DTSTART><DTEND>20240131</DTEND>
${formattedTransactions.join('\n')}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>0.00</BALAMT><DTASOF>20240131120000</DTASOF></LEDGERBAL>
<AVAILBAL><BALAMT>0.00</BALAMT><DTASOF>20240131120000</DTASOF></AVAILBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`;

// Write the fixed file
fs.writeFileSync(outputFile, output, 'utf8');
console.log(`Fixed QBO file written to: ${outputFile}`);
console.log(`Total transactions formatted: ${formattedTransactions.length}`);
