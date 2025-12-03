// components/DocumentUpload.tsx
'use client';

import { useState, useRef } from 'react';

interface DocumentUploadProps {
  onUploadComplete?: (result: any) => void;
  useGoogleDrive?: boolean;
  documentCategory?: string;
  isCorporate?: boolean;
  clientCode?: string;
  onCategoryChange?: (category: string) => void;
}

export default function DocumentUpload({ onUploadComplete, useGoogleDrive = false, documentCategory, isCorporate = false, clientCode = '', onCategoryChange }: DocumentUploadProps) {
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

  const documentCategoryOptions = [
    { value: 'statements', label: 'Financial Statements', icon: '📊' },
    { value: 'tax-returns', label: 'Tax Returns', icon: '📋' },
    { value: 'notices-letters', label: 'Notices and Letters', icon: '📄' },
    { value: 'sales-tax', label: 'Sales Tax', icon: '🛒' },
    { value: 'payroll-tax', label: 'Payroll Tax', icon: '👥' },
    { value: 'business-credentials', label: 'Business Credentials', icon: '🏢' }
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate client code is provided and is 4 digits
    if (!clientCode.trim()) {
      setError('Please select a client first');
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

    // Validate tax year is selected (except for business credentials and notices-letters)
    const yearIndependentCategories = ['business-credentials', 'notices-letters'];
    if (!taxYear && !(isCorporate && yearIndependentCategories.includes(documentCategory || ''))) {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const uploadedFiles: any[] = [];
      const failedFiles: string[] = [];

      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('clientCode', clientCode.trim());

          // For year-independent categories, use 'N/A' as tax year
          const yearIndependentCategories = ['business-credentials', 'notices-letters'];
          if (isCorporate && yearIndependentCategories.includes(documentCategory || '')) {
            formData.append('taxYear', 'N/A');
          } else {
            formData.append('taxYear', taxYear);
          }

          if (isCorporate && documentCategory) {
            formData.append('documentCategory', documentCategory);
            formData.append('isCorporate', 'true');
          }

          const response = await fetch(`${apiUrl}/api/documents`, {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
          }

          uploadedFiles.push({ ...result, fileName: file.name });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          failedFiles.push(`${file.name} (${errorMessage})`);
          console.error(`Failed to upload ${file.name}:`, err);
        }
      }

      // Set result based on upload outcome
      if (uploadedFiles.length > 0) {
        const result = {
          success: true,
          clientCode: clientCode.trim(),
          uploadedCount: uploadedFiles.length,
          totalCount: files.length,
          files: uploadedFiles,
          failedFiles,
        };

        setUploadResult(result);
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      }

      if (failedFiles.length > 0) {
        setError(`Failed to upload ${failedFiles.length} file(s): ${failedFiles.join(', ')}`);
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

        {/* Client Code Display */}
        {clientCode ? (
          <div className="alert alert-info mb-4">
            <span>Uploading for Client Code: <strong className="font-mono">{clientCode}</strong></span>
          </div>
        ) : (
          <div className="alert alert-warning mb-4">
            <span>Please select a client using the search above</span>
          </div>
        )}

        {/* Document Category Selector - Only for Corporate Documents */}
        {isCorporate && (
          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-medium">Document Category</span>
              <span className="label-text-alt text-error">*Required</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={documentCategory || ''}
              onChange={(e) => onCategoryChange?.(e.target.value)}
              disabled={!clientCode}
            >
              <option value="">Select document category</option>
              {documentCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <label className="label">
              <span className="label-text-alt">
                {documentCategory ? (
                  <span className="text-success">✓ Category selected: <strong>{documentCategoryOptions.find(opt => opt.value === documentCategory)?.label}</strong></span>
                ) : (
                  <span className="text-base-content/60">Select a category to organize your documents</span>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="form-control w-full mb-4">
          <label className="label">
            <span className="label-text">Select tax filing year</span>
            <span className="label-text-alt text-error">
              {isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters') ? 'Not required for this category' : '*Required'}
            </span>
          </label>
          <select
            className="select select-bordered w-full"
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            disabled={isUploading || (isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters')) || !clientCode}
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
                isCorporate && documentCategory === 'notices-letters' ?
                'Notices and letters are stored in a single folder regardless of year' :
                'Select relevant tax year'
              }
            </span>
          </label>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Select file(s) to upload</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="file-input file-input-bordered w-full"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            onChange={handleFileUpload}
            disabled={isUploading || !clientCode.trim() || !/^\d{4}$/.test(clientCode.trim()) || (!taxYear && !(isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters'))) || (isCorporate && !documentCategory)}
          />
          <label className="label">
            <span className="label-text-alt">
              Allowed: PDF, Word, Text, Images (max 20MB each). You can select multiple files.
            </span>
          </label>
        </div>

        {clientCode && /^\d{4}$/.test(clientCode) && (taxYear || (isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters'))) && (!isCorporate || documentCategory) && (
          <div className="alert alert-success">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div>Ready to upload to client code: <strong>{clientCode}</strong></div>
                {isCorporate && documentCategory === 'business-credentials' ? (
                  <div className="text-sm">Category: <strong>Business Credentials</strong> (Year-independent)</div>
                ) : isCorporate && documentCategory === 'notices-letters' ? (
                  <div className="text-sm">Category: <strong>Notices and Letters</strong> (Year-independent)</div>
                ) : (
                  <div className="text-sm">Tax filing year: <strong>{taxYearOptions.find(opt => opt.value === taxYear)?.label}</strong></div>
                )}
                {isCorporate && documentCategory && documentCategory !== 'business-credentials' && documentCategory !== 'notices-letters' && (
                  <div className="text-sm">Category: <strong>{documentCategory}</strong></div>
                )}
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="alert alert-warning">
            <span className="loading loading-spinner loading-sm"></span>
            <span>Uploading file(s)...</span>
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
            <div className="flex-1">
              <div className="font-bold">Upload successful!</div>
              <div className="text-sm">
                Client Code: <strong>{uploadResult.clientCode}</strong>
              </div>
              {uploadResult.uploadedCount !== undefined && (
                <div className="text-sm mt-1">
                  Successfully uploaded <strong>{uploadResult.uploadedCount}</strong> of <strong>{uploadResult.totalCount}</strong> file(s)
                </div>
              )}
              {uploadResult.files && uploadResult.files.length > 0 && (
                <div className="text-xs mt-2 opacity-75">
                  <div className="font-semibold mb-1">Uploaded files:</div>
                  <ul className="list-disc list-inside">
                    {uploadResult.files.map((file: any, index: number) => (
                      <li key={index}>{file.fileName}</li>
                    ))}
                  </ul>
                </div>
              )}
              {uploadResult.source === 'google-drive' && (
                <div className="text-xs mt-1 opacity-75">
                  Stored in Google Drive
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
