'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CheckRow {
  id: string;
  client: string | null;
  service: string | null;
  date: string | null;
  amount: number | null;
  status: string | null;
  processor: string | null;
  clientType: 'corporate' | 'personal' | null;
  ageDays: number | null;
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

interface Check {
  key: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  count: number;
  amount: number | null;
  rows: CheckRow[];
  truncated: boolean;
  buckets?: AgingBucket[];
}

interface ReportData {
  generatedAt: string;
  detailLimit: number;
  totalAtRisk: number;
  totalFindings: number;
  checks: Check[];
}

const money = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function severityClass(severity: Check['severity'], count: number): string {
  if (count === 0) return 'badge-success';
  return severity === 'critical' ? 'badge-error' : 'badge-warning';
}

// Age coloring mirrors the aging buckets so a row's urgency reads the same
// way in the detail table as it does in the bucket strip above it.
function ageBadgeClass(days: number | null): string {
  if (days == null) return 'badge-ghost';
  if (days > 90) return 'badge-error';
  if (days > 60) return 'badge-warning';
  return 'badge-ghost';
}

function toCsv(check: Check): string {
  const header = ['id', 'client', 'clientType', 'service', 'date', 'ageDays', 'amount', 'status', 'processor'];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = check.rows.map((r) =>
    [r.id, r.client, r.clientType, r.service, r.date, r.ageDays, r.amount, r.status, r.processor]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

function downloadCsv(check: Check) {
  const blob = new Blob([toCsv(check)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${check.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CheckCard({ check }: { check: Check }) {
  const [expanded, setExpanded] = useState(false);
  const clean = check.count === 0;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-64">
            <h2 className="card-title text-lg">
              {check.title}
              <span className={`badge ${severityClass(check.severity, check.count)}`}>
                {check.count}
              </span>
            </h2>
            <p className="text-sm text-base-content/70 mt-1">{check.description}</p>
          </div>
          {check.amount != null && (
            <div className="text-right">
              <div className="text-xs text-base-content/60 uppercase tracking-wide">Total</div>
              <div className="text-2xl font-bold font-mono text-error">{money(check.amount)}</div>
            </div>
          )}
        </div>

        {clean ? (
          <p className="text-sm text-success mt-3">Nothing flagged. ✅</p>
        ) : (
          <>
            {check.buckets && check.buckets.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {check.buckets.map((b) => (
                  <div key={b.label} className="rounded-lg border border-base-300 p-3">
                    <div className="text-xs text-base-content/60">{b.label}</div>
                    <div className="font-mono font-bold">{money(b.amount)}</div>
                    <div className="text-xs text-base-content/60">
                      {b.count} record{b.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button className="btn btn-sm btn-outline" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Hide' : 'Show'} {Math.min(check.rows.length, check.count)} record
                {check.rows.length !== 1 ? 's' : ''}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => downloadCsv(check)}>
                ⬇ Export CSV
              </button>
              {check.truncated && (
                <span className="text-xs text-base-content/60">
                  Showing the {check.rows.length} oldest of {check.count} — export includes the same
                  {' '}{check.rows.length}.
                </span>
              )}
            </div>

            {expanded && (
              <div className="overflow-x-auto mt-3">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Service</th>
                      <th>Date</th>
                      <th>Age</th>
                      <th className="text-right">Amount</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.client || '—'}</td>
                        <td>{r.service || '—'}</td>
                        <td className="font-mono text-xs">{r.date || '—'}</td>
                        <td>
                          <span className={`badge badge-sm ${ageBadgeClass(r.ageDays)}`}>
                            {r.ageDays == null ? '—' : `${r.ageDays}d`}
                          </span>
                        </td>
                        <td className="text-right font-mono">{money(r.amount)}</td>
                        <td className="text-xs">{r.status || '—'}</td>
                        <td className="text-right">
                          <Link
                            href={
                              check.key === 'completed-not-billed'
                                ? r.clientType === 'personal'
                                  ? '/personal-services-pipeline'
                                  : '/corporate-services-pipeline'
                                : `/billing?type=${r.clientType || 'corporate'}`
                            }
                            className="btn btn-ghost btn-xs"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingReconciliation() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/billing-reconciliation');
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to run reconciliation');
      }
    } catch (err) {
      console.error('Error loading billing reconciliation:', err);
      setError('Could not reach the API server');
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
              <Link href="/business-management" className="btn btn-ghost btn-sm">
                ← Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-base-content">🧾 Billing Reconciliation</h1>
                <p className="text-sm text-base-content/70">
                  Work that was done but never charged, priced, or collected
                </p>
              </div>
            </div>
            <button onClick={load} className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-xs" /> : null}
              Re-run
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
                <div className="stat-title">Money at risk</div>
                <div className="stat-value text-error font-mono">{money(data.totalAtRisk)}</div>
                <div className="stat-desc">Unbilled work plus uncollected invoices</div>
              </div>
              <div className="stat">
                <div className="stat-title">Total findings</div>
                <div className="stat-value">{data.totalFindings}</div>
                <div className="stat-desc">
                  Checks overlap — a record with no amount is also counted as unbilled
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Last run</div>
                <div className="stat-value text-base font-normal">
                  {new Date(data.generatedAt).toLocaleString()}
                </div>
                <div className="stat-desc">Read-only — this report changes nothing</div>
              </div>
            </div>

            {data.checks.map((check) => (
              <CheckCard key={check.key} check={check} />
            ))}
          </>
        ) : null}
      </main>
    </div>
  );
}
