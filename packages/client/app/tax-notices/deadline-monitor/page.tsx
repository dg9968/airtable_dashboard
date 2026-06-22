'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRequireRole } from '@/hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BADGE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

const STATUS_COLOR: Record<string, string> = {
  'New Notice': 'bg-gray-500 text-white',
  'Scanned / Uploaded': 'bg-blue-600 text-white',
  'Initial Review': 'bg-indigo-600 text-white',
  'Waiting on Client': 'bg-yellow-500 text-black',
  'Research / Drafting': 'bg-purple-600 text-white',
  'Needs Daniel Review': 'bg-red-600 text-white',
  'Ready to Submit': 'bg-green-600 text-white',
}

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
  priority: string
  status: string
  assignedOwner: string
  responseDueDate: string
  daysUntilDue: number
}

function NoticeRow({ n }: { n: Notice }) {
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const isOverdue = n.daysUntilDue < 0

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-base-300 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-medium text-sm text-base-content">{n.clientName}</span>
          {n.entityName && <span className="text-base-content/50 text-xs">{n.entityName}</span>}
          <span className={`${BADGE} ${PRIORITY_COLOR[n.priority] || 'bg-gray-400 text-white'}`}>{n.priority}</span>
          <span className={`${BADGE} ${STATUS_COLOR[n.status] || 'bg-gray-400 text-white'}`}>{n.status}</span>
        </div>
        <div className="text-xs text-base-content/50">
          <span className="font-mono">{n.noticeNumber}</span>
          <span className="mx-2">·</span>
          {n.noticeCategory}
          <span className="mx-2">·</span>
          {n.assignedOwner}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold ${isOverdue ? 'text-error' : n.daysUntilDue <= 7 ? 'text-orange-500' : n.daysUntilDue <= 14 ? 'text-warning' : 'text-base-content/60'}`}>
          {isOverdue ? `${Math.abs(n.daysUntilDue)}d overdue` : `${n.daysUntilDue}d`}
        </div>
        <div className="text-xs text-base-content/40">{fmt(n.responseDueDate)}</div>
        <Link href={`/tax-notices/${n.id}`} className="mt-1 btn btn-xs btn-primary">
          View
        </Link>
      </div>
    </div>
  )
}

function Section({ title, notices, alertCls }: { title: string; notices: Notice[]; alertCls: string }) {
  if (notices.length === 0) return null
  return (
    <div className="card bg-base-100 shadow overflow-hidden">
      <div className={`px-5 py-3 ${alertCls}`}>
        <h2 className="font-semibold text-sm">{title} <span className="opacity-70 font-normal">({notices.length})</span></h2>
      </div>
      <div className="px-5">
        {notices.map(n => <NoticeRow key={n.id} n={n} />)}
      </div>
    </div>
  )
}

export default function DeadlineMonitorPage() {
  const { session, isPending } = useRequireRole(['admin', 'staff'])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API_URL}/api/tax-notices/deadline-monitor`)
      .then(r => r.json())
      .then(data => { if (data.success) setNotices(data.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isPending && session) load()
  }, [isPending, session, load])

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  )
  if (!session) return null

  const overdue = notices.filter(n => n.daysUntilDue < 0)
  const due7 = notices.filter(n => n.daysUntilDue >= 0 && n.daysUntilDue <= 7)
  const due14 = notices.filter(n => n.daysUntilDue > 7 && n.daysUntilDue <= 14)
  const later = notices.filter(n => n.daysUntilDue > 14)

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/tax-notices" className="text-base-content/60 hover:text-base-content text-sm">← Tax Notices</Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Deadline Monitor</h1>
            <p className="text-base-content/60 text-sm mt-1">All open notices with pending response deadlines</p>
          </div>
          <button onClick={load} className="btn btn-ghost btn-sm">Refresh</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : notices.length === 0 ? (
          <div className="card bg-base-100 shadow">
            <div className="card-body items-center text-center py-16">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="card-title">No pending deadlines</h2>
              <p className="text-base-content/60 text-sm">All open notices have been addressed.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Section title="⚠ Overdue" notices={overdue} alertCls="bg-error/20 text-error border-b border-error/30" />
            <Section title="🔴 Due in 1–7 days" notices={due7} alertCls="bg-orange-500/15 text-orange-600 border-b border-orange-500/30" />
            <Section title="🟡 Due in 8–14 days" notices={due14} alertCls="bg-warning/15 text-warning border-b border-warning/30" />
            <Section title="🟢 Due in 15+ days" notices={later} alertCls="bg-base-200 text-base-content/70 border-b border-base-300" />
          </div>
        )}

        <div className="mt-4 text-xs text-base-content/40">{notices.length} notice{notices.length !== 1 ? 's' : ''} with open deadlines</div>
      </div>
    </div>
  )
}
