// components/DocumentBrowser.tsx
'use client';

import { useState } from 'react';

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
}

export default function DocumentBrowser({ useGoogleDrive = false, documentCategory, isCorporate = false }: DocumentBrowserProps) {
  const [clientCode, setClientCode] = useState('');
  const [taxYear, setTaxYear] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; document: Document | null }>({
    show: false,
    document: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const taxYearOptions = [
    { value: '2022', label: 'Tax Filing Year 2022' },
    { value: '2023', label: 'Tax Filing Year 2023' },
    { value: '2024', label: 'Tax Filing Year 2024' },
    { value: '2025', label: 'Tax Filing Year 2025' },
  ];

  const fetchDocuments = async () => {
    if (!clientCode.trim()) {
      setError('Please enter a 4-digit client code');
      return;
    }

    if (!/^\d{4}$/.test(clientCode.trim())) {
      setError('Client code must be exactly 4 digits');
      return;
    }

    if (!taxYear && !(isCorporate && documentCategory === 'business-credentials')) {
      setError('Please select a tax filing year');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const apiEndpoint = useGoogleDrive ? '/api/documents-gdrive' : '/api/documents';
      
      // For business credentials, use 'N/A' as tax year
      const effectiveTaxYear = (isCorporate && documentCategory === 'business-credentials') ? 'N/A' : taxYear;
      let queryParams = `clientCode=${clientCode.trim()}&taxYear=${effectiveTaxYear}`;
      
      if (isCorporate && documentCategory) {
        queryParams += `&documentCategory=${documentCategory}&isCorporate=true`;
      }
      
      const response = await fetch(`${apiEndpoint}?${queryParams}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      setDocuments(result.documents || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDocument = async (document: Document) => {
    try {
      const apiEndpoint = useGoogleDrive ? '/api/documents-gdrive/download' : '/api/documents/download';
      const response = await fetch(`${apiEndpoint}?recordId=${document.id}`);
      
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
      // Open document in new tab for viewing
      const apiEndpoint = useGoogleDrive ? '/api/documents-gdrive/view' : '/api/documents/view';
      const viewUrl = `${apiEndpoint}?recordId=${document.id}`;
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
      const apiEndpoint = useGoogleDrive ? '/api/documents-gdrive' : '/api/documents';
      const response = await fetch(`${apiEndpoint}?recordId=${deleteConfirm.document.id}`, {
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

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          {isCorporate ? 'Corporate Document Browser' : 'Document Browser'}
          {isCorporate && documentCategory && (
            <div className="badge badge-primary text-xs ml-2">{documentCategory}</div>
          )}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <div className="form-control">
            <input
              type="text"
              placeholder="Enter 4-digit client code"
              className="input input-bordered"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              maxLength={4}
              pattern="\d{4}"
            />
          </div>
          <div className="form-control">
            <select
              className="select select-bordered"
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
            >
              <option value="">Choose tax filing year</option>
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
            disabled={isLoading || !clientCode.trim() || (!taxYear && !(isCorporate && documentCategory === 'business-credentials'))}
          >
            {isLoading && <span className="loading loading-spinner loading-sm"></span>}
            Search Documents
          </button>
        </div>

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
                  <th className="w-2/5">Document</th>
                  <th className="hidden sm:table-cell w-1/6">Size</th>
                  <th className="hidden md:table-cell w-1/4">Upload Date</th>
                  <th className="text-center w-1/6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-4.5B1.5 11.625 3 10.125 3 8.25v-1.875a3.375 3.375 0 013.375-3.375H16.5a1.125 1.125 0 011.125 1.125v1.875" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25l-2.625 2.625a3.375 3.375 0 01-2.375 1.125H8.25a1.125 1.125 0 01-1.125-1.125V10.5" />
            </svg>
            <p>No documents found for client code: {clientCode}</p>
            <p className="text-sm">Tax filing year: {taxYearOptions.find(opt => opt.value === taxYear)?.label}</p>
          </div>
        ) : null}
      </div>

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