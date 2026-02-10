// components/DocumentBrowser.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Document {
  id: string;
  fileName: string;
  originalName: string;
  uploadDate: string;
  fileSize: number;
  fileType: string;
  clientCode: string;
}

interface DocumentBrowserProps {
  useGoogleDrive?: boolean;
  documentCategory?: string;
  isCorporate?: boolean;
  clientCode?: string;
  personalId?: string;
  onCategoryChange?: (category: string) => void;
}

export default function DocumentBrowser({ useGoogleDrive = false, documentCategory, isCorporate = false, clientCode = '', personalId, onCategoryChange }: DocumentBrowserProps) {
  const [taxYear, setTaxYear] = useState('');
  const [bankName, setBankName] = useState('');
  const [existingBanks, setExistingBanks] = useState<string[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [showNewBankInput, setShowNewBankInput] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; document: Document | null }>({
    show: false,
    document: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ show: boolean; document: Document | null }>({
    show: false,
    document: null
  });
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [includeSpouse, setIncludeSpouse] = useState(true);
  const [includeDependents, setIncludeDependents] = useState(true);
  const [sortColumn, setSortColumn] = useState<'name' | 'size' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch existing banks when client code changes and category is statements
  useEffect(() => {
    if (isCorporate && documentCategory === 'statements' && clientCode && /^\d{4}$/.test(clientCode)) {
      fetchExistingBanks();
    } else {
      setExistingBanks([]);
      setBankName('');
      setShowNewBankInput(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientCode, documentCategory, isCorporate]);

  const fetchExistingBanks = async () => {
    setIsLoadingBanks(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${apiUrl}/api/documents/banks/${clientCode}`;
      console.log('[DocumentBrowser] Fetching banks from:', url);

      const response = await fetch(url);
      console.log('[DocumentBrowser] Response status:', response.status);

      const result = await response.json();
      console.log('[DocumentBrowser] Response data:', result);

      if (result.success && result.banks) {
        setExistingBanks(result.banks);
        console.log('[DocumentBrowser] Set existing banks:', result.banks);
        if (result.banks.length === 0) {
          console.log('[DocumentBrowser] No banks found, showing new bank input');
          setShowNewBankInput(true);
        }
      } else {
        console.log('[DocumentBrowser] Invalid response format:', result);
      }
    } catch (err) {
      console.error('[DocumentBrowser] Error fetching banks:', err);
      setShowNewBankInput(true);
    } finally {
      setIsLoadingBanks(false);
    }
  };

  const taxYearOptions = [
    { value: '2022', label: 'Tax Filing Year 2022' },
    { value: '2023', label: 'Tax Filing Year 2023' },
    { value: '2024', label: 'Tax Filing Year 2024' },
    { value: '2025', label: 'Tax Filing Year 2025' },
    { value: '2026', label: 'Tax Filing Year 2026' },
  ];

  const documentCategoryOptions = [
    { value: 'statements', label: 'Bank and Credit Card Statements', icon: '📊' },
    { value: 'tax-returns', label: 'Tax Returns', icon: '📋' },
    { value: 'notices-letters', label: 'Notices and Letters', icon: '📄' },
    { value: 'sales-tax', label: 'Sales Tax', icon: '🛒' },
    { value: 'payroll-tax', label: 'Payroll Tax', icon: '👥' },
    { value: 'business-credentials', label: 'Business Credentials', icon: '🏢' },
    { value: 'bookkeeping', label: 'Bookkeeping', icon: '📚' },
    { value: 'bills-invoices', label: 'Bills and Invoices', icon: '🧾' }
  ];

  // Clear documents when client code changes
  useEffect(() => {
    setDocuments([]);
    setError('');
  }, [clientCode]);

  const fetchDocuments = async () => {
    if (!clientCode.trim()) {
      setError('Please select a client first');
      return;
    }

    if (!/^\d{4}$/.test(clientCode.trim())) {
      setError('Client code must be exactly 4 digits');
      return;
    }

    const yearIndependentCategories = ['business-credentials', 'notices-letters'];
    if (!taxYear && !(isCorporate && yearIndependentCategories.includes(documentCategory || ''))) {
      setError('Please select a tax filing year');
      return;
    }

    // Validate bank name for financial statements
    if (isCorporate && documentCategory === 'statements' && !bankName.trim()) {
      setError('Please enter a bank name for financial statements');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiEndpoint = `${apiUrl}/api/documents`;

      // For year-independent categories, use 'N/A' as tax year
      const yearIndependentCategories = ['business-credentials', 'notices-letters'];
      const effectiveTaxYear = (isCorporate && yearIndependentCategories.includes(documentCategory || '')) ? 'N/A' : taxYear;
      let queryParams = `clientCode=${clientCode.trim()}&taxYear=${effectiveTaxYear}`;

      if (isCorporate && documentCategory) {
        queryParams += `&documentCategory=${documentCategory}&isCorporate=true`;

        // Add bank name for financial statements
        if (documentCategory === 'statements' && bankName.trim()) {
          queryParams += `&bankName=${encodeURIComponent(bankName.trim())}`;
        }
      }

      // Add includeSpouse parameter for personal documents
      if (!isCorporate && includeSpouse) {
        queryParams += `&includeSpouse=true`;
      }

      // Add includeDependents parameter for personal documents
      if (!isCorporate && includeDependents) {
        queryParams += `&includeDependents=true`;
      }

      const response = await fetch(`${apiEndpoint}?${queryParams}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      const docs = result.documents || [];
      setDocuments(docs);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDocument = async (document: Document) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents/download?recordId=${document.id}`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const viewDocument = (document: Document) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const viewUrl = `${apiUrl}/api/documents/view?recordId=${document.id}`;
      window.open(viewUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'View failed');
    }
  };

  const handleDeleteClick = (document: Document) => {
    setDeleteConfirm({ show: true, document });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.document) return;

    setIsDeleting(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents?recordId=${deleteConfirm.document.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      // Remove document from local state
      setDocuments(docs => docs.filter(doc => doc.id !== deleteConfirm.document!.id));

      // Close confirmation dialog
      setDeleteConfirm({ show: false, document: null });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, document: null });
  };

  const handleRenameClick = (document: Document) => {
    setRenameDialog({ show: true, document });
    setNewFileName(document.originalName);
  };

  const handleRenameConfirm = async () => {
    if (!renameDialog.document || !newFileName.trim()) return;

    setIsRenaming(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: renameDialog.document.id,
          newFileName: newFileName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Rename failed');
      }

      // Update document in local state
      setDocuments(docs =>
        docs.map(doc =>
          doc.id === renameDialog.document!.id
            ? { ...doc, originalName: newFileName.trim() }
            : doc
        )
      );

      // Close rename dialog
      setRenameDialog({ show: false, document: null });
      setNewFileName('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameDialog({ show: false, document: null });
    setNewFileName('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (column: 'name' | 'size' | 'date') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case 'name':
        comparison = a.originalName.localeCompare(b.originalName, undefined, { sensitivity: 'base' });
        break;
      case 'size':
        comparison = a.fileSize - b.fileSize;
        break;
      case 'date':
        comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: 'name' | 'size' | 'date' }) => {
    if (sortColumn !== column) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 opacity-30">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center mb-2">
          <h2 className="card-title">
            {isCorporate ? 'Corporate Document Browser' : 'Document Browser'}
            {isCorporate && documentCategory && (
              <div className="badge badge-primary text-xs ml-2">{documentCategory}</div>
            )}
          </h2>

          {/* Navigation Links */}
          {!isCorporate && (
            <div className="flex gap-2">
              <Link href="/personal-services-pipeline" className="btn btn-sm btn-ghost">
                Services Pipeline
              </Link>
              {personalId && (
                <Link href={`/client-intake?id=${personalId}`} className="btn btn-sm btn-primary">
                  Client Intake
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Client Code Display */}
        {clientCode ? (
          <div className="alert alert-info mb-4">
            <span>Selected Client Code: <strong className="font-mono">{clientCode}</strong></span>
          </div>
        ) : (
          <div className="alert alert-warning mb-4">
            <span>Please select a client using the search above</span>
          </div>
        )}

        {/* Document Category Display - Only for Corporate Documents */}
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
                  <span className="text-base-content/60">Select a category to browse documents</span>
                )}
              </span>
            </label>
          </div>
        )}

        {/* Bank Name Input - Only for Financial Statements */}
        {isCorporate && documentCategory === 'statements' && (
          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-medium">Bank Name</span>
              <span className="label-text-alt text-error">*Required</span>
            </label>

            {isLoadingBanks ? (
              <div className="flex items-center gap-2 p-3 bg-base-200 rounded-lg">
                <span className="loading loading-spinner loading-sm"></span>
                <span className="text-sm">Loading existing banks...</span>
              </div>
            ) : !showNewBankInput && existingBanks.length > 0 ? (
              <div className="space-y-2">
                <select
                  className="select select-bordered w-full"
                  value={bankName}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewBankInput(true);
                      setBankName('');
                    } else {
                      setBankName(e.target.value);
                    }
                  }}
                  disabled={!clientCode}
                >
                  <option value="">Select existing bank or add new</option>
                  {existingBanks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                  <option value="__new__">+ Add New Bank</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter bank name (e.g., Chase, Bank of America, Wells Fargo)"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={!clientCode}
                />
                {existingBanks.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setShowNewBankInput(false);
                      setBankName('');
                    }}
                  >
                    ← Back to existing banks
                  </button>
                )}
              </div>
            )}

            <label className="label">
              <span className="label-text-alt">
                {bankName ? (
                  <span className="text-success">✓ Bank selected: <strong>{bankName}</strong></span>
                ) : (
                  <span className="text-base-content/60">
                    {existingBanks.length > 0 ? 'Select an existing bank or add a new one' : 'Enter the bank name to browse statements organized by year'}
                  </span>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
          <div className="form-control">
            <select
              className="select select-bordered"
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              disabled={!clientCode || (isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters'))}
            >
              <option value="">{isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters') ? 'Year not required for this category' : 'Choose tax filing year'}</option>
              {taxYearOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchDocuments}
            disabled={isLoading || !clientCode.trim() || (!taxYear && !(isCorporate && (documentCategory === 'business-credentials' || documentCategory === 'notices-letters'))) || (isCorporate && documentCategory === 'statements' && !bankName.trim())}
          >
            {isLoading && <span className="loading loading-spinner loading-sm"></span>}
            Search Documents
          </button>
        </div>

        {/* Include Family Documents Checkboxes - Only for Personal Documents */}
        {!isCorporate && clientCode && (
          <div className="space-y-2 mb-4">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={includeSpouse}
                  onChange={(e) => setIncludeSpouse(e.target.checked)}
                />
                <span className="label-text">
                  Include spouse documents (if married)
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-8">
                When enabled, this will also show documents from the linked spouse's client code
              </p>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={includeDependents}
                  onChange={(e) => setIncludeDependents(e.target.checked)}
                />
                <span className="label-text">
                  Include dependents documents
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-8">
                When enabled, this will also show documents from all linked dependents' client codes
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th className="w-2/5">
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Document
                      <SortIcon column="name" />
                    </button>
                  </th>
                  <th className="hidden sm:table-cell w-1/6">
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('size')}
                    >
                      Size
                      <SortIcon column="size" />
                    </button>
                  </th>
                  <th className="hidden md:table-cell w-1/4">
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      Upload Date
                      <SortIcon column="date" />
                    </button>
                  </th>
                  <th className="text-center w-1/6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocuments.map((doc) => (
                  <tr key={doc.id} className="hover">
                    <td className="w-2/5">
                      <div className="flex items-center gap-2">
                        <div className="avatar placeholder flex-shrink-0">
                          <div className="bg-primary text-primary-content rounded w-8 h-8 text-xs font-bold">
                            {doc.fileType.includes('pdf') ? 'PDF' :
                             doc.fileType.includes('image') ? 'IMG' :
                             doc.fileType.includes('word') ? 'DOC' : 'TXT'}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate max-w-48">{doc.originalName}</div>
                          <div className="text-xs opacity-60 sm:hidden truncate">
                            {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadDate)}
                          </div>
                          <div className="text-xs opacity-60 hidden sm:block md:hidden truncate">
                            {formatDate(doc.uploadDate)}
                          </div>
                          {/* Show client code badge if it's different from the searched code */}
                          {!isCorporate && doc.clientCode !== clientCode && (
                            <div className="badge badge-sm badge-ghost mt-1">
                              Family Member: {doc.clientCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-sm">{formatFileSize(doc.fileSize)}</td>
                    <td className="hidden md:table-cell text-sm">{formatDate(doc.uploadDate)}</td>
                    <td>
                      <div className="flex justify-center gap-1">
                        <div className="tooltip" data-tip="View">
                          <button
                            className="btn btn-ghost btn-xs text-info hover:bg-info hover:text-info-content"
                            onClick={() => viewDocument(doc)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </div>
                        <div className="tooltip" data-tip="Download">
                          <button
                            className="btn btn-ghost btn-xs text-success hover:bg-success hover:text-success-content"
                            onClick={() => downloadDocument(doc)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          </button>
                        </div>
                        <div className="tooltip" data-tip="Rename">
                          <button
                            className="btn btn-ghost btn-xs text-warning hover:bg-warning hover:text-warning-content"
                            onClick={() => handleRenameClick(doc)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        </div>
                        <div className="tooltip" data-tip="Delete">
                          <button
                            className="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
                            onClick={() => handleDeleteClick(doc)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : documents.length === 0 && !isLoading && clientCode && taxYear ? (
          <div className="text-center py-8 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-4.5A1.5 1.5 0 0 0 10.125 10.125v1.5c0 .621.504 1.125 1.125 1.125h2.25a2.25 2.25 0 0 1 2.25 2.25v2.25a2.25 2.25 0 0 1-2.25 2.25H9a2.25 2.25 0 0 1-2.25-2.25v-4.5" />
            </svg>
            <p>No documents found for client code: {clientCode}</p>
            <p className="text-sm">Tax filing year: {taxYearOptions.find(opt => opt.value === taxYear)?.label}</p>
          </div>
        ) : null}
      </div>

      {/* Rename Dialog */}
      {renameDialog.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-warning">Rename Document</h3>
            <p className="py-2 text-sm text-gray-500">
              Current name: <strong>{renameDialog.document?.originalName}</strong>
            </p>
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">New file name</span>
              </label>
              <input
                type="text"
                placeholder="Enter new file name"
                className="input input-bordered w-full"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                disabled={isRenaming}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFileName.trim()) {
                    handleRenameConfirm();
                  }
                }}
              />
              <label className="label">
                <span className="label-text-alt">Include file extension (e.g., document.pdf)</span>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleRenameCancel}
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={handleRenameConfirm}
                disabled={isRenaming || !newFileName.trim()}
              >
                {isRenaming && <span className="loading loading-spinner loading-sm"></span>}
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Delete Document</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>"{deleteConfirm.document?.originalName}"</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              This action cannot be undone. The document will be permanently removed from the system.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting && <span className="loading loading-spinner loading-sm"></span>}
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
