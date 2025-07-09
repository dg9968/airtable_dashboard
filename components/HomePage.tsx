// components/HomePage.tsx (Updated with role-based access)
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  bgColor: string;
  requiredRole?: string[]; // Add role requirement
}

export default function HomePage() {
  const { data: session, status } = useSession();

  const allMenuItems: MenuItem[] = [
    {
      title: "Airtable Dashboard",
      description: "Overview of all Airtable tables, records, and database statistics with detailed analytics",
      href: "/airtable-dashboard",
      icon: "📊",
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      requiredRole: ['staff', 'admin']
    },
    {
      title: "View Display",
      description: "Display and configure any Airtable view with custom filters, sorting, and advanced options",
      href: "/view-display",
      icon: "👁️",
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
      requiredRole: ['staff', 'admin'] // Restrict to staff and admin only
    },
    {
      title: "Processor Billing",
      description: "View processor billing information, client distribution, and revenue analytics for bookkeeping services",
      href: "/processor-billing",
      icon: "💰",
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100 border-orange-200",
      requiredRole: ['staff', 'admin']
    },
    {
    title: "Filing Deadlines",
    description: "Track all tax filing deadlines, quarterly forms, and annual returns with priority alerts and notifications",
    href: "/filing-deadlines",
    icon: "📅",
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100 border-green-200"
    // No requiredRole - accessible with password protection
    },
    {
      title: "Training Videos",
      description: "Access comprehensive tax preparation training videos, tutorials, and educational content from our YouTube channel",
      href: "/training-videos",
      icon: "🎥",
      color: "text-red-600",
      bgColor: "bg-red-50 hover:bg-red-100 border-red-200"
      // No requiredRole - public access
    }
  ];

  // Filter menu items based on user role
  const getVisibleMenuItems = () => {
    if (!session?.user?.role) {
      // Show only public items for non-authenticated users
      return allMenuItems.filter(item => !item.requiredRole);
    }

    const userRole = session.user.role;
    return allMenuItems.filter(item => {
      if (!item.requiredRole) return true; // Public items
      return item.requiredRole.includes(userRole);
    });
  };

  const menuItems = getVisibleMenuItems();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Welcome to Tax Pro Operations
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Your comprehensive business management system for tax preparation services, 
              client management, and operational oversight
            </p>
            <div className="mt-8">
              <div className="inline-flex items-center space-x-3 bg-gray-800/50 rounded-full px-6 py-3 border border-gray-700">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300 font-medium">All Systems Operational</span>
              </div>
            </div>

            {/* User Status */}
            {session && (
              <div className="mt-6">
                <div className="inline-flex items-center space-x-2 bg-blue-900/50 rounded-full px-4 py-2 border border-blue-700">
                  <span className="text-blue-300 text-sm">Welcome back, {session.user?.name}</span>
                  <span className="text-xs text-blue-400 bg-blue-800 px-2 py-1 rounded-full">
                    {session.user?.role || 'user'}
                  </span>
                </div>
              </div>
            )}

            {/* Authentication message for restricted content */}
            {!session && (
              <div className="mt-6">
                <p className="text-sm text-gray-400">
                  <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">
                    Sign in
                  </Link> to access additional business management tools
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Navigation Cards */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Choose Your Dashboard</h2>
            <p className="text-gray-400 text-lg">
              {session ? 
                `Select the area you want to manage (${menuItems.length} available)` : 
                'Select from available tools'
              }
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className={`group block p-8 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${item.bgColor}`}
              >
                <div className="text-center">
                  <div className="text-6xl md:text-7xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className={`text-2xl md:text-3xl font-bold mb-4 ${item.color} group-hover:text-opacity-80 transition-colors duration-300`}>
                    {item.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-base md:text-lg">
                    {item.description}
                  </p>
                  {item.requiredRole && (
                    <div className="mt-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                        {item.requiredRole.join(' • ')} access required
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Show message if some items are hidden */}
          {!session && allMenuItems.length > menuItems.length && (
            <div className="mt-8 text-center">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-300 text-sm">
                  {allMenuItems.length - menuItems.length} additional tools available for staff and administrators.{' '}
                  <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">
                    Sign in
                  </Link> to access more features.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Platform Features</h2>
            <p className="text-gray-400 text-lg">Everything you need to manage your tax preparation business</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="text-4xl md:text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">
                🏢
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mb-4">
                Client Management
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Track client information, services, and subscription status across all business operations with real-time updates
              </p>
            </div>
            
            <div className="text-center group">
              <div className="text-4xl md:text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">
                📈
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mb-4">
                Business Analytics
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Monitor revenue, client activity, and operational metrics to drive business growth with detailed insights
              </p>
            </div>
            
            <div className="text-center group">
              <div className="text-4xl md:text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">
                🎓
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mb-4">
                Training & Education
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Access comprehensive training videos and educational resources to enhance your tax preparation skills
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl font-bold text-blue-400">{allMenuItems.length}</div>
              <div className="text-sm text-gray-400">Dashboards</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl font-bold text-green-400">24/7</div>
              <div className="text-sm text-gray-400">Availability</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl font-bold text-purple-400">Real-time</div>
              <div className="text-sm text-gray-400">Data Sync</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl font-bold text-orange-400">Secure</div>
              <div className="text-sm text-gray-400">Platform</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-2xl font-bold text-red-400">Videos</div>
              <div className="text-sm text-gray-400">Training</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}