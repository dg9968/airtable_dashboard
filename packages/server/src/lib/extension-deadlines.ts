/**
 * Extended tax-filing deadline math, used to set the due date on the
 * follow-up ticket auto-created when an extension is marked Filed.
 *
 * Server-side port of the relevant subset of
 * packages/client/lib/extensionHelpers.ts (client and server packages don't
 * share code — packages/server/src/routes/extensions.ts already duplicates
 * getFormCode locally for the same reason).
 */

/** Parse a "MM/DD" fiscal year end string into month (1-based) and day. */
function parseFiscalYearEnd(fiscalYearEnd: string): { month: number; day: number } {
  const parts = (fiscalYearEnd || '12/31').split('/');
  const month = parseInt(parts[0], 10) || 12;
  const day = parseInt(parts[1], 10) || 31;
  return { month, day };
}

/**
 * Extended due date for a corporate Form 7004 (original due date + 6 months).
 * - C Corporation: original due date is the 4th month after FYE, 15th day
 * - S Corporation / Partnership / LLC: 3rd month after FYE, 15th day
 */
export function getExtensionDueDateCorporate(
  entityType: string,
  fiscalYearEnd: string,
  taxYear: number
): Date {
  const { month } = parseFiscalYearEnd(fiscalYearEnd);
  const type = (entityType || '').toLowerCase().trim();
  const monthOffset = type.includes('c corporation') || type === 'c corp' ? 4 : 3;

  const original = new Date(taxYear, month - 1 + monthOffset, 15);
  return new Date(original.getFullYear(), original.getMonth() + 6, original.getDate());
}

/** Extension due date for a personal return (Form 4868): October 15 of taxYear+1. */
export function getExtensionDueDatePersonal(taxYear: number): Date {
  return new Date(taxYear + 1, 9, 15); // October = month index 9
}

/** Format a Date as 'YYYY-MM-DD', matching the extensionFiledDate convention. */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().split('T')[0];
}
