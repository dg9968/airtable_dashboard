'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ServiceBucket {
  view: string;
  serviceName: string;
  openCount: number;
  oldestDays: number;
  avgDays: number;
}

interface DashboardData {
  corporate: ServiceBucket[];
  personal: ServiceBucket[];
}

// Rough triage coloring so the oldest, most-at-risk services jump out.
function ageBadgeClass(days: number): string {
  if (days >= 30) return 'badge-error';
  if (days >= 14) return 'badge-warning';
  return 'badge-ghost';
}

function ServiceTable({
  title,
  buckets,
  pipelineHref,
  loading,
}: {
  title: string;
  buckets: ServiceBucket[];
  pipelineHref: string;
  loading: boolean;
}) {
  const totalOpen = buckets.reduce((sum, b) => sum + b.openCount, 0);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">{title}</h2>
          <span className="badge badge-primary badge-lg">{totalOpen} open</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : buckets.length === 0 ? (
          <p className="text-sm text-base-content/60 py-6">No open tickets. 🎉</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Open Tickets</th>
                  <th>Oldest In Pipeline</th>
                  <th>Average Age</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.view}>
                    <td className="font-medium">{b.serviceName}</td>
                    <td>{b.openCount}</td>
                    <td>
                      <span className={`badge ${ageBadgeClass(b.oldestDays)}`}>
                        {b.oldestDays} day{b.oldestDays !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>{b.avgDays} day{b.avgDays !== 1 ? 's' : ''}</td>
                    <td className="text-right">
                      <Link
                        href={`${pipelineHref}?service=${encodeURIComponent(b.view)}`}
                        className="btn btn-outline btn-xs"
                      >
                        Review with Preparers →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenTicketsDashboard() {
  const [data, setData] = useState<DashboardData>({ corporate: [], personal: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/open-tickets-dashboard');
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        console.error('Failed to load open tickets dashboard:', result.error);
      }
    } catch (error) {
      console.error('Error loading open tickets dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
                <h1 className="text-2xl font-bold text-base-content">📥 Open Tickets Dashboard</h1>
                <p className="text-sm text-base-content/70">
                  Every service's open pipeline tickets and how long they've been waiting
                </p>
              </div>
            </div>
            <button onClick={load} className="btn btn-primary btn-sm">
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ServiceTable
          title="🏢 Corporate Services"
          buckets={data.corporate}
          pipelineHref="/corporate-services-pipeline"
          loading={loading}
        />
        <ServiceTable
          title="👤 Personal Services"
          buckets={data.personal}
          pipelineHref="/personal-services-pipeline"
          loading={loading}
        />
      </main>
    </div>
  );
}
