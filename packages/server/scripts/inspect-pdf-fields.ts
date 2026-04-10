/**
 * Run with: bun run scripts/inspect-pdf-fields.ts <path-to-pdf>
 * Lists all AcroForm field names in an IRS PDF for field mapping.
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: bun run scripts/inspect-pdf-fields.ts <path-to-pdf>');
  process.exit(1);
}

const pdfBytes = readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
const form = pdfDoc.getForm();
const fields = form.getFields();

console.log(`\nFound ${fields.length} fields in ${pdfPath}:\n`);
for (const field of fields) {
  console.log(`  [${field.constructor.name}] ${field.getName()}`);
}
