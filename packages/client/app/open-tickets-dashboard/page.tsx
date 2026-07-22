'use client';

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import OpenTicketsDashboard from '@/components/OpenTicketsDashboard';

export default function OpenTicketsDashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return; // Still loading

    if (!session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-base-content">Loading open tickets...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <OpenTicketsDashboard />;
}
