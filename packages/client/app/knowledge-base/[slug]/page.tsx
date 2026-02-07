'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import ArticleView from '@/components/ArticleView';

export default function ArticlePage() {
  const { slug } = useParams();
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
      <ArticleView slug={slug as string} />
    </Suspense>
  );
}
