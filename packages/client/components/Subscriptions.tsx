'use client'

import { useState, useEffect } from 'react'

interface Service {
  id: string
  name: string
  price?: number
  description?: string
}

interface BundleItem {
  id: string
  bundleId: string
  serviceId: string
  serviceName: string | null
  amount: number
  status: 'active' | 'removed'
  effectiveDate: string | null
  endDate: string | null
  notes: string | null
}

interface Bundle {
  id: string
  corporationId: string
  name: string | null
  status: 'active' | 'paused' | 'cancelled'
  billingCycle: 'monthly' | 'quarterly' | 'annual'
  startDate: string | null
  endDate: string | null
  notes: string | null
  totalAmount: number
  items: BundleItem[]
}

interface CorporateCustomer {
  id: string
  name: string
  code: string
}

export default function Subscriptions() {
  const [selectedCustomer, setSelectedCustomer] = useState<CorporateCustomer | null>(null)
  const [customers, setCustomers] = useState<CorporateCustomer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add-item form
  const [newItemServiceId, setNewItemServiceId] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [generatingTickets, setGeneratingTickets] = useState(false)

  useEffect(() => {
    loadCorporateCustomers()
    loadServices()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      loadBundle(selectedCustomer.id)
    } else {
      setBundle(null)
    }
  }, [selectedCustomer])

  const loadCorporateCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/view?table=Corporations')
      if (!response.ok) throw new Error('Failed to load customers')

      const data = await response.json()
      const companiesList: CorporateCustomer[] = []

      if (data.data?.records && Array.isArray(data.data.records)) {
        data.data.records.forEach((record: any) => {
          const companyName = record.fields['Company']
          const companyCode = record.fields['Business Partner Number'] || record.fields['EIN'] || record.fields['Entity Number']
          if (companyName && companyName.toString().trim()) {
            companiesList.push({
              id: record.id,
              name: companyName.toString().trim(),
              code: companyCode ? companyCode.toString().trim() : '',
            })
          }
        })
      }

      companiesList.sort((a, b) => a.name.localeCompare(b.name))
      setCustomers(companiesList)
    } catch (err) {
      setError('Failed to load corporate customers')
      console.error('Error loading customers:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services-cached')
      if (!response.ok) throw new Error('Failed to load services')
      const data = await response.json()
      if (data.success && data.data) {
        setServices(data.data)
      }
    } catch (err) {
      console.error('Error loading services:', err)
    }
  }

  const loadBundle = async (corporationId: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/corporate-billing-bundles?corporationId=${encodeURIComponent(corporationId)}`)
      if (!response.ok) throw new Error('Failed to load billing bundle')
      const data = await response.json()
      if (data.success) {
        // One active bundle per client — show it if present, else the most
        // recent (e.g. a cancelled one), else null.
        const active = data.data.find((b: Bundle) => b.status === 'active')
        setBundle(active || data.data[0] || null)
      }
    } catch (err) {
      setError('Failed to load billing bundle')
      console.error('Error loading bundle:', err)
    } finally {
      setLoading(false)
    }
  }

  const createBundle = async () => {
    if (!selectedCustomer) return
    try {
      setLoading(true)
      const response = await fetch('/api/corporate-billing-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corporationId: selectedCustomer.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create bundle')
      setBundle(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bundle')
      console.error('Error creating bundle:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateBundleStatus = async (newStatus: Bundle['status']) => {
    if (!bundle) return
    try {
      const response = await fetch(`/api/corporate-billing-bundles/${bundle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update bundle status')
      setBundle(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bundle status')
      console.error('Error updating bundle status:', err)
    }
  }

  const generateThisMonthsTickets = async () => {
    if (!bundle) return
    try {
      setGeneratingTickets(true)
      const response = await fetch(`/api/corporate-billing-bundles/generate-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: bundle.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate tickets')
      const { ticketsCreated, ticketsSkippedExisting, period } = data.data
      alert(
        ticketsCreated > 0
          ? `Created ${ticketsCreated} pipeline ticket(s) for ${period}.${ticketsSkippedExisting > 0 ? ` (${ticketsSkippedExisting} already existed.)` : ''}`
          : `No new tickets needed for ${period} — all ${ticketsSkippedExisting} already exist.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tickets')
      console.error('Error generating tickets:', err)
    } finally {
      setGeneratingTickets(false)
    }
  }

  const addItem = async () => {
    if (!bundle || !newItemServiceId || !newItemAmount) return
    try {
      setAddingItem(true)
      const response = await fetch(`/api/corporate-billing-bundles/${bundle.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: newItemServiceId, amount: parseFloat(newItemAmount) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add service to bundle')
      setBundle(data.data)
      setNewItemServiceId('')
      setNewItemAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service to bundle')
      console.error('Error adding bundle item:', err)
    } finally {
      setAddingItem(false)
    }
  }

  const updateItemAmount = async (itemId: string, newAmount: number) => {
    if (!bundle) return
    try {
      const response = await fetch(`/api/corporate-billing-bundles/${bundle.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update amount')
      setBundle(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update amount')
      console.error('Error updating bundle item:', err)
    }
  }

  const removeItem = async (itemId: string) => {
    if (!bundle) return
    if (!confirm('Remove this service from the bundle? It will no longer be billed monthly.')) return
    try {
      const response = await fetch(`/api/corporate-billing-bundles/${bundle.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'removed' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to remove service')
      setBundle(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove service')
      console.error('Error removing bundle item:', err)
    }
  }

  const activeItems = bundle?.items.filter((i) => i.status === 'active') || []
  const bundledServiceIds = new Set(activeItems.map((i) => i.serviceId))
  const availableServices = services.filter((s) => !bundledServiceIds.has(s.id))

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="card-title text-2xl">Corporate Billing Bundles</h2>
              <p className="text-sm text-base-content/60">
                A client's durable, recurring monthly bill — covering many services in one place.
              </p>
            </div>
            {bundle && (
              <div className="text-right">
                <div className="text-sm text-base-content/60">Monthly Total</div>
                <div className="text-2xl font-bold text-success">
                  ${bundle.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-base-content/50">for {selectedCustomer?.name}</div>
              </div>
            )}
          </div>

          {/* Customer Selection */}
          <div className="form-control w-full max-w-xs mb-6">
            <label className="label">
              <span className="label-text font-medium">Select Corporate Customer</span>
            </label>
            <select
              className="select select-bordered w-full max-w-xs"
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const customer = customers.find((c) => c.id === e.target.value) || null
                setSelectedCustomer(customer)
                setError(null)
              }}
              disabled={loading}
            >
              <option value="">Choose a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.code && `(${customer.code})`}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {selectedCustomer && loading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}

          {selectedCustomer && !loading && !bundle && (
            <div className="text-center py-8">
              <p className="text-base-content/70 mb-4">
                {selectedCustomer.name} has no billing bundle yet.
              </p>
              <button className="btn btn-primary" onClick={createBundle}>
                Create Billing Bundle
              </button>
            </div>
          )}

          {selectedCustomer && !loading && bundle && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Bundle Line Items</h3>
                <div className="flex items-center gap-2">
                  {bundle.status === 'active' && (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={generatingTickets || activeItems.length === 0}
                      onClick={generateThisMonthsTickets}
                      title="Create this month's pipeline ticket for each active service in this bundle"
                    >
                      {generatingTickets ? <span className="loading loading-spinner loading-xs"></span> : 'Generate This Month\'s Tickets'}
                    </button>
                  )}
                  <select
                    className="select select-bordered select-sm"
                    value={bundle.status}
                    onChange={(e) => updateBundleStatus(e.target.value as Bundle['status'])}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Monthly Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-base-content/60">
                          No services in this bundle yet — add one below.
                        </td>
                      </tr>
                    )}
                    {bundle.items.map((item) => (
                      <tr key={item.id} className={item.status === 'removed' ? 'opacity-50' : ''}>
                        <td className="font-medium">{item.serviceName || item.serviceId}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">$</span>
                            <input
                              type="number"
                              className="input input-xs input-bordered w-24"
                              defaultValue={item.amount}
                              disabled={item.status === 'removed'}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value) || 0
                                if (value !== item.amount) updateItemAmount(item.id, value)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                              }}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${item.status === 'active' ? 'badge-success' : 'badge-ghost'}`}>
                            {item.status === 'active' ? 'Active' : 'Removed'}
                          </span>
                        </td>
                        <td>
                          {item.status === 'active' && (
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => removeItem(item.id)}>
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add item */}
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h4 className="font-semibold text-sm mb-2">Add Service to Bundle</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="form-control">
                      <select
                        className="select select-bordered select-sm w-64"
                        value={newItemServiceId}
                        onChange={(e) => {
                          setNewItemServiceId(e.target.value)
                          const svc = services.find((s) => s.id === e.target.value)
                          if (svc?.price != null && !newItemAmount) setNewItemAmount(String(svc.price))
                        }}
                      >
                        <option value="">Choose a service...</option>
                        {availableServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">$</span>
                        <input
                          type="number"
                          className="input input-bordered input-sm w-28"
                          placeholder="0.00"
                          value={newItemAmount}
                          onChange={(e) => setNewItemAmount(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!newItemServiceId || !newItemAmount || addingItem}
                      onClick={addItem}
                    >
                      {addingItem ? <span className="loading loading-spinner loading-xs"></span> : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!selectedCustomer && !loading && (
            <div className="text-center py-8 text-base-content/60">
              Select a corporate customer to view or set up their billing bundle.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
