// components/ProcessorBilling.tsx
'use client';

import { useState, useEffect } from 'react';

// Types for the raw records from Airtable
interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

// Types for processed processor data
interface ProcessorClient {
  id: string;
  companyName: string;
  billingAmount: number;
  status: string;
  createdTime: string;
}

interface ProcessorData {
  processor: string;
  clientCount: number;
  totalBilling: number;
  averageBilling: number;
  clients: ProcessorClient[];
}

interface ProcessorBillingStats {
  totalClients: number;
  totalProcessors: number;
  grandTotalBilling: number;
  averageBillingPerClient: number;
  lastUpdated: string;
  tableName: string;
  viewName: string;
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

export default function ProcessorBilling() {
  const [processors, setProcessors] = useState<ProcessorData[]>([]);
  const [stats, setStats] = useState<ProcessorBillingStats>({
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

  useEffect(() => {
    fetchProcessorBillingData();
  }, []);

  const fetchProcessorBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuggestion(null);
      
      const response = await fetch('/api/processor-billing');
      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        // Process the raw records to group by processor
        const processedData = processRecordsIntoProcessors(result.data.records);
        setProcessors(processedData.processors);
        setStats({
          ...processedData.stats,
          tableName: result.data.stats.tableName,
          viewName: result.data.stats.viewName,
          lastUpdated: result.data.stats.lastUpdated
        });
        
        console.log(`Loaded ${processedData.processors.length} processors with ${processedData.stats.totalClients} total clients`);
      } else {
        setError(result.error || 'Failed to fetch processor billing data');
        setSuggestion(result.suggestion || null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const processRecordsIntoProcessors = (records: AirtableRecord[]) => {
    // Group records by processor
    const processorGroups: Record<string, AirtableRecord[]> = {};
    
    records.forEach(record => {
      // Try multiple possible field names for processor
      const processor = record.fields.Processor || 
                       record.fields.processor || 
                       record.fields['Assigned Processor'] ||
                       record.fields['Staff Member'] ||
                       record.fields.Staff ||
                       record.fields.Employee ||
                       record.fields['Responsible Person'] ||
                       record.fields.Owner ||
                       record.fields['Account Manager'] ||
                       'Unassigned';

      const processorName = typeof processor === 'string' ? processor : String(processor || 'Unassigned');
      
      if (!processorGroups[processorName]) {
        processorGroups[processorName] = [];
      }
      
      processorGroups[processorName].push(record);
    });

    // Calculate statistics for each processor
    const processors = Object.entries(processorGroups).map(([processorName, clients]) => {
      const totalBilling = clients.reduce((sum, record) => {
        const fee = record.fields['Monthly Fee'] || 
                   record.fields.Fee || 
                   record.fields.Amount || 
                   record.fields['Subscription Fee'] || 
                   record.fields.Price ||
                   record.fields['Billing Amount'] ||
                   record.fields['Monthly Amount'] || 0;
        return sum + (typeof fee === 'number' ? fee : parseFloat(fee) || 0);
      }, 0);

      const averageBilling = clients.length > 0 ? totalBilling / clients.length : 0;

      const clientDetails = clients.map(record => ({
        id: record.id,
        companyName: record.fields['Company Name'] || 
                    record.fields.Name || 
                    record.fields.Company || 
                    record.fields['Client Name'] || 
                    record.fields['Business Name'] ||
                    'Unknown Company',
        billingAmount: record.fields['Monthly Fee'] || 
                      record.fields.Fee || 
                      record.fields.Amount || 
                      record.fields['Subscription Fee'] || 
                      record.fields.Price ||
                      record.fields['Billing Amount'] ||
                      record.fields['Monthly Amount'] || 0,
        status: String(record.fields.Status || record.fields.status || 'Active'), // Convert to string
        createdTime: record.createdTime
      }));

      return {
        processor: processorName,
        clientCount: clients.length,
        totalBilling: Math.round(totalBilling),
        averageBilling: Math.round(averageBilling),
        clients: clientDetails
      };
    });

    // Sort processors by total billing (highest first)
    processors.sort((a, b) => b.totalBilling - a.totalBilling);

    // Calculate overall statistics
    const totalBilling = processors.reduce((sum, p) => sum + p.totalBilling, 0);
    const stats = {
      totalClients: records.length,
      totalProcessors: processors.length,
      grandTotalBilling: totalBilling,
      averageBillingPerClient: records.length > 0 ? Math.round(totalBilling / records.length) : 0,
      lastUpdated: '',
      tableName: '',
      viewName: ''
    };

    return { processors, stats };
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string | null | undefined): string => {
    // Safely convert to string and handle null/undefined
    const statusStr = String(status || 'unknown').toLowerCase();
    
    switch (statusStr) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  // Reusable StatCard component
  interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
  }

  const StatCard = ({ title, value, icon, bgColor, textColor }: StatCardProps) => (
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading processor billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-blue-400 hover:text-blue-300 cursor-pointer">
                  ← Back to Main Dashboard
                </a>
              </div>
              <h1 className="text-3xl font-bold text-white mt-2">Processor Billing Dashboard</h1>
              <p className="text-gray-300">
                {stats.tableName ? 
                  `Bookkeeping clients grouped by processor from "${stats.viewName}" view` :
                  'Analyzing processor billing data'
                }
              </p>
              
              {error && (
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
              )}
            </div>
            <button 
              onClick={fetchProcessorBillingData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {processors.length > 0 && (
          <>
            {/* Statistics Cards */}
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
                title="Avg per Client"
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

            {/* Processors List */}
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                  Processors by Billing ({processors.length} processors)
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Sorted by total monthly billing amount
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {processors.map((processor, index) => {
                    const isExpanded = expandedProcessors.has(processor.processor);
                    const processorInitial = getProcessorInitial(processor.processor);
                    const processorColorClass = getProcessorColor(index);

                    return (
                      <div key={processor.processor} className="border border-gray-700 rounded-lg overflow-hidden">
                        {/* Processor Header */}
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                          onClick={() => toggleProcessorExpansion(processor.processor)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${processorColorClass}`}>
                                <span className="font-bold text-lg">
                                  {processorInitial}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">
                                  {processor.processor}
                                </h3>
                                <p className="text-sm text-gray-400">
                                  {processor.clientCount} clients • {formatCurrency(processor.totalBilling)} monthly
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-400">
                                  {formatCurrency(processor.totalBilling)}
                                </div>
                                <div className="text-sm text-gray-400">
                                  Avg: {formatCurrency(processor.averageBilling)}
                                </div>
                              </div>
                              <div className="text-gray-400">
                                <svg 
                                  className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
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
                          <div className="border-t border-gray-700 bg-gray-900 p-4">
                            <div className="space-y-2">
                              {processor.clients.map((client) => (
                                <div key={client.id} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-sm font-medium text-white">
                                      {client.companyName}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                                      {client.status}
                                    </span>
                                  </div>
                                  <div className="text-sm font-semibold text-white">
                                    {formatCurrency(client.billingAmount)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Debug Information */}
            <div className="mt-8 bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Debug Information</h3>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Table: {stats.tableName}</p>
                <p>View: {stats.viewName}</p>
                <p>Total Records: {stats.totalClients}</p>
                <p>Processors Found: {stats.totalProcessors}</p>
                <p>Last Updated: {new Date(stats.lastUpdated).toLocaleString()}</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}