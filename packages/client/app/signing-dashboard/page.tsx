// app/signing-dashboard/page.tsx
'use client';

import { Suspense } from 'react';
import { useRequireRole } from '@/hooks/useAuth';
import SigningDashboard from '../../components/SigningDashboard';
import Link from 'next/link';

function SigningDashboardContent() {
  const { session, status } = useRequireRole(['staff', 'admin']);

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Access denied. Please log in with appropriate permissions.</p>
        <Link href="/api/auth/signin" className="btn btn-primary mt-4">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Breadcrumb */}
      <div className="text-sm breadcrumbs mb-4">
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
          <li>Signing Dashboard</li>
        </ul>
      </div>

      {/* Main Content */}
      <SigningDashboard />

      {/* Help Section */}
      <div className="card bg-base-100 shadow mt-8">
        <div className="card-body">
          <h3 className="card-title text-lg">About DocuSign Integration</h3>
          <div className="prose prose-sm max-w-none">
            <p>
              This dashboard shows all documents sent for digital signing through DocuSign.
              The integration works with n8n to automate the signing workflow.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Sending Documents</h4>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Upload your PDF to Document Management</li>
                  <li>Click the pen icon on the document</li>
                  <li>Enter signer details and send</li>
                  <li>Track status here</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Status Meanings</h4>
                <ul className="text-sm space-y-1">
                  <li><span className="badge badge-info badge-sm">Sent</span> - Email sent to signer</li>
                  <li><span className="badge badge-warning badge-sm">Viewed</span> - Signer opened the document</li>
                  <li><span className="badge badge-success badge-sm">Completed</span> - Signed successfully</li>
                  <li><span className="badge badge-error badge-sm">Declined</span> - Signer declined</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SigningDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      }
    >
      <SigningDashboardContent />
    </Suspense>
  );
}
