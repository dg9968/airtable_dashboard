'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRequireRole } from '@/hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BADGE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold'

const STATUS_COLOR: Record<string, string> = {
  'New Notice': 'bg-gray-500 text-white',
  'Scanned / Uploaded': 'bg-blue-600 text-white',
  'Initial Review': 'bg-indigo-600 text-white',
  'Waiting on Client': 'bg-yellow-500 text-black',
  'Research / Drafting': 'bg-purple-600 text-white',
  'Drafting Response': 'bg-violet-600 text-white',
  'Awaiting Client Signature': 'bg-amber-500 text-black',
  'Response Signed': 'bg-teal-500 text-white',
  'Needs Daniel Review': 'bg-red-600 text-white',
  'Ready to Submit': 'bg-green-600 text-white',
  'Submitted': 'bg-teal-600 text-white',
  'Waiting on Agency': 'bg-orange-500 text-white',
  'Resolved': 'bg-emerald-600 text-white',
  'Closed / Archived': 'bg-gray-400 text-white',
}

const PRIORITY_COLOR: Record<string, string> = {
  'High': 'bg-red-600 text-white',
  'Medium': 'bg-yellow-500 text-black',
  'Low': 'bg-gray-400 text-white',
}

const STATUSES = [
  'New Notice', 'Scanned / Uploaded', 'Initial Review', 'Waiting on Client',
  'Research / Drafting', 'Drafting Response', 'Awaiting Client Signature', 'Response Signed',
  'Needs Daniel Review', 'Ready to Submit',
  'Submitted', 'Waiting on Agency', 'Resolved', 'Closed / Archived',
]
const OWNERS = ['Daniel', 'Genesis', 'Javier', 'Scarlett', 'Evelina']
const AGENCIES = ['IRS', 'State', 'Local', 'Other']

interface Notice {
  id: string
  clientName: string
  entityName: string
  noticeNumber: string
  noticeCategory: string
  noticeAgency: string
  taxYear: string
  priority: string
  status: string
  assignedOwner: string
  responseDueDate: string
  daysUntilDue: number
  danielReviewRequired: boolean
  amountDue: number | null
  letterDriveId: string | null
}

export default function TaxNoticesPage() {
  const { session, isPending } = useRequireRole(['admin', 'staff'])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterAgency, setFilterAgency] = useState('')

  const fetchNotices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterPriority) params.set('priority', filterPriority)
      if (filterOwner) params.set('assignedOwner', filterOwner)
      if (filterAgency) params.set('agency', filterAgency)
      const res = await fetch(`${API_URL}/api/tax-notices?${params}`)
      const data = await res.json()
      if (data.success) setNotices(data.data)
    } catch (err) {
      console.error('Failed to fetch tax notices:', err)
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterPriority, filterOwner, filterAgency])

  useEffect(() => {
    if (!isPending && session) fetchNotices()
  }, [isPending, session, fetchNotices])

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  )
  if (!session) return null

  const urgencyClass = (days: number) => {
    if (days < 0) return 'bg-red-500/10'
    if (days <= 7) return 'bg-orange-500/10'
    return ''
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Tax Notices</h1>
            <p className="text-base-content/60 text-sm mt-1">IRS letters, state notices, and tax correspondence</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/tax-notices/deadline-monitor" className="btn btn-ghost btn-sm">
              Deadline Monitor
            </Link>
            <Link href="/tax-notices/review-queue" className="btn btn-ghost btn-sm">
              Review Queue
            </Link>
            <Link href="/tax-notices/new" className="btn btn-primary btn-sm">
              + New Notice
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Search client or notice #..."
                className="input input-bordered input-sm col-span-2 md:col-span-1"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchNotices()}
              />
              <select className="select select-bordered select-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="select select-bordered select-sm" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select className="select select-bordered select-sm" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
                <option value="">All Owners</option>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="select select-bordered select-sm" value={filterAgency} onChange={e => setFilterAgency(e.target.value)}>
                <option value="">All Agencies</option>
                {AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card bg-base-100 shadow overflow-hidden">
          {loading ? (
            <div className="card-body flex items-center justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : notices.length === 0 ? (
            <div className="card-body text-center py-16 text-base-content/50">No notices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Notice #</th>
                    <th>Category</th>
                    <th>Agency</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Due Date</th>
                    <th>Days Left</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map(n => (
                    <tr key={n.id} className={`hover ${urgencyClass(n.daysUntilDue)}`}>
                      <td className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {n.letterDriveId && (
                            <span title="Letter attached" className="text-primary flex-shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            </span>
                          )}
                          <span>
                            {n.clientName}
                            {n.entityName && <div className="text-xs opacity-60">{n.entityName}</div>}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{n.noticeNumber}</td>
                      <td>{n.noticeCategory}</td>
                      <td>{n.noticeAgency}</td>
                      <td>
                        <span className={`${BADGE} ${PRIORITY_COLOR[n.priority] || 'bg-gray-400 text-white'}`}>
                          {n.priority}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`${BADGE} ${STATUS_COLOR[n.status] || 'bg-gray-400 text-white'}`}>
                            {n.status}
                          </span>
                          {n.danielReviewRequired && (
                            <span className={`${BADGE} bg-red-600 text-white`}>D</span>
                          )}
                        </div>
                      </td>
                      <td>{n.assignedOwner}</td>
                      <td className="text-xs">
                        {n.responseDueDate
                          ? new Date(n.responseDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>
                        {n.responseDueDate ? (
                          <span className={`text-xs font-semibold ${n.daysUntilDue < 0 ? 'text-error' : n.daysUntilDue <= 7 ? 'text-warning' : n.daysUntilDue <= 14 ? 'text-warning' : 'text-base-content/50'}`}>
                            {n.daysUntilDue < 0 ? `${Math.abs(n.daysUntilDue)}d overdue` : `${n.daysUntilDue}d`}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <Link href={`/tax-notices/${n.id}`} className="btn btn-xs btn-primary">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-base-content/40">{notices.length} notice{notices.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
  )
}
