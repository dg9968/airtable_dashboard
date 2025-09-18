// components/DocumentUpload.tsx
'use client';

import { useState, useRef } from 'react';

interface DocumentUploadProps {
  onUploadComplete?: (result: any) => void;
  useGoogleDrive?: boolean;
  documentCategory?: string;
  isCorporate?: boolean;
}

export default function DocumentUpload({ onUploadComplete, useGoogleDrive = false, documentCategory, isCorporate = false }: DocumentUploadProps) {
  const [clientCode, setClientCode] = useState('');
  const [taxYear, setTaxYear] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const taxYearOptions = [
    { value: '2022', label: 'Tax Filing Year 2022' },
    { value: '2023', label: 'Tax Filing Year 2023' },
    { value: '2024', label: 'Tax Filing Year 2024' },
    { value: '2025', label: 'Tax Filing Year 2025' },
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate client code is provided and is 4 digits
    if (!clientCode.trim()) {
      setError('Please enter a 4-digit client code');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!/^\d{4}$/.test(clientCode.trim())) {
      setError('Client code must be exactly 4 digits');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate tax year is selected (except for business credentials)
    if (!taxYear && !(isCorporate && documentCategory === 'business-credentials')) {
      setError('Please select a tax filing year');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate document category for corporate uploads
    if (isCorporate && !documentCategory) {
      setError('Please select a document category first');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientCode', clientCode.trim());
      
      // For business credentials, use 'N/A' as tax year
      if (isCorporate && documentCategory === 'business-credentials') {
        formData.append('taxYear', 'N/A');
      } else {
        formData.append('taxYear', taxYear);
      }
      
      if (isCorporate && documentCategory) {
        formData.append('documentCategory', documentCategory);
        formData.append('isCorporate', 'true');
      }

      const apiEndpoint = useGoogleDrive ? '/api/documents-gdrive' : '/api/documents';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(result);
      if (onUploadComplete) {
        onUploadComplete(result);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          {isCorporate ? 'Upload Corporate Document' : 'Upload Document'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Enter 4-digit client code</span>
              <span className="label-text-alt text-error">*Required</span>
            </label>
            <input
              type="text"
              placeholder="Enter 4-digit code (e.g., 1234)"
              className="input input-bordered w-full"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              maxLength={4}
              pattern="\d{4}"
              disabled={isUploading}
            />
            <label className="label">
              <span className="label-text-alt">
                Must be exactly 4 digits
              </span>
            </label>
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Select tax filing year</span>
              <span className="label-text-alt text-error">
                {isCorporate && documentCategory === 'business-credentials' ? 'Not required for Business Credentials' : '*Required'}
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              disabled={isUploading || (isCorporate && documentCategory === 'business-credentials')}
            >
              <option value="">Choose tax filing year</option>
              {taxYearOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="label">
              <span className="label-text-alt">
                {isCorporate && documentCategory === 'business-credentials' ? 
                  'Business credentials are year-independent' : 
                  'Select relevant tax year'
                }
              </span>
            </label>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Select file to upload</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input file-input-bordered w-full"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            onChange={handleFileUpload}
            disabled={isUploading || !clientCode.trim() || !/^\d{4}$/.test(clientCode.trim()) || (!taxYear && !(isCorporate && documentCategory === 'business-credentials')) || (isCorporate && !documentCategory)}
          />
          <label className="label">
            <span className="label-text-alt">
              Allowed: PDF, Word, Text, Images (max 10MB)
            </span>
          </label>
        </div>

        {clientCode && /^\d{4}$/.test(clientCode) && (taxYear || (isCorporate && documentCategory === 'business-credentials')) && (!isCorporate || documentCategory) && (
          <div className="alert alert-success">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div>Ready to upload to client code: <strong>{clientCode}</strong></div>
                {isCorporate && documentCategory === 'business-credentials' ? (
                  <div className="text-sm">Category: <strong>Business Credentials</strong> (Year-independent)</div>
                ) : (
                  <div className="text-sm">Tax filing year: <strong>{taxYearOptions.find(opt => opt.value === taxYear)?.label}</strong></div>
                )}
                {isCorporate && documentCategory && documentCategory !== 'business-credentials' && (
                  <div className="text-sm">Category: <strong>{documentCategory}</strong></div>
                )}
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="alert alert-warning">
            <span className="loading loading-spinner loading-sm"></span>
            <span>Uploading file...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {uploadResult && (
          <div className="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-bold">Upload successful!</div>
              <div className="text-sm">
                Client Code: <strong>{uploadResult.clientCode}</strong>
                {uploadResult.source === 'google-drive' && (
                  <div className="text-xs mt-1 opacity-75">
                    Stored in Google Drive
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}