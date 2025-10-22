// app/processor-billing/page.tsx
'use client';

import { Suspense } from 'react';
import { useRequireRole } from '@/hooks/useAuth';
import ProcessorBilling from '@/components/ProcessorBilling';

export default function ProcessorBillingPage() {
  const { session, status } = useRequireRole(['staff', 'admin']);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  // Check authorization
  const userRole = (session.user as any)?.role;
  if (userRole !== 'staff' && userRole !== 'admin') {
    return null;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProcessorBilling />
    </Suspense>
  );
}