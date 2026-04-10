/**
 * Extensions Personal API Routes
 *
 * Provides combined subscription + personal client data for Form 4868 extension filing.
 * Reads from and writes to the "Subscriptions Personal" table.
 */

import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRecord, updateRecords } from '../lib/airtable-helpers';

const app = new Hono();

const SUBSCRIPTIONS_TABLE = 'Subscriptions Personal';
const PERSONAL_TABLE = 'Personal';

function formatCurrency(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Fill IRS Form 4868 PDF with client and extension data.
 *
 * Field names verified via pdf-lib inspection of the 2025 f4868.pdf:
 *
 *  VoucherHeader (payment voucher strip):
 *    f1_1 — Name(s)
 *    f1_2 — Address
 *    f1_3 — City, State, ZIP
 *
 *  PartI_ReadOrder (Part I — Identification):
 *    f1_4  — Line 1: Name(s)
 *    f1_5  — Address
 *    f1_6  — City
 *    f1_7  — State
 *    f1_8  — ZIP code
 *    f1_9  — Line 2: SSN (primary)
 *    f1_10 — Line 3: SSN (spouse, leave blank if not applicable)
 *
 *  Top-level (Part II — Individual Income Tax):
 *    f1_11 — Line 4: Estimated total tax liability
 *    f1_12 — Line 5: Total payments
 *    f1_13 — Line 6: Balance due
 *    f1_14 — Line 7: Amount paying
 *
 *  Checkboxes:
 *    c1_1  — Line 8: Out of country
 *    c1_2  — Line 9: Form 1040-NR filer
 */
async function fillForm4868(data: {
  clientName: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  taxYear: number;
  estimatedTax: number;
  paymentsCredits: number;
  balanceDue: number;
}): Promise<Uint8Array> {
  const pdfPath = join(process.cwd(), 'src/assets/f4868.pdf');
  const pdfBytes = readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const set = (name: string, value: string) => {
    try { form.getTextField(name).setText(value); } catch (_) {}
  };

  const balanceDue = Math.max(0, data.balanceDue);
  const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');

  // VoucherHeader — payment voucher strip at top
  set('topmostSubform[0].Page1[0].VoucherHeader[0].f1_1[0]', data.clientName);
  set('topmostSubform[0].Page1[0].VoucherHeader[0].f1_2[0]', data.address);
  set('topmostSubform[0].Page1[0].VoucherHeader[0].f1_3[0]', cityStateZip);

  // Part I — Identification
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_4[0]', data.clientName);
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_5[0]', data.address);
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_6[0]', data.city);
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_7[0]', data.state);
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_8[0]', data.zip);
  set('topmostSubform[0].Page1[0].PartI_ReadOrder[0].f1_9[0]',  data.ssn);
  // f1_10 is spouse SSN — leave blank for individual filers

  // Part II — Individual Income Tax
  set('topmostSubform[0].Page1[0].f1_11[0]', formatCurrency(data.estimatedTax));
  set('topmostSubform[0].Page1[0].f1_12[0]', formatCurrency(data.paymentsCredits));
  set('topmostSubform[0].Page1[0].f1_13[0]', formatCurrency(balanceDue));
  set('topmostSubform[0].Page1[0].f1_14[0]', formatCurrency(balanceDue));

  form.flatten();
  return pdfDoc.save();
}

/**
 * GET /api/extensions-personal/:subscriptionId
 *
 * Returns combined subscription fields (including Extension_* fields)
 * and the linked personal client's data for Form 4868 pre-filling.
 */
app.get('/:subscriptionId', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const subscriptionId = c.req.param('subscriptionId');

    const subscription = await getRecord(baseId, SUBSCRIPTIONS_TABLE, subscriptionId);

    // The "Last Name" field is the linked record field to the Personal table
    const linkedPersonal = subscription.fields['Last Name'];
    const personalId = Array.isArray(linkedPersonal) ? linkedPersonal[0] : linkedPersonal;

    if (!personalId) {
      return c.json({ success: false, error: 'No linked personal record found on subscription' }, 400);
    }

    const personal = await getRecord(baseId, PERSONAL_TABLE, personalId);
    const pf = personal.fields;

    const fullName =
      pf['Full Name'] ||
      `${pf['First Name'] || ''} ${pf['Last Name'] || ''}`.trim() ||
      'Unnamed';

    const client = {
      id: personal.id,
      clientName: fullName,
      ssn: pf['SSN'] || pf['Tax ID'] || '',
      address: pf['Address'] || pf['ADDRESS'] || '',
      city: pf['City'] || pf['CITY'] || '',
      state: pf['State'] || pf['STATE'] || '',
      zip: pf['ZIP'] || pf['Zip'] || pf['ZIP CODE'] || '',
      phone: pf['📞Phone number'] || pf['Phone'] || '',
      email: pf['📧 Email'] || pf['Email'] || '',
      clientCode: pf['Client Code'] || '',
    };

    const sf = subscription.fields;
    const extensionData = {
      taxYear: sf['Extension Tax Year'] || null,
      estimatedTax: sf['Extension Estimated Tax'] || null,
      paymentsCredits: sf['Extension Payments Credits'] || null,
      status: sf['Extension Status'] || 'Not Filed',
      filedDate: sf['Extension Filed Date'] || null,
    };

    return c.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          ...extensionData,
        },
        client,
      },
    });
  } catch (error: any) {
    console.error('GET /api/extensions-personal/:id error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/extensions-personal/:subscriptionId/pdf
 *
 * Returns a filled IRS Form 4868 PDF ready to download.
 */
app.get('/:subscriptionId/pdf', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const subscriptionId = c.req.param('subscriptionId');

    const subscription = await getRecord(baseId, SUBSCRIPTIONS_TABLE, subscriptionId);

    const linkedPersonal = subscription.fields['Last Name'];
    const personalId = Array.isArray(linkedPersonal) ? linkedPersonal[0] : linkedPersonal;
    if (!personalId) {
      return c.json({ success: false, error: 'No linked personal record found' }, 400);
    }

    const personal = await getRecord(baseId, PERSONAL_TABLE, personalId);
    const pf = personal.fields;
    const sf = subscription.fields;

    const clientName =
      pf['Full Name'] ||
      `${pf['First Name'] || ''} ${pf['Last Name'] || ''}`.trim() ||
      '';
    const ssn = pf['SSN'] || pf['Tax ID'] || '';
    const address = pf['Address'] || pf['ADDRESS'] || '';
    const city = pf['City'] || pf['CITY'] || '';
    const state = pf['State'] || pf['STATE'] || '';
    const zip = pf['ZIP'] || pf['Zip'] || pf['ZIP CODE'] || '';

    const taxYear = sf['Extension Tax Year'] || new Date().getFullYear() - 1;
    const estimatedTax = parseFloat(sf['Extension Estimated Tax'] || '0') || 0;
    const paymentsCredits = parseFloat(sf['Extension Payments Credits'] || '0') || 0;
    const balanceDue = estimatedTax - paymentsCredits;

    const filledPdf = await fillForm4868({
      clientName, ssn, address, city, state, zip,
      taxYear: Number(taxYear),
      estimatedTax, paymentsCredits, balanceDue,
    });

    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Form4868_${safeName}_${taxYear}.pdf`;

    return new Response(filledPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/extensions-personal/:id/pdf error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PATCH /api/extensions-personal/:subscriptionId
 *
 * Updates extension-specific fields on the Subscriptions Personal record.
 */
app.patch('/:subscriptionId', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const subscriptionId = c.req.param('subscriptionId');
    const body = await c.req.json();

    if (!body.fields || typeof body.fields !== 'object') {
      return c.json({ success: false, error: 'Missing or invalid fields in request body' }, 400);
    }

    const updated = await updateRecords(baseId, SUBSCRIPTIONS_TABLE, [
      { id: subscriptionId, fields: body.fields },
    ]);

    return c.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error('PATCH /api/extensions-personal/:id error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
