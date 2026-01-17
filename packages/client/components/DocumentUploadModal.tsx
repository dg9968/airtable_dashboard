"use client";

import { useState } from "react";
import DocumentUpload from "./DocumentUpload";
import DocumentBrowser from "./DocumentBrowser";

interface DocumentUploadModalProps {
  clientId?: string;
  companyId?: string;
  clientCode?: string;
  isCorporate?: boolean;
  onClose: () => void;
}

export default function DocumentUploadModal({
  clientId,
  companyId,
  clientCode = "",
  isCorporate = false,
  onClose,
}: DocumentUploadModalProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [documentCategory, setDocumentCategory] = useState("");

  const handleUploadComplete = (result: any) => {
    if (result.clientCode) {
      // Force refresh of document browser
      setRefreshKey((prev) => prev + 1);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-2xl">
              {isCorporate ? "Corporate" : "Personal"} Documents
            </h3>
            <p className="text-sm opacity-70 mt-1">
              {clientCode
                ? `Client Code: ${clientCode}`
                : "Upload and manage client documents"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div>
              <h4 className="font-semibold text-lg mb-4">Upload Documents</h4>
              <div className="card bg-base-200">
                <div className="card-body">
                  <DocumentUpload
                    onUploadComplete={handleUploadComplete}
                    useGoogleDrive={true}
                    documentCategory={documentCategory}
                    isCorporate={isCorporate}
                    clientCode={clientCode}
                    onCategoryChange={setDocumentCategory}
                  />
                </div>
              </div>
            </div>

            {/* Browse Section */}
            <div>
              <h4 className="font-semibold text-lg mb-4">
                Existing Documents
              </h4>
              <div className="card bg-base-200">
                <div className="card-body">
                  {clientCode ? (
                    <DocumentBrowser
                      key={refreshKey}
                      clientCode={clientCode}
                      useGoogleDrive={true}
                      isCorporate={isCorporate}
                    />
                  ) : (
                    <div className="text-center py-8 opacity-70">
                      <p>Select a client to view documents</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-action">
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
