/**
 * GET /api/open-tickets-dashboard
 *
 * Read-only rollup of currently-open pipeline tickets (corporate +
 * personal), grouped by the same legacy "view" names the two pipeline
 * screens already filter by (CORPORATE_VIEW_FILTERS / PERSONAL_VIEW_FILTERS),
 * so a link built from this response filters the pipeline exactly the way
 * clicking the dropdown option would. "Open" means status is not that
 * pipeline's terminal status; age is measured from the ticket's createdAt.
 */

import { Hono } from 'hono';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  corporatePipelineTickets,
  personalPipelineTickets,
  servicesCorporate,
  personalServices,
} from '../db/schema';
import { CORPORATE_VIEW_FILTERS, PERSONAL_VIEW_FILTERS } from '../db/serializers-subscriptions';

const app = new Hono();

const CORPORATE_TERMINAL_STATUS = 'Complete Service';
const PERSONAL_TERMINAL_STATUSES = ['File Return', 'Filed Elsewhere'];

// serviceName -> view, built from the same maps the pipeline dropdowns use.
// Skips null-filter views (no single service, e.g. corporate's "Grid view")
// and, for corporate, "Bookkeeping Billing" (an activeOnly variant of the
// same serviceName as "Bookkeeping" — the dropdown only exposes "Bookkeeping").
function buildServiceToViewMap(
  filters: Record<string, { serviceName: string; activeOnly?: boolean } | null>,
  skipViews: string[] = []
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [view, filter] of Object.entries(filters)) {
    if (!filter || skipViews.includes(view)) continue;
    if (!map.has(filter.serviceName)) map.set(filter.serviceName, view);
  }
  return map;
}

const CORPORATE_SERVICE_TO_VIEW = buildServiceToViewMap(CORPORATE_VIEW_FILTERS, ['Bookkeeping Billing']);
const PERSONAL_SERVICE_TO_VIEW = buildServiceToViewMap(PERSONAL_VIEW_FILTERS);

interface ServiceBucket {
  view: string;
  serviceName: string;
  openCount: number;
  oldestDays: number;
  avgDays: number;
}

function summarize(view: string, serviceName: string, createdDates: Date[], now: number): ServiceBucket {
  const ageDays = createdDates.map((d) => Math.floor((now - d.getTime()) / 86_400_000));
  const oldestDays = ageDays.length ? Math.max(...ageDays) : 0;
  const avgDays = ageDays.length ? Math.round(ageDays.reduce((a, b) => a + b, 0) / ageDays.length) : 0;
  return { view, serviceName, openCount: createdDates.length, oldestDays, avgDays };
}

app.get('/', async (c) => {
  try {
    const db = getDb();
    const now = Date.now();

    const openCorporateRows = await db
      .select({
        serviceName: servicesCorporate.name,
        createdAt: corporatePipelineTickets.createdAt,
      })
      .from(corporatePipelineTickets)
      .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
      .where(
        or(
          isNull(corporatePipelineTickets.status),
          ne(corporatePipelineTickets.status, CORPORATE_TERMINAL_STATUS)
        )
      );

    const openPersonalRows = await db
      .select({
        serviceName: personalServices.name,
        createdAt: personalPipelineTickets.createdAt,
      })
      .from(personalPipelineTickets)
      .innerJoin(personalServices, eq(personalPipelineTickets.serviceId, personalServices.id))
      .where(
        and(
          ...PERSONAL_TERMINAL_STATUSES.map((s) => ne(personalPipelineTickets.status, s)),
          // ne() against a NULL column doesn't match it back to TRUE, so
          // NULL statuses (open by definition) need an explicit isNull() OR.
        )
      );
    // The AND-of-NEs above drops rows where status IS NULL (SQL NULL
    // comparisons never satisfy <>), so pull those back in separately.
    const openPersonalNullStatusRows = await db
      .select({
        serviceName: personalServices.name,
        createdAt: personalPipelineTickets.createdAt,
      })
      .from(personalPipelineTickets)
      .innerJoin(personalServices, eq(personalPipelineTickets.serviceId, personalServices.id))
      .where(isNull(personalPipelineTickets.status));

    const groupBy = (
      rows: { serviceName: string | null; createdAt: Date }[],
      serviceToView: Map<string, string>
    ): ServiceBucket[] => {
      const buckets = new Map<string, Date[]>();
      for (const row of rows) {
        if (!row.serviceName) continue;
        const view = serviceToView.get(row.serviceName);
        if (!view) continue;
        const existing = buckets.get(view);
        if (existing) existing.push(row.createdAt);
        else buckets.set(view, [row.createdAt]);
      }
      return [...buckets.entries()]
        .map(([view, dates]) => {
          const serviceName = [...serviceToView.entries()].find(([, v]) => v === view)?.[0] || view;
          return summarize(view, serviceName, dates, now);
        })
        .sort((a, b) => b.oldestDays - a.oldestDays);
    };

    const corporate = groupBy(openCorporateRows, CORPORATE_SERVICE_TO_VIEW);
    const personal = groupBy(
      [...openPersonalRows, ...openPersonalNullStatusRows],
      PERSONAL_SERVICE_TO_VIEW
    );

    return c.json({ success: true, data: { corporate, personal } });
  } catch (error) {
    console.error('Error computing open tickets dashboard:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compute open tickets dashboard' },
      500
    );
  }
});

export default app;
