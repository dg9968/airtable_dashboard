'use client';

import { Suspense } from 'react';
import CorporateServicesPipeline from '@/components/CorporateServicesPipeline';

function CorporateServicesPipelineContent() {
  return <CorporateServicesPipeline />;
}

export default function CorporateServicesPipelinePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    }>
      <CorporateServicesPipelineContent />
    </Suspense>
  );
}
