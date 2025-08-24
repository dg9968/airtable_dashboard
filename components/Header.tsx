'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <div className="navbar bg-primary text-primary-content shadow-lg">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </div>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/training-videos">Training Videos</Link></li>
            {session && (
              <>
                <li><Link href="/dashboard">Dashboard</Link></li>
                <li><Link href="/airtable-dashboard">Airtable</Link></li>
                {((session.user as any).role === 'staff' || (session.user as any).role === 'admin') && (
                  <>
                    <li><Link href="/document-management">Documents</Link></li>
                    <li><Link href="/bank-statement-processing">Statement to QBO</Link></li>
                  </>
                )}
                {(session.user as any).role === 'admin' && (
                  <li><Link href="/admin">Admin</Link></li>
                )}
              </>
            )}
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-xl font-bold">
          Tax Pro Operations
        </Link>
      </div>
      
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><Link href="/" className="btn btn-ghost">Home</Link></li>
          <li><Link href="/training-videos" className="btn btn-ghost">Training Videos</Link></li>
          {session && (
            <>
              <li><Link href="/dashboard" className="btn btn-ghost">Dashboard</Link></li>
              <li><Link href="/airtable-dashboard" className="btn btn-ghost">Airtable</Link></li>
              {((session.user as any).role === 'staff' || (session.user as any).role === 'admin') && (
                <>
                  <li><Link href="/document-management" className="btn btn-ghost">Documents</Link></li>
                  <li><Link href="/bank-statement-processing" className="btn btn-ghost">Statement to QBO</Link></li>
                </>
              )}
              {(session.user as any).role === 'admin' && (
                <li><Link href="/admin" className="btn btn-ghost">Admin</Link></li>
              )}
            </>
          )}
        </ul>
      </div>
      
      <div className="navbar-end">
        {status === 'loading' ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : session ? (
          <div className="flex items-center space-x-3">
            <div className="text-sm">
              <span>Hello, {session.user?.name}</span>
              {(session.user as any)?.role && (
                <div className="badge badge-secondary badge-sm ml-2">
                  {(session.user as any)?.role}
                </div>
              )}
            </div>
            <button
              onClick={() => signOut()}
              className="btn btn-secondary btn-sm"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-x-2">
            <Link href="/auth/signin" className="btn btn-ghost btn-sm">
              Sign In
            </Link>
            <Link href="/auth/signup" className="btn btn-accent btn-sm">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
