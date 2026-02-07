'use client';

import { Suspense } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import KnowledgeBase from '@/components/KnowledgeBase';

export default function KnowledgeBasePage() {
  const { session, status } = useRequireAuth();

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
      <KnowledgeBase />
    </Suspense>
  );
}
