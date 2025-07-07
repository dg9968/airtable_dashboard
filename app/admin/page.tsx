'use client'

import { useRequireRole } from '@/hooks/useAuth'

export default function AdminPage() {
  const { session, status } = useRequireRole('admin')

  if (status === 'loading') {
    return <div className="text-white">Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          Admin Dashboard
        </h1>
        <p className="text-gray-300">
          This page is only accessible to administrators.
        </p>
      </div>
    </div>
  )
}