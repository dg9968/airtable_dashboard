// app/dashboard/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Fix for components/Dashboard.tsx - Add type assertion for user.role

// Add this interface at the top of the file (after imports):
interface ExtendedUser {
  role?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}
// Types for dashboard data
interface DashboardStats {
  totalClients: number;
  totalRevenue: number;
  activeProjects: number;
  pendingTasks: number;
}

interface RecentActivity {
  id: string;
  type: 'client' | 'payment' | 'task' | 'video';
  title: string;
  description: string;
  time: string;
  status: 'success' | 'pending' | 'warning' | 'info';
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  bgColor: string;
  requiresRole?: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalRevenue: 0,
    activeProjects: 0,
    pendingTasks: 0
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Load dashboard data
    loadDashboardData();
  }, [session, status, router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // In a real app, you'd fetch this from your API
      // For now, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setStats({
        totalClients: 156,
        totalRevenue: 89250,
        activeProjects: 23,
        pendingTasks: 8
      });

      setRecentActivity([
        {
          id: '1',
          type: 'client',
          title: 'New client onboarded',
          description: 'ABC Corporation signed up for bookkeeping services',
          time: '2 hours ago',
          status: 'success'
        },
        {
          id: '2',
          type: 'payment',
          title: 'Payment received',
          description: '$2,500 payment from Johnson LLC',
          time: '4 hours ago',
          status: 'success'
        },
        {
          id: '3',
          type: 'task',
          title: 'Tax return completed',
          description: 'Q4 tax filing for Smith Industries',
          time: '1 day ago',
          status: 'info'
        },
        {
          id: '4',
          type: 'video',
          title: 'Training video viewed',
          description: 'Advanced Deductions and Credits Strategies',
          time: '2 days ago',
          status: 'info'
        }
      ]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Quick actions based on user role
  const getQuickActions = (): QuickAction[] => {
    const baseActions: QuickAction[] = [
      {
        title: "Airtable Dashboard",
        description: "View client data and database statistics",
        href: "/airtable-dashboard",
        icon: "📊",
        color: "text-blue-600",
        bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200"
      },
      {
        title: "Training Videos",
        description: "Watch educational content and tutorials",
        href: "/training-videos",
        icon: "🎥",
        color: "text-red-600",
        bgColor: "bg-red-50 hover:bg-red-100 border-red-200"
      },
      {
        title: "View Display",
        description: "Configure and display data views",
        href: "/view-display",
        icon: "👁️",
        color: "text-purple-600",
        bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200"
      }
    ];

    // Add role-specific actions
    const user = session?.user as ExtendedUser;
    if (user?.role === 'admin' || user?.role === 'staff') {
      baseActions.push(
        {
          title: "Bookkeeping Dashboard",
          description: "Manage bookkeeping clients and services",
          href: "/bookkeeping-dashboard",
          icon: "💼",
          color: "text-green-600",
          bgColor: "bg-green-50 hover:bg-green-100 border-green-200",
          requiresRole: "staff"
        },
        {
          title: "Processor Billing",
          description: "View billing information and analytics",
          href: "/processor-billing",
          icon: "💰",
          color: "text-orange-600",
          bgColor: "bg-orange-50 hover:bg-orange-100 border-orange-200",
          requiresRole: "staff"
        }
      );
    }

    if ((session && session.user as any)?.role === 'admin') {
      baseActions.push({
        title: "Admin Panel",
        description: "System administration and user management",
        href: "/admin",
        icon: "⚙️",
        color: "text-gray-600",
        bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200",
        requiresRole: "admin"
      });
    }

    return baseActions;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'client': return '👤';
      case 'payment': return '💳';
      case 'task': return '✅';
      case 'video': return '🎥';
      default: return '📝';
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'warning': return 'bg-red-100 text-red-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Welcome back, {session.user?.name || 'User'}!
                </h1>
                <p className="text-gray-300 mt-2">
                  Here's what's happening with your business today.
                </p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {(session.user as any)?.role || 'user'}
                  </span>
                  <span className="text-sm text-gray-400">
                    {session.user?.email}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => loadDashboardData()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Clients</p>
                <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-900 rounded-lg">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Active Projects</p>
                <p className="text-2xl font-bold text-white">{stats.activeProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-orange-900 rounded-lg">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Pending Tasks</p>
                <p className="text-2xl font-bold text-white">{stats.pendingTasks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                <p className="text-sm text-gray-400 mt-1">Jump to commonly used tools and dashboards</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getQuickActions().map((action, index) => (
                    <Link
                      key={index}
                      href={action.href}
                      className={`group block p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${action.bgColor}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                          {action.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-semibold ${action.color} group-hover:text-opacity-80 transition-colors duration-300`}>
                            {action.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {action.description}
                          </p>
                          {action.requiresRole && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 mt-2">
                              {action.requiresRole}+ only
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
                <p className="text-sm text-gray-400 mt-1">Latest updates and actions</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-sm">{getActivityIcon(activity.type)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white truncate">
                            {activity.title}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActivityColor(activity.status)}`}>
                            {activity.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link
                    href="/activity"
                    className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                  >
                    View all activity →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium text-white">Airtable Connection</p>
                <p className="text-xs text-gray-400">All systems operational</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium text-white">YouTube Integration</p>
                <p className="text-xs text-gray-400">Videos loading normally</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium text-white">Authentication</p>
                <p className="text-xs text-gray-400">Secure session active</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}