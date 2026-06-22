'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRequireRole } from '@/hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const CATEGORIES = [
  'CP2000', 'Audit', 'Collections', 'Levy/Lien', 'Garnishment', 'Penalty',
  'Informational', 'Missing Form', 'Processing Delay', 'Appeal', 'Other',
]
const TAX_TYPES = ['Individual', 'Business', 'Payroll', 'Sales Tax', 'Income Tax', 'Other']
const AGENCIES = ['IRS', 'State', 'Local', 'Other']

const today = new Date().toISOString().split('T')[0]

const inputCls = 'input input-bordered w-full'
const selectCls = 'select select-bordered w-full'
const labelCls = 'block text-sm text-base-content/70 mb-1'

interface ClientResult { id: string; name: string; phone: string }
interface EntityResult { id: string; name: string; ein: string }

export default function NewTaxNoticePage() {
  const { session, isPending } = useRequireRole(['admin', 'staff'])
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [triageResult, setTriageResult] = useState<{ priority: string; assignedOwner: string; danielReviewRequired: boolean } | null>(null)
  const [newNoticeId, setNewNoticeId] = useState<string | null>(null)

  const [form, setForm] = useState({
    clientName: '',
    entityName: '',
    noticeAgency: '',
    noticeNumber: '',
    noticeCategory: '',
    taxYear: '',
    taxType: '',
    dateReceived: today,
    responseDueDate: '',
    amountDue: '',
  })

  // --- Client Name search ---
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientResult[]>([])
  const [clientSearching, setClientSearching] = useState(false)
  const clientRef = useRef<HTMLDivElement>(null)

  // --- Entity Name search ---
  const [entitySearch, setEntitySearch] = useState('')
  const [entityResults, setEntityResults] = useState<EntityResult[]>([])
  const [entitySearching, setEntitySearching] = useState(false)
  const entityRef = useRef<HTMLDivElement>(null)

  // Debounced client search
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return }
    const t = setTimeout(async () => {
      setClientSearching(true)
      try {
        const res = await fetch(`${API_URL}/api/personal/search?q=${encodeURIComponent(clientSearch)}`)
        const data = await res.json()
        if (data.success) {
          setClientResults(
            (data.data || []).slice(0, 8).map((r: any) => ({
              id: r.id,
              name: r.fields?.['Full Name'] || '',
              phone: r.fields?.['📞Phone number'] || '',
            })).filter((r: ClientResult) => r.name)
          )
        }
      } catch { /* ignore */ } finally { setClientSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [clientSearch])

  // Debounced entity search
  useEffect(() => {
    if (entitySearch.length < 2) { setEntityResults([]); return }
    const t = setTimeout(async () => {
      setEntitySearching(true)
      try {
        const res = await fetch(`${API_URL}/api/companies/search?q=${encodeURIComponent(entitySearch)}`)
        const data = await res.json()
        if (data.success) {
          setEntityResults(
            (data.data || []).slice(0, 8).map((r: any) => ({
              id: r.id,
              name: r.name || '',
              ein: r.ein || '',
            })).filter((r: EntityResult) => r.name)
          )
        }
      } catch { /* ignore */ } finally { setEntitySearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [entitySearch])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientResults([])
      if (entityRef.current && !entityRef.current.contains(e.target as Node)) setEntityResults([])
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectClient = (r: ClientResult) => {
    setForm(prev => ({ ...prev, clientName: r.name }))
    setClientSearch('')
    setClientResults([])
  }

  const selectEntity = (r: EntityResult) => {
    setForm(prev => ({ ...prev, entityName: r.name }))
    setEntitySearch('')
    setEntityResults([])
  }

  const clearClient = () => setForm(prev => ({ ...prev, clientName: '' }))
  const clearEntity = () => setForm(prev => ({ ...prev, entityName: '' }))

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientName.trim()) { setError('Client Name is required.'); return }
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, any> = {
        ...form,
        amountDue: form.amountDue ? Number(form.amountDue) : undefined,
        createdBy: (session?.user as any)?.name || '',
      }
      const res = await fetch(`${API_URL}/api/tax-notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to create notice'); return }
      setTriageResult(data.triage)
      setNewNoticeId(data.data.id)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  )
  if (!session) return null

  if (triageResult && newNoticeId) {
    const priorityColor = triageResult.priority === 'High' ? 'text-error' : triageResult.priority === 'Medium' ? 'text-warning' : 'text-base-content/60'
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="card bg-base-100 shadow-xl max-w-md w-full">
          <div className="card-body text-center">
            <div className="text-5xl mb-2">✅</div>
            <h2 className="card-title justify-center text-2xl">Notice Created</h2>
            <p className="text-base-content/60 mb-4">Auto-triage results:</p>
            <div className="space-y-2 text-left mb-6">
              <div className="flex justify-between items-center bg-base-200 rounded-lg px-4 py-3">
                <span className="text-base-content/60 text-sm">Priority</span>
                <span className={`font-bold ${priorityColor}`}>{triageResult.priority}</span>
              </div>
              <div className="flex justify-between items-center bg-base-200 rounded-lg px-4 py-3">
                <span className="text-base-content/60 text-sm">Assigned To</span>
                <span className="font-bold text-base-content">{triageResult.assignedOwner}</span>
              </div>
              <div className="flex justify-between items-center bg-base-200 rounded-lg px-4 py-3">
                <span className="text-base-content/60 text-sm">Daniel Review</span>
                <span className={`font-bold ${triageResult.danielReviewRequired ? 'text-error' : 'text-success'}`}>
                  {triageResult.danielReviewRequired ? 'Required' : 'Not Required'}
                </span>
              </div>
            </div>
            <div className="card-actions flex gap-3">
              <button onClick={() => router.push(`/tax-notices/${newNoticeId}`)} className="btn btn-primary flex-1">
                View Notice
              </button>
              <button
                onClick={() => {
                  setTriageResult(null)
                  setNewNoticeId(null)
                  setForm({ clientName: '', entityName: '', noticeAgency: '', noticeNumber: '', noticeCategory: '', taxYear: '', taxType: '', dateReceived: today, responseDueDate: '', amountDue: '' })
                  setClientSearch('')
                  setEntitySearch('')
                }}
                className="btn btn-ghost flex-1"
              >
                Add Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6">
          <Link href="/tax-notices" className="text-base-content/60 hover:text-base-content text-sm">← Tax Notices</Link>
        </div>
        <h1 className="text-2xl font-bold text-base-content mb-1">New Tax Notice</h1>
        <p className="text-base-content/60 text-sm mb-8">Complete all required fields. Priority and assignment are set automatically.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Client Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                {/* Client Name — search Personal table */}
                <div ref={clientRef} className="relative">
                  <label className={labelCls}>Client Name <span className="text-error">*</span></label>
                  {form.clientName ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 input input-bordered flex items-center bg-base-200">
                        <span className="text-sm truncate">{form.clientName}</span>
                      </div>
                      <button type="button" onClick={clearClient} className="btn btn-sm btn-ghost btn-square" title="Clear">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          className={inputCls}
                          placeholder="Search by name..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          autoComplete="off"
                        />
                        {clientSearching && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="loading loading-spinner loading-xs"></span>
                          </span>
                        )}
                      </div>
                      {clientResults.length > 0 && (
                        <ul className="absolute z-20 left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden">
                          {clientResults.map(r => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="w-full text-left px-4 py-2.5 hover:bg-base-200 transition-colors"
                                onClick={() => selectClient(r)}
                              >
                                <div className="text-sm font-medium text-base-content">{r.name}</div>
                                {r.phone && <div className="text-xs text-base-content/50">{r.phone}</div>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {clientSearch.length >= 2 && !clientSearching && clientResults.length === 0 && (
                        <p className="text-xs text-base-content/40 mt-1">No clients found — you can type the name manually and press Enter or continue filling the form.</p>
                      )}
                    </>
                  )}
                  {/* Hidden required input for validation */}
                  <input type="hidden" required value={form.clientName} />
                </div>

                {/* Entity Name — search Corporations table */}
                <div ref={entityRef} className="relative">
                  <label className={labelCls}>Entity Name <span className="text-base-content/40 text-xs font-normal">(optional)</span></label>
                  {form.entityName ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 input input-bordered flex items-center bg-base-200">
                        <span className="text-sm truncate">{form.entityName}</span>
                      </div>
                      <button type="button" onClick={clearEntity} className="btn btn-sm btn-ghost btn-square" title="Clear">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          className={inputCls}
                          placeholder="Search by company name..."
                          value={entitySearch}
                          onChange={e => setEntitySearch(e.target.value)}
                          autoComplete="off"
                        />
                        {entitySearching && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="loading loading-spinner loading-xs"></span>
                          </span>
                        )}
                      </div>
                      {entityResults.length > 0 && (
                        <ul className="absolute z-20 left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden">
                          {entityResults.map(r => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="w-full text-left px-4 py-2.5 hover:bg-base-200 transition-colors"
                                onClick={() => selectEntity(r)}
                              >
                                <div className="text-sm font-medium text-base-content">{r.name}</div>
                                {r.ein && <div className="text-xs text-base-content/50">EIN: {r.ein}</div>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {entitySearch.length >= 2 && !entitySearching && entityResults.length === 0 && (
                        <p className="text-xs text-base-content/40 mt-1">No entities found — you can type the name manually and continue.</p>
                      )}
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Notice Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Notice Agency <span className="text-error">*</span></label>
                  <select required className={selectCls} value={form.noticeAgency} onChange={e => set('noticeAgency', e.target.value)}>
                    <option value="">Select agency...</option>
                    {AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notice Number <span className="text-error">*</span></label>
                  <input required className={`${inputCls} font-mono`} value={form.noticeNumber} onChange={e => set('noticeNumber', e.target.value)} placeholder="CP2000, LT11, etc." />
                </div>
                <div>
                  <label className={labelCls}>Notice Category <span className="text-error">*</span></label>
                  <select required className={selectCls} value={form.noticeCategory} onChange={e => set('noticeCategory', e.target.value)}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tax Type <span className="text-error">*</span></label>
                  <select required className={selectCls} value={form.taxType} onChange={e => set('taxType', e.target.value)}>
                    <option value="">Select type...</option>
                    {TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tax Year</label>
                  <input className={inputCls} value={form.taxYear} onChange={e => set('taxYear', e.target.value)} placeholder="2023" />
                </div>
                <div>
                  <label className={labelCls}>Amount Due / Proposed</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={form.amountDue} onChange={e => set('amountDue', e.target.value)} placeholder="0.00" />
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Dates</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Date Received <span className="text-error">*</span></label>
                  <input required type="date" className={inputCls} value={form.dateReceived} onChange={e => set('dateReceived', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Response Due Date <span className="text-error">*</span></label>
                  <input required type="date" className={inputCls} value={form.responseDueDate} onChange={e => set('responseDueDate', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? <span className="loading loading-spinner loading-sm"></span> : 'Create Notice'}
            </button>
            <Link href="/tax-notices" className="btn btn-ghost flex-1">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
