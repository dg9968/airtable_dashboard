'use client';

import { useEffect, useState } from 'react';
import {
  getPersonalOriginalDueDate,
  getPersonalExtensionDueDate,
  getDaysUntilDeadline,
  getDeadlineUrgency,
  formatDeadlineDate,
  inferPersonalTaxYear,
  urgencyToBadgeClass,
  formatDaysLabel,
} from '@/lib/extensionHelpers';

interface ClientData {
  id: string;
  clientName: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  clientCode: string;
}

interface ExtensionData {
  taxYear: number | null;
  estimatedTax: number | null;
  paymentsCredits: number | null;
  status: string;
  filedDate: string | null;
}

interface PersonalExtensionDetailModalProps {
  subscriptionId: string;
  clientName: string;
  onClose: () => void;
  onStatusUpdated: (subscriptionId: string, newStatus: string) => void;
}

export default function PersonalExtensionDetailModal({
  subscriptionId,
  clientName,
  onClose,
  onStatusUpdated,
}: PersonalExtensionDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [extensionData, setExtensionData] = useState<ExtensionData | null>(null);

  const [taxYear, setTaxYear] = useState('');
  const [estimatedTax, setEstimatedTax] = useState('');
  const [paymentsCredits, setPaymentsCredits] = useState('');
  const [extensionStatus, setExtensionStatus] = useState('Not Filed');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/extensions-personal/${subscriptionId}`);
        const json = await res.json();
        if (json.success) {
          const { client: c, subscription: s } = json.data;
          setClient(c);
          setExtensionData(s);

          const inferredYear = inferPersonalTaxYear();
          setTaxYear(s.taxYear?.toString() || inferredYear.toString());
          setEstimatedTax(s.estimatedTax != null ? s.estimatedTax.toString() : '');
          setPaymentsCredits(s.paymentsCredits != null ? s.paymentsCredits.toString() : '');
          setExtensionStatus(s.status || 'Not Filed');
        }
      } catch (err) {
        console.error('Failed to fetch personal extension data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [subscriptionId]);

  const parsedEstimatedTax = parseFloat(estimatedTax) || 0;
  const parsedPaymentsCredits = parseFloat(paymentsCredits) || 0;
  const balanceDue = parsedEstimatedTax - parsedPaymentsCredits;

  const taxYearNum = parseInt(taxYear) || inferPersonalTaxYear();
  const originalDueDate = getPersonalOriginalDueDate(taxYearNum);
  const extensionDueDate = getPersonalExtensionDueDate(taxYearNum);
  const daysRemaining = getDaysUntilDeadline(extensionDueDate);
  const urgency = getDeadlineUrgency(daysRemaining);
  const badgeClass = urgencyToBadgeClass(urgency);

  async function handleSave(overrideFields?: Record<string, any>) {
    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const fields: Record<string, any> = {
        'Extension Tax Year': parseInt(taxYear) || null,
        'Extension Estimated Tax': parsedEstimatedTax || null,
        'Extension Payments Credits': parsedPaymentsCredits || null,
        'Extension Status': extensionStatus,
        ...overrideFields,
      };

      const res = await fetch(`${apiUrl}/api/extensions-personal/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      if (json.success) {
        if (overrideFields?.['Extension Status']) {
          onStatusUpdated(subscriptionId, overrideFields['Extension Status']);
        } else {
          onStatusUpdated(subscriptionId, extensionStatus);
        }
      }
    } catch (err) {
      console.error('Failed to save personal extension data:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAsFiled() {
    const today = new Date().toISOString().split('T')[0];
    setExtensionStatus('Filed');
    await handleSave({
      'Extension Status': 'Filed',
      'Extension Filed Date': today,
    });
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await handleSave();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/extensions-personal/${subscriptionId}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form4868_${(client?.clientName || clientName).replace(/[^a-zA-Z0-9]/g, '_')}_${taxYearNum}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6">
            <h3 className="font-bold text-xl mb-1">{client?.clientName || clientName}</h3>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary text-xs">Form 4868 — Personal Extension</span>
              {client?.clientCode && (
                <span className="badge badge-outline text-xs font-mono">
                  Code: {client.clientCode}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Form Details */}
            <div className="card bg-base-200">
              <div className="card-body p-4">
                <h4 className="card-title text-sm">Form Details</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Form</span>
                    <span className="font-medium">Form 4868 — Application for Extension</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/60">Tax Year</span>
                    <input
                      type="number"
                      className="input input-xs input-bordered w-24 text-right"
                      value={taxYear}
                      onChange={(e) => setTaxYear(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Original Due Date</span>
                    <span className="font-medium">{formatDeadlineDate(originalDueDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div className="card bg-base-200">
              <div className="card-body p-4">
                <h4 className="card-title text-sm">Extension Deadline</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/60">Extended Due Date</span>
                    <span className="font-medium">{formatDeadlineDate(extensionDueDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/60">Days Remaining</span>
                    <span className={`badge ${badgeClass} font-mono`}>
                      {formatDaysLabel(daysRemaining)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/60">Filing Status</span>
                    <select
                      className="select select-xs select-bordered"
                      value={extensionStatus}
                      onChange={(e) => setExtensionStatus(e.target.value)}
                    >
                      <option>Not Filed</option>
                      <option>Filed</option>
                      <option>Confirmed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Calculation */}
          <div className="card bg-base-200 mb-6">
            <div className="card-body p-4">
              <h4 className="card-title text-sm">Tax Calculation (Form 4868 Part II)</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="w-64 text-sm text-base-content/60">
                    Line 4 — Estimated Total Tax Liability
                  </label>
                  <div className="join">
                    <span className="join-item btn btn-sm btn-disabled btn-ghost px-2">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="input input-sm input-bordered join-item w-40"
                      value={estimatedTax}
                      onChange={(e) => setEstimatedTax(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="w-64 text-sm text-base-content/60">
                    Line 5 — Total Payments
                  </label>
                  <div className="join">
                    <span className="join-item btn btn-sm btn-disabled btn-ghost px-2">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="input input-sm input-bordered join-item w-40"
                      value={paymentsCredits}
                      onChange={(e) => setPaymentsCredits(e.target.value)}
                    />
                  </div>
                </div>
                <div className="divider my-1" />
                <div className="flex items-center gap-4">
                  <label className="w-64 text-sm font-medium">
                    Line 6 — Balance Due
                  </label>
                  <div
                    className={`font-mono font-bold text-lg ${
                      balanceDue > 0 ? 'text-error' : 'text-success'
                    }`}
                  >
                    ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {balanceDue > 0 && (
                  <div className="alert alert-warning py-2 text-xs">
                    Tax balance due must be paid by the <strong>original</strong> due date (
                    {formatDeadlineDate(originalDueDate)}). Form 4868 extends time to file, not
                    time to pay.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-action flex flex-wrap gap-2 justify-end">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleDownloadPdf}
              disabled={downloading || saving}
              title="Download filled IRS Form 4868 PDF"
            >
              {downloading
                ? <span className="loading loading-spinner loading-xs" />
                : '📥'}
              {' '}Download Form 4868
            </button>
            <button
              className="btn btn-success"
              onClick={handleMarkAsFiled}
              disabled={saving || extensionStatus === 'Filed'}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : null}
              ✓ Mark as Filed
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSave()}
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : null}
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
