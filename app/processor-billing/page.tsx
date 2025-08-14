// app/processor-billing/page.tsx
'use client';

import { Suspense } from 'react';
import ProcessorBilling from '@/components/ProcessorBilling';

export default function ProcessorBillingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProcessorBilling />
    </Suspense>
  );
}