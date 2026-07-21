/**
 * Extensions API Routes
 *
 * Provides combined subscription + company data for Form 7004 extension filing.
 * Reads from and writes to the "Subscriptions Corporate" table.
 */

import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporatePipelineTickets, corporations } from '../db/schema';
import {
  subsCorporateFieldsToColumns,
  subsCorporateToAirtableRecord,
  loadSubsCorporateContext,
} from '../db/serializers-subscriptions';

// ---------------------------------------------------------------------------
// Form 7004 field mapping (AcroForm fields after XFA strip by pdf-lib)
// Field names → IRS form positions (verified by coordinate inspection):
//
//  f1_1  (x=87,  y=684, w=358): Name of filer
//  f1_2  (x=446, y=684, w=130): EIN  (format: XX-XXXXXXX)
//  f1_3  (x=87,  y=660, w=401): Street address
//  f1_4  (x=490, y=660, w=86 ): Room / suite
//  f1_5  (x=87,  y=636, w=185): City
//  f1_6  (x=275, y=636, w=106): State
//  f1_7  (x=383, y=636, w=106): Foreign country (leave blank for US)
//  f1_8  (x=490, y=636, w=86 ): ZIP code
//  f1_9  (x=547, y=601, w=14 ): Tax year end — month (MM)
//  f1_10 (x=562, y=601, w=14 ): Tax year end — year  (YY)
//  c1_1  (y=337): Line 2 — foreign corporation checkbox
//  c1_2  (y=313): Line 3 — consolidated group checkbox
//  c1_3  (y=278): Line 3b checkbox
//  f1_11–f1_15 (y=264): Tax year begin/end date parts (mm, dd, yyyy)
//  c1_4[0-4]: Additional election checkboxes
//  f1_16 (x=504, y=216, w=72 ): Line 6 — tentative total tax
//  f1_17 (x=504, y=192, w=72 ): Line 7 — total payments and credits
//  f1_18 (x=504, y=168, w=72 ): Line 8 — balance due
// ---------------------------------------------------------------------------

function getFormCode(entityType: string): string {
  const t = (entityType || '').toLowerCase();
  if (t.includes('c corporation') || t === 'c corp') return '12';
  if (t.includes('s corporation') || t === 's corp') return '25';
  if (t.includes('partnership') || t.includes('llc')) return '09';
  return '';
}

function formatCurrency(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fillForm7004(data: {
  companyName: string;
  ein: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  entityType: string;
  fiscalYearEnd: string;  // "MM/DD"
  taxYear: number;        // e.g. 2024
  estimatedTax: number;
  paymentsCredits: number;
  balanceDue: number;
}): Promise<Uint8Array> {
  const pdfPath = join(process.cwd(), 'src/assets/f7004.pdf');
  const pdfBytes = readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const set = (name: string, value: string) => {
    try { form.getTextField(name).setText(value); } catch (_) {}
  };
  const check = (name: string) => {
    try { form.getCheckBox(name).check(); } catch (_) {}
  };

  // Header — name, EIN, address
  set('topmostSubform[0].Page1[0].f1_1[0]', data.companyName);
  set('topmostSubform[0].Page1[0].f1_2[0]', data.ein);
  set('topmostSubform[0].Page1[0].f1_3[0]', data.address);
  set('topmostSubform[0].Page1[0].f1_5[0]', data.city);
  set('topmostSubform[0].Page1[0].f1_6[0]', data.state);
  set('topmostSubform[0].Page1[0].f1_8[0]', data.zip);

  // Tax year end month / year (2-digit year)
  const [fyMonth, fyDay] = (data.fiscalYearEnd || '12/31').split('/');
  const taxYearShort = data.taxYear.toString().slice(-2);
  set('topmostSubform[0].Page1[0].f1_9[0]',  fyMonth || '12');
  set('topmostSubform[0].Page1[0].f1_10[0]', taxYearShort);

  // Lines 4/5 date fields: MM | DD | YYYY for tax year begin and end
  // f1_11: begin month, f1_12: begin year, f1_13: end month, f1_14: end year, f1_15: extra
  // Tax year begin = 01/01/{taxYear} for calendar-year filers; use FYE month/day for fiscal year
  const beginMonth = String(parseInt(fyMonth || '12') - 11).padStart(2, '0') === '01'
    ? '01'
    : fyMonth; // simplification: for 12/31 begin=01, otherwise same month
  const isCalendarYear = fyMonth === '12' && fyDay === '31';
  set('topmostSubform[0].Page1[0].f1_11[0]', isCalendarYear ? '01' : fyMonth);
  set('topmostSubform[0].Page1[0].f1_12[0]', data.taxYear.toString());
  set('topmostSubform[0].Page1[0].f1_13[0]', fyMonth || '12');
  set('topmostSubform[0].Page1[0].f1_14[0]', data.taxYear.toString());
  set('topmostSubform[0].Page1[0].f1_15[0]', fyDay || '31');

  // Lines 6, 7, 8 — tax amounts
  set('topmostSubform[0].Page1[0].f1_16[0]', formatCurrency(data.estimatedTax));
  set('topmostSubform[0].Page1[0].f1_17[0]', formatCurrency(data.paymentsCredits));
  set('topmostSubform[0].Page1[0].f1_18[0]', formatCurrency(Math.max(0, data.balanceDue)));

  // Flatten so the filled values are locked into the PDF
  form.flatten();

  return pdfDoc.save();
}

const app = new Hono();

/** Fetch subscription + linked corporation from Postgres (or nulls). */
async function loadSubscriptionWithCompany(subscriptionId: string) {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(corporatePipelineTickets)
    .where(eq(corporatePipelineTickets.id, subscriptionId))
    .limit(1);
  if (!sub) return { sub: null, corp: null };
  const corp = sub.corporationId
    ? (await db.select().from(corporations).where(eq(corporations.id, sub.corporationId)).limit(1))[0] ?? null
    : null;
  return { sub, corp };
}

/**
 * GET /api/extensions/:subscriptionId
 *
 * Returns combined subscription fields (including Extension_* fields)
 * and the linked corporation's client data for Form 7004 pre-filling.
 */
app.get('/:subscriptionId', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');

    const { sub, corp } = await loadSubscriptionWithCompany(subscriptionId);
    if (!sub) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }
    if (!corp) {
      return c.json({ success: false, error: 'No linked corporation found on subscription' }, 400);
    }

    const company = {
      id: corp.id,
      companyName: corp.company || 'Unnamed',
      ein: corp.ein || '',
      entityType: corp.typeOfEntity || '',
      fiscalYearEnd: corp.fiscalYearEnd || '12/31',
      address: corp.address || '',
      city: corp.city || '',
      state: corp.state || '',
      zip: corp.zip || '',
      phone: corp.phone || '',
      email: corp.email || '',
    };

    const extensionData = {
      taxYear: sub.extensionTaxYear || null,
      estimatedTax: sub.extensionEstimatedTax != null ? Number(sub.extensionEstimatedTax) : null,
      paymentsCredits: sub.extensionPaymentsCredits != null ? Number(sub.extensionPaymentsCredits) : null,
      status: sub.extensionStatus || 'Not Filed',
      filedDate: sub.extensionFiledDate || null,
    };

    return c.json({
      success: true,
      data: {
        subscription: {
          id: sub.id,
          ...extensionData,
        },
        company,
      },
    });
  } catch (error: any) {
    console.error('GET /api/extensions/:id error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/extensions/:subscriptionId/pdf
 *
 * Returns a filled IRS Form 7004 PDF ready to download.
 */
app.get('/:subscriptionId/pdf', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');

    const { sub, corp } = await loadSubscriptionWithCompany(subscriptionId);
    if (!sub) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }
    if (!corp) {
      return c.json({ success: false, error: 'No linked corporation found' }, 400);
    }

    const companyName = corp.company || '';
    const ein = corp.ein || '';
    const entityType = corp.typeOfEntity || '';
    const fiscalYearEnd = corp.fiscalYearEnd || '12/31';
    const address = corp.address || '';
    const city = corp.city || '';
    const state = corp.state || '';
    const zip = corp.zip || '';

    const taxYear = sub.extensionTaxYear || new Date().getFullYear() - 1;
    const estimatedTax = sub.extensionEstimatedTax != null ? Number(sub.extensionEstimatedTax) : 0;
    const paymentsCredits = sub.extensionPaymentsCredits != null ? Number(sub.extensionPaymentsCredits) : 0;
    const balanceDue = estimatedTax - paymentsCredits;

    const filledPdf = await fillForm7004({
      companyName, ein, address, city, state, zip,
      entityType, fiscalYearEnd,
      taxYear: Number(taxYear),
      estimatedTax, paymentsCredits, balanceDue,
    });

    const filename = `Form7004_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${taxYear}.pdf`;

    return new Response(filledPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/extensions/:id/pdf error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PATCH /api/extensions/:subscriptionId
 *
 * Updates extension-specific fields on the Subscriptions Corporate record.
 *
 * Body: { fields: { "Extension Tax Year"?: number, "Extension Estimated Tax"?: number,
 *                   "Extension Payments Credits"?: number, "Extension Status"?: string,
 *                   "Extension Filed Date"?: string } }
 */
app.patch('/:subscriptionId', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');
    const body = await c.req.json();

    if (!body.fields || typeof body.fields !== 'object') {
      return c.json({ success: false, error: 'Missing or invalid fields in request body' }, 400);
    }

    const db = getDb();
    const [row] = await db
      .update(corporatePipelineTickets)
      .set(subsCorporateFieldsToColumns(body.fields))
      .where(eq(corporatePipelineTickets.id, subscriptionId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const ctx = await loadSubsCorporateContext(db);
    return c.json({ success: true, data: subsCorporateToAirtableRecord(row, ctx) });
  } catch (error: any) {
    console.error('PATCH /api/extensions/:id error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
