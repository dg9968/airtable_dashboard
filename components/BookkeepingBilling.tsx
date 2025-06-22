'use client';

import { useState, useEffect } from 'react';

// Types for processor billing data
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
  filterApplied: string;
  sortField: string;
}

interface ProcessorBillingData {
  processors: ProcessorData[];
  stats: ProcessorBillingStats;
  rawRecords: number;
  tableName: string;
  viewName: string;
}

interface ProcessorBillingProps {
  title?: string;
  showStats?: boolean;
  showClientDetails?: boolean;
  maxProcessors?: number;
  className?: string;
  onDataLoad?: (data: ProcessorBillingData) => void;
}

export default function ProcessorBilling({
  title = "Processor Billing Summary",
  showStats = true,
  showClientDetails = true,
  maxProcessors,
  className = "",
  onDataLoad
}: ProcessorBillingProps) {
  const [data, setData] = useState<ProcessorBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProcessorBillingData();
  }, []);

  const fetchProcessorBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/processor-billing');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        if (onDataLoad) {
          onDataLoad(result.data);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch processor billing data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-3 text-gray-300">Loading processor billing data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-800 rounded-lg shadow-sm border border-red-700 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Processor Data</h3>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchProcessorBillingData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const displayProcessors = maxProcessors ? data.processors.slice(0, maxProcessors) : data.processors;

  return (
    <div className={`bg-gray-800 rounded-lg shadow-sm border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            onClick={fetchProcessorBillingData}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Bookkeeping Clients grouped by Processor with billing totals
        </p>
      </div>

      {/* Statistics */}
      {showStats && (
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{data.stats.totalProcessors}</div>
              <div className="text-sm text-gray-400">Processors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{data.stats.totalClients}</div>
              <div className="text-sm text-gray-400">Total Clients</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{formatCurrency(data.stats.grandTotalBilling)}</div>
              <div className="text-sm text-gray-400">Total Billing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{formatCurrency(data.stats.averageBillingPerClient)}</div>
              <div className="text-sm text-gray-400">Avg per Client</div>
            </div>
          </div>
        </div>
      )}

      {/* Processors List */}
      <div className="p-6">
        <div className="space-y-4">
          {displayProcessors.map((processor) => {
            // Safe handling of processor name
            const processorName = processor.processor || 'Unknown Processor';
            const processorInitial = typeof processorName === 'string' && processorName.length > 0 
              ? processorName.charAt(0).toUpperCase() 
              : '?';

            return (
              <div key={processor.processor || 'unknown'} className="border border-gray-700 rounded-lg p-4">
                {/* Processor Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 font-semibold text-sm">
                        {processorInitial}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{processorName}</h3>
                      <p className="text-sm text-gray-400">
                        {processor.clientCount || 0} clients • {formatCurrency(processor.totalBilling || 0)} total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">{formatCurrency(processor.totalBilling || 0)}</div>
                    <div className="text-sm text-gray-400">Avg: {formatCurrency(processor.averageBilling || 0)}</div>
                  </div>
                </div>

                {/* Client Details */}
                {showClientDetails && processor.clients && Array.isArray(processor.clients) && (
                  <div className="space-y-2">
                    {processor.clients.slice(0, 5).map((client) => (
                      <div key={client.id} className="flex items-center justify-between py-2 px-3 bg-gray-900 rounded">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span className="text-sm font-medium text-white">{client.companyName || 'Unknown Company'}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status || 'unknown')}`}>
                            {client.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white">{formatCurrency(client.billingAmount || 0)}</div>
                      </div>
                    ))}
                    {processor.clients.length > 5 && (
                      <div className="text-center py-2">
                        <span className="text-xs text-gray-400">
                          +{processor.clients.length - 5} more clients
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {maxProcessors && data.processors.length > maxProcessors && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">
              Showing {maxProcessors} of {data.processors.length} processors
            </p>
          </div>
        )}
      </div>
    </div>
  );
}