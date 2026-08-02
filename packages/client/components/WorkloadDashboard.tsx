'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

interface WorkloadData {
  generatedAt: string;
  totals: {
    open: number;
    assigned: number;
    unassigned: number;
    corporateOpen: number;
    personalOpen: number;
    people: number;
  };
  buckets: WorkloadBucket[];
}

// Same thresholds the open-tickets dashboard uses, so a "30 day" ticket reads
// as equally urgent on both screens.
function ageBadgeClass(days: number): string {
  if (days >= 90) return 'badge-error';
  if (days >= 30) return 'badge-warning';
  return 'badge-ghost';
}

function pipelineHref(side: 'corporate' | 'personal', id: string | null): string {
  const base = side === 'corporate' ? '/corporate-services-pipeline' : '/personal-services-pipeline';
  return `${base}?processor=${id ?? 'unassigned'}`;
}

function SideCell({ stats, side, id }: { stats: SideStats; side: 'corporate' | 'personal'; id: string | null }) {
  if (stats.open === 0) {
    return <span className="text-base-content/40">—</span>;
  }
  return (
    <Link href={pipelineHref(side, id)} className="link link-hover">
      <span className="font-medium">{stats.open}</span>{' '}
      <span className={`badge badge-sm ${ageBadgeClass(stats.oldestDays)}`}>
        {stats.oldestDays}d oldest
      </span>{' '}
      <span className="text-xs text-base-content/60">avg {stats.avgDays}d</span>
    </Link>
  );
}

function ServiceChips({ services }: { services: ServiceCount[] }) {
  if (services.length === 0) return <span className="text-base-content/40">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {services.map((s) => (
        <span key={s.name} className="badge badge-outline badge-sm whitespace-nowrap">
          {s.name} <span className="ml-1 opacity-60">{s.count}</span>
        </span>
      ))}
    </div>
  );
}

export default function WorkloadDashboard() {
  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/workload-dashboard');
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load workload');
      }
    } catch (err) {
      console.error('Error loading workload dashboard:', err);
      setError('Could not reach the API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unassigned = data?.buckets.find((b) => b.id === null) ?? null;
  const people = data?.buckets.filter((b) => b.id !== null) ?? [];
  const unassignedPct =
    data && data.totals.open > 0 ? Math.round((data.totals.unassigned / data.totals.open) * 100) : 0;

  return (
    <div className="min-h-screen bg-base-200">
      <header className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/airtable-dashboard" className="btn btn-ghost btn-sm">
                ← Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-base-content">👥 Team Workload</h1>
                <p className="text-sm text-base-content/70">
                  Every open ticket, grouped by who is responsible for it
                </p>
              </div>
            </div>
            <button onClick={load} className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-xs" /> : null}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : error ? (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            <div className="stats shadow w-full">
              <div className="stat">
                <div className="stat-title">Open tickets</div>
                <div className="stat-value">{data.totals.open}</div>
                <div className="stat-desc">
                  {data.totals.corporateOpen} corporate · {data.totals.personalOpen} personal
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Unassigned</div>
                <div className="stat-value text-error">{data.totals.unassigned}</div>
                <div className="stat-desc">{unassignedPct}% of all open work</div>
              </div>
              <div className="stat">
                <div className="stat-title">Assigned</div>
                <div className="stat-value">{data.totals.assigned}</div>
                <div className="stat-desc">across {data.totals.people} people</div>
              </div>
            </div>

            {unassigned && unassigned.total > 0 && (
              <div className="card bg-base-100 shadow-xl border-l-4 border-error">
                <div className="card-body">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="card-title">
                        Unassigned
                        <span className="badge badge-error">{unassigned.total}</span>
                      </h2>
                      <p className="text-sm text-base-content/70 mt-1">
                        Open tickets with nobody responsible. These appear in no one&apos;s queue,
                        so nothing prompts anyone to work them.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="rounded-lg border border-base-300 p-3">
                      <div className="text-xs text-base-content/60 uppercase tracking-wide mb-1">
                        Corporate
                      </div>
                      <SideCell stats={unassigned.corporate} side="corporate" id={null} />
                    </div>
                    <div className="rounded-lg border border-base-300 p-3">
                      <div className="text-xs text-base-content/60 uppercase tracking-wide mb-1">
                        Personal
                      </div>
                      <SideCell stats={unassigned.personal} side="personal" id={null} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-base-content/60 uppercase tracking-wide mb-2">
                      Most common services
                    </div>
                    <ServiceChips services={unassigned.topServices} />
                  </div>
                </div>
              </div>
            )}

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">By person</h2>
                {people.length === 0 ? (
                  <p className="text-sm text-base-content/60 py-6">No assigned tickets.</p>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <table className="table table-zebra">
                      <thead>
                        <tr>
                          <th>Person</th>
                          <th>Total</th>
                          <th>Corporate</th>
                          <th>Personal</th>
                          <th>Working on</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <div className="font-medium">{b.name}</div>
                              {b.role && (
                                <span className="badge badge-ghost badge-xs mt-1">{b.role}</span>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-primary">{b.total}</span>
                            </td>
                            <td>
                              <SideCell stats={b.corporate} side="corporate" id={b.id} />
                            </td>
                            <td>
                              <SideCell stats={b.personal} side="personal" id={b.id} />
                            </td>
                            <td className="max-w-md">
                              <ServiceChips services={b.topServices} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-base-content/50">
              Generated {new Date(data.generatedAt).toLocaleString()}. Counts every open ticket,
              including services that do not appear in the pipeline dropdowns.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
