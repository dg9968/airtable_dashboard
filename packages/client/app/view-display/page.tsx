// Fix for app/view-display/page.tsx - Add type assertion
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ViewDisplay from '@/components/ViewDisplay';

// Type assertion to extend the session user type
interface ExtendedUser {
  role?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

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

    // Check if user has required role (staff or admin) - FIXED with type assertion
    const user = session.user as ExtendedUser;
    if (user?.role !== 'staff' && user?.role !== 'admin') {
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

  // Show nothing if not authenticated or authorized (will redirect) - FIXED with type assertion
  const user = session?.user as ExtendedUser;
  if (!session || (user?.role !== 'staff' && user?.role !== 'admin')) {
    return null;
  }

  return <ViewDisplay />;
}
