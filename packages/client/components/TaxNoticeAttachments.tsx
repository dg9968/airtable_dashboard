'use client'

import { useState, useEffect, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const FILE_TYPE_LABELS: Record<string, string> = {
  'original-letter': 'Original Letter',
  'additional-pages': 'Additional Pages',
  'response-draft': 'Response Draft',
  'signed-response': 'Signed Response',
  'proof-of-submission': 'Proof of Submission',
  'other': 'Other',
}

const FILE_TYPE_OPTIONS = Object.entries(FILE_TYPE_LABELS)

export interface Attachment {
  id: string
  noticeId: string | null
  fileName: string
  driveId: string | null
  viewUrl: string | null
  fileType: string
  uploadedBy: string
  uploadedAt: string
}

interface Props {
  noticeId: string
  legacyLetter?: { driveId: string | null; viewUrl: string | null; fileName: string | null }
  userName?: string
  onLegacyLetterRemoved?: () => void
}

export default function TaxNoticeAttachments({ noticeId, legacyLetter, userName = '', onLegacyLetterRemoved }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removingLegacy, setRemovingLegacy] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [fileType, setFileType] = useState('original-letter')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tax-notice-attachments/notice/${noticeId}`)
      const data = await res.json()
      if (data.success) setAttachments(data.data)
    } catch (err) {
      console.error('Failed to fetch attachments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttachments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId])

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      form.append('fileType', fileType)
      form.append('uploadedBy', userName)
      const res = await fetch(`${API_URL}/api/tax-notice-attachments/notice/${noticeId}`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        setAttachments(prev => [...prev, data.data])
        setShowUploadForm(false)
        setSelectedFile(null)
        setFileType('original-letter')
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Network error during upload')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async (attachmentId: string) => {
    if (!confirm('Remove this file?')) return
    setRemovingId(attachmentId)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/tax-notice-attachments/${attachmentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId))
      } else {
        setError(data.error || 'Remove failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setRemovingId(null)
    }
  }

  const handleLegacyRemove = async () => {
    if (!confirm('Remove the attached letter?')) return
    setRemovingLegacy(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/tax-notices/${noticeId}/letter`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        onLegacyLetterRemoved?.()
      } else {
        setError(data.error || 'Remove failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setRemovingLegacy(false)
    }
  }

  const hasLegacyLetter = !!legacyLetter?.driveId
  const total = (hasLegacyLetter ? 1 : 0) + attachments.length

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
            Attachments{total > 0 ? ` (${total})` : ''}
          </h2>
          <button
            onClick={() => { setShowUploadForm(v => !v); setError('') }}
            className="btn btn-xs btn-outline"
          >
            {showUploadForm ? 'Cancel' : '+ Add File'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-xs">
            <span>{error}</span>
            <button onClick={() => setError('')} className="btn btn-xs btn-ghost ml-auto">✕</button>
          </div>
        )}

        {showUploadForm && (
          <div className="border border-base-300 rounded-lg p-3 space-y-2 bg-base-200/40">
            <div>
              <label className="block text-xs text-base-content/60 mb-1">File Type</label>
              <select
                className="select select-bordered select-sm w-full"
                value={fileType}
                onChange={e => setFileType(e.target.value)}
              >
                {FILE_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="file-input file-input-bordered file-input-sm w-full"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-base-content/40 mt-1">PDF, JPG, PNG, DOC</p>
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="btn btn-sm btn-primary w-full"
            >
              {uploading
                ? <><span className="loading loading-spinner loading-xs" /> Uploading…</>
                : 'Upload'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-sm text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Legacy letter (from old single-file field) */}
            {hasLegacyLetter && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-base-200/50 border border-base-300">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-base-content/50 mb-0.5">Original Letter</p>
                  <p className="text-xs truncate text-base-content/80">{legacyLetter!.fileName || 'notice-letter'}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <a href={legacyLetter!.viewUrl!} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-ghost">View</a>
                  <a href={`${API_URL}/api/tax-notices/${noticeId}/letter/download`} download className="btn btn-xs btn-ghost">DL</a>
                  <button onClick={handleLegacyRemove} disabled={removingLegacy} className="btn btn-xs btn-ghost text-error">
                    {removingLegacy ? <span className="loading loading-spinner loading-xs" /> : '✕'}
                  </button>
                </div>
              </div>
            )}

            {/* New attachments */}
            {attachments.map(a => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-base-200/50 border border-base-300">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-base-content/50 mb-0.5">{FILE_TYPE_LABELS[a.fileType] || a.fileType}</p>
                  <p className="text-xs truncate text-base-content/80">{a.fileName}</p>
                  {a.uploadedBy && <p className="text-xs text-base-content/40 mt-0.5">by {a.uploadedBy}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {a.viewUrl && (
                    <a href={a.viewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-ghost">View</a>
                  )}
                  <a href={`${API_URL}/api/tax-notice-attachments/${a.id}/download`} download className="btn btn-xs btn-ghost">DL</a>
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={removingId === a.id}
                    className="btn btn-xs btn-ghost text-error"
                  >
                    {removingId === a.id ? <span className="loading loading-spinner loading-xs" /> : '✕'}
                  </button>
                </div>
              </div>
            ))}

            {!hasLegacyLetter && attachments.length === 0 && (
              <p className="text-xs text-base-content/40 text-center py-3">No attachments yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
