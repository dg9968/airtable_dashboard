'use client';

import { Suspense } from 'react';
import { useRequireRole } from '@/hooks/useAuth';
import BillingModule from '@/components/BillingModule';

export default function BillingPage() {
  const { session, status } = useRequireRole(['staff', 'admin']);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!session) return null;

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    }>
      <BillingModule />
    </Suspense>
  );
}
