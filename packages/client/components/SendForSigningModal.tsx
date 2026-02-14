'use client';

import { useState } from 'react';

interface Document {
  id: string;
  fileName: string;
  originalName: string;
  clientCode: string;
  googleDriveFileId?: string;
}

interface SendForSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  clientType: 'personal' | 'corporate';
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  taxYear: string;
  onSuccess?: () => void;
}

type DocumentType = '1040' | '1120' | '1120S' | '1065' | '990' | '8879' | 'Other';

const documentTypeOptions: { value: DocumentType; label: string }[] = [
  { value: '1040', label: 'Form 1040 - Individual Income Tax' },
  { value: '8879', label: 'Form 8879 - E-File Authorization' },
  { value: '1120', label: 'Form 1120 - Corporate Tax Return' },
  { value: '1120S', label: 'Form 1120S - S Corporation Return' },
  { value: '1065', label: 'Form 1065 - Partnership Return' },
  { value: '990', label: 'Form 990 - Tax-Exempt Organization' },
  { value: 'Other', label: 'Other Document' },
];

export default function SendForSigningModal({
  isOpen,
  onClose,
  document,
  clientType,
  clientId,
  clientName = '',
  clientEmail = '',
  taxYear,
  onSuccess,
}: SendForSigningModalProps) {
  const [signerName, setSignerName] = useState(clientName);
  const [signerEmail, setSignerEmail] = useState(clientEmail);
  const [documentType, setDocumentType] = useState<DocumentType>('1040');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens with new data
  useState(() => {
    if (isOpen) {
      setSignerName(clientName);
      setSignerEmail(clientEmail);
      setError('');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!document || !document.googleDriveFileId) {
      setError('Document does not have a Google Drive file ID');
      return;
    }

    if (!signerEmail || !signerName) {
      setError('Please enter signer name and email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signerEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/docusign/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentRecordId: document.id,
          clientType,
          clientId: clientId || '',
          signerEmail,
          signerName,
          taxYear,
          documentType,
          driveFileId: document.googleDriveFileId,
          triggeredBy: 'user', // TODO: Get from auth context
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send for signing');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for signing');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6 text-primary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
            />
          </svg>
          Send for Signing
        </h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Document Info */}
          <div className="bg-base-200 rounded-lg p-3">
            <p className="text-sm font-medium">Document</p>
            <p className="text-sm opacity-70 truncate">{document?.originalName}</p>
            <p className="text-xs opacity-50">Tax Year: {taxYear}</p>
          </div>

          {/* Document Type */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Document Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Signer Name */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Signer Name</span>
              <span className="label-text-alt text-error">*Required</span>
            </label>
            <input
              type="text"
              placeholder="Enter signer's full name"
              className="input input-bordered w-full"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
            />
          </div>

          {/* Signer Email */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Signer Email</span>
              <span className="label-text-alt text-error">*Required</span>
            </label>
            <input
              type="email"
              placeholder="Enter signer's email address"
              className="input input-bordered w-full"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              required
            />
            <label className="label">
              <span className="label-text-alt">
                The signer will receive an email from DocuSign with a link to sign the document
              </span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
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

          {/* Actions */}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !document?.googleDriveFileId}
            >
              {isSubmitting && <span className="loading loading-spinner loading-sm"></span>}
              Send for Signing
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
