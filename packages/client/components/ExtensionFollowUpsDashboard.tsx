'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getDaysUntilDeadline,
  getDeadlineUrgency,
  urgencyToBadgeClass,
  formatDaysLabel,
  formatDeadlineDate,
} from '@/lib/extensionHelpers';

interface FollowUpRow {
  extensionTicketId: string;
  followUpTicketId: string;
  followUpStatus: string | null;
  name: string;
  taxYear: number | null;
  filedDate: string | null;
  dueDate: string | null;
  corporationId?: string | null;
  personalId?: string | null;
}

interface DashboardData {
  corporate: FollowUpRow[];
  personal: FollowUpRow[];
}

function DeadlineBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-base-content/50">—</span>;
  const date = new Date(dueDate);
  const days = getDaysUntilDeadline(date);
  const urgency = getDeadlineUrgency(days);
  return (
    <span className={`badge ${urgencyToBadgeClass(urgency)} font-mono`}>
      {formatDaysLabel(days)}
    </span>
  );
}

function FollowUpTable({
  title,
  rows,
  pipelineHref,
  idParam,
  loading,
}: {
  title: string;
  rows: FollowUpRow[];
  pipelineHref: string;
  idParam: 'companyId' | 'personalId';
  loading: boolean;
}) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">{title}</h2>
          <span className="badge badge-primary badge-lg">{rows.length} awaiting return</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-base-content/60 py-6">No filed extensions awaiting a return. 🎉</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Tax Year</th>
                  <th>Filed</th>
                  <th>Extended Due Date</th>
                  <th>Days Remaining</th>
                  <th>Follow-up Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const linkId = idParam === 'companyId' ? r.corporationId : r.personalId;
                  const query = new URLSearchParams({ service: title.includes('Corporate') ? 'Tax Returns' : 'Tax Prep Pipeline' });
                  if (linkId) query.set(idParam, linkId);
                  return (
                    <tr key={r.extensionTicketId}>
                      <td className="font-medium">{r.name}</td>
                      <td>{r.taxYear ?? '—'}</td>
                      <td>{r.filedDate ?? '—'}</td>
                      <td>{r.dueDate ? formatDeadlineDate(new Date(r.dueDate)) : '—'}</td>
                      <td>
                        <DeadlineBadge dueDate={r.dueDate} />
                      </td>
                      <td>{r.followUpStatus || 'Not Started'}</td>
                      <td className="text-right">
                        <Link href={`${pipelineHref}?${query.toString()}`} className="btn btn-outline btn-xs">
                          Open Return Ticket →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExtensionFollowUpsDashboard() {
  const [data, setData] = useState<DashboardData>({ corporate: [], personal: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/extension-followups');
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        console.error('Failed to load extension follow-ups:', result.error);
      }
    } catch (error) {
      console.error('Error loading extension follow-ups:', error);
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
                <h1 className="text-2xl font-bold text-base-content">⏳ Extension Follow-Ups</h1>
                <p className="text-sm text-base-content/70">
                  Clients whose extension was filed — track the actual return before the extended deadline
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
        <FollowUpTable
          title="🏢 Corporate Extensions"
          rows={data.corporate}
          pipelineHref="/corporate-services-pipeline"
          idParam="companyId"
          loading={loading}
        />
        <FollowUpTable
          title="👤 Personal Extensions"
          rows={data.personal}
          pipelineHref="/personal-services-pipeline"
          idParam="personalId"
          loading={loading}
        />
      </main>
    </div>
  );
}
