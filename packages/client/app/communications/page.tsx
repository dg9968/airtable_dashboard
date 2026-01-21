'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import CommunicationsForm from '@/components/CommunicationsForm';

export default function CommunicationsPage() {
  return (
    <ProtectedRoute requiredRole={['staff', 'admin']}>
      <div className="min-h-screen bg-base-200">
        {/* Header */}
        <header className="bg-base-100 shadow-sm border-b border-base-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-base-content">
              Corporate Communications
            </h1>
            <p className="text-sm text-base-content/70 mt-1">
              Send emails to corporate clients
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <CommunicationsForm />
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
