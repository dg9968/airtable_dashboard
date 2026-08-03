/**
 * Per-service rules governing corporate billing bundle -> pipeline ticket
 * generation: when a ticket is due, what its note says, and whether it may be
 * created without an assignee.
 *
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
 * Services whose ticket may not be created without a standing assignee on the
 * bundle line item (`corporate_billing_bundle_items.processor_id`).
 *
 * Bookkeeping is the case this exists for: the bookkeeper has to be chosen
 * *before* the ticket exists, not bulk-assigned afterwards out of the
 * unassigned pile, because the work benefits from continuity — the same person
 * learns the business and makes better calls reconciling it. Generation skips
 * these line items and reports them instead of producing an unassigned ticket,
 * so an unassigned bookkeeping ticket can never come into existence.
 *
 * Every other service still generates unassigned and is assigned afterwards
 * via the workload dashboard, which is fine for work that doesn't carry
 * client-specific context between periods.
 */
export const SERVICES_REQUIRING_PROCESSOR = new Set(['Bookkeeping Clients']);

export function requiresProcessor(serviceName: string | null | undefined): boolean {
  return serviceName != null && SERVICES_REQUIRING_PROCESSOR.has(serviceName);
}

/**
 * What an Annual-cadence ticket is actually for, keyed by service name.
 *
 * Annual cadence means only "one ticket a year, in January" — it says nothing
 * about what that ticket is. These services differ sharply: some file against
 * the *prior* tax year, some renew for the *current* one, and two aren't
 * filings at all. Without this map every one of them inherited the "Covers tax
 * year N-1" wording that is only correct for the return-filing pair, which
 * would tell staff a contract review was a tax-year task.
 *
 * `year` is the year the ticket generates in.
 */
const ANNUAL_NOTE_BY_SERVICE: Record<string, (year: number) => string> = {
  // File against the tax year that just closed.
  'Tax Returns': (year) => `Covers tax year ${year - 1}`,
  '1099 Filing': (year) => `Covers tax year ${year - 1}`,
  // Renew/report for the year now starting.
  'Annual Report': (year) => `Florida annual report for ${year} (due May 1)`,
  'Registered Agent': (year) => `Registered agent renewal for ${year}`,
  // Billed monthly all year; the once-a-year ticket is to renegotiate terms,
  // not to file anything.
  'Vault Management': (year) => `Annual contract review for ${year}`,
  'Quickbooks Software': (year) => `Annual contract review for ${year}`,
  'PO Box - 1414': (year) => `Annual contract review for ${year}`,
};

/**
 * Human-readable description of what a generated ticket covers, for its notes
 * (e.g. a Quarterly ticket generated in April covers "January-March 2026"
 * sales). Null for cadences where the covered period is just the filing month
 * itself (Monthly) or not meaningful.
 *
 * `serviceName` selects the Annual wording via ANNUAL_NOTE_BY_SERVICE; an
 * Annual service absent from that map falls back to the tax-year phrasing.
 */
export function describeCoveredPeriod(
  billingCycle: string | null | undefined,
  period: string,
  serviceName?: string | null
): string | null {
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
    case 'annual': {
      const describe = serviceName ? ANNUAL_NOTE_BY_SERVICE[serviceName] : undefined;
      return describe ? describe(year) : `Covers tax year ${year - 1}`;
    }
    default:
      return null;
  }
}
