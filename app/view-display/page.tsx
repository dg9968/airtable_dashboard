'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ViewDisplay from '@/components/ViewDisplay';

export default function ViewDisplayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (!session) {
      // Not authenticated - redirect to login
      router.push('/auth/signin?callbackUrl=/view-display');
      return;
    }

    // Check if user has required role (staff or admin)
    if (session.user?.role !== 'staff' && session.user?.role !== 'admin') {
      // Not authorized - redirect to main dashboard with error message
      router.push('/?error=unauthorized');
      return;
    }
  }, [session, status, router]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated or authorized (will redirect)
  if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
    return null;
  }

  return <ViewDisplay />;
}