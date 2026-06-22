'use client'

import Link from 'next/link'
import { useRequireRole } from '@/hooks/useAuth'

export default function AdminPage() {
  const { session, isPending } = useRequireRole('admin')

  if (isPending) {
    return <div className="text-white">Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="rounded-lg border border-gray-700 bg-gray-800 p-6 hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-1">User Management</h2>
            <p className="text-sm text-gray-400">Create, edit, and manage user accounts and roles</p>
          </Link>
        </div>
      </div>
    </div>
  )
}