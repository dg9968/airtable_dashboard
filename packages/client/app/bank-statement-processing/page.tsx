'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import CsvCombiner from '@/components/CsvCombiner'

export default function BankStatementProcessing() {
  const { data: session } = useSession()
  const [isUploading, setIsUploading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [qboDownloadUrl, setQboDownloadUrl] = useState<string>('')
  const [processingStage, setProcessingStage] = useState<number>(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0)
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
    setProcessingStage(0)
    setEstimatedTimeRemaining(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('processingType', 'bank-statement')

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/bank-statement-processing`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadResult(result)
      setProcessingStatus('File uploaded successfully. Processing started...')
      setProcessingStage(1)
      setEstimatedTimeRemaining(90) // Estimate 90 seconds total
      
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const response = await fetch(`${apiUrl}/api/bank-statement-processing/status?fileKey=${encodeURIComponent(fileKey)}`)
        const statusResult = await response.json()

        if (response.ok) {
          setProcessingStatus(statusResult.status)

          // Update processing stage based on status message
          if (statusResult.status.includes('Processing bank statement')) {
            setProcessingStage(1)
            setEstimatedTimeRemaining(Math.max(0, 90 - statusResult.elapsedTime))
          } else if (statusResult.status.includes('Extracting transaction')) {
            setProcessingStage(2) 
            setEstimatedTimeRemaining(Math.max(0, 60 - statusResult.elapsedTime))
          } else if (statusResult.status.includes('Converting to QBO')) {
            setProcessingStage(3)
            setEstimatedTimeRemaining(Math.max(0, 30 - statusResult.elapsedTime))
          } else if (statusResult.status.includes('Finalizing')) {
            setProcessingStage(4)
            setEstimatedTimeRemaining(Math.max(0, 10 - statusResult.elapsedTime))
          }

          if (statusResult.processed && statusResult.qboUrl) {
            setProcessingStatus('Processing complete! QBO file ready for download.')
            setProcessingStage(5)
            setEstimatedTimeRemaining(0)
            // Prepend API URL if the qboUrl is a relative path
            const fullQboUrl = statusResult.qboUrl.startsWith('http')
              ? statusResult.qboUrl
              : `${apiUrl}${statusResult.qboUrl}`
            setQboDownloadUrl(fullQboUrl)
            return
          }

          if (statusResult.error) {
            setError(`Processing failed: ${statusResult.error}`)
            setProcessingStatus('')
            setProcessingStage(0)
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

  // Check if user has staff or admin role
  const userRole = (session.user as any)?.role
  if (userRole !== 'staff' && userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You need staff or admin privileges to access bank statement processing.</p>
          <div className="mt-4">
            <div className="badge badge-warning">Current Role: {userRole || 'None'}</div>
          </div>
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
              <div className="mt-4 space-y-4">
                {/* Processing Status Alert */}
                <div className="alert alert-info">
                  <div className="flex items-center gap-3">
                    <span className="loading loading-spinner loading-md"></span>
                    <div className="flex-1">
                      <div className="font-medium">{processingStatus}</div>
                      {estimatedTimeRemaining > 0 && (
                        <div className="text-sm opacity-70">
                          Estimated time remaining: {Math.ceil(estimatedTimeRemaining)} seconds
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Processing Progress Steps */}
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body p-4">
                    <h3 className="font-medium text-sm mb-3">Processing Steps</h3>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <progress 
                        className="progress progress-primary w-full" 
                        value={processingStage * 20} 
                        max="100"
                      ></progress>
                      <div className="text-xs text-center mt-1 opacity-70">
                        Step {processingStage} of 5
                      </div>
                    </div>

                    {/* Step indicators */}
                    <div className="space-y-2">
                      <div className={`flex items-center gap-3 p-2 rounded ${processingStage >= 1 ? 'bg-primary/10' : 'opacity-50'}`}>
                        {processingStage > 1 ? (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-content" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : processingStage === 1 ? (
                          <span className="loading loading-spinner loading-sm text-primary"></span>
                        ) : (
                          <div className="w-6 h-6 bg-base-300 rounded-full"></div>
                        )}
                        <span className={`text-sm ${processingStage >= 1 ? 'text-base-content' : 'text-base-content/50'}`}>
                          Processing bank statement
                        </span>
                      </div>

                      <div className={`flex items-center gap-3 p-2 rounded ${processingStage >= 2 ? 'bg-primary/10' : 'opacity-50'}`}>
                        {processingStage > 2 ? (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-content" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : processingStage === 2 ? (
                          <span className="loading loading-spinner loading-sm text-primary"></span>
                        ) : (
                          <div className="w-6 h-6 bg-base-300 rounded-full"></div>
                        )}
                        <span className={`text-sm ${processingStage >= 2 ? 'text-base-content' : 'text-base-content/50'}`}>
                          Extracting transaction data
                        </span>
                      </div>

                      <div className={`flex items-center gap-3 p-2 rounded ${processingStage >= 3 ? 'bg-primary/10' : 'opacity-50'}`}>
                        {processingStage > 3 ? (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-content" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : processingStage === 3 ? (
                          <span className="loading loading-spinner loading-sm text-primary"></span>
                        ) : (
                          <div className="w-6 h-6 bg-base-300 rounded-full"></div>
                        )}
                        <span className={`text-sm ${processingStage >= 3 ? 'text-base-content' : 'text-base-content/50'}`}>
                          Converting to QBO format
                        </span>
                      </div>

                      <div className={`flex items-center gap-3 p-2 rounded ${processingStage >= 4 ? 'bg-primary/10' : 'opacity-50'}`}>
                        {processingStage > 4 ? (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-content" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : processingStage === 4 ? (
                          <span className="loading loading-spinner loading-sm text-primary"></span>
                        ) : (
                          <div className="w-6 h-6 bg-base-300 rounded-full"></div>
                        )}
                        <span className={`text-sm ${processingStage >= 4 ? 'text-base-content' : 'text-base-content/50'}`}>
                          Finalizing QBO file
                        </span>
                      </div>

                      <div className={`flex items-center gap-3 p-2 rounded ${processingStage >= 5 ? 'bg-success/10' : 'opacity-50'}`}>
                        {processingStage >= 5 ? (
                          <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-success-content" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-base-300 rounded-full"></div>
                        )}
                        <span className={`text-sm font-medium ${processingStage >= 5 ? 'text-success' : 'text-base-content/50'}`}>
                          Ready for download
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
              <div className="mt-4 animate-bounce">
                <div className="card bg-gradient-to-r from-success to-success-focus text-success-content shadow-2xl border border-success/20">
                  <div className="card-body">
                    <div className="flex items-center gap-4">
                      <div className="text-6xl animate-pulse">🎉</div>
                      <div className="flex-1">
                        <h3 className="card-title text-2xl mb-2">
                          QBO File Ready!
                          <div className="badge badge-success-content/20 text-success-content">
                            Processing Complete
                          </div>
                        </h3>
                        <p className="opacity-90">
                          Your bank statement has been successfully processed and converted to QuickBooks format.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-sm opacity-80">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          File processed and ready for import
                        </div>
                      </div>
                    </div>
                    <div className="card-actions justify-end mt-4">
                      <button 
                        className="btn btn-success-content text-success hover:bg-success-content/10 border-success-content/30" 
                        onClick={downloadQbo}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download QBO File
                      </button>
                    </div>
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

        {/* CSV to QBO Converter Section */}
        <div className="mt-8">
          <CsvCombiner />
        </div>
      </div>
    </div>
  )
}