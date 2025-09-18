'use client';

import { useState } from 'react';
import DocumentUpload from '../../components/DocumentUpload';
import DocumentBrowser from '../../components/DocumentBrowser';

export default function CorporateDocumentManagementPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [useGoogleDrive, setUseGoogleDrive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');

  const documentCategories = [
    { value: 'statements', label: 'Financial Statements', icon: '📊' },
    { value: 'tax-returns', label: 'Tax Returns', icon: '📋' },
    { value: 'notices-letters', label: 'Notices and Letters', icon: '📄' },
    { value: 'sales-tax', label: 'Sales Tax', icon: '🛒' },
    { value: 'payroll-tax', label: 'Payroll Tax', icon: '👥' },
    { value: 'business-credentials', label: 'Business Credentials', icon: '🏢' }
  ];

  const handleUploadComplete = (result: any) => {
    if (result.clientCode) {
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Corporate Document Management</h1>
            <p className="text-gray-600">
              Manage corporate tax documents by client code, year, and document type
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
              <div className="text-sm">Corporate documents will be stored securely in Google Drive with automatic backup and sharing capabilities.</div>
            </div>
          </div>
        )}

        {/* Document Category Selection */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">Document Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {documentCategories.map((category) => (
                <div
                  key={category.value}
                  className={`card bg-base-200 cursor-pointer transition-all hover:bg-base-300 ${
                    selectedCategory === category.value ? 'ring-2 ring-primary bg-primary/10' : ''
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === category.value ? '' : category.value)}
                >
                  <div className="card-body items-center text-center p-4">
                    <div className="text-2xl mb-2">{category.icon}</div>
                    <h3 className="text-sm font-medium">{category.label}</h3>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedCategory && (
              <div className="mt-4 p-4 bg-base-300 rounded-lg">
                <p className="text-sm">
                  <strong>Selected Category:</strong> {documentCategories.find(cat => cat.value === selectedCategory)?.label}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Documents will be organized under this category for better classification and retrieval.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div>
          <DocumentUpload
            onUploadComplete={handleUploadComplete}
            useGoogleDrive={useGoogleDrive}
            documentCategory={selectedCategory}
            isCorporate={true}
          />
        </div>

        {/* Browser Section */}
        <div>
          <DocumentBrowser
            key={`${refreshKey}-${useGoogleDrive ? 'gdrive' : 'local'}-${selectedCategory}`}
            useGoogleDrive={useGoogleDrive}
            documentCategory={selectedCategory}
            isCorporate={true}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Corporate Document Workflow</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat">
                <div className="stat-figure text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125-.504-1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="stat-title">Categorize</div>
                <div className="stat-desc">Select document type first</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div className="stat-title">Upload</div>
                <div className="stat-desc">Upload corporate documents</div>
              </div>

              <div className="stat">
                <div className="stat-figure text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="stat-title">Retrieve</div>
                <div className="stat-desc">Search and download by category</div>
              </div>
            </div>

            <div className="divider">Instructions</div>
            
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h3 className="font-bold">Corporate Document Management Workflow:</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• <strong>Step 1:</strong> Select document category (Statements, Tax Returns, Notices and Letters, Sales Tax, Payroll Tax, or Business Credentials)</li>
                  <li>• <strong>Step 2:</strong> Enter the 4-digit corporate client code (e.g., 1234)</li>
                  <li>• <strong>Step 3:</strong> Select the relevant tax filing year (2022-2025)</li>
                  <li>• <strong>Step 4:</strong> Upload the corporate document</li>
                  <li>• <strong>Step 5:</strong> Browse documents by category, client code, and year</li>
                  <li>• Documents are automatically organized by category for easier retrieval</li>
                  <li>• Supported file types: PDF, Word docs, Excel sheets, images (max 10MB)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}