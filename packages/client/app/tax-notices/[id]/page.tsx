'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRequireRole } from '@/hooks/useAuth'
import TaxNoticeNotes from '@/components/TaxNoticeNotes'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BADGE = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold'

const STATUS_COLOR: Record<string, string> = {
  'New Notice': 'bg-gray-500 text-white',
  'Scanned / Uploaded': 'bg-blue-600 text-white',
  'Initial Review': 'bg-indigo-600 text-white',
  'Waiting on Client': 'bg-yellow-500 text-black',
  'Research / Drafting': 'bg-purple-600 text-white',
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

const OWNERS = ['Daniel', 'Genesis', 'Javier', 'Scarlett', 'Evelina']

const inputCls = 'input input-bordered w-full'
const selectCls = 'select select-bordered w-full'
const labelCls = 'block text-sm text-base-content/70 mb-1'
const textareaCls = 'textarea textarea-bordered w-full'

interface Notice {
  id: string
  clientName: string
  entityName: string
  noticeAgency: string
  noticeNumber: string
  taxYear: string
  taxType: string
  dateReceived: string
  responseDueDate: string
  amountDue: number | null
  noticeCategory: string
  assignedOwner: string
  supportingTeamMember: string
  status: string
  priority: string
  danielReviewRequired: boolean
  clientDocumentsNeeded: string
  responseFiledDate: string
  proofOfSubmissionUploaded: boolean
  finalResolution: string
  createdBy: string
  createdTime: string
  validNextStatuses: string[]
}

export default function TaxNoticeDetailPage() {
  const { session, isPending } = useRequireRole(['admin', 'staff'])
  const params = useParams()
  const id = params.id as string

  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [assignedOwner, setAssignedOwner] = useState('')
  const [supportingTeamMember, setSupportingTeamMember] = useState('')
  const [priority, setPriority] = useState('')
  const [danielReviewRequired, setDanielReviewRequired] = useState(false)
  const [clientDocumentsNeeded, setClientDocumentsNeeded] = useState('')
  const [responseFiledDate, setResponseFiledDate] = useState('')
  const [proofUploaded, setProofUploaded] = useState(false)
  const [finalResolution, setFinalResolution] = useState('')

  const fetchNotice = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/tax-notices/${id}`)
      const data = await res.json()
      if (data.success) {
        const n = data.data
        setNotice(n)
        setAssignedOwner(n.assignedOwner)
        setSupportingTeamMember(n.supportingTeamMember)
        setPriority(n.priority)
        setDanielReviewRequired(n.danielReviewRequired)
        setClientDocumentsNeeded(n.clientDocumentsNeeded)
        setResponseFiledDate(n.responseFiledDate)
        setProofUploaded(n.proofOfSubmissionUploaded)
        setFinalResolution(n.finalResolution)
      }
    } catch (err) {
      console.error('Failed to fetch notice:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isPending && session) fetchNotice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session, id])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/tax-notices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedOwner,
          supportingTeamMember,
          priority,
          danielReviewRequired,
          clientDocumentsNeeded,
          responseFiledDate: responseFiledDate || null,
          proofOfSubmissionUploaded: proofUploaded,
          finalResolution,
        }),
      })
      const data = await res.json()
      if (data.success) { setNotice(data.data); showSuccess('Saved successfully') }
      else setError(data.error || 'Save failed')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceStatus = async (targetStatus: string) => {
    setAdvancing(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/tax-notices/${id}/advance-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus }),
      })
      const data = await res.json()
      if (data.success) { setNotice(data.data); showSuccess(`Status updated to "${targetStatus}"`) }
      else setError(data.error || 'Status update failed')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setAdvancing(false)
    }
  }

  if (isPending || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  )

  if (!session || !notice) return null

  const daysUntilDue = notice.responseDueDate
    ? Math.ceil((new Date(notice.responseDueDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const dueDateColor = daysUntilDue != null
    ? daysUntilDue < 0 ? 'text-error' : daysUntilDue <= 7 ? 'text-orange-500' : daysUntilDue <= 14 ? 'text-warning' : 'text-base-content'
    : 'text-base-content'

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mb-6">
          <ul>
            <li><Link href="/tax-notices">Tax Notices</Link></li>
            <li>{notice.clientName} — {notice.noticeNumber}</li>
          </ul>
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="alert alert-error mb-4">
            <span>{error}</span>
            <button onClick={() => setError('')} className="btn btn-xs btn-ghost">✕</button>
          </div>
        )}
        {successMsg && (
          <div role="alert" className="alert alert-success mb-4">
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Notice info + workflow */}
          <div className="lg:col-span-2 space-y-4">

            {/* Header card */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-base-content">{notice.clientName}</h1>
                    {notice.entityName && <p className="text-base-content/60 text-sm mt-0.5">{notice.entityName}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <span className={`${BADGE} ${PRIORITY_COLOR[notice.priority] || 'bg-gray-400 text-white'}`}>
                      {notice.priority}
                    </span>
                    <span className={`${BADGE} ${STATUS_COLOR[notice.status] || 'bg-gray-400 text-white'}`}>
                      {notice.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-base-content/50 text-xs mb-0.5">Notice Number</p><p className="font-mono font-semibold">{notice.noticeNumber}</p></div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Agency</p><p>{notice.noticeAgency}</p></div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Category</p><p>{notice.noticeCategory}</p></div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Tax Type</p><p>{notice.taxType}</p></div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Tax Year</p><p>{notice.taxYear || '—'}</p></div>
                  <div>
                    <p className="text-base-content/50 text-xs mb-0.5">Amount Due</p>
                    <p>{notice.amountDue != null ? `$${notice.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</p>
                  </div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Date Received</p><p>{fmt(notice.dateReceived)}</p></div>
                  <div>
                    <p className="text-base-content/50 text-xs mb-0.5">Response Due</p>
                    <p className={`font-semibold ${dueDateColor}`}>
                      {fmt(notice.responseDueDate)}
                      {daysUntilDue != null && (
                        <span className="text-xs ml-1.5 opacity-75">
                          ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d left`})
                        </span>
                      )}
                    </p>
                  </div>
                  <div><p className="text-base-content/50 text-xs mb-0.5">Created By</p><p>{notice.createdBy || '—'}</p></div>
                </div>
              </div>
            </div>

            {/* Workflow controls */}
            <div className="card bg-base-100 shadow">
              <div className="card-body space-y-4">
                <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Workflow Controls</h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Assigned Owner</label>
                    <select className={selectCls} value={assignedOwner} onChange={e => setAssignedOwner(e.target.value)}>
                      {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Supporting Team Member</label>
                    <select className={selectCls} value={supportingTeamMember} onChange={e => setSupportingTeamMember(e.target.value)}>
                      <option value="">None</option>
                      {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Priority</label>
                    <select className={selectCls} value={priority} onChange={e => setPriority(e.target.value)}>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="danielReview"
                      checked={danielReviewRequired}
                      onChange={e => setDanielReviewRequired(e.target.checked)}
                      className="checkbox checkbox-error"
                    />
                    <label htmlFor="danielReview" className="text-sm cursor-pointer">Daniel Review Required</label>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Client Documents Needed</label>
                  <textarea className={textareaCls} rows={3} value={clientDocumentsNeeded} onChange={e => setClientDocumentsNeeded(e.target.value)} placeholder="List any documents still needed from the client..." />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Response Filed Date</label>
                    <input type="date" className={inputCls} value={responseFiledDate} onChange={e => setResponseFiledDate(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="proofUploaded"
                      checked={proofUploaded}
                      onChange={e => setProofUploaded(e.target.checked)}
                      className="checkbox checkbox-success"
                    />
                    <label htmlFor="proofUploaded" className="text-sm cursor-pointer">Proof of Submission Uploaded</label>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Final Resolution</label>
                  <textarea className={textareaCls} rows={3} value={finalResolution} onChange={e => setFinalResolution(e.target.value)} placeholder="Describe how the notice was resolved..." />
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                    {saving ? <span className="loading loading-spinner loading-xs"></span> : null}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <TaxNoticeNotes noticeId={notice.id} clientName={notice.clientName} />
          </div>

          {/* RIGHT: Status */}
          <div className="space-y-4">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-3">Current Status</h2>
                <div className={`${BADGE} w-full justify-center py-3 text-sm ${STATUS_COLOR[notice.status] || 'bg-gray-400 text-white'}`}>
                  {notice.status}
                </div>

                {notice.danielReviewRequired && (
                  <div role="alert" className="alert alert-error mt-3 py-2 text-xs">
                    <span>⚠ Daniel review required</span>
                  </div>
                )}

                {notice.validNextStatuses.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-base-content/50 font-medium">Move to:</p>
                    {notice.validNextStatuses.map(s => (
                      <button
                        key={s}
                        onClick={() => handleAdvanceStatus(s)}
                        disabled={advancing}
                        className="btn btn-sm btn-outline w-full justify-start gap-2"
                      >
                        {advancing
                          ? <span className="loading loading-spinner loading-xs"></span>
                          : <span className="opacity-40">→</span>}
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {notice.status === 'Closed / Archived' && (
                  <p className="text-xs text-base-content/40 mt-4 text-center">Notice is closed.</p>
                )}
              </div>
            </div>

            {/* Submission summary */}
            <div className="card bg-base-100 shadow">
              <div className="card-body space-y-3">
                <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Submission</h2>
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Filed Date</span>
                  <span>{fmt(notice.responseFiledDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Proof Uploaded</span>
                  <span className={notice.proofOfSubmissionUploaded ? 'text-success font-medium' : 'text-base-content/40'}>
                    {notice.proofOfSubmissionUploaded ? '✓ Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
