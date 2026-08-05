'use client';

import { useState, useEffect, useCallback } from 'react';

interface CorporateService {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  category: string | null;
  billingCycle: string | null;
  vendorCost: number | null;
  vendorName: string | null;
  status: string;
}

interface PersonalService {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
}

interface CorporateFormData {
  name: string;
  price: string;
  description: string;
  category: string;
  billingCycle: string;
  vendorCost: string;
  vendorName: string;
}

interface PersonalFormData {
  name: string;
  description: string;
  category: string;
}

const EMPTY_CORPORATE_FORM: CorporateFormData = {
  name: '',
  price: '',
  description: '',
  category: '',
  billingCycle: '',
  vendorCost: '',
  vendorName: '',
};

const EMPTY_PERSONAL_FORM: PersonalFormData = {
  name: '',
  description: '',
  category: '',
};

const BILLING_CYCLE_OPTIONS = ['Monthly', 'Quarterly', 'Annual', 'One-time'];

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const formatCurrency = (amount: number | null) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function ServicesCatalog() {
  const [showInactive, setShowInactive] = useState(false);

  // Corporate
  const [corporateServices, setCorporateServices] = useState<CorporateService[]>([]);
  const [corporateLoading, setCorporateLoading] = useState(true);
  const [corporateError, setCorporateError] = useState<string | null>(null);
  const [editingCorporate, setEditingCorporate] = useState<CorporateService | null>(null);
  const [isCreatingCorporate, setIsCreatingCorporate] = useState(false);
  const [corporateForm, setCorporateForm] = useState<CorporateFormData>(EMPTY_CORPORATE_FORM);
  const [corporateSaving, setCorporateSaving] = useState(false);

  // Personal
  const [personalServices, setPersonalServices] = useState<PersonalService[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<PersonalService | null>(null);
  const [isCreatingPersonal, setIsCreatingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState<PersonalFormData>(EMPTY_PERSONAL_FORM);
  const [personalSaving, setPersonalSaving] = useState(false);

  const loadCorporateServices = useCallback(async () => {
    try {
      setCorporateLoading(true);
      const qs = showInactive ? '?includeInactive=true' : '';
      const response = await fetch(`${apiUrl}/api/services-catalog/corporate${qs}`);
      const data = await response.json();
      if (data.success) {
        setCorporateServices(data.data);
      } else {
        setCorporateError(data.error || 'Failed to load corporate services');
      }
    } catch (err) {
      setCorporateError(err instanceof Error ? err.message : 'Failed to load corporate services');
    } finally {
      setCorporateLoading(false);
    }
  }, [showInactive]);

  const loadPersonalServices = useCallback(async () => {
    try {
      setPersonalLoading(true);
      const qs = showInactive ? '?includeInactive=true' : '';
      const response = await fetch(`${apiUrl}/api/services-catalog/personal${qs}`);
      const data = await response.json();
      if (data.success) {
        setPersonalServices(data.data);
      } else {
        setPersonalError(data.error || 'Failed to load personal services');
      }
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : 'Failed to load personal services');
    } finally {
      setPersonalLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    loadCorporateServices();
    loadPersonalServices();
  }, [loadCorporateServices, loadPersonalServices]);

  // --- Corporate handlers ---

  const resetCorporateForm = () => {
    setCorporateForm(EMPTY_CORPORATE_FORM);
    setEditingCorporate(null);
    setIsCreatingCorporate(false);
    setCorporateError(null);
  };

  const handleCreateCorporate = () => {
    setIsCreatingCorporate(true);
    setEditingCorporate(null);
    setCorporateForm(EMPTY_CORPORATE_FORM);
  };

  const handleEditCorporate = (service: CorporateService) => {
    setEditingCorporate(service);
    setIsCreatingCorporate(false);
    setCorporateForm({
      name: service.name,
      price: service.price != null ? String(service.price) : '',
      description: service.description || '',
      category: service.category || '',
      billingCycle: service.billingCycle || '',
      vendorCost: service.vendorCost != null ? String(service.vendorCost) : '',
      vendorName: service.vendorName || '',
    });
  };

  const handleCorporateChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setCorporateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCorporateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corporateForm.name.trim()) {
      setCorporateError('Service name is required');
      return;
    }

    try {
      setCorporateSaving(true);
      setCorporateError(null);

      const url = editingCorporate
        ? `${apiUrl}/api/services-catalog/corporate/${editingCorporate.id}`
        : `${apiUrl}/api/services-catalog/corporate`;

      const body = {
        name: corporateForm.name.trim(),
        price: corporateForm.price.trim() === '' ? null : Number(corporateForm.price),
        description: corporateForm.description.trim() || null,
        category: corporateForm.category.trim() || null,
        billingCycle: corporateForm.billingCycle || null,
        vendorCost: corporateForm.vendorCost.trim() === '' ? null : Number(corporateForm.vendorCost),
        vendorName: corporateForm.vendorName.trim() || null,
      };

      const response = await fetch(url, {
        method: editingCorporate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (data.success) {
        resetCorporateForm();
        loadCorporateServices();
      } else {
        throw new Error(data.error || 'Failed to save corporate service');
      }
    } catch (err) {
      setCorporateError(err instanceof Error ? err.message : 'Failed to save corporate service');
    } finally {
      setCorporateSaving(false);
    }
  };

  const handleDeactivateCorporate = async (service: CorporateService) => {
    if (!confirm(`Deactivate "${service.name}"? It will no longer appear when creating new tickets or bundles, but existing records referencing it are unaffected.`)) {
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/services-catalog/corporate/${service.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        loadCorporateServices();
      } else {
        throw new Error(data.error || 'Failed to deactivate service');
      }
    } catch (err) {
      setCorporateError(err instanceof Error ? err.message : 'Failed to deactivate service');
    }
  };

  const handleReactivateCorporate = async (service: CorporateService) => {
    try {
      const response = await fetch(`${apiUrl}/api/services-catalog/corporate/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' }),
      });
      const data = await response.json();
      if (data.success) {
        loadCorporateServices();
      } else {
        throw new Error(data.error || 'Failed to reactivate service');
      }
    } catch (err) {
      setCorporateError(err instanceof Error ? err.message : 'Failed to reactivate service');
    }
  };

  // --- Personal handlers ---

  const resetPersonalForm = () => {
    setPersonalForm(EMPTY_PERSONAL_FORM);
    setEditingPersonal(null);
    setIsCreatingPersonal(false);
    setPersonalError(null);
  };

  const handleCreatePersonal = () => {
    setIsCreatingPersonal(true);
    setEditingPersonal(null);
    setPersonalForm(EMPTY_PERSONAL_FORM);
  };

  const handleEditPersonal = (service: PersonalService) => {
    setEditingPersonal(service);
    setIsCreatingPersonal(false);
    setPersonalForm({
      name: service.name,
      description: service.description || '',
      category: service.category || '',
    });
  };

  const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPersonalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalForm.name.trim()) {
      setPersonalError('Service name is required');
      return;
    }

    try {
      setPersonalSaving(true);
      setPersonalError(null);

      const url = editingPersonal
        ? `${apiUrl}/api/services-catalog/personal/${editingPersonal.id}`
        : `${apiUrl}/api/services-catalog/personal`;

      const body = {
        name: personalForm.name.trim(),
        description: personalForm.description.trim() || null,
        category: personalForm.category.trim() || null,
      };

      const response = await fetch(url, {
        method: editingPersonal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (data.success) {
        resetPersonalForm();
        loadPersonalServices();
      } else {
        throw new Error(data.error || 'Failed to save personal service');
      }
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : 'Failed to save personal service');
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleDeactivatePersonal = async (service: PersonalService) => {
    if (!confirm(`Deactivate "${service.name}"? It will no longer appear when creating new tickets, but existing records referencing it are unaffected.`)) {
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/services-catalog/personal/${service.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        loadPersonalServices();
      } else {
        throw new Error(data.error || 'Failed to deactivate service');
      }
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : 'Failed to deactivate service');
    }
  };

  const handleReactivatePersonal = async (service: PersonalService) => {
    try {
      const response = await fetch(`${apiUrl}/api/services-catalog/personal/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' }),
      });
      const data = await response.json();
      if (data.success) {
        loadPersonalServices();
      } else {
        throw new Error(data.error || 'Failed to reactivate service');
      }
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : 'Failed to reactivate service');
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-base-content">Services Catalog</h1>
              <p className="text-base-content/70 mt-2">
                Manage corporate and personal service offerings, pricing, and vendor costs
              </p>
            </div>
            <label className="label cursor-pointer gap-2">
              <span className="label-text">Show inactive services</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            </label>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Corporate Services */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-2xl">Corporate Services</h2>
              <button onClick={handleCreateCorporate} className="btn btn-primary btn-sm gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Corporate Service
              </button>
            </div>

            {corporateError && (
              <div className="alert alert-error mb-4">
                <span>{corporateError}</span>
              </div>
            )}

            {corporateLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : corporateServices.length === 0 ? (
              <p className="text-sm text-base-content/60 py-4">No corporate services to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Billing Cycle</th>
                      <th>Category</th>
                      <th>Vendor</th>
                      <th>Vendor Cost</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {corporateServices.map((service) => (
                      <tr key={service.id} className={service.status === 'Inactive' ? 'opacity-60' : ''}>
                        <td className="font-medium">{service.name}</td>
                        <td>{formatCurrency(service.price)}</td>
                        <td>{service.billingCycle || '—'}</td>
                        <td>{service.category || '—'}</td>
                        <td>{service.vendorName || '—'}</td>
                        <td>{formatCurrency(service.vendorCost)}</td>
                        <td>
                          <span className={`badge ${service.status === 'Active' ? 'badge-success' : 'badge-ghost'}`}>
                            {service.status}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {service.status === 'Active' ? (
                            <>
                              <button onClick={() => handleEditCorporate(service)} className="btn btn-ghost btn-xs">
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeactivateCorporate(service)}
                                className="btn btn-ghost btn-xs text-error"
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReactivateCorporate(service)}
                              className="btn btn-ghost btn-xs text-success"
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(isCreatingCorporate || editingCorporate) && (
              <div className="border-t border-base-300 pt-6 mt-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingCorporate ? 'Edit Corporate Service' : 'New Corporate Service'}
                </h3>
                <form onSubmit={handleCorporateSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label"><span className="label-text font-medium">Name *</span></label>
                      <input
                        type="text"
                        name="name"
                        value={corporateForm.name}
                        onChange={handleCorporateChange}
                        placeholder="Service name"
                        className="input input-bordered w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Price</span></label>
                      <input
                        type="number"
                        step="0.01"
                        name="price"
                        value={corporateForm.price}
                        onChange={handleCorporateChange}
                        placeholder="0.00"
                        className="input input-bordered w-full"
                      />
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Billing Cycle</span></label>
                      <select
                        name="billingCycle"
                        value={corporateForm.billingCycle}
                        onChange={handleCorporateChange}
                        className="select select-bordered w-full"
                      >
                        <option value="">—</option>
                        {BILLING_CYCLE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Category</span></label>
                      <input
                        type="text"
                        name="category"
                        value={corporateForm.category}
                        onChange={handleCorporateChange}
                        placeholder="Category"
                        className="input input-bordered w-full"
                      />
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Vendor Name</span></label>
                      <input
                        type="text"
                        name="vendorName"
                        value={corporateForm.vendorName}
                        onChange={handleCorporateChange}
                        placeholder="e.g. Intuit"
                        className="input input-bordered w-full"
                      />
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Vendor Cost (wholesale)</span></label>
                      <input
                        type="number"
                        step="0.01"
                        name="vendorCost"
                        value={corporateForm.vendorCost}
                        onChange={handleCorporateChange}
                        placeholder="0.00"
                        className="input input-bordered w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label"><span className="label-text font-medium">Description</span></label>
                    <textarea
                      name="description"
                      value={corporateForm.description}
                      onChange={handleCorporateChange}
                      placeholder="Service description"
                      className="textarea textarea-bordered w-full"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={resetCorporateForm} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={corporateSaving}>
                      {corporateSaving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Saving...
                        </>
                      ) : editingCorporate ? 'Save Changes' : 'Create Service'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Personal Services */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-2xl">Personal Services</h2>
              <button onClick={handleCreatePersonal} className="btn btn-primary btn-sm gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Personal Service
              </button>
            </div>

            {personalError && (
              <div className="alert alert-error mb-4">
                <span>{personalError}</span>
              </div>
            )}

            {personalLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : personalServices.length === 0 ? (
              <p className="text-sm text-base-content/60 py-4">No personal services to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalServices.map((service) => (
                      <tr key={service.id} className={service.status === 'Inactive' ? 'opacity-60' : ''}>
                        <td className="font-medium">{service.name}</td>
                        <td>{service.description || '—'}</td>
                        <td>{service.category || '—'}</td>
                        <td>
                          <span className={`badge ${service.status === 'Active' ? 'badge-success' : 'badge-ghost'}`}>
                            {service.status}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {service.status === 'Active' ? (
                            <>
                              <button onClick={() => handleEditPersonal(service)} className="btn btn-ghost btn-xs">
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeactivatePersonal(service)}
                                className="btn btn-ghost btn-xs text-error"
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReactivatePersonal(service)}
                              className="btn btn-ghost btn-xs text-success"
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(isCreatingPersonal || editingPersonal) && (
              <div className="border-t border-base-300 pt-6 mt-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingPersonal ? 'Edit Personal Service' : 'New Personal Service'}
                </h3>
                <form onSubmit={handlePersonalSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label"><span className="label-text font-medium">Name *</span></label>
                      <input
                        type="text"
                        name="name"
                        value={personalForm.name}
                        onChange={handlePersonalChange}
                        placeholder="Service name"
                        className="input input-bordered w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="label"><span className="label-text font-medium">Category</span></label>
                      <input
                        type="text"
                        name="category"
                        value={personalForm.category}
                        onChange={handlePersonalChange}
                        placeholder="Category"
                        className="input input-bordered w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label"><span className="label-text font-medium">Description</span></label>
                    <textarea
                      name="description"
                      value={personalForm.description}
                      onChange={handlePersonalChange}
                      placeholder="Service description"
                      className="textarea textarea-bordered w-full"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={resetPersonalForm} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={personalSaving}>
                      {personalSaving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Saving...
                        </>
                      ) : editingPersonal ? 'Save Changes' : 'Create Service'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
