'use client';

import { Suspense } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import TeamDirectory from '@/components/TeamDirectory';

export default function TeamDirectoryPage() {
  const { session, isPending } = useRequireAuth();

  if (isPending) {
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
      <TeamDirectory />
    </Suspense>
  );
}
