'use client'

import { useState, useEffect, useRef } from 'react'

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

interface MissingTicketItem {
  bundleId: string
  bundleItemId: string
  corporationId: string
  companyName: string
  serviceId: string
  serviceName: string | null
  amount: number
}

export default function Subscriptions() {
  const [selectedCustomer, setSelectedCustomer] = useState<CorporateCustomer | null>(null)
  const [customers, setCustomers] = useState<CorporateCustomer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Corporation ids with an active billing bundle, so the customer picker
  // can highlight who already has one.
  const [bundledCorporationIds, setBundledCorporationIds] = useState<Set<string>>(new Set())

  // Customer search combobox
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const customerPickerRef = useRef<HTMLDivElement>(null)

  // Add-item form
  const [newItemServiceId, setNewItemServiceId] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [generatingTickets, setGeneratingTickets] = useState(false)

  // Cross-client "needs this month's tickets generated" summary. A bundle
  // subscription doesn't disappear when its ticket is completed — but
  // nothing else creates next month's ticket automatically, so this makes
  // that gap visible instead of clients silently going un-ticketed.
  const [missingTickets, setMissingTickets] = useState<MissingTicketItem[]>([])
  const [missingTicketsPeriod, setMissingTicketsPeriod] = useState<string>('')
  const [loadingMissing, setLoadingMissing] = useState(false)
  const [showMissingPanel, setShowMissingPanel] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generatingBundleId, setGeneratingBundleId] = useState<string | null>(null)

  useEffect(() => {
    loadCorporateCustomers()
    loadServices()
    loadBundledCorporationIds()
    loadMissingTickets()
  }, [])

  // Close the customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerPickerRef.current && !customerPickerRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  const loadBundledCorporationIds = async () => {
    try {
      const response = await fetch('/api/corporate-billing-bundles')
      if (!response.ok) throw new Error('Failed to load bundles')
      const data = await response.json()
      if (data.success && Array.isArray(data.data)) {
        const ids = new Set<string>(
          data.data.filter((b: Bundle) => b.status === 'active').map((b: Bundle) => b.corporationId)
        )
        setBundledCorporationIds(ids)
      }
    } catch (err) {
      console.error('Error loading bundled corporation ids:', err)
    }
  }

  const loadMissingTickets = async () => {
    try {
      setLoadingMissing(true)
      const response = await fetch('/api/corporate-billing-bundles/generation-status')
      if (!response.ok) throw new Error('Failed to load generation status')
      const data = await response.json()
      if (data.success) {
        setMissingTickets(data.data.missing || [])
        setMissingTicketsPeriod(data.data.period || '')
      }
    } catch (err) {
      console.error('Error loading generation status:', err)
    } finally {
      setLoadingMissing(false)
    }
  }

  const generateForBundle = async (bundleId: string) => {
    try {
      setGeneratingBundleId(bundleId)
      const response = await fetch('/api/corporate-billing-bundles/generate-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate tickets')
      await loadMissingTickets()
      if (selectedCustomer?.id && bundle?.id === bundleId) {
        // Refresh the currently-open bundle view too, if it's the one we just generated for.
        loadBundle(selectedCustomer.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tickets')
      console.error('Error generating tickets for bundle:', err)
    } finally {
      setGeneratingBundleId(null)
    }
  }

  const generateAllMissing = async () => {
    const bundleIds = [...new Set(missingTickets.map((m) => m.bundleId))]
    if (bundleIds.length === 0) return
    if (!confirm(`Generate this month's tickets for all ${bundleIds.length} client(s) with missing services?`)) return
    try {
      setGeneratingAll(true)
      for (const bundleId of bundleIds) {
        await fetch('/api/corporate-billing-bundles/generate-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bundleId }),
        })
      }
      await loadMissingTickets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tickets')
      console.error('Error generating all missing tickets:', err)
    } finally {
      setGeneratingAll(false)
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
      setBundledCorporationIds((prev) => new Set(prev).add(selectedCustomer.id))
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
      setBundledCorporationIds((prev) => {
        const next = new Set(prev)
        if (newStatus === 'active') next.add(bundle.corporationId)
        else next.delete(bundle.corporationId)
        return next
      })
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

  const filteredCustomers = (() => {
    const term = customerSearchTerm.trim().toLowerCase()
    const list = term
      ? customers.filter((c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term))
      : customers
    // Clients with an existing bundle float to the top, alphabetical within each group.
    return [...list].sort((a, b) => {
      const aHas = bundledCorporationIds.has(a.id)
      const bHas = bundledCorporationIds.has(b.id)
      if (aHas !== bHas) return aHas ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  })()

  const selectCustomer = (customer: CorporateCustomer) => {
    setSelectedCustomer(customer)
    setCustomerSearchTerm(customer.name)
    setShowCustomerDropdown(false)
    setError(null)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearchTerm('')
    setShowCustomerDropdown(false)
  }

  const missingByClient = (() => {
    const map = new Map<string, { bundleId: string; companyName: string; items: MissingTicketItem[] }>()
    for (const m of missingTickets) {
      const existing = map.get(m.corporationId)
      if (existing) {
        existing.items.push(m)
      } else {
        map.set(m.corporationId, { bundleId: m.bundleId, companyName: m.companyName, items: [m] })
      }
    }
    return [...map.entries()]
      .map(([corporationId, v]) => ({ corporationId, ...v }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName))
  })()

  return (
    <div className="space-y-6">
      {/* Needs-generating summary — a bundle subscription never disappears
          when its ticket is completed, but nothing else creates next
          month's ticket automatically, so this surfaces that gap instead
          of it being silently missed. */}
      {!loadingMissing && missingTickets.length > 0 && (
        <div className="card bg-warning/10 border border-warning shadow-xl">
          <div className="card-body p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => setShowMissingPanel((v) => !v)}
              >
                <span className="text-xl">⚠️</span>
                <span className="font-semibold">
                  {missingTickets.length} bundle service{missingTickets.length !== 1 ? 's' : ''} across{' '}
                  {missingByClient.length} client{missingByClient.length !== 1 ? 's' : ''} haven't had a{' '}
                  {missingTicketsPeriod} ticket generated yet
                </span>
                <span className="text-xs opacity-60">{showMissingPanel ? '▲ hide' : '▼ show'}</span>
              </button>
              <button
                className="btn btn-warning btn-sm"
                disabled={generatingAll}
                onClick={generateAllMissing}
              >
                {generatingAll ? <span className="loading loading-spinner loading-xs"></span> : `Generate All (${missingByClient.length})`}
              </button>
            </div>

            {showMissingPanel && (
              <div className="mt-3 divide-y divide-base-300 max-h-80 overflow-y-auto">
                {missingByClient.map((c) => (
                  <div key={c.corporationId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.companyName}</div>
                      <div className="text-xs text-base-content/60 truncate">
                        {c.items.map((i) => i.serviceName || i.serviceId).join(', ')}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-xs shrink-0"
                      disabled={generatingBundleId === c.bundleId}
                      onClick={() => generateForBundle(c.bundleId)}
                    >
                      {generatingBundleId === c.bundleId ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Generate'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

          {/* Customer Selection — searchable, with existing-bundle clients highlighted */}
          <div className="form-control w-full max-w-xs mb-6 relative" ref={customerPickerRef}>
            <label className="label">
              <span className="label-text font-medium">Select Corporate Customer</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="input input-bordered w-full pr-8"
                placeholder="Type to search customers..."
                value={customerSearchTerm}
                disabled={loading}
                onFocus={() => setShowCustomerDropdown(true)}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value)
                  setShowCustomerDropdown(true)
                  if (selectedCustomer) setSelectedCustomer(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowCustomerDropdown(false)
                }}
              />
              {(customerSearchTerm || selectedCustomer) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={clearCustomer}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>

            {showCustomerDropdown && (
              <div className="absolute z-10 top-full mt-1 w-full max-h-80 overflow-y-auto bg-base-100 border border-base-300 rounded-lg shadow-xl">
                {filteredCustomers.length === 0 && (
                  <div className="px-4 py-3 text-sm text-base-content/60">No customers match "{customerSearchTerm}"</div>
                )}
                {filteredCustomers.slice(0, 100).map((customer) => {
                  const hasBundle = bundledCorporationIds.has(customer.id)
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center justify-between gap-2 ${
                        selectedCustomer?.id === customer.id ? 'bg-base-200' : ''
                      }`}
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="truncate">
                        {customer.name} {customer.code && <span className="text-base-content/50">({customer.code})</span>}
                      </span>
                      {hasBundle && (
                        <span className="badge badge-success badge-sm shrink-0" title="Has an active billing bundle">
                          💰 Bundle
                        </span>
                      )}
                    </button>
                  )
                })}
                {filteredCustomers.length > 100 && (
                  <div className="px-4 py-2 text-xs text-base-content/50 border-t border-base-300">
                    {filteredCustomers.length - 100} more — keep typing to narrow it down
                  </div>
                )}
              </div>
            )}
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
