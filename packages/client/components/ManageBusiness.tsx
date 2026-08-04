'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client'
import Link from 'next/link';

interface BusinessStats {
  totalClients: number;
  corporateClients: number;
  personalClients: number;
  /** Contracted recurring billing: sum of active bundle line items. */
  recurringMonthlyRevenue: number;
  /** Cash actually received this month (billing_records 'Billed - Paid'). */
  revenueCollectedThisMonth: number;
  /** How many payments made up that figure — not how much work was finished. */
  paymentsThisMonth: number;
  /** Distinct staff holding at least one open pipeline ticket. */
  activeProcessors: number;
  /** Active 'Bookkeeping Clients' tickets — the rows /processor-billing lists. */
  activeBookkeepingClients: number;
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

interface ToolSection {
  title: string;
  description: string;
  actions: QuickAction[];
}

type ActivityEvent =
  | {
      type: 'new_client';
      id: string;
      timestamp: string;
      clientName: string;
      clientType: 'corporate' | 'personal';
    }
  | {
      type: 'work_completed';
      id: string;
      timestamp: string;
      clientName: string | null;
      serviceType: string | null;
      billingStatus: string | null;
      amountCharged: number | null;
    }
  | {
      type: 'payment_received';
      id: string;
      timestamp: string;
      clientName: string | null;
      amountCharged: number | null;
    };

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ManageBusiness() {
  const { data: session } = authClient.useSession();
  const [stats, setStats] = useState<BusinessStats>({
    totalClients: 0,
    corporateClients: 0,
    personalClients: 0,
    recurringMonthlyRevenue: 0,
    revenueCollectedThisMonth: 0,
    paymentsThisMonth: 0,
    activeProcessors: 0,
    activeBookkeepingClients: 0
  });
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    loadBusinessData();
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    try {
      setActivityLoading(true);
      const response = await fetch('/api/recent-activity');
      const result = await response.json();

      if (result.success && result.data) {
        setActivity(result.data.events || []);
      } else {
        console.error('Failed to load recent activity:', result.error);
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/business-stats');
      const result = await response.json();

      if (result.success && result.data) {
        setStats({
          totalClients: result.data.totalClients || 0,
          corporateClients: result.data.corporateClients || 0,
          personalClients: result.data.personalClients || 0,
          recurringMonthlyRevenue: result.data.recurringMonthlyRevenue || 0,
          revenueCollectedThisMonth: result.data.revenueCollectedThisMonth || 0,
          paymentsThisMonth: result.data.paymentsThisMonth || 0,
          activeProcessors: result.data.activeProcessors || 0,
          activeBookkeepingClients: result.data.activeBookkeepingClients || 0
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Every `stats` pill below must be a figure the linked page can actually
  // corroborate. Tiles whose page has no single headline number (the document
  // managers, which are per-client lookups) carry no pill rather than borrowing
  // an unrelated one.
  //
  // The tools are grouped into the three concepts this hub actually covers —
  // documents, clients, operations — so a user always knows which kind of
  // work a tile belongs to.
  const toolSections: ToolSection[] = [
    {
      title: 'Business Operations & Billing',
      description: 'Revenue, pipelines, and workload across the practice',
      actions: [
        {
          title: 'Processor Billing',
          description: 'View billing by processor, client revenue, and service breakdown',
          href: '/processor-billing',
          icon: '💰',
          color: 'text-green-600',
          bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
          stats: `${stats.activeBookkeepingClients} bookkeeping clients`
        },
        {
          title: 'Customer Subscriptions',
          description: 'Manage corporate clients\' recurring monthly billing bundles',
          href: '/subscriptions',
          icon: '📋',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
          stats: `${formatCurrency(stats.recurringMonthlyRevenue)}/mo recurring`
        },
        {
          title: 'Billing Reconciliation',
          description: 'Find work that was completed but never charged, priced, or collected',
          href: '/billing-reconciliation',
          icon: '🧾',
          color: 'text-red-600',
          bgColor: 'bg-red-50 hover:bg-red-100 border-red-200'
        },
        {
          title: 'Open Tickets Dashboard',
          description: 'See every service\'s open pipeline tickets and how long they\'ve been waiting',
          href: '/open-tickets-dashboard',
          icon: '📥',
          color: 'text-rose-600',
          bgColor: 'bg-rose-50 hover:bg-rose-100 border-rose-200'
        },
        {
          title: 'Extension Follow-Ups',
          description: 'Clients whose extension was filed — track the return before the extended deadline',
          href: '/extension-followups',
          icon: '⏳',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200'
        },
        {
          title: 'Team Workload',
          description: 'See every open ticket grouped by who is responsible — and what nobody owns',
          href: '/workload-dashboard',
          icon: '👥',
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
        }
      ]
    },
    {
      title: 'Document Management',
      description: 'Store, browse, and process client files',
      actions: [
        {
          title: 'Corporate Documents',
          description: 'Manage business documents, financial statements, and tax returns',
          href: '/corporate-document-management',
          icon: '🏢',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200'
        },
        {
          title: 'Personal Documents',
          description: 'Handle individual client tax documents and personal files',
          href: '/document-management',
          icon: '📄',
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
        },
        {
          title: 'Bank Statements',
          description: 'Convert bank statements to QuickBooks format',
          href: '/bank-statement-processing',
          icon: '🏦',
          color: 'text-teal-600',
          bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200'
        }
      ]
    },
    {
      title: 'Client Management',
      description: 'Onboard new clients and maintain who you serve',
      actions: [
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
        }
      ]
    }
  ];

  // Every event here is backed by a real created_at/receipt_date — there's no
  // updated_at on any business table to draw on, so this can't show status
  // transitions, only the three moments a timestamp actually proves happened.
  const describeActivity = (event: ActivityEvent) => {
    switch (event.type) {
      case 'new_client':
        return {
          icon: '💼',
          avatarClass: 'bg-primary text-primary-content',
          title: event.clientType === 'corporate' ? 'New corporate client onboarded' : 'New personal client onboarded',
          subtitle: event.clientName,
        };
      case 'work_completed':
        return {
          icon: '✓',
          avatarClass: 'bg-success text-success-content',
          title: `${event.serviceType || 'Service'} completed`,
          subtitle: [event.clientName, event.amountCharged !== null ? formatCurrency(event.amountCharged) : null]
            .filter(Boolean)
            .join(' — ') || 'No client on file',
        };
      case 'payment_received':
        return {
          icon: '💵',
          avatarClass: 'bg-accent text-accent-content',
          title: 'Payment received',
          subtitle: [event.clientName, event.amountCharged !== null ? formatCurrency(event.amountCharged) : null]
            .filter(Boolean)
            .join(' — ') || 'No client on file',
        };
    }
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
              onClick={() => { loadBusinessData(); loadRecentActivity(); }}
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
              <div className="stat-title">Recurring Revenue</div>
              <div className="stat-value text-secondary">{formatCurrency(stats.recurringMonthlyRevenue)}</div>
              <div className="stat-desc">Contracted per month, all active bundles</div>
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
              <div className="stat-desc">Staff with at least one open ticket</div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-success">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="stat-title">Collected This Month</div>
              <div className="stat-value text-success">{formatCurrency(stats.revenueCollectedThisMonth)}</div>
              <div className="stat-desc">
                {stats.paymentsThisMonth} payment{stats.paymentsThisMonth === 1 ? '' : 's'} received
              </div>
            </div>
          </div>
        </div>

        {/* Tool Sections — one card per concept: documents, clients, operations */}
        {toolSections.map((section) => (
          <div key={section.title} className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-1">{section.title}</h2>
              <p className="text-base-content/70 mb-6">{section.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.actions.map((action) => (
                  <Link
                    key={action.href}
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
        ))}

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Recent Business Activity</h3>
              {activityLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : activity.length === 0 ? (
                <p className="text-sm text-base-content/60 mt-4">No recent activity to show.</p>
              ) : (
                <div className="space-y-3 mt-4">
                  {activity.map((event) => {
                    const { icon, avatarClass, title, subtitle } = describeActivity(event);
                    return (
                      <div key={`${event.type}-${event.id}`} className="flex items-center space-x-3 p-3 bg-base-200 rounded-lg">
                        <div className="avatar placeholder">
                          <div className={`${avatarClass} rounded-full w-10`}>
                            <span className="text-xs">{icon}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{title}</p>
                          <p className="text-xs text-base-content/60">
                            {subtitle} - {formatRelativeTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Additional Resources</h3>
              <div className="space-y-2 mt-4">
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
