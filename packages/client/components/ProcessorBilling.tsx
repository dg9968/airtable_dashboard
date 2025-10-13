// components/ProcessorBilling.tsx - Updated with URL state persistence
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ===== TYPES =====
interface ProcessorData {
  processor: string;
  clients: ClientData[];
  totalBilling: number;
  clientCount: number;
  averageBilling: number;
}

interface ClientData {
  name: string;
  billing: number;
  services: string[];
  status: string;
}

interface DashboardStats {
  totalClients: number;
  totalProcessors: number;
  grandTotalBilling: number;
  averageBillingPerClient: number;
  lastUpdated: string;
  tableName: string;
  viewName: string;
}

interface ViewConfig {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  icon: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    records: AirtableRecord[];
    stats: {
      totalRecords: number;
      tableName: string;
      viewName: string;
      lastUpdated: string;
    };
  };
  error?: string;
  suggestion?: string;
}

// ===== COMPONENT =====
export default function ProcessorBilling() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial activeView from URL params, fallback to 'bookkeeping'
  const initialView = (searchParams.get('view') as 'bookkeeping' | 'service-by-client') || 'bookkeeping';
  
  // State Management
  const [processors, setProcessors] = useState<ProcessorData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalProcessors: 0,
    grandTotalBilling: 0,
    averageBillingPerClient: 0,
    lastUpdated: '',
    tableName: '',
    viewName: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [expandedProcessors, setExpandedProcessors] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'bookkeeping' | 'service-by-client'>(initialView);

  // View Configuration
  const views: ViewConfig[] = [
    {
      key: 'bookkeeping',
      label: 'Bookkeeping Billing',
      description: 'View bookkeeping clients grouped by processor with billing information',
      endpoint: '/api/processor-billing',
      icon: '💰'
    },
    {
      key: 'service-by-client',
      label: 'Service by Client',
      description: 'View all services grouped by client and assigned processor',
      endpoint: '/api/service-by-client',
      icon: '📋'
    }
  ];

  const currentView = views.find(v => v.key === activeView) || views[0];

  // Update URL when activeView changes
  const handleViewChange = (newView: 'bookkeeping' | 'service-by-client') => {
    setActiveView(newView);
    
    // Update URL without causing page reload
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    router.replace(`?${params.toString()}`, { scroll: false });
    
    console.log(`🔄 Switched to ${newView} view and updated URL`);
  };

  // ===== EFFECTS =====
  useEffect(() => {
    fetchData();
  }, [activeView]);

  // Sync state with URL changes (for browser back/forward)
  useEffect(() => {
    const urlView = searchParams.get('view') as 'bookkeeping' | 'service-by-client';
    if (urlView && urlView !== activeView && (urlView === 'bookkeeping' || urlView === 'service-by-client')) {
      setActiveView(urlView);
      console.log(`🔄 Synced view from URL: ${urlView}`);
    }
  }, [searchParams]);

  // ===== API FUNCTIONS =====
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuggestion(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}${currentView.endpoint}`);
      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        const processedData = processRecordsIntoProcessors(result.data.records);
        setProcessors(processedData.processors);
        setStats({
          ...processedData.stats,
          tableName: result.data.stats.tableName,
          viewName: result.data.stats.viewName,
          lastUpdated: result.data.stats.lastUpdated
        });
        
        console.log(`✅ Loaded ${processedData.processors.length} processors with ${processedData.stats.totalClients} clients from ${currentView.label}`);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setSuggestion(err instanceof Error && 'suggestion' in err ? 
        (err as any).suggestion : 'Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ===== DATA PROCESSING =====
  const processRecordsIntoProcessors = (records: AirtableRecord[]) => {
    const processorMap = new Map<string, ProcessorData>();
    let totalClients = 0;
    let grandTotalBilling = 0;

    records.forEach(record => {
      const fields = record.fields;
      const processorName = fields['Processor'] || 'Unassigned';
      const clientName = fields['Name'] || fields['Client Name'] || 'Unknown Client';
      const billingAmount = parseFloat(fields['Billing Amount'] || '0');
      const servicesName = fields['Services Name'] || fields['Service'] || 'No Service';
      const status = fields['Status'] || 'Active';

      if (!processorMap.has(processorName)) {
        processorMap.set(processorName, {
          processor: processorName,
          clients: [],
          totalBilling: 0,
          clientCount: 0,
          averageBilling: 0
        });
      }

      const processor = processorMap.get(processorName)!;
      
      // Check if client already exists
      let existingClient = processor.clients.find(c => c.name === clientName);
      
      if (!existingClient) {
        existingClient = {
          name: clientName,
          billing: 0,
          services: [],
          status: status
        };
        processor.clients.push(existingClient);
        totalClients++;
      }

      existingClient.billing += billingAmount;
      if (!existingClient.services.includes(servicesName)) {
        existingClient.services.push(servicesName);
      }

      processor.totalBilling += billingAmount;
      grandTotalBilling += billingAmount;
    });

    // Calculate averages and sort
    const processorsArray = Array.from(processorMap.values()).map(processor => {
      processor.clientCount = processor.clients.length;
      processor.averageBilling = processor.clientCount > 0 ? processor.totalBilling / processor.clientCount : 0;
      processor.clients.sort((a, b) => b.billing - a.billing);
      return processor;
    });

    processorsArray.sort((a, b) => b.totalBilling - a.totalBilling);

    return {
      processors: processorsArray,
      stats: {
        totalClients,
        totalProcessors: processorsArray.length,
        grandTotalBilling,
        averageBillingPerClient: totalClients > 0 ? grandTotalBilling / totalClients : 0,
        lastUpdated: new Date().toISOString(),
        tableName: '',
        viewName: ''
      }
    };
  };

  // ===== UTILITY FUNCTIONS =====
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProcessorInitial = (processorName: string): string => {
    return processorName && processorName.length > 0 
      ? processorName.charAt(0).toUpperCase() 
      : '?';
  };

  const getProcessorColor = (index: number): string => {
    const colors = [
      'bg-blue-900 text-blue-400',
      'bg-green-900 text-green-400', 
      'bg-purple-900 text-purple-400',
      'bg-orange-900 text-orange-400',
      'bg-pink-900 text-pink-400',
      'bg-indigo-900 text-indigo-400',
      'bg-red-900 text-red-400',
      'bg-yellow-900 text-yellow-400'
    ];
    return colors[index % colors.length];
  };

  const toggleProcessorExpansion = (processorName: string) => {
    const newExpanded = new Set(expandedProcessors);
    if (newExpanded.has(processorName)) {
      newExpanded.delete(processorName);
    } else {
      newExpanded.add(processorName);
    }
    setExpandedProcessors(newExpanded);
  };

  // ===== COMPONENTS =====
  const StatCard = ({ title, value, icon, bgColor, textColor }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
  }) => (
    <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
      <div className="flex items-center">
        <div className={`p-2 ${bgColor} rounded-lg`}>
          <div className={`w-6 h-6 ${textColor}`}>
            {icon}
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  const LoadingState = () => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
        <p className="mt-4 text-gray-300">Loading {currentView.label.toLowerCase()}...</p>
      </div>
    </div>
  );

  const ErrorAlert = () => error && (
    <div className="mt-2 p-4 bg-red-900/50 border border-red-700 rounded-lg">
      <p className="text-sm text-red-200">
        <span className="font-medium">❌ Error:</span> {error}
      </p>
      {suggestion && (
        <p className="text-sm text-red-300 mt-2">
          <span className="font-medium">💡 Suggestion:</span> {suggestion}
        </p>
      )}
    </div>
  );

  const ViewSelector = () => (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 mb-8">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Select Data View</h2>
        <p className="text-sm text-gray-400 mt-1">
          Choose which dataset to analyze
          <span className="ml-2 text-xs text-blue-400">
            (View persisted in URL)
          </span>
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {views.map((view) => (
            <button
              key={view.key}
              onClick={() => handleViewChange(view.key as 'bookkeeping' | 'service-by-client')}
              disabled={loading}
              className={`p-4 rounded-lg border-2 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                activeView === view.key
                  ? 'border-blue-500 bg-blue-900/30 shadow-lg transform scale-105'
                  : 'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700 hover:scale-102'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{view.icon}</div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${
                    activeView === view.key ? 'text-blue-300' : 'text-white'
                  }`}>
                    {view.label}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    {view.description}
                  </p>
                  {activeView === view.key && (
                    <div className="flex items-center space-x-2 mt-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-blue-300">Currently Active</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const StatsSection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Processors"
        value={stats.totalProcessors}
        bgColor="bg-blue-900"
        textColor="text-blue-400"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        }
      />

      <StatCard
        title="Total Clients"
        value={stats.totalClients}
        bgColor="bg-green-900"
        textColor="text-green-400"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />

      <StatCard
        title="Total Monthly Revenue"
        value={formatCurrency(stats.grandTotalBilling)}
        bgColor="bg-purple-900"
        textColor="text-purple-400"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <StatCard
        title="Average per Client"
        value={formatCurrency(stats.averageBillingPerClient)}
        bgColor="bg-orange-900"
        textColor="text-orange-400"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />
    </div>
  );

  const ProcessorsList = () => (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Processors by {activeView === 'bookkeeping' ? 'Billing' : 'Service Assignment'} ({processors.length} total)
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Sorted by total monthly billing amount • Click to expand client details
            </p>
          </div>
          <div className="text-sm text-gray-400">
            View: {currentView.label}
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {processors.map((processor, index) => {
            const isExpanded = expandedProcessors.has(processor.processor);
            const processorInitial = getProcessorInitial(processor.processor);
            const processorColorClass = getProcessorColor(index);

            return (
              <div key={processor.processor} className="border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors">
                {/* Processor Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => toggleProcessorExpansion(processor.processor)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${processorColorClass} shadow-lg`}>
                        <span className="font-bold text-xl">
                          {processorInitial}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {processor.processor}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                          <span>{processor.clientCount} clients</span>
                          <span>•</span>
                          <span>{formatCurrency(processor.totalBilling)} monthly</span>
                          <span>•</span>
                          <span>Avg: {formatCurrency(processor.averageBilling)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400">
                          {formatCurrency(processor.totalBilling)}
                        </div>
                        <div className="text-sm text-gray-400">
                          Monthly Revenue
                        </div>
                      </div>
                      <div className="text-gray-400">
                        <svg 
                          className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Client Details */}
                {isExpanded && (
                  <div className="border-t border-gray-700 bg-gray-750">
                    <div className="p-4">
                      <h4 className="text-md font-semibold text-white mb-3">
                        Clients ({processor.clientCount})
                      </h4>
                      <div className="space-y-2">
                        {processor.clients.map((client, clientIndex) => (
                          <div key={clientIndex} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-semibold text-white">
                                    {client.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-white">{client.name}</p>
                                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                                    <span>Services: {client.services.join(', ')}</span>
                                    <span>•</span>
                                    <span className={`px-2 py-1 rounded-full ${
                                      client.status === 'Active' ? 'bg-green-900 text-green-300' : 'bg-gray-600 text-gray-300'
                                    }`}>
                                      {client.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-400">
                                {formatCurrency(client.billing)}
                              </div>
                              <div className="text-xs text-gray-400">
                                Monthly
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const DebugInfo = () => (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 mt-8">
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Debug Information</h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="text-gray-400">
            <span className="font-medium">Current View:</span><br />
            <span className="text-sm">{currentView.label} ({activeView})</span>
          </div>
          <div className="text-gray-400">
            <span className="font-medium">Data Source:</span><br />
            <span className="text-sm">{stats.tableName || 'Loading...'} • {stats.viewName || 'Loading...'}</span>
          </div>
          <div className="text-gray-400">
            <span className="font-medium">URL Parameters:</span><br />
            <span className="text-sm font-mono">?view={activeView}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-gray-400">
            <span className="font-medium">Last Updated:</span><br />
            <span className="text-xs">{new Date(stats.lastUpdated).toLocaleString()}</span>
          </div>
          <div className="text-gray-400">
            <span className="font-medium">API Endpoint:</span><br />
            <span className="text-xs font-mono">{currentView.endpoint}</span>
          </div>
          <div className="text-gray-400">
            <span className="font-medium">Records Processed:</span><br />
            <span className="text-sm">{processors.reduce((sum, p) => sum + p.clientCount, 0)} clients across {processors.length} processors</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ===== RENDER =====
  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <a href="/" className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to Main Dashboard</span>
                </a>
              </div>
              <h1 className="text-3xl font-bold text-white">Processor Billing Dashboard</h1>
              <p className="text-gray-300 mt-2">
                {stats.tableName ? 
                  `${currentView.description} • Data from "${stats.viewName}" view` :
                  'Loading processor and billing analytics...'
                }
              </p>
              <ErrorAlert />
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={fetchData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ViewSelector />
        
        {processors.length > 0 && (
          <>
            <StatsSection />
            <ProcessorsList />
            <DebugInfo />
          </>
        )}
        
        {processors.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-white mb-2">No Data Available</h3>
            <p className="text-gray-400 mb-4">
              No processors or billing data found in the {currentView.label} view.
            </p>
            <button 
              onClick={fetchData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}