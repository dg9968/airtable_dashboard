'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRequireRole } from '@/hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BADGE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

const PRIORITY_COLOR: Record<string, string> = {
  'High': 'bg-red-600 text-white',
  'Medium': 'bg-yellow-500 text-black',
  'Low': 'bg-gray-400 text-white',
}

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
  amountDue: number | null
  danielReviewRequired: boolean
}

export default function ReviewQueuePage() {
  const { session, isPending } = useRequireRole('admin')
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isPending && session) {
      fetch(`${API_URL}/api/tax-notices/review-queue`)
        .then(r => r.json())
        .then(data => { if (data.success) setNotices(data.data) })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [isPending, session])

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  )
  if (!session) return null

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/tax-notices" className="text-base-content/60 hover:text-base-content text-sm">← Tax Notices</Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content">Daniel's Review Queue</h1>
          <p className="text-base-content/60 text-sm mt-1">Notices requiring owner review — sorted by urgency</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : notices.length === 0 ? (
          <div className="card bg-base-100 shadow">
            <div className="card-body items-center text-center py-16">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="card-title">Queue is clear</h2>
              <p className="text-base-content/60 text-sm">No notices currently require your review.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => {
              const isOverdue = n.daysUntilDue < 0
              const isUrgent = !isOverdue && n.daysUntilDue <= 7
              const borderColor = isOverdue ? 'border-l-error' : isUrgent ? 'border-l-orange-500' : 'border-l-base-300'

              return (
                <div key={n.id} className={`card bg-base-100 shadow border-l-4 ${borderColor}`}>
                  <div className="card-body py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-base-content font-semibold text-lg">{n.clientName}</h3>
                          {n.entityName && <span className="text-base-content/50 text-sm">{n.entityName}</span>}
                          <span className={`${BADGE} ${PRIORITY_COLOR[n.priority] || 'bg-gray-400 text-white'}`}>{n.priority}</span>
                          {n.status === 'Needs Daniel Review' && (
                            <span className={`${BADGE} bg-red-600 text-white`}>Needs Review</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/70">
                          <span><span className="text-base-content/40">Notice:</span> <span className="font-mono">{n.noticeNumber}</span></span>
                          <span><span className="text-base-content/40">Category:</span> {n.noticeCategory}</span>
                          <span><span className="text-base-content/40">Agency:</span> {n.noticeAgency}</span>
                          {n.taxYear && <span><span className="text-base-content/40">Year:</span> {n.taxYear}</span>}
                          {n.amountDue != null && (
                            <span><span className="text-base-content/40">Amount:</span> ${n.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          )}
                          <span><span className="text-base-content/40">Drafter:</span> {n.assignedOwner}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${isOverdue ? 'text-error' : isUrgent ? 'text-orange-500' : 'text-base-content/60'}`}>
                          {isOverdue ? `${Math.abs(n.daysUntilDue)}d overdue` : `${n.daysUntilDue}d left`}
                        </div>
                        <div className="text-xs text-base-content/40 mt-0.5">{fmt(n.responseDueDate)}</div>
                        <Link href={`/tax-notices/${n.id}`} className="mt-3 btn btn-sm btn-primary">
                          Review →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-base-content/40">{notices.length} notice{notices.length !== 1 ? 's' : ''} pending review</div>
      </div>
    </div>
  )
}
