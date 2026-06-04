import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRequireAuth(redirectUrl = '/auth/signin') {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    if (isPending) return

    if (!session) {
      router.push(redirectUrl)
    }
  }, [session, isPending, router, redirectUrl])

  return { session, isPending }
}

export function useRequireRole(requiredRole: string | string[], redirectUrl = '/') {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    if (isPending) return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    const userRole = (session.user as any)?.role
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

    if (!allowedRoles.includes(userRole)) {
      router.push(redirectUrl)
    }
  }, [session, isPending, router, requiredRole, redirectUrl])

  return { session, isPending }
}
