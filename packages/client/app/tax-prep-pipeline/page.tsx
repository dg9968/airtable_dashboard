'use client';

import { useRequireRole } from '@/hooks/useAuth';
import TaxPrepPipeline from '@/components/TaxPrepPipeline';

export default function TaxPrepPipelinePage() {
  const { session, status } = useRequireRole(['staff', 'admin']);

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

  return <TaxPrepPipeline />;
}
