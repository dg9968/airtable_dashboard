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

export function useRequireRole(requiredRole: string, redirectUrl = '/') {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session || (session.user as any)?.role !== requiredRole) {
      router.push(redirectUrl)
    }
  }, [session, status, router, requiredRole, redirectUrl])

  return { session, status }
}