'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface BusinessStats {
  totalClients: number;
  corporateClients: number;
  personalClients: number;
  monthlyRevenue: number;
  activeProcessors: number;
  tasksCompletedThisMonth: number;
  monthlyTaskRevenue: number;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  bgColor: string;
  stats?: string;
}

export default function ManageBusiness() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<BusinessStats>({
    totalClients: 0,
    corporateClients: 0,
    personalClients: 0,
    monthlyRevenue: 0,
    activeProcessors: 0,
    tasksCompletedThisMonth: 0,
    monthlyTaskRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      // Fetch real business stats from Airtable
      const response = await fetch('/api/business-stats');
      const result = await response.json();

      if (result.success && result.data) {
        setStats({
          totalClients: result.data.totalClients || 0,
          corporateClients: result.data.corporateClients || 0,
          personalClients: result.data.personalClients || 0,
          monthlyRevenue: result.data.monthlyRevenue || 0,
          activeProcessors: result.data.activeProcessors || 0,
          tasksCompletedThisMonth: result.data.tasksCompletedThisMonth || 0,
          monthlyTaskRevenue: result.data.monthlyTaskRevenue || 0
        });
      } else {
        console.error('Failed to load business stats:', result.error);
        // Keep stats at 0 if fetch fails
      }
    } catch (error) {
      console.error('Error loading business data:', error);
      // Keep stats at 0 if fetch fails
    } finally {
      setLoading(false);
    }
  };

  const businessActions: QuickAction[] = [
    {
      title: 'Processor Billing',
      description: 'View billing by processor, client revenue, and service breakdown',
      href: '/processor-billing',
      icon: '💰',
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
      stats: `$${stats.monthlyRevenue.toLocaleString()}/mo`
    },
    {
      title: 'Personal Services Pipeline',
      description: 'Track personal client progress through services',
      href: '/personal-services-pipeline',
      icon: '📋',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      stats: `${stats.personalClients} clients`
    },
    {
      title: 'Corporate Documents',
      description: 'Manage business documents, financial statements, and tax returns',
      href: '/corporate-document-management',
      icon: '🏢',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
      stats: `${stats.corporateClients} businesses`
    },
    {
      title: 'Personal Documents',
      description: 'Handle individual client tax documents and personal files',
      href: '/document-management',
      icon: '📄',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
      stats: `${stats.tasksCompletedThisMonth} completed`
    },
    {
      title: 'Personal Client Intake',
      description: 'Onboard new individual tax clients and manage personal information',
      href: '/client-intake',
      icon: '👤',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
      stats: `${stats.personalClients} personal`
    },
    {
      title: 'Corporate Client Intake',
      description: 'Onboard new business clients and manage company representatives',
      href: '/corporate-client-intake',
      icon: '🏭',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
      stats: `${stats.corporateClients} corporate`
    },
    {
      title: 'Bank Statements',
      description: 'Convert bank statements to QuickBooks format',
      href: '/bank-statement-processing',
      icon: '🏦',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200'
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading business data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-base-content">
                Business Management
              </h1>
              <p className="text-base-content/70 mt-2">
                Manage your tax preparation and bookkeeping business operations
              </p>
            </div>
            <button
              onClick={loadBusinessData}
              className="btn btn-primary btn-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-primary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="stat-title">Total Clients</div>
              <div className="stat-value text-primary">{stats.totalClients}</div>
              <div className="stat-desc">{stats.corporateClients} corporate, {stats.personalClients} personal</div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-title">Monthly Revenue</div>
              <div className="stat-value text-secondary">{formatCurrency(stats.monthlyRevenue)}</div>
              <div className="stat-desc">Recurring monthly billing</div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-accent">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="stat-title">Active Processors</div>
              <div className="stat-value text-accent">{stats.activeProcessors}</div>
              <div className="stat-desc">Staff members handling work</div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-success">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-title">Tasks Completed</div>
              <div className="stat-value text-success">{stats.tasksCompletedThisMonth}</div>
              <div className="stat-desc">{formatCurrency(stats.monthlyTaskRevenue)} this month</div>
            </div>
          </div>
        </div>

        {/* Business Tools Grid */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Business Tools</h2>
            <p className="text-base-content/70 mb-6">
              Quick access to all your business management tools and workflows
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {businessActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className={`group block p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-xl ${action.bgColor}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl group-hover:scale-110 transition-transform duration-300">
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-bold text-lg ${action.color} group-hover:opacity-80 transition-colors duration-300`}>
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {action.description}
                      </p>
                      {action.stats && (
                        <div className="mt-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white shadow-sm border">
                            {action.stats}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={`${action.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Recent Business Activity</h3>
              <div className="space-y-3 mt-4">
                <div className="flex items-center space-x-3 p-3 bg-base-200 rounded-lg">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-10">
                      <span className="text-xs">💼</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">New corporate client onboarded</p>
                    <p className="text-xs text-base-content/60">ABC Corporation - 2 hours ago</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-base-200 rounded-lg">
                  <div className="avatar placeholder">
                    <div className="bg-success text-success-content rounded-full w-10">
                      <span className="text-xs">✓</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Tax return completed</p>
                    <p className="text-xs text-base-content/60">Smith Industries - 5 hours ago</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-base-200 rounded-lg">
                  <div className="avatar placeholder">
                    <div className="bg-warning text-warning-content rounded-full w-10">
                      <span className="text-xs">📄</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Documents uploaded</p>
                    <p className="text-xs text-base-content/60">15 new files - Today</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Additional Resources</h3>
              <div className="space-y-2 mt-4">
                <Link href="/view-display" className="btn btn-outline btn-block justify-start">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Database Views
                </Link>

                <Link href="/subscriptions" className="btn btn-outline btn-block justify-start">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  Customer Subscriptions
                </Link>

                <Link href="/training-videos" className="btn btn-outline btn-block justify-start">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Training Resources
                </Link>

                <Link href="/filing-deadlines" className="btn btn-outline btn-block justify-start">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Tax Deadlines
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
