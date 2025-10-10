const fs = require('fs');
const path = require('path');

// Read the OFX file
const ofxPath = path.join(__dirname, '..', 'output', 'wells-fargo-transactions.ofx');
const ofxContent = fs.readFileSync(ofxPath, 'utf8');

// Parse OFX line by line
const lines = ofxContent.split('\n').map(l => l.trim()).filter(l => l);

// Build header (no line breaks)
const header = lines.slice(0, 9).join('');

// Build OFX body (no line breaks, no closing tags except for container tags)
const bodyLines = lines.slice(10); // Skip header and blank line
let body = bodyLines.join('').replace(/\r/g, '');

// Fix DTSERVER to include time and timezone
body = body.replace(/<DTSERVER>(\d{8})(\d{6})?/, '<DTSERVER>$1120000.000[-8:PST]');

// Fix all DTPOSTED dates to include time and timezone
body = body.replace(/<DTPOSTED>(\d{8})/g, '<DTPOSTED>$1120000.000[-8:PST]');

// Fix DTASOF dates to include time and timezone
body = body.replace(/<DTASOF>(\d{8})(\d{6})?/g, '<DTASOF>$1120000.000[-8:PST]');

// Fix DTSTART and DTEND
body = body.replace(/<DTSTART>(\d{8})/g, '<DTSTART>$1120000.000[-8:PST]');
body = body.replace(/<DTEND>(\d{8})/g, '<DTEND>$1120000.000[-8:PST]');

// Map transaction types to QuickBooks-compatible codes
// Look at MEMO field to determine proper type
body = body.replace(/<TRNTYPE>DEBIT<DTPOSTED>([^<]+)<TRNAMT>([^<]+)<FITID>([^<]+)<NAME>([^<]*)<MEMO>([^<]*ATM[^<]*)</g,
  '<TRNTYPE>ATM<DTPOSTED>$1<TRNAMT>$2<FITID>$3<NAME>$4<MEMO>$5');
body = body.replace(/<TRNTYPE>DEBIT<DTPOSTED>([^<]+)<TRNAMT>([^<]+)<FITID>([^<]+)<NAME>([^<]*)<MEMO>([^<]*Transfer[^<]*)</g,
  '<TRNTYPE>XFER<DTPOSTED>$1<TRNAMT>$2<FITID>$3<NAME>$4<MEMO>$5');
body = body.replace(/<TRNTYPE>DEBIT<DTPOSTED>([^<]+)<TRNAMT>([^<]+)<FITID>([^<]+)<NAME>([^<]*)<MEMO>([^<]*Purchase[^<]*)</g,
  '<TRNTYPE>POS<DTPOSTED>$1<TRNAMT>$2<FITID>$3<NAME>$4<MEMO>$5');
body = body.replace(/<TRNTYPE>DEBIT<DTPOSTED>([^<]+)<TRNAMT>([^<]+)<FITID>([^<]+)<NAME>([^<]*)<MEMO>([^<]*Fee[^<]*)</g,
  '<TRNTYPE>FEE<DTPOSTED>$1<TRNAMT>$2<FITID>$3<NAME>$4<MEMO>$5');
body = body.replace(/<TRNTYPE>CREDIT<DTPOSTED>([^<]+)<TRNAMT>([^<]+)<FITID>([^<]+)<NAME>([^<]*Deposit[^<]*)/g,
  '<TRNTYPE>DEP<DTPOSTED>$1<TRNAMT>$2<FITID>$3<NAME>$4');

// Fix HTML entities
body = body.replace(/&apos;/g, "'");

// Don't remove closing tags - QuickBooks needs them!

// Remove the last two malformed transactions (empty DTPOSTED fields)
body = body.replace(/<STMTTRN><TRNTYPE>DEBIT<DTPOSTED><TRNAMT>0\.00<FITID>000144<NAME><CHECKNUM>al 1\/31<MEMO><\/STMTTRN>/g, '');
body = body.replace(/<STMTTRN><TRNTYPE>CREDIT<DTPOSTED><TRNAMT>12822\.16<FITID>000145<NAME><MEMO><\/STMTTRN>/g, '');

// Output as single line QBO
const qbo = header + body;

const outputPath = path.join(__dirname, '..', 'output', 'wells-fargo-transactions-final.qbo');
fs.writeFileSync(outputPath, qbo, 'utf8');

console.log('Created QBO file:', outputPath);
console.log('File size:', qbo.length, 'bytes');
