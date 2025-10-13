'use client'

import { useState, useRef } from 'react'

interface CsvFile {
  id: string
  file: File
  name: string
  size: number
}

export default function CsvCombiner() {
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState<string>('')
  const [qboDownloadUrl, setQboDownloadUrl] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newFiles: CsvFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError(`File "${file.name}" is not a CSV file`)
        continue
      }

      // Validate file size (max 10MB per file)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setError(`File "${file.name}" is too large (max 10MB)`)
        continue
      }

      newFiles.push({
        id: `${Date.now()}_${i}`,
        file,
        name: file.name,
        size: file.size
      })
    }

    setCsvFiles(prev => [...prev, ...newFiles])
    setError('')

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (id: string) => {
    setCsvFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearAllFiles = () => {
    setCsvFiles([])
    setError('')
    setQboDownloadUrl('')
    setProcessingStatus('')
  }

  const processFiles = async () => {
    if (csvFiles.length === 0) {
      setError('Please select at least one CSV file')
      return
    }

    setIsProcessing(true)
    setError('')
    setQboDownloadUrl('')
    setProcessingStatus('Uploading CSV files...')

    try {
      const formData = new FormData()

      // Append all CSV files
      csvFiles.forEach((csvFile, index) => {
        formData.append(`csvFiles`, csvFile.file)
      })

      setProcessingStatus('Combining CSV files and converting to QBO...')

      const response = await fetch('/api/csv-to-qbo', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Processing failed')
      }

      setProcessingStatus('Processing complete!')
      setQboDownloadUrl(result.qboUrl)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setProcessingStatus('')
    } finally {
      setIsProcessing(false)
    }
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
      a.download = `combined_bank_statement_${Date.now()}.qbo`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Failed to download QBO file')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title mb-4">CSV to QBO Converter</h2>
        <p className="text-sm text-base-content/70 mb-4">
          Upload multiple CSV files to combine and convert them into a single QuickBooks (.qbo) file
        </p>

        {/* File Upload Section */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Select CSV files</span>
            <span className="label-text-alt">Multiple files allowed</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input file-input-bordered w-full"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isProcessing}
            multiple
          />
          <label className="label">
            <span className="label-text-alt">
              CSV format only (max 10MB per file)
            </span>
          </label>
        </div>

        {/* Selected Files List */}
        {csvFiles.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">
                Selected Files ({csvFiles.length})
              </h3>
              <button
                className="btn btn-ghost btn-xs"
                onClick={clearAllFiles}
                disabled={isProcessing}
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {csvFiles.map((csvFile) => (
                <div
                  key={csvFile.id}
                  className="flex items-center justify-between bg-base-200 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <svg
                      className="w-5 h-5 text-primary flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {csvFile.name}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {formatFileSize(csvFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm btn-circle"
                    onClick={() => removeFile(csvFile.id)}
                    disabled={isProcessing}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Process Button */}
        {csvFiles.length > 0 && (
          <div className="mt-4">
            <button
              className="btn btn-primary w-full"
              onClick={processFiles}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Processing...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Convert to QBO
                </>
              )}
            </button>
          </div>
        )}

        {/* Processing Status */}
        {processingStatus && !qboDownloadUrl && (
          <div className="alert alert-info mt-4">
            <span className="loading loading-spinner loading-sm"></span>
            <span>{processingStatus}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success and Download */}
        {qboDownloadUrl && (
          <div className="mt-4">
            <div className="card bg-gradient-to-r from-success to-success-focus text-success-content shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="text-5xl">✅</div>
                  <div className="flex-1">
                    <h3 className="card-title text-xl mb-1">
                      QBO File Ready!
                    </h3>
                    <p className="text-sm opacity-90">
                      {csvFiles.length} CSV file{csvFiles.length > 1 ? 's' : ''} combined
                      and converted successfully
                    </p>
                  </div>
                </div>
                <div className="card-actions justify-end mt-2">
                  <button
                    className="btn btn-success-content text-success hover:bg-success-content/10"
                    onClick={downloadQbo}
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download QBO File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="divider">Instructions</div>
        <div className="bg-base-200 p-4 rounded-lg space-y-4">
          <div>
            <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
              🏦 Step 1: Upload Wells Fargo Statements to Amazon Textract
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs ml-4">
              <li>Open the Amazon Textract console</li>
              <li>Upload your Wells Fargo PDF statements</li>
              <li>Choose "Tables" as the extraction type</li>
              <li>Textract will output 13–14 CSV files compressed into a ZIP file</li>
              <li>💡 Tip: Configure Textract to send output to an S3 bucket</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
              📦 Step 2: Extract the ZIP File
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs ml-4">
              <li>Download the Textract ZIP output</li>
              <li>Extract to your working folder (e.g., C:\WellsFargo\Statements\2025-10\)</li>
              <li>You'll see multiple .csv files (table-1.csv, table-2.csv, etc.)</li>
              <li>🧹 Tip: Preview CSVs in Excel to verify headers align properly</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
              🔄 Step 3: Convert to QBO Using CSV to QBO Converter
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs ml-4">
              <li>Select all CSV files from the extracted folder above</li>
              <li>Click "Convert to QBO" - the system will combine all transactions</li>
              <li>Download the generated .QBO file</li>
              <li>Import the QBO file into QuickBooks Desktop or Online</li>
              <li>💡 Optional: Save a mapping template for one-click future conversions</li>
            </ul>
          </div>

          <div className="alert alert-info text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>CSV files must have columns: Date, Check #, Description, Credits, Debits, Balance</span>
          </div>
        </div>
      </div>
    </div>
  )
}
