/**
 * Cadence rules for corporate billing bundle -> pipeline ticket generation.
 * A bundle line item's dollar amount is billed every period, but not every
 * cadence produces a ticket every month: e.g. a Quarterly sales tax filing
 * only needs a ticket in the filing month (which covers the prior 3
 * months' sales), and an Annual filing only needs one ticket a year.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Fixed filing month for Annual-cadence services (1 = January). Every
// client's annual ticket generates in this same calendar month regardless
// of that client's fiscal_year_end or entity type.
const ANNUAL_FILING_MONTH = 1;

/**
 * Whether a bundle line item's service should get a pipeline ticket
 * generated for the given YYYY-MM billing period, based on the service's
 * billing_cycle (Monthly/Quarterly/Annual/One-time/null).
 */
export function isFilingMonth(billingCycle: string | null | undefined, period: string): boolean {
  const month = Number(period.slice(5, 7)); // 1-12
  switch ((billingCycle ?? 'Monthly').toLowerCase()) {
    case 'quarterly':
      return month % 3 === 1; // Jan, Apr, Jul, Oct
    case 'annual':
      return month === ANNUAL_FILING_MONTH;
    case 'one-time':
      return false; // one-time services never get a recurring bundle ticket
    case 'monthly':
    default:
      return true;
  }
}

/**
 * Human-readable description of the period a filing covers, for the
 * generated ticket's notes (e.g. a Quarterly ticket generated in April
 * covers "January-March 2026" sales). Null for cadences where the covered
 * period is just the filing month itself (Monthly) or not meaningful.
 */
export function describeCoveredPeriod(billingCycle: string | null | undefined, period: string): string | null {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)); // 1-12, the filing month

  switch ((billingCycle ?? 'Monthly').toLowerCase()) {
    case 'quarterly': {
      const startMonth = month - 3;
      const endMonth = month - 1;
      const start = startMonth <= 0 ? { m: startMonth + 12, y: year - 1 } : { m: startMonth, y: year };
      const end = endMonth <= 0 ? { m: endMonth + 12, y: year - 1 } : { m: endMonth, y: year };
      const range =
        start.y === end.y
          ? `${MONTH_NAMES[start.m - 1]}-${MONTH_NAMES[end.m - 1]} ${end.y}`
          : `${MONTH_NAMES[start.m - 1]} ${start.y}-${MONTH_NAMES[end.m - 1]} ${end.y}`;
      return `Covers ${range}`;
    }
    case 'annual':
      return `Covers tax year ${year - 1}`;
    default:
      return null;
  }
}
