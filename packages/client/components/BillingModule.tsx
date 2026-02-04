'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
}

interface GroupedServices {
  clientName: string;
  services: ServiceRendered[];
  totalAmount: number;
}

export default function BillingModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceRendered[]>([]);
  const [groupedServices, setGroupedServices] = useState<GroupedServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState('Unbilled');
  const [clientSearch, setClientSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [processorFilter, setProcessorFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'client' | 'processor' | 'date'>('client');
  const [clientType, setClientType] = useState<'all' | 'personal' | 'corporate'>('all');

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
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

  // Detect client type from query parameter
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'personal' || type === 'corporate') {
      setClientType(type);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchServices();
  }, [statusFilter, startDate, endDate, processorFilter, clientType]);

  useEffect(() => {
    groupServices();
  }, [services, groupBy, clientSearch]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'All') params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (processorFilter) params.append('processor', processorFilter);
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

  const groupServices = () => {
    let filtered = services;

    // Apply client search filter
    if (clientSearch) {
      filtered = filtered.filter((s) =>
        s.clientName.toLowerCase().includes(clientSearch.toLowerCase())
      );
    }

    // Group services
    const grouped: { [key: string]: ServiceRendered[] } = {};

    filtered.forEach((service) => {
      let key = '';

      if (groupBy === 'client') {
        key = service.clientName || 'Unknown Client';
      } else if (groupBy === 'processor') {
        key = service.processor || 'Unknown Processor';
      } else {
        key = service.serviceDate || 'Unknown Date';
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(service);
    });

    // Convert to array and calculate totals
    const groupedArray: GroupedServices[] = Object.entries(grouped).map(([name, svcs]) => ({
      clientName: name,
      services: svcs,
      totalAmount: svcs.reduce((sum, s) => sum + (s.amount || 0), 0),
    }));

    // Sort by name
    groupedArray.sort((a, b) => a.clientName.localeCompare(b.clientName));

    setGroupedServices(groupedArray);
  };

  const toggleSelection = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const toggleGroupSelection = (group: GroupedServices) => {
    const newSelected = new Set(selectedServices);
    const allSelected = group.services.every((s) => newSelected.has(s.id));

    if (allSelected) {
      // Deselect all
      group.services.forEach((s) => newSelected.delete(s.id));
    } else {
      // Select all
      group.services.forEach((s) => newSelected.add(s.id));
    }

    setSelectedServices(newSelected);
  };

  const toggleGroupExpanded = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleBatchBill = async () => {
    if (selectedServices.size === 0) {
      alert('Please select at least one service to bill');
      return;
    }

    try {
      const selectedList = Array.from(selectedServices);
      const totalAmount = services
        .filter((s) => selectedList.includes(s.id))
        .reduce((sum, s) => sum + (s.amount || 0), 0);

      const response = await fetch('/api/services-rendered/batch-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedList,
          paymentMethod: batchPaymentMethod,
          receiptDate: batchReceiptDate,
          totalAmount,
          createLedger: batchCreateLedger,
          billingStatus: batchPaymentMethod === 'Not Paid Yet' ? 'Billed - Unpaid' : 'Billed - Paid',
          notes: batchNotes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully billed ${selectedList.length} services!`);
        setShowBatchModal(false);
        setSelectedServices(new Set());
        setBatchNotes('');
        fetchServices();
      } else {
        alert(`Failed to bill services: ${data.error}`);
      }
    } catch (error) {
      console.error('Error batch billing:', error);
      alert('Failed to bill services');
    }
  };

  const handleIndividualBill = async () => {
    if (!selectedService) return;

    const amount = individualAmount || selectedService.amount || 0;

    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      console.log('[BillingModule] Billing service:', selectedService.id);
      console.log('[BillingModule] Amount:', amount);
      console.log('[BillingModule] Payment method:', individualPaymentMethod);
      console.log('[BillingModule] Receipt date:', individualReceiptDate);

      const response = await fetch(`/api/services-rendered/${selectedService.id}/bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCharged: amount,
          paymentMethod: individualPaymentMethod,
          receiptDate: individualReceiptDate,
          createLedger: individualCreateLedger,
          billingStatus: individualPaymentMethod === 'Not Paid Yet' ? 'Billed - Unpaid' : 'Billed - Paid',
        }),
      });

      console.log('[BillingModule] Response status:', response.status);
      const data = await response.json();
      console.log('[BillingModule] Response data:', data);

      if (data.success) {
        alert('Service billed successfully!');
        setShowIndividualModal(false);
        setSelectedService(null);
        setIndividualAmount(null);
        fetchServices();
      } else {
        console.error('[BillingModule] Billing failed:', data.error);
        alert(`Failed to bill service: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[BillingModule] Error billing service:', error);
      alert(`Failed to bill service: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Calculate statistics
  const totalUnbilled = services.filter((s) => s.billingStatus === 'Unbilled').length;
  const totalAmount = services.reduce((sum, s) => sum + (s.amount || 0), 0);
  const uniqueClients = new Set(services.map((s) => s.clientName || 'Unknown')).size;

  return (
    <div className="min-h-screen bg-base-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm mb-4">
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">Billing Module</h1>
          </div>
          <button
            onClick={() => router.push('/ledger')}
            className="btn btn-primary btn-sm"
          >
            View Revenue Ledger →
          </button>
        </div>

        {/* Statistics */}
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total Unbilled Services</div>
            <div className="stat-value text-primary">{totalUnbilled}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Total Amount</div>
            <div className="stat-value text-secondary">${totalAmount.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Unique Clients</div>
            <div className="stat-value">{uniqueClients}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Status Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Unbilled">Unbilled</option>
                <option value="Billed - Paid">Billed - Paid</option>
                <option value="Billed - Unpaid">Billed - Unpaid</option>
                <option value="Waived">Waived</option>
                <option value="All">All</option>
              </select>
            </div>

            {/* Client Type Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Client Type</span>
              </label>
              <div className="btn-group w-full">
                <button
                  className={`btn btn-sm flex-1 ${clientType === 'all' ? 'btn-active' : ''}`}
                  onClick={() => setClientType('all')}
                >
                  All
                </button>
                <button
                  className={`btn btn-sm flex-1 ${clientType === 'personal' ? 'btn-active' : ''}`}
                  onClick={() => setClientType('personal')}
                >
                  Personal
                </button>
                <button
                  className={`btn btn-sm flex-1 ${clientType === 'corporate' ? 'btn-active' : ''}`}
                  onClick={() => setClientType('corporate')}
                >
                  Corporate
                </button>
              </div>
            </div>

            {/* Client Search */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Client Search</span>
              </label>
              <input
                type="text"
                placeholder="Search client name..."
                className="input input-bordered"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>

            {/* Start Date */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Start Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">End Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Group By */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Group By</span>
              </label>
              <select
                className="select select-bordered"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'client' | 'processor' | 'date')}
              >
                <option value="client">Client/Company</option>
                <option value="processor">Processor</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>

          {/* Batch Bill Button */}
          {selectedServices.size > 0 && (
            <div className="mt-4">
              <button
                className="btn btn-primary"
                onClick={() => setShowBatchModal(true)}
              >
                Batch Bill Selected ({selectedServices.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Services Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : groupedServices.length === 0 ? (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <p className="text-center text-gray-500">No services found with the selected filters.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedServices.map((group) => {
            const isExpanded = expandedGroups.has(group.clientName);
            const allSelected = group.services.every((s) => selectedServices.has(s.id));
            const someSelected = group.services.some((s) => selectedServices.has(s.id));

            return (
              <div key={group.clientName} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  {/* Group Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={() => toggleGroupSelection(group)}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleGroupExpanded(group.clientName)}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      <div>
                        <h3 className="text-xl font-bold">{group.clientName}</h3>
                        <p className="text-sm text-gray-500">
                          {group.services.length} service{group.services.length !== 1 ? 's' : ''} •
                          Total: ${group.totalAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group Services */}
                  {isExpanded && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="table table-zebra">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Service Type</th>
                            <th>Processor</th>
                            <th>Service Date</th>
                            <th>Amount</th>
                            <th>Notes</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.services.map((service) => (
                            <tr key={service.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={selectedServices.has(service.id)}
                                  onChange={() => toggleSelection(service.id)}
                                />
                              </td>
                              <td>{service.serviceType || 'N/A'}</td>
                              <td>{service.processor || 'N/A'}</td>
                              <td>{service.serviceDate}</td>
                              <td>
                                {service.billingStatus === 'Unbilled' ? (
                                  <div className="flex items-center gap-1">
                                    <span>$</span>
                                    <input
                                      type="number"
                                      className="input input-bordered input-sm w-24"
                                      value={service.amount || ''}
                                      onChange={(e) =>
                                        handleAmountChange(service.id, parseFloat(e.target.value) || 0)
                                      }
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
                                {service.notes ? (
                                  <div className="tooltip tooltip-left" data-tip={service.notes}>
                                    <span className="text-sm text-base-content/70 line-clamp-2 max-w-xs cursor-help">
                                      {service.notes}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-base-content/40 italic">No notes</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${
                                  service.billingStatus === 'Unbilled' ? 'badge-warning' :
                                  service.billingStatus === 'Billed - Paid' ? 'badge-success' :
                                  service.billingStatus === 'Billed - Unpaid' ? 'badge-error' :
                                  'badge-ghost'
                                }`}>
                                  {service.billingStatus}
                                </span>
                              </td>
                              <td>
                                {service.billingStatus === 'Unbilled' && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => openIndividualBillingModal(service)}
                                  >
                                    Bill This
                                  </button>
                                )}
                                {service.billingStatus === 'Billed - Unpaid' && (
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => openMarkPaidModal(service)}
                                  >
                                    Mark as Paid
                                  </button>
                                )}
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
          })}
        </div>
      )}

      {/* Batch Billing Modal */}
      {showBatchModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Batch Bill Selected Services</h3>
            <p className="mb-4">
              Billing {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} •
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
