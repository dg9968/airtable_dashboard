// components/ProtectedRoute.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string | string[];
  redirectTo?: string;
  fallbackComponent?: ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = '/auth/signin',
  fallbackComponent 
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      // Store the current path to redirect back after login
      const currentPath = window.location.pathname;
      router.push(`${redirectTo}?callbackUrl=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (requiredRole) {
      const userRole = (session.user as any)?.role;
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        router.push('/?error=unauthorized');
        return;
      }
    }
  }, [session, status, router, requiredRole, redirectTo]);

  // Loading state
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

  // Not authenticated
  if (!session) {
    return fallbackComponent || null;
  }

  // Not authorized
  if (requiredRole) {
    const userRole = (session.user as any)?.role;
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return fallbackComponent || (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-gray-300 mb-4">You don't have permission to access this page.</p>
            <button 
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// Usage example for view-display page:
// 'use client';
// 
// import ProtectedRoute from '@/components/ProtectedRoute';
// import ViewDisplay from '@/components/ViewDisplay';
// 
// export default function ViewDisplayPage() {
//   return (
//     <ProtectedRoute requiredRole={['staff', 'admin']}>
//       <ViewDisplay />
//     </ProtectedRoute>
//   );
// }