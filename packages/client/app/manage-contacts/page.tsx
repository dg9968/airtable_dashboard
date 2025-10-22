// app/manage-contacts/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ManageContacts from '@/components/ManageContacts';

export default function ManageContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Check if user has staff or admin role
    const userRole = (session.user as any)?.role;
    if (userRole !== 'staff' && userRole !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

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
    return null;
  }

  // Check authorization
  const userRole = (session.user as any)?.role;
  if (userRole !== 'staff' && userRole !== 'admin') {
    return null;
  }

  return <ManageContacts />;
}
