import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRequireAuth(redirectUrl = '/auth/signin') {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push(redirectUrl)
    }
  }, [session, status, router, redirectUrl])

  return { session, status }
}

export function useRequireRole(requiredRole: string | string[], redirectUrl = '/') {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    const userRole = (session.user as any)?.role
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

    if (!allowedRoles.includes(userRole)) {
      router.push(redirectUrl)
    }
  }, [session, status, router, requiredRole, redirectUrl])

  return { session, status }
}