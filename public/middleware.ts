import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Additional middleware logic here
    console.log('User role:', req.nextauth.token?.role)
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
          '/training-videos', // Make this public
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
            pathname.startsWith('/admin')) {
          
          // Check if user is authenticated
          if (!token) return false
          
          // Admin-only routes
          if (pathname.startsWith('/admin')) {
            return token.role === 'admin'
          }
          
          // Staff and admin can access these
          if (pathname.startsWith('/airtable') || pathname.startsWith('/bookkeeping')) {
            return token.role === 'admin' || token.role === 'staff'
          }
          
          return true // Any authenticated user
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
