// components/Header.tsx - UPDATED WITH CALENDAR
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
            <li><Link href="/calendar">Calendar</Link></li>
            <li><Link href="/filing-deadlines">Filing Deadlines</Link></li>
            {session && (
              <>
                <li><Link href="/dashboard">Dashboard</Link></li>
                <li><Link href="/airtable-dashboard">Airtable</Link></li>
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
          <li><Link href="/calendar" className="btn btn-ghost">Calendar</Link></li>
          <li><Link href="/filing-deadlines" className="btn btn-ghost">Filing Deadlines</Link></li>
          {session && (
            <>
              <li><Link href="/dashboard" className="btn btn-ghost">Dashboard</Link></li>
              <li><Link href="/airtable-dashboard" className="btn btn-ghost">Airtable</Link></li>
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
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <img 
                  alt="User Avatar" 
                  src={session.user?.image || '/api/placeholder/40/40'} 
                />
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <a className="justify-between">
                  Profile
                  <span className="badge">New</span>
                </a>
              </li>
              <li><a>Settings</a></li>
              <li><a onClick={() => signOut()}>Logout</a></li>
            </ul>
          </div>
        ) : (
          <Link href="/auth/signin" className="btn btn-ghost">
            Sign In
          </Link>
        )}
      </div>
    </div>
  )
}