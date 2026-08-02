/**
 * GET /api/workload-dashboard
 *
 * Open pipeline tickets grouped by the person responsible, across both the
 * corporate and personal pipelines at once — the "who is working on what"
 * view. open-tickets-dashboard.ts answers the same question grouped by
 * service; this one groups by processor, and the two pipeline screens can
 * each only filter within their own side.
 *
 * Unassigned work is returned as its own bucket (id: null) and is the point
 * of the report: an open ticket with nobody on it is the one that goes
 * unnoticed, since it appears in no one's queue.
 *
 * Unlike open-tickets-dashboard, this deliberately counts EVERY open ticket
 * rather than only those whose service appears in CORPORATE_VIEW_FILTERS /
 * PERSONAL_VIEW_FILTERS — a workload that silently omits unmapped services
 * would understate what someone is actually carrying.
 *
 * "Open" uses the same terminal statuses as the rest of the app, including
 * the legacy corporate 'Completed' spelling still present on real rows.
 */

import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';

const app = new Hono();

const CORPORATE_TERMINAL_STATUSES = ['Complete Service', 'Completed'];
const PERSONAL_TERMINAL_STATUSES = ['File Return', 'Filed Elsewhere'];

const TOP_SERVICES = 5;

const inList = (values: readonly string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);

interface SideStats {
  open: number;
  oldestDays: number;
  avgDays: number;
}

interface ServiceCount {
  name: string;
  count: number;
}

interface WorkloadBucket {
  id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  corporate: SideStats;
  personal: SideStats;
  total: number;
  topServices: ServiceCount[];
}

/** One row per (assignee, service) with its open count and age spread. */
interface RawRow {
  user_id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  service: string | null;
  open_tickets: number;
  oldest_days: number | null;
  total_days: number | null;
}

const emptySide = (): SideStats => ({ open: 0, oldestDays: 0, avgDays: 0 });

app.get('/', async (c) => {
  try {
    const db = getDb();

    // Age is measured from created_at, matching open-tickets-dashboard.
    // total_days is summed (not averaged) here so the two sides can be
    // combined into one weighted average per person in JS.
    const corporate = await db.execute(sql`
      select t.processor_id as user_id, u.name, u.email, u.role,
             sv.name as service,
             count(*)::int as open_tickets,
             max(current_date - t.created_at::date)::int as oldest_days,
             sum(current_date - t.created_at::date)::int as total_days
        from corporate_pipeline_tickets t
        left join "user" u on u.id = t.processor_id
        left join services_corporate sv on sv.id = t.service_id
       where t.status is null
          or t.status not in (${inList(CORPORATE_TERMINAL_STATUSES)})
       group by 1, 2, 3, 4, 5
    `);

    const personal = await db.execute(sql`
      select t.tax_preparer_id as user_id, u.name, u.email, u.role,
             sv.name as service,
             count(*)::int as open_tickets,
             max(current_date - t.created_at::date)::int as oldest_days,
             sum(current_date - t.created_at::date)::int as total_days
        from personal_pipeline_tickets t
        left join "user" u on u.id = t.tax_preparer_id
        left join personal_services sv on sv.id = t.service_id
       where t.status is null
          or t.status not in (${inList(PERSONAL_TERMINAL_STATUSES)})
       group by 1, 2, 3, 4, 5
    `);

    const buckets = new Map<string, WorkloadBucket>();
    // Running age totals, kept outside the bucket so avgDays can be computed
    // once at the end rather than re-derived on every row.
    const totals = new Map<string, { corpDays: number; personalDays: number }>();

    const ingest = (rows: RawRow[], side: 'corporate' | 'personal') => {
      for (const row of rows) {
        const key = row.user_id ?? '__unassigned__';
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            id: row.user_id,
            name: row.user_id ? row.name ?? `(unknown user ${row.user_id})` : 'Unassigned',
            email: row.email,
            role: row.role,
            corporate: emptySide(),
            personal: emptySide(),
            total: 0,
            topServices: [],
          };
          buckets.set(key, bucket);
          totals.set(key, { corpDays: 0, personalDays: 0 });
        }

        const stats = bucket[side];
        stats.open += row.open_tickets;
        stats.oldestDays = Math.max(stats.oldestDays, row.oldest_days ?? 0);
        bucket.total += row.open_tickets;

        const t = totals.get(key)!;
        if (side === 'corporate') t.corpDays += row.total_days ?? 0;
        else t.personalDays += row.total_days ?? 0;

        const serviceName = row.service ?? '(no service)';
        const existing = bucket.topServices.find((s) => s.name === serviceName);
        if (existing) existing.count += row.open_tickets;
        else bucket.topServices.push({ name: serviceName, count: row.open_tickets });
      }
    };

    ingest(corporate.rows as unknown as RawRow[], 'corporate');
    ingest(personal.rows as unknown as RawRow[], 'personal');

    for (const [key, bucket] of buckets) {
      const t = totals.get(key)!;
      if (bucket.corporate.open > 0) {
        bucket.corporate.avgDays = Math.round(t.corpDays / bucket.corporate.open);
      }
      if (bucket.personal.open > 0) {
        bucket.personal.avgDays = Math.round(t.personalDays / bucket.personal.open);
      }
      bucket.topServices.sort((a, b) => b.count - a.count);
      bucket.topServices = bucket.topServices.slice(0, TOP_SERVICES);
    }

    // Unassigned leads regardless of size — it is the bucket that represents
    // work nobody is looking at. Everyone else sorts by load.
    const list = [...buckets.values()].sort((a, b) => {
      if (a.id === null) return -1;
      if (b.id === null) return 1;
      return b.total - a.total;
    });

    const unassigned = list.find((b) => b.id === null)?.total ?? 0;
    const open = list.reduce((sum, b) => sum + b.total, 0);

    return c.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        totals: {
          open,
          assigned: open - unassigned,
          unassigned,
          corporateOpen: list.reduce((sum, b) => sum + b.corporate.open, 0),
          personalOpen: list.reduce((sum, b) => sum + b.personal.open, 0),
          people: list.filter((b) => b.id !== null).length,
        },
        buckets: list,
      },
    });
  } catch (error) {
    console.error('GET /api/workload-dashboard error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute workload dashboard',
      },
      500
    );
  }
});

export default app;
