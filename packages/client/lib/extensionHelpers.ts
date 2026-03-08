/**
 * IRS Form 7004 Extension Filing Helpers
 *
 * Pure utility functions for calculating filing deadlines,
 * mapping entity types to form codes, and other extension-related logic.
 */

/** IRS Form 7004 form code by entity type */
export function getFormCode(entityType: string): string | null {
  const type = (entityType || '').toLowerCase().trim();
  if (type.includes('c corporation') || type === 'c corp') return '12';
  if (type.includes('s corporation') || type === 's corp') return '25';
  if (type.includes('partnership') || type.includes('llc')) return '09';
  if (type.includes('non-profit') || type.includes('nonprofit')) return null; // Form 8868 applies instead
  return null;
}

/** Full form name by entity type */
export function getFormName(entityType: string): string {
  const type = (entityType || '').toLowerCase().trim();
  if (type.includes('c corporation') || type === 'c corp') return 'Form 1120';
  if (type.includes('s corporation') || type === 's corp') return 'Form 1120-S';
  if (type.includes('partnership') || type.includes('llc')) return 'Form 1065';
  if (type.includes('non-profit') || type.includes('nonprofit')) return 'Form 990 (use Form 8868)';
  return 'Unknown';
}

/**
 * Parse a "MM/DD" fiscal year end string into month (1-based) and day.
 * Returns { month: 12, day: 31 } for "12/31".
 */
function parseFiscalYearEnd(fiscalYearEnd: string): { month: number; day: number } {
  const parts = (fiscalYearEnd || '12/31').split('/');
  const month = parseInt(parts[0], 10) || 12;
  const day = parseInt(parts[1], 10) || 31;
  return { month, day };
}

/**
 * Get the original (unextended) due date for Form 7004.
 * - C Corporation: 4th month after FYE, 15th day
 * - S Corporation / Partnership / LLC: 3rd month after FYE, 15th day
 *
 * Uses JavaScript Date overflow: new Date(year, 13, 15) == Feb 15 of year+1
 */
export function getOriginalDueDate(
  entityType: string,
  fiscalYearEnd: string,
  taxYear: number
): Date {
  const { month } = parseFiscalYearEnd(fiscalYearEnd);
  const type = (entityType || '').toLowerCase().trim();

  // C Corps get the 4th month after FYE; all others get the 3rd month
  const monthOffset = type.includes('c corporation') || type === 'c corp' ? 4 : 3;

  // JavaScript months are 0-based; month is 1-based from parseFiscalYearEnd
  // The fiscal year ends in `taxYear`, so the due date is in taxYear+1 for 12/31 FYE
  // For a 12/31 FYE: month=12 (Dec), offset=3 → month index = 12-1+3 = 14 → Feb of next year is wrong...
  // Let's think again: FYE month 12 (December), add 3 months → March. Year of FYE end = taxYear.
  // So due date = March 15 of taxYear+1.
  // new Date(taxYear, 12-1 + 3, 15) = new Date(taxYear, 14, 15) = March 15, taxYear+1 ✓

  return new Date(taxYear, month - 1 + monthOffset, 15);
}

/**
 * Get the extension due date (original due date + 6 months).
 */
export function getExtensionDueDate(
  entityType: string,
  fiscalYearEnd: string,
  taxYear: number
): Date {
  const original = getOriginalDueDate(entityType, fiscalYearEnd, taxYear);
  return new Date(original.getFullYear(), original.getMonth() + 6, original.getDate());
}

/**
 * Days from today until the deadline.
 * Returns a negative number if the deadline has passed.
 */
export function getDaysUntilDeadline(deadline: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  return Math.round((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Color-coded urgency level based on days remaining */
export function getDeadlineUrgency(days: number): 'safe' | 'warning' | 'urgent' | 'overdue' {
  if (days < 0) return 'overdue';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'warning';
  return 'safe';
}

/** Format a Date as "Month DD, YYYY" (e.g., "September 15, 2025") */
export function formatDeadlineDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Infer the tax year being filed from the fiscal year end and current date.
 * Returns the calendar year in which the fiscal period ended.
 *
 * For a 12/31 FYE during filing season (Jan–Sep), we're typically filing
 * for the prior year. We return the most recently completed fiscal year.
 */
export function inferTaxYear(fiscalYearEnd: string): number {
  const { month, day } = parseFiscalYearEnd(fiscalYearEnd);
  const today = new Date();
  const currentYear = today.getFullYear();

  // FYE date in the current year
  const fyeThisYear = new Date(currentYear, month - 1, day);

  // If the FYE for this year has already passed, the last completed FY ended this year
  if (today >= fyeThisYear) {
    return currentYear;
  }
  // Otherwise the last completed FY ended last year
  return currentYear - 1;
}

/** DaisyUI badge class for a given urgency level */
export function urgencyToBadgeClass(urgency: 'safe' | 'warning' | 'urgent' | 'overdue'): string {
  switch (urgency) {
    case 'safe': return 'badge-success';
    case 'warning': return 'badge-warning';
    case 'urgent': return 'badge-error';
    case 'overdue': return 'badge-error';
  }
}

/** Human-readable label for days remaining */
export function formatDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}
