'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BillingStatusBadge from './BillingStatusBadge';
import BillingNotes from './BillingNotes';

interface ServiceRendered {
  id: string;
  serviceDate: string;
  clientName: string;
  serviceType: string;
  processor: string;
  billingStatus: string;
  amount: number;
  paymentMethod?: string;
  receiptDate?: string;
  notes?: string;
  clientType?: string;
}

export default function BillingModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceRendered[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [clientSearch, setClientSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientType, setClientType] = useState<'all' | 'personal' | 'corporate'>('all');

  // URL-based client filter
  const [filteredByClient, setFilteredByClient] = useState(false);
  const [filteredClientName, setFilteredClientName] = useState('');

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceRendered | null>(null);

  // Batch billing form
  const [batchPaymentMethod, setBatchPaymentMethod] = useState('Credit Card');
  const [batchReceiptDate, setBatchReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchCreateLedger, setBatchCreateLedger] = useState(true);

  // Individual billing form
  const [individualAmount, setIndividualAmount] = useState<number | null>(null);
  const [individualPaymentMethod, setIndividualPaymentMethod] = useState('Credit Card');
  const [individualReceiptDate, setIndividualReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [individualCreateLedger, setIndividualCreateLedger] = useState(true);

  // Mark as paid form
  const [markPaidPaymentMethod, setMarkPaidPaymentMethod] = useState('Credit Card');
  const [markPaidReceiptDate, setMarkPaidReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidCreateLedger, setMarkPaidCreateLedger] = useState(true);

  const paymentMethods = ['Credit Card', 'Cash', 'Zelle', 'Check', 'ACH', 'TPG Bank Product', 'Other', 'Not Paid Yet'];
  const paidPaymentMethods = ['Credit Card', 'Cash', 'Zelle', 'Check', 'ACH', 'TPG Bank Product', 'Other'];

  // Detect client type and client name from query parameters
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'personal' || type === 'corporate') {
      setClientType(type);
    }

    const clientNameFromUrl = searchParams.get('clientName');
    if (clientNameFromUrl) {
      setFilteredByClient(true);
      setFilteredClientName(clientNameFromUrl);
      setClientSearch(clientNameFromUrl);
    } else {
      setFilteredByClient(false);
      setFilteredClientName('');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchServices();
  }, [statusFilter, startDate, endDate, clientType]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'All') params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (clientType !== 'all') params.append('clientType', clientType);

      const response = await fetch(`/api/services-rendered?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setServices(data.data?.services || []);
      } else {
        console.error('Failed to fetch services:', data.error);
        alert('Failed to load services');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      alert('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  // Filter services by client search and status
  // "Need Review" (default) shows only actionable items: Unbilled and Billed - Unpaid
  const filteredServices = services.filter((s) => {
    // Client search filter
    if (clientSearch && !s.clientName.toLowerCase().includes(clientSearch.toLowerCase())) {
      return false;
    }
    // "Need Review" mode - only show actionable items
    if (statusFilter === 'All') {
      const actionableStatuses = ['Unbilled', 'Billed - Unpaid'];
      if (!actionableStatuses.includes(s.billingStatus)) {
        return false;
      }
    }
    return true;
  });

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedServices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedServices.size === filteredServices.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(filteredServices.map((s) => s.id)));
    }
  };

  const handleAmountChange = (serviceId: string, newAmount: number) => {
    setServices((prevServices) =>
      prevServices.map((s) =>
        s.id === serviceId ? { ...s, amount: newAmount } : s
      )
    );
  };

  const openIndividualBillingModal = (service: ServiceRendered) => {
    setSelectedService(service);
    setIndividualAmount(service.amount || null);
    setIndividualPaymentMethod('Credit Card');
    setIndividualReceiptDate(new Date().toISOString().split('T')[0]);
    setIndividualCreateLedger(true);
    setShowIndividualModal(true);
  };

  const openMarkPaidModal = (service: ServiceRendered) => {
    setSelectedService(service);
    setMarkPaidPaymentMethod('Credit Card');
    setMarkPaidReceiptDate(new Date().toISOString().split('T')[0]);
    setMarkPaidCreateLedger(true);
    setShowMarkPaidModal(true);
  };

  const openNotesModal = (service: ServiceRendered) => {
    setSelectedService(service);
    setShowNotesModal(true);
  };

  const handleIndividualBill = async () => {
    if (!selectedService || !individualAmount) {
      alert('Please enter an amount');
      return;
    }

    try {
      const billingStatus = individualPaymentMethod === 'Not Paid Yet' ? 'Billed - Unpaid' : 'Billed - Paid';
      const response = await fetch(`/api/services-rendered/${selectedService.id}/bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCharged: individualAmount,
          paymentMethod: individualPaymentMethod,
          receiptDate: individualReceiptDate,
          createLedger: individualCreateLedger,
          billingStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Service billed successfully!');
        setShowIndividualModal(false);
        setSelectedService(null);
        fetchServices();
      } else {
        alert(`Failed to bill service: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error billing service:', error);
      alert(`Failed to bill service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/services-rendered/${selectedService.id}/bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCharged: selectedService.amount || 0,
          paymentMethod: markPaidPaymentMethod,
          receiptDate: markPaidReceiptDate,
          createLedger: markPaidCreateLedger,
          billingStatus: 'Billed - Paid',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Service marked as paid!');
        setShowMarkPaidModal(false);
        setSelectedService(null);
        fetchServices();
      } else {
        alert(`Failed to mark as paid: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error marking service as paid:', error);
      alert(`Failed to mark as paid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleWaive = async (service: ServiceRendered) => {
    if (!confirm('Are you sure you want to waive this service?')) return;

    try {
      const response = await fetch(`/api/services-rendered/${service.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingStatus: 'Waived' }),
      });

      const data = await response.json();

      if (data.success) {
        fetchServices();
      } else {
        alert(`Failed to waive service: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error waiving service:', error);
      alert('Failed to waive service');
    }
  };

  const handleBatchBill = async () => {
    if (selectedServices.size === 0) {
      alert('No services selected');
      return;
    }

    try {
      const billingStatus = batchPaymentMethod === 'Not Paid Yet' ? 'Billed - Unpaid' : 'Billed - Paid';
      const response = await fetch('/api/services-rendered/batch-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: Array.from(selectedServices),
          paymentMethod: batchPaymentMethod,
          receiptDate: batchReceiptDate,
          createLedger: batchCreateLedger,
          billingStatus,
          notes: batchNotes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully billed ${selectedServices.size} service(s)!`);
        setShowBatchModal(false);
        setSelectedServices(new Set());
        setBatchNotes('');
        fetchServices();
      } else {
        alert(`Failed to batch bill: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error batch billing:', error);
      alert(`Failed to batch bill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearFilters = () => {
    setStatusFilter('All');
    setClientType('all');
    setClientSearch('');
    setStartDate('');
    setEndDate('');
    setFilteredByClient(false);
    setFilteredClientName('');
    router.push('/billing');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate statistics for displayed services
  const totalServices = filteredServices.length;
  const unbilledCount = filteredServices.filter((s) => s.billingStatus === 'Unbilled').length;
  const unpaidCount = filteredServices.filter((s) => s.billingStatus === 'Billed - Unpaid').length;
  const totalAmount = filteredServices.reduce((sum, s) => sum + (s.amount || 0), 0);

  const hasActiveFilters = statusFilter !== 'All' || clientType !== 'all' || clientSearch || startDate || endDate;

  return (
    <div className="min-h-screen bg-base-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm mb-4">
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Billing Module</h1>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => fetchServices()}
                disabled={loading}
                title="Refresh"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            onClick={() => router.push('/ledger')}
            className="btn btn-primary btn-sm"
          >
            View Revenue Ledger →
          </button>
        </div>

        {/* Statistics */}
        <div className="stats shadow w-full">
          <div className="stat">
            <div className="stat-title">Total</div>
            <div className="stat-value text-2xl">{totalServices}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Unbilled</div>
            <div className="stat-value text-2xl text-warning">{unbilledCount}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Unpaid</div>
            <div className="stat-value text-2xl text-error">{unpaidCount}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Total Amount</div>
            <div className="stat-value text-2xl">${totalAmount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Status Filter */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">Status</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">Need Review</option>
                <option value="Unbilled">Unbilled</option>
                <option value="Billed - Unpaid">Billed - Unpaid</option>
                <option value="Billed - Paid">Billed - Paid</option>
                <option value="Waived">Waived</option>
                <option value="Part of Subscription">Part of Subscription</option>
              </select>
            </div>

            {/* Client Type Filter */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">Client Type</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={clientType}
                onChange={(e) => setClientType(e.target.value as 'all' | 'personal' | 'corporate')}
              >
                <option value="all">All Types</option>
                <option value="personal">Personal</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>

            {/* Client Search */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">Client Search</span>
              </label>
              <input
                type="text"
                placeholder="Search..."
                className="input input-bordered input-sm w-40"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>

            {/* Start Date */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">Start Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">End Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Clear Filters
              </button>
            )}

            {/* Batch Bill Button */}
            {selectedServices.size > 0 && (
              <button
                className="btn btn-primary btn-sm ml-auto"
                onClick={() => setShowBatchModal(true)}
              >
                Batch Bill ({selectedServices.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client Filter Banner */}
      {filteredByClient && (
        <div className="alert alert-info mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div className="flex-1">
            <div className="font-bold">Filtered by Client</div>
            <div className="text-sm">Showing services for: {filteredClientName}</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Clear Filter
          </button>
        </div>
      )}

      {/* Services Table */}
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No services found with the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedServices.size === filteredServices.length && filteredServices.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Status</th>
                    <th>Client</th>
                    <th>Service Rendered</th>
                    <th>Processor</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedServices.has(service.id)}
                          onChange={() => toggleSelection(service.id)}
                        />
                      </td>
                      <td>
                        <BillingStatusBadge status={service.billingStatus} size="sm" />
                      </td>
                      <td>
                        <div className="font-medium">{service.clientName}</div>
                        {service.clientType && (
                          <div className="text-xs opacity-60 capitalize">{service.clientType}</div>
                        )}
                      </td>
                      <td>{service.serviceType || 'N/A'}</td>
                      <td>{service.processor || 'N/A'}</td>
                      <td className="text-sm">{formatDate(service.serviceDate)}</td>
                      <td>
                        {service.billingStatus === 'Unbilled' ? (
                          <div className="flex items-center gap-1">
                            <span>$</span>
                            <input
                              type="number"
                              className="input input-bordered input-sm w-20"
                              value={service.amount || ''}
                              onChange={(e) => handleAmountChange(service.id, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        ) : (
                          `$${service.amount?.toLocaleString() || '0'}`
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openNotesModal(service)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Notes
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {service.billingStatus === 'Unbilled' && (
                            <>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => openIndividualBillingModal(service)}
                              >
                                Bill
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleWaive(service)}
                              >
                                Waive
                              </button>
                            </>
                          )}
                          {service.billingStatus === 'Billed - Unpaid' && (
                            <button
                              className="btn btn-success btn-xs"
                              onClick={() => openMarkPaidModal(service)}
                            >
                              Mark Paid
                            </button>
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

      {/* Notes Modal */}
      {showNotesModal && selectedService && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => {
                setShowNotesModal(false);
                setSelectedService(null);
              }}
            >
              ✕
            </button>
            <BillingNotes
              serviceRenderedId={selectedService.id}
              clientName={selectedService.clientName}
              serviceName={selectedService.serviceType}
            />
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowNotesModal(false);
              setSelectedService(null);
            }}
          />
        </div>
      )}

      {/* Batch Billing Modal */}
      {showBatchModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Batch Bill Selected Services</h3>
            <p className="mb-4">
              Billing {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} -
              Total: ${services.filter((s) => selectedServices.has(s.id)).reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString()}
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Payment Method</span>
              </label>
              <select
                className="select select-bordered"
                value={batchPaymentMethod}
                onChange={(e) => setBatchPaymentMethod(e.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Receipt Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={batchReceiptDate}
                onChange={(e) => setBatchReceiptDate(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Notes (Optional)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                placeholder="Add billing notes..."
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label cursor-pointer">
                <span className="label-text">Create Ledger Entry</span>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={batchCreateLedger}
                  onChange={(e) => setBatchCreateLedger(e.target.checked)}
                />
              </label>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowBatchModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBatchBill}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Billing Modal */}
      {showIndividualModal && selectedService && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Bill Service</h3>
            <p className="mb-4">
              Client: {selectedService.clientName || 'Unknown'}<br />
              Service: {selectedService.serviceType || 'N/A'}
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Amount Charged</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={individualAmount || ''}
                onChange={(e) => setIndividualAmount(parseFloat(e.target.value) || null)}
                placeholder="Enter amount"
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Payment Method</span>
              </label>
              <select
                className="select select-bordered"
                value={individualPaymentMethod}
                onChange={(e) => setIndividualPaymentMethod(e.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Receipt Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={individualReceiptDate}
                onChange={(e) => setIndividualReceiptDate(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label cursor-pointer">
                <span className="label-text">Create Ledger Entry</span>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={individualCreateLedger}
                  onChange={(e) => setIndividualCreateLedger(e.target.checked)}
                />
              </label>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowIndividualModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleIndividualBill}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showMarkPaidModal && selectedService && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Mark as Paid</h3>
            <p className="mb-4">
              Client: {selectedService.clientName || 'Unknown'}<br />
              Service: {selectedService.serviceType || 'N/A'}<br />
              Amount: ${selectedService.amount?.toLocaleString() || '0'}
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Payment Method</span>
              </label>
              <select
                className="select select-bordered"
                value={markPaidPaymentMethod}
                onChange={(e) => setMarkPaidPaymentMethod(e.target.value)}
              >
                {paidPaymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Receipt Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={markPaidReceiptDate}
                onChange={(e) => setMarkPaidReceiptDate(e.target.value)}
              />
            </div>

            <div className="form-control mb-4">
              <label className="label cursor-pointer">
                <span className="label-text">Create Ledger Entry</span>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={markPaidCreateLedger}
                  onChange={(e) => setMarkPaidCreateLedger(e.target.checked)}
                />
              </label>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowMarkPaidModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleMarkAsPaid}>
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
