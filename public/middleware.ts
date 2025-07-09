import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Additional middleware logic here
    console.log('User role:', req.nextauth.token?.role)
    console.log('Accessing:', req.nextUrl.pathname)
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Public routes - no authentication required
        const publicRoutes = [
          '/',
          '/about',
          '/contact',
          '/training-videos', // Keep this public
          '/auth/signin',
          '/auth/signup'
        ]
        
        if (publicRoutes.includes(pathname)) {
          return true
        }
        
        // Protected routes - require authentication
        if (pathname.startsWith('/dashboard') || 
            pathname.startsWith('/airtable') ||
            pathname.startsWith('/bookkeeping') ||
            pathname.startsWith('/processor-billing') ||
            pathname.startsWith('/view-display') || // Add view-display protection
            pathname.startsWith('/admin')) {
          
          // Check if user is authenticated
          if (!token) return false
          
          // Admin-only routes
          if (pathname.startsWith('/admin')) {
            return token.role === 'admin'
          }
          
          // Staff and admin only routes (including view-display)
          if (pathname.startsWith('/airtable') || 
              pathname.startsWith('/bookkeeping') ||
              pathname.startsWith('/view-display')) {
            return token.role === 'admin' || token.role === 'staff'
          }
          
          // Processor billing - staff and admin only
          if (pathname.startsWith('/processor-billing')) {
            return token.role === 'admin' || token.role === 'staff'
          }
          
          return true // Any authenticated user for other dashboard routes
        }
        
        return true // Default allow
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}