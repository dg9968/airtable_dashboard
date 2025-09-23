'use client'

import { useState, useEffect } from 'react'

interface Service {
  id: string
  name: string
  price?: number
  description?: string
}

interface Subscription {
  id: string
  clientId: string
  serviceId: string
  status: string
  price: number
}

interface CorporateCustomer {
  id: string
  name: string
  code: string
}

export default function Subscriptions() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [customers, setCustomers] = useState<CorporateCustomer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingAmounts, setEditingAmounts] = useState<Record<string, number>>({})

  // Load corporate customers on component mount
  useEffect(() => {
    loadCorporateCustomers()
  }, [])

  // Load services and subscriptions when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      loadServices()
      loadSubscriptions(selectedCustomer)
      setEditingAmounts({}) // Clear any editing amounts when customer changes
    } else {
      setServices([])
      setSubscriptions([])
      setEditingAmounts({})
    }
  }, [selectedCustomer])

  const loadCorporateCustomers = async () => {
    try {
      setLoading(true)
      // Load companies from the Corporations table
      const response = await fetch('/api/view?table=Corporations')
      if (!response.ok) throw new Error('Failed to load customers')

      const data = await response.json()

      console.log('Raw corporations data:', data)

      // Extract companies from Corporations table
      const companiesList: CorporateCustomer[] = []

      if (data.data && data.data.records && Array.isArray(data.data.records)) {
        console.log('First record:', data.data.records[0])
        console.log('First record fields:', data.data.records[0]?.fields)
        console.log('All field keys:', Object.keys(data.data.records[0]?.fields || {}))

        data.data.records.forEach((record: any, index: number) => {
          const companyName = record.fields['Company'] // Using 'Company' without trailing space as shown in fieldNames
          const companyCode = record.fields['Business Partner Number'] || record.fields['EIN'] || record.fields['Entity Number']

          if (index < 5) { // Log first 5 records
            console.log(`Record ${index}:`, record.id, 'Company field:', companyName, 'Code:', companyCode)
          }

          if (companyName && companyName.toString().trim()) {
            companiesList.push({
              id: record.id,
              name: companyName.toString().trim(),
              code: companyCode ? companyCode.toString().trim() : ''
            })
          }
        })
      } else {
        console.log('Records array not found in response')
      }

      // Sort companies alphabetically by name
      const sortedCompaniesList = companiesList.sort((a, b) => a.name.localeCompare(b.name))

      setCustomers(sortedCompaniesList)
      console.log('Companies loaded and sorted:', sortedCompaniesList)
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
        console.log(`Services loaded: ${data.data.length} services (cached: ${data.cached || false})`)
      }
    } catch (err) {
      console.error('Error loading services:', err)
    }
  }

  const loadSubscriptions = async (customerName: string) => {
    try {
      const response = await fetch(`/api/customer-subscriptions?customer=${encodeURIComponent(customerName)}`)
      if (!response.ok) throw new Error('Failed to load subscriptions')

      const data = await response.json()

      if (data.success && data.data) {
        setSubscriptions(data.data)
        console.log(`Customer subscriptions loaded: ${data.data.length} subscriptions for ${customerName}`)
      } else {
        setSubscriptions([])
        console.log(`No subscriptions found for ${customerName}`)
      }
    } catch (err) {
      setError('Failed to load subscriptions')
      console.error('Error loading subscriptions:', err)
    }
  }

  const updateSubscriptionStatus = async (serviceName: string, newStatus: string) => {
    try {
      // Find existing subscription
      const existingSubscription = subscriptions.find(sub => sub.serviceId === serviceName)

      if (existingSubscription) {
        // Update existing subscription status only
        const response = await fetch('/api/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: existingSubscription.id,
            status: newStatus
          })
        })

        if (!response.ok) throw new Error('Failed to update subscription')

        // Reload subscriptions to show updated status
        loadSubscriptions(selectedCustomer)
      } else {
        // No existing subscription found - cannot update
        setError(`No subscription found for ${serviceName}. Cannot update status.`)
        console.warn(`No subscription found for service: ${serviceName}`)
      }
    } catch (err) {
      setError('Failed to update subscription')
      console.error('Error updating subscription:', err)
    }
  }

  const updateBillingAmount = async (serviceName: string, newAmount: number) => {
    try {
      // Find existing subscription
      const existingSubscription = subscriptions.find(sub => sub.serviceId === serviceName)

      if (existingSubscription) {
        // Update existing subscription billing amount
        const response = await fetch('/api/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: existingSubscription.id,
            price: newAmount
          })
        })

        if (!response.ok) throw new Error('Failed to update billing amount')

        // Reload subscriptions to show updated amount
        loadSubscriptions(selectedCustomer)
      } else {
        // No existing subscription found - cannot update
        setError(`No subscription found for ${serviceName}. Cannot update billing amount.`)
        console.warn(`No subscription found for service: ${serviceName}`)
      }
    } catch (err) {
      setError('Failed to update billing amount')
      console.error('Error updating billing amount:', err)
    }
  }

  const getSubscriptionStatus = (serviceName: string) => {
    const subscription = subscriptions.find(sub => sub.serviceId === serviceName)
    // Status is a multiple select field that returns an array
    if (subscription?.status && Array.isArray(subscription.status) && subscription.status.length > 0) {
      return subscription.status[0] // Return first status from the array
    }
    return '' // Return empty string for no status (instead of 'Inactive')
  }

  const getSubscriptionPrice = (serviceName: string) => {
    const subscription = subscriptions.find(sub => sub.serviceId === serviceName)
    return subscription?.price || 0
  }

  const calculateTotalBilling = () => {
    const total = services.reduce((total, service) => {
      const status = getSubscriptionStatus(service.name)
      const price = getSubscriptionPrice(service.name) || service.price

      console.log(`Service: ${service.name}, Status: ${status}, Price: ${price}`)

      // Only include services with Active status
      if (status === 'Active') {
        return total + (price || 0)
      }
      return total
    }, 0)

    console.log('Total Active Billing:', total)
    return total
  }

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-start mb-4">
            <h2 className="card-title text-2xl">Corporate Subscriptions Management</h2>
            {selectedCustomer && (
              <div className="text-right">
                <div className="text-sm text-base-content/60">Total Active Billing</div>
                <div className="text-2xl font-bold text-success">
                  ${calculateTotalBilling().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-base-content/50">for {selectedCustomer}</div>
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
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              disabled={loading}
            >
              <option value="">Choose a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>
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

          {/* Services and Subscriptions */}
          {selectedCustomer && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Available Services</h3>

              {loading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Service Name</th>
                        <th>Description</th>
                        <th>Billing Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => {
                        const status = getSubscriptionStatus(service.name)
                        const price = getSubscriptionPrice(service.name) || service.price

                        return (
                          <tr key={service.id} className={
                            status === 'Active' ? 'bg-success/10' :
                            status === 'Paused' ? 'bg-warning/10' :
                            status === 'Cancelled' ? 'bg-error/10' :
                            ''
                          }>
                            <td className="font-medium">
                              <div className="flex items-center gap-2">
                                {status === 'Active' && <span className="text-success">✓</span>}
                                {status === 'Paused' && <span className="text-warning">⏸</span>}
                                {status === 'Cancelled' && <span className="text-error">✗</span>}
                                {service.name}
                              </div>
                            </td>
                            <td>{service.description || 'No description available'}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">$</span>
                                <input
                                  type="number"
                                  className="input input-xs input-bordered w-24"
                                  value={editingAmounts[service.name] !== undefined ? editingAmounts[service.name] : (price || 0)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0
                                    setEditingAmounts(prev => ({
                                      ...prev,
                                      [service.name]: value
                                    }))
                                  }}
                                  onBlur={() => {
                                    const currentEditingAmount = editingAmounts[service.name]
                                    if (currentEditingAmount !== undefined && currentEditingAmount !== price) {
                                      updateBillingAmount(service.name, currentEditingAmount)
                                    }
                                    // Clear editing state
                                    setEditingAmounts(prev => {
                                      const newState = { ...prev }
                                      delete newState[service.name]
                                      return newState
                                    })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur()
                                    }
                                  }}
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                            <td>
                              <div className={`badge ${
                                status === 'Active' ? 'badge-success' :
                                status === 'Paused' ? 'badge-warning' :
                                status === 'Cancelled' ? 'badge-error' :
                                'badge-ghost'
                              }`}>
                                {status || 'No Status'}
                              </div>
                            </td>
                            <td>
                              <div className="dropdown dropdown-end">
                                <div tabIndex={0} role="button" className="btn btn-sm btn-outline">
                                  Update Status
                                </div>
                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                                  <li>
                                    <button
                                      onClick={() => updateSubscriptionStatus(service.name, 'Active')}
                                      className={status === 'Active' ? 'active' : ''}
                                    >
                                      <span className="text-success">✓</span> Active
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      onClick={() => updateSubscriptionStatus(service.name, 'Paused')}
                                      className={status === 'Paused' ? 'active' : ''}
                                    >
                                      <span className="text-warning">⏸</span> Paused
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      onClick={() => updateSubscriptionStatus(service.name, 'Cancelled')}
                                      className={status === 'Cancelled' ? 'active' : ''}
                                    >
                                      <span className="text-error">✗</span> Cancelled
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      onClick={() => updateSubscriptionStatus(service.name, '')}
                                      className={!status ? 'active' : ''}
                                    >
                                      <span className="text-base-content/50">○</span> Clear Status
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!selectedCustomer && !loading && (
            <div className="text-center py-8 text-base-content/60">
              Please select a corporate customer to view their subscription details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}