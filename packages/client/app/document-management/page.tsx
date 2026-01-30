// app/document-management/page.tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRequireRole } from '@/hooks/useAuth';
import ClientSearch from '../../components/ClientSearch';
import DocumentUpload from '../../components/DocumentUpload';
import DocumentBrowser from '../../components/DocumentBrowser';

function DocumentManagementContent() {
  const { session, status } = useRequireRole(['staff', 'admin']);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [useGoogleDrive, setUseGoogleDrive] = useState(true); // Default to Google Drive
  const [selectedClientCode, setSelectedClientCode] = useState(searchParams.get('clientCode') || '');
  const [selectedPersonalId, setSelectedPersonalId] = useState(searchParams.get('personalId') || '');
  const [clientName, setClientName] = useState('');

  // Auto-load from localStorage if no URL params provided
  useEffect(() => {
    if (!selectedClientCode && !selectedPersonalId && typeof window !== 'undefined') {
      const lastClient = localStorage.getItem('lastSelectedClient');
      if (lastClient) {
        try {
          const clientData = JSON.parse(lastClient);
          if (clientData.clientCode && clientData.id) {
            setSelectedClientCode(clientData.clientCode);
            setSelectedPersonalId(clientData.id);
            setClientName(clientData.name || '');
          }
        } catch (e) {
          console.error('Failed to parse last selected client:', e);
        }
      }
    }
  }, []);

  // Fetch client name when personalId is from URL params
  useEffect(() => {
    const fetchClientName = async () => {
      if (selectedPersonalId && !clientName) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const response = await fetch(`${apiUrl}/api/personal/${selectedPersonalId}`);
          const data = await response.json();
          if (data.success && data.data) {
            const name = data.data.fields?.['Full Name'] ||
                        `${data.data.fields?.['First Name'] || ''} ${data.data.fields?.['Last Name'] || ''}`.trim() ||
                        'Selected Client';
            setClientName(name);
          }
        } catch (error) {
          console.error('Failed to fetch client name:', error);
        }
      }
    };
    fetchClientName();
  }, [selectedPersonalId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Check authorization
  const userRole = (session.user as any)?.role;
  if (userRole !== 'staff' && userRole !== 'admin') {
    return null;
  }

  const handleClientSelect = (clientCode: string, personalId: string) => {
    setSelectedClientCode(clientCode);
    setSelectedPersonalId(personalId);
  };

  const handleUploadComplete = (result: any) => {
    if (result.clientCode) {
      // Force refresh of document browser
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Document Management</h1>
            <p className="text-gray-600">
              Upload, manage, and retrieve client documents using 4-digit codes
            </p>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text mr-3">
                {useGoogleDrive ? 'Google Drive' : 'Local Storage'}
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={useGoogleDrive}
                onChange={(e) => setUseGoogleDrive(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {useGoogleDrive && (
          <div className="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 className="font-bold">Using Google Drive Storage</h3>
              <div className="text-sm">Documents will be stored securely in Google Drive with automatic backup and sharing capabilities.</div>
            </div>
          </div>
        )}
      </div>

      {/* Client Search Section - Full Width */}
      <div className="mb-8">
        <ClientSearch
          onClientSelect={handleClientSelect}
          initialClientCode={selectedClientCode}
        />
      </div>

      {/* Client Context Indicator and Navigation */}
      {selectedPersonalId && clientName && (
        <div className="alert alert-info mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div className="flex-1">
            <div className="font-bold">Working with Client</div>
            <div className="text-sm">
              {clientName} {selectedClientCode && `(Code: ${selectedClientCode})`}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/client-intake?id=${selectedPersonalId}`)}
              className="btn btn-sm btn-primary"
            >
              👤 View Client Details
            </button>
            <button
              onClick={() => router.push(`/tax-prep-pipeline?personalId=${selectedPersonalId}`)}
              className="btn btn-sm btn-accent"
            >
              💼 View Tax Pipeline
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div>
          <DocumentUpload
            onUploadComplete={handleUploadComplete}
            useGoogleDrive={useGoogleDrive}
            clientCode={selectedClientCode}
          />
        </div>

        {/* Browser Section */}
        <div>
          <DocumentBrowser
            key={`${refreshKey}-${useGoogleDrive ? 'gdrive' : 'local'}-${selectedClientCode}`}
            useGoogleDrive={useGoogleDrive}
            clientCode={selectedClientCode}
            personalId={selectedPersonalId}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Quick Actions</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat">
                <div className="stat-figure text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div className="stat-title">Upload</div>
                <div className="stat-desc">Upload documents for clients</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <div className="stat-title">Search</div>
                <div className="stat-desc">Find documents by client code</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="stat-title">View & Download</div>
                <div className="stat-desc">Preview and download documents</div>
              </div>
            </div>

            <div className="divider">Instructions</div>

            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h3 className="font-bold">How to use:</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• <strong>Step 1:</strong> Search for a client by name, email, phone, or last 4 of SSN</li>
                  <li>• <strong>Step 2:</strong> Select the client from search results</li>
                  <li>• <strong>Step 3:</strong> Select the relevant tax filing year (2022-2025)</li>
                  <li>• <strong>Step 4:</strong> Upload documents or search existing documents</li>
                  <li>• <strong>Step 5:</strong> View documents in browser or download them</li>
                  <li>• Supported file types: PDF, Word docs, images, text files, CSV, Excel, QuickBooks (max 20MB)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    }>
      <DocumentManagementContent />
    </Suspense>
  );
}
