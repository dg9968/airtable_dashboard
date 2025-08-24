'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

export default function BankStatementProcessing() {
  const { data: session } = useSession()
  const [isUploading, setIsUploading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [qboDownloadUrl, setQboDownloadUrl] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type - bank statements are typically PDF or CSV
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or CSV file')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file size (max 25MB for bank statements)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File too large (max 25MB)')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setIsUploading(true)
    setError('')
    setUploadResult(null)
    setQboDownloadUrl('')
    setProcessingStatus('Uploading to S3...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('processingType', 'bank-statement')

      const response = await fetch('/api/bank-statement-processing', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadResult(result)
      setProcessingStatus('File uploaded successfully. Processing started...')
      
      // Start polling for processing status
      pollProcessingStatus(result.fileKey)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProcessingStatus('')
    } finally {
      setIsUploading(false)
    }
  }

  const pollProcessingStatus = async (fileKey: string) => {
    const maxPolls = 60 // Poll for up to 5 minutes
    let pollCount = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/bank-statement-processing/status?fileKey=${encodeURIComponent(fileKey)}`)
        const statusResult = await response.json()

        if (response.ok) {
          setProcessingStatus(statusResult.status)

          if (statusResult.processed && statusResult.qboUrl) {
            setProcessingStatus('Processing complete! QBO file ready for download.')
            setQboDownloadUrl(statusResult.qboUrl)
            return
          }

          if (statusResult.error) {
            setError(`Processing failed: ${statusResult.error}`)
            setProcessingStatus('')
            return
          }
        }

        pollCount++
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          setProcessingStatus('Processing is taking longer than expected. Please check back later.')
        }
      } catch (err) {
        console.error('Error polling status:', err)
        setProcessingStatus('Unable to check processing status')
      }
    }

    setTimeout(poll, 2000) // Start polling after 2 seconds
  }

  const downloadQbo = async () => {
    if (!qboDownloadUrl) return

    try {
      const response = await fetch(qboDownloadUrl)
      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bank_statement_${Date.now()}.qbo`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Failed to download QBO file')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please sign in to access bank statement processing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">
            Bank Statement to QBO Processing
          </h1>
          <p className="text-base-content/70">
            Upload your bank statements and convert them to QuickBooks (.qbo) format
          </p>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">Upload Bank Statement</h2>
            
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Select bank statement file</span>
                <span className="label-text-alt">PDF or CSV format</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                className="file-input file-input-bordered w-full"
                accept=".pdf,.csv,.xls,.xlsx"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label className="label">
                <span className="label-text-alt">
                  Supported: PDF, CSV files (max 25MB)
                </span>
              </label>
            </div>

            {isUploading && (
              <div className="alert alert-warning mt-4">
                <span className="loading loading-spinner loading-sm"></span>
                <span>Uploading file to S3...</span>
              </div>
            )}

            {processingStatus && (
              <div className="alert alert-info mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{processingStatus}</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {uploadResult && (
              <div className="alert alert-success mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-bold">Upload successful!</div>
                  <div className="text-sm">
                    File Key: <code className="text-xs">{uploadResult.fileKey}</code>
                  </div>
                </div>
              </div>
            )}

            {qboDownloadUrl && (
              <div className="card bg-primary text-primary-content mt-4">
                <div className="card-body">
                  <h3 className="card-title">QBO File Ready!</h3>
                  <p>Your bank statement has been processed and converted to QBO format.</p>
                  <div className="card-actions justify-end">
                    <button 
                      className="btn btn-secondary" 
                      onClick={downloadQbo}
                    >
                      Download QBO File
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="divider">Process Information</div>
            
            <div className="bg-base-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">How it works:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Upload your bank statement (PDF or CSV format)</li>
                <li>File is uploaded to Amazon S3 for processing</li>
                <li>Our AWS functions automatically parse the statement</li>
                <li>The processed file is converted to QBO format</li>
                <li>Download your QBO file when processing is complete</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}