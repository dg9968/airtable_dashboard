'use client';

import { useState, useEffect } from 'react';
import SigningStatusBadge from './SigningStatusBadge';

interface Envelope {
  id: string;
  'Envelope ID'?: string;
  Status: string;
  'Client Type': string;
  'Signer Email': string;
  'Signer Name': string;
  'Tax Year': string;
  'Document Type': string;
  'Sent At'?: string;
  'Completed At'?: string;
  'Error Message'?: string;
  'Created By'?: string;
  Personal?: string[];
  Corporation?: string[];
}

export default function SigningDashboard() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('');
  const [taxYearFilter, setTaxYearFilter] = useState<string>('');

  const fetchEnvelopes = async () => {
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (clientTypeFilter) params.append('clientType', clientTypeFilter);
      if (taxYearFilter) params.append('taxYear', taxYearFilter);

      const url = `${apiUrl}/api/docusign/envelopes${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch envelopes');
      }

      setEnvelopes(result.envelopes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch envelopes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvelopes();
  }, [statusFilter, clientTypeFilter, taxYearFilter]);

  const handleVoid = async (envelopeId: string) => {
    if (!confirm('Are you sure you want to void this signing request?')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/docusign/void/${envelopeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Voided by user' }),
      });

      if (response.ok) {
        fetchEnvelopes();
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to void envelope');
      }
    } catch (err) {
      alert('Failed to void envelope');
    }
  };

  const handleResend = async (envelopeId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/docusign/resend/${envelopeId}`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Resend notification sent');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to resend');
      }
    } catch (err) {
      alert('Failed to resend');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusOptions = ['Created', 'Sent', 'Delivered', 'Viewed', 'Signed', 'Completed', 'Declined', 'Voided'];
  const taxYearOptions = ['2022', '2023', '2024', '2025', '2026'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-primary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
            />
          </svg>
          Signing Dashboard
        </h1>
        <button className="btn btn-primary btn-sm" onClick={fetchEnvelopes}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3">
          <div className="flex flex-wrap gap-4">
            <div className="form-control">
              <label className="label label-text text-xs">Status</label>
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label label-text text-xs">Client Type</label>
              <select
                className="select select-bordered select-sm"
                value={clientTypeFilter}
                onChange={(e) => setClientTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="personal">Personal</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label label-text text-xs">Tax Year</label>
              <select
                className="select select-bordered select-sm"
                value={taxYearFilter}
                onChange={(e) => setTaxYearFilter(e.target.value)}
              >
                <option value="">All Years</option>
                {taxYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter || clientTypeFilter || taxYearFilter) && (
              <div className="form-control justify-end">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStatusFilter('');
                    setClientTypeFilter('');
                    setTaxYearFilter('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-title">Total</div>
          <div className="stat-value text-2xl">{envelopes.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value text-2xl text-warning">
            {envelopes.filter((e) => ['Sent', 'Delivered', 'Viewed'].includes(e.Status)).length}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Completed</div>
          <div className="stat-value text-2xl text-success">
            {envelopes.filter((e) => ['Signed', 'Completed'].includes(e.Status)).length}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Issues</div>
          <div className="stat-value text-2xl text-error">
            {envelopes.filter((e) => ['Declined', 'Voided'].includes(e.Status) || e['Error Message']).length}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : envelopes.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p>No signing requests found</p>
              <p className="text-sm mt-2">Send documents for signing from the Document Management page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Signer</th>
                    <th>Document Type</th>
                    <th>Tax Year</th>
                    <th>Client Type</th>
                    <th>Sent</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopes.map((envelope) => (
                    <tr key={envelope.id}>
                      <td>
                        <SigningStatusBadge status={envelope.Status as any} size="sm" />
                        {envelope['Error Message'] && (
                          <div className="tooltip tooltip-right" data-tip={envelope['Error Message']}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-error ml-1 inline">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium">{envelope['Signer Name']}</div>
                        <div className="text-sm opacity-60">{envelope['Signer Email']}</div>
                      </td>
                      <td>{envelope['Document Type']}</td>
                      <td>{envelope['Tax Year']}</td>
                      <td>
                        <span className={`badge badge-sm ${envelope['Client Type'] === 'Personal' ? 'badge-primary' : 'badge-secondary'}`}>
                          {envelope['Client Type']}
                        </span>
                      </td>
                      <td className="text-sm">{formatDate(envelope['Sent At'])}</td>
                      <td className="text-sm">{formatDate(envelope['Completed At'])}</td>
                      <td>
                        <div className="flex gap-1">
                          {['Sent', 'Delivered', 'Viewed'].includes(envelope.Status) && (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleResend(envelope.id)}
                                title="Resend notification"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-error"
                                onClick={() => handleVoid(envelope.id)}
                                title="Void"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
