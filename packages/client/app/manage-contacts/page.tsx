// app/manage-contacts/page.tsx
'use client';

import { Suspense } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import ManageContacts from '@/components/ManageContacts';

export default function ManageContactsPage() {
  const { session, status } = useRequireAuth();

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
    return null; // Will redirect to signin
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManageContacts />
    </Suspense>
  );
}
