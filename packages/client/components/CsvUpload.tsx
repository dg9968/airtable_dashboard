'use client';

import { useState } from 'react';

export default function CsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [responseData, setResponseData] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'Please select a CSV file' });
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setMessage(null);
      setResponseData(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setResponseData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://vault1040.app.n8n.cloud/webhook/upload-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Try to parse JSON response, handle empty or non-JSON responses
      let result;
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();

      if (contentType?.includes('application/json') && responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = { message: responseText || 'Upload completed' };
        }
      } else {
        result = { message: responseText || 'Upload completed successfully' };
      }

      setMessage({ type: 'success', text: 'CSV uploaded and processed successfully!' });
      setResponseData(result);
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload CSV'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Upload CSV File</h2>
        <p className="text-sm opacity-70 mb-4">
          Upload a CSV file to process Airtable database maintenance operations
        </p>

        <div className="form-control w-full">
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="file-input file-input-bordered w-full"
            disabled={uploading}
          />
          {file && (
            <label className="label">
              <span className="label-text-alt">Selected: {file.name}</span>
            </label>
          )}
        </div>

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mt-4`}>
            <span>{message.text}</span>
          </div>
        )}

        {responseData && (
          <div className="mt-4">
            <div className="stats shadow w-full">
              <div className="stat">
                <div className="stat-figure text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div className="stat-title">Processing Result</div>
                <div className="stat-value text-success">
                  {responseData.success ? 'Success' : 'Failed'}
                </div>
                <div className="stat-desc">{responseData.message}</div>
              </div>

              <div className="stat">
                <div className="stat-title">Records Processed</div>
                <div className="stat-value">{responseData.recordsProcessed || 0}</div>
                <div className="stat-desc">From uploaded CSV</div>
              </div>
            </div>

            {/* Show full response details in collapsible section */}
            <details className="collapse collapse-arrow bg-base-200 mt-2">
              <summary className="collapse-title text-sm font-medium">
                View full response details
              </summary>
              <div className="collapse-content">
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(responseData, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        <div className="card-actions justify-end mt-4">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn btn-primary"
          >
            {uploading ? (
              <>
                <span className="loading loading-spinner"></span>
                Uploading...
              </>
            ) : (
              'Upload CSV'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
