const fs = require('fs');
const path = require('path');

// Read the working template file
const templateFile = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output', 'bank_statement_ 01_2024.qbo');
const inputFile = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output', 'corrected-wells-fargo.qbo');
const outputFile = path.join(__dirname, '..', 'Wells Fargo Doc converter', 'output', 'fixed-wells-fargo.qbo');

// Read the template
const template = fs.readFileSync(templateFile, 'utf8');

// Read the malformed file
const content = fs.readFileSync(inputFile, 'utf8');

// Extract all transactions using regex - handle missing closing tags
const transactionRegex = /<STMTTRN>[^]*?(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/g;
const rawTransactions = content.match(transactionRegex) || [];

// Split any concatenated transactions on the same line
const transactions = [];
rawTransactions.forEach(raw => {
  if (raw.includes('/STMTTRN><STMTTRN>')) {
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
  let trnType = (txn.match(/<TRNTYPE>([^<]+)/) || [])[1] || '';
  let dtPosted = (txn.match(/<DTPOSTED>([^<]+)/) || [])[1] || '20240131';
  let trnAmt = (txn.match(/<TRNAMT>([^<]+)/) || [])[1] || '0.00';
  const fitId = (txn.match(/<FITID>([^<]+)/) || [])[1] || '';
  const name = (txn.match(/<NAME>([^<]+)/) || [])[1] || '';

  // Clean up date - keep only YYYYMMDD
  dtPosted = dtPosted.replace(/\.000\[-?\d+:[A-Z]+\]/, '').trim().substring(0, 8);

  // Convert TRNTYPE based on amount sign
  const amount = parseFloat(trnAmt);
  if (amount < 0) {
    trnType = 'DEBIT';
    // Keep negative amount for debits
    trnAmt = amount.toFixed(2);
  } else if (amount > 0) {
    trnType = 'CREDIT';
  }

  // Skip empty/invalid transactions
  if (!trnType || !fitId || !name) {
    console.log(`Skipping invalid transaction: FITID=${fitId}, TYPE=${trnType}, NAME=${name}`);
    return null;
  }

  // Build transaction exactly matching working file format
  return `<STMTTRN>
<TRNTYPE>${trnType.trim()}</TRNTYPE>
<DTPOSTED>${dtPosted.trim()}</DTPOSTED>
<TRNAMT>${trnAmt.trim()}</TRNAMT>
<FITID>${fitId.trim()}</FITID>
<NAME>${name.trim()}</NAME>
</STMTTRN>`;
}).filter(Boolean);

// Extract header from template (everything before first <STMTTRN>)
const headerMatch = template.match(/^([\s\S]*?)<STMTTRN>/);
const header = headerMatch ? headerMatch[1] : '';

// Extract footer from template (everything after </BANKTRANLIST>)
const footerMatch = template.match(/<\/BANKTRANLIST>([\s\S]*)$/);
const footer = footerMatch ? footerMatch[1] : '';

// Build final output using template structure
const output = header + formattedTransactions.join('\n') + '\n</BANKTRANLIST>' + footer;

// Write the fixed file
fs.writeFileSync(outputFile, output, 'utf8');
console.log(`Fixed QBO file written to: ${outputFile}`);
console.log(`Total transactions formatted: ${formattedTransactions.length}`);
