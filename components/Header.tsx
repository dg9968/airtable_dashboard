'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="bg-blue-800 shadow-lg border-b border-blue-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-white font-bold text-xl">
            Tax Pro Operations
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-4">
            <Link href="/" className="text-white hover:text-blue-200">
              Home
            </Link>
            <Link href="/training-videos" className="text-white hover:text-blue-200">
              Training Videos
            </Link>
            
            {session && (
              <>
                <Link href="/dashboard" className="text-white hover:text-blue-200">
                  Dashboard
                </Link>
                <Link href="/airtable-dashboard" className="text-white hover:text-blue-200">
                  Airtable
                </Link>
                {session.user.role === 'admin' && (
                  <Link href="/admin" className="text-white hover:text-blue-200">
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {status === 'loading' ? (
              <div className="text-white">Loading...</div>
            ) : session ? (
              <div className="flex items-center space-x-4">
                <span className="text-white">Hello, {session.user.name}</span>
                <button
                  onClick={() => signOut()}
                  className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-x-2">
                <Link
                  href="/auth/signin"
                  className="text-white hover:text-blue-200"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}