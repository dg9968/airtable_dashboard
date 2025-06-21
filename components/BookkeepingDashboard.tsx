'use client';

import { useState, useEffect } from 'react';

// Types for subscription data
interface SubscriptionRecord {
  id: string;
  fields: {
    'Customer'?: string;
    'Services'?: string | string[];
    'Status'?: string;
    'Billing Amount'?: number;
  };
  createdTime: string;
}

interface BookkeepingStats {
  totalClients: number;
  activeClients: number;
  monthlyRevenue: number;
  averageFee: number;
  recentClients: number;
}

export default function BookkeepingDashboard() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [stats, setStats] = useState<BookkeepingStats>({
    totalClients: 0,
    activeClients: 0,
    monthlyRevenue: 0,
    averageFee: 0,
    recentClients: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [servicesTableInfo, setServicesTableInfo] = useState<any>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  useEffect(() => {
    fetchBookkeepingData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [subscriptions, statusFilter, planFilter]);

  const checkServicesTable = async () => {
    try {
      const response = await fetch('/api/services');
      const data = await response.json();
      setServicesTableInfo(data);
      console.log('Services table info:', data);
    } catch (error) {
      console.error('Error checking services table:', error);
    }
  };

  const runDiagnostic = async () => {
    try {
      const response = await fetch('/api/diagnostic');
      const data = await response.json();
      setDiagnosticInfo(data);
      console.log('Diagnostic info:', data);
    } catch (error) {
      console.error('Error running diagnostic:', error);
    }
  };

  const fetchBookkeepingData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuggestion(null);
      setDebugInfo(null);
      
      const response = await fetch('/api/bookkeeping');
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.data.subscriptions || []);
        setStats(data.data.stats);
        console.log(`Loaded ${(data.data.subscriptions || []).length} Bookkeeping Clients subscribers`);
      } else {
        // Handle specific error about no Active records
        if (data.error?.includes('No Active status records found')) {
          setError('No Active status records found');
          setSuggestion('Make sure your records have a Status field set to "Active"');
          
          if (data.debug) {
            setDebugInfo(data.debug);
            console.log('Debug info:', data.debug);
          }
        }
        // Handle specific error about no Bookkeeping Clients subscribers among Active records
        else if (data.error?.includes('No "Bookkeeping Clients" service subscribers found among Active records')) {
          setError('No "Bookkeeping Clients" service subscribers found among Active records');
          setSuggestion('Make sure your Active records have a Services field that contains exactly "Bookkeeping Clients"');
          
          if (data.debug) {
            setDebugInfo(data.debug);
            console.log('Debug info:', data.debug);
          }
        } else {
          throw new Error(data.error || 'Failed to fetch bookkeeping clients data');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('Error:', err);
      
      // Try to get available tables to help user
      try {
        const tablesResponse = await fetch('/api/tables');
        const tablesData = await tablesResponse.json();
        if (tablesData.success) {
          setAvailableTables(tablesData.data.tables.map((t: any) => t.name));
        }
      } catch (tablesError) {
        console.error('Could not fetch available tables:', tablesError);
      }
      
      // Mock data for demonstration - all with "Bookkeeping Clients" service
      const mockSubscriptions: SubscriptionRecord[] = [
        {
          id: 'rec1',
          fields: {
            'Company Name': 'TechStart Solutions',
            'Contact Person': 'John Smith',
            'Email': 'john@techstart.com',
            'Phone': '+1-555-0123',
            'Services': 'Bookkeeping Clients',
            'Subscription Plan': 'Premium',
            'Status': 'Active',
            'Monthly Fee': 500,
            'Start Date': '2024-01-15',
            'Next Billing': '2024-07-15',
            'Notes': 'Full bookkeeping service with monthly reports'
          },
          createdTime: '2024-01-15T10:00:00.000Z'
        },
        {
          id: 'rec2',
          fields: {
            'Company Name': 'Local Bakery LLC',
            'Contact Person': 'Sarah Johnson',
            'Email': 'sarah@localbakery.com',
            'Phone': '+1-555-0456',
            'Services': 'Bookkeeping Clients',
            'Subscription Plan': 'Basic',
            'Status': 'Active',
            'Monthly Fee': 250,
            'Start Date': '2024-02-01',
            'Next Billing': '2024-07-01',
            'Notes': 'Small business bookkeeping package'
          },
          createdTime: '2024-02-01T09:30:00.000Z'
        }
      ];

      const mockStats: BookkeepingStats = {
        totalClients: mockSubscriptions.length,
        activeClients: mockSubscriptions.filter(sub => sub.fields.Status === 'Active').length,
        monthlyRevenue: mockSubscriptions
          .filter(sub => sub.fields.Status === 'Active')
          .reduce((sum, sub) => sum + (sub.fields['Monthly Fee'] || 0), 0),
        averageFee: mockSubscriptions.reduce((sum, sub) => sum + (sub.fields['Monthly Fee'] || 0), 0) / mockSubscriptions.length,
        recentClients: mockSubscriptions.filter(sub => 
          new Date(sub.createdTime) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length
      };

      setSubscriptions(mockSubscriptions);
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = subscriptions || [];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => sub.fields.Status === statusFilter);
    }

    if (planFilter !== 'all') {
      filtered = filtered.filter(sub => sub.fields['Subscription Plan'] === planFilter);
    }

    setFilteredSubscriptions(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Suspended': return 'bg-red-100 text-red-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'Basic': return 'bg-blue-100 text-blue-800';
      case 'Standard': return 'bg-cyan-100 text-cyan-800';
      case 'Premium': return 'bg-purple-100 text-purple-800';
      case 'Professional': return 'bg-pink-100 text-pink-800';
      case 'Enterprise': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading "Bookkeeping Clients" subscribers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-blue-600 hover:text-blue-800 cursor-pointer">
                  ← Back to Main Dashboard
                </a>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">"Bookkeeping Clients" Service Dashboard</h1>
              <p className="text-gray-600">Clients subscribed to the "Bookkeeping Clients" service</p>
              
              {error && (
                <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">⚠️ Connection Error:</span> {error}
                  </p>
                  {suggestion && (
                    <p className="text-sm text-amber-700 mt-2">
                      <span className="font-medium">💡 Suggestion:</span> {suggestion}
                    </p>
                  )}
                  
                  {debugInfo?.note && (
                    <p className="text-sm text-amber-600 italic mt-1">
                      {debugInfo.note}
                    </p>
                  )}
                  
                  {debugInfo?.sampleRecords && Array.isArray(debugInfo.sampleRecords) && debugInfo.sampleRecords.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-amber-800">Sample records analysis ({debugInfo.sampleRecords.length} records):</p>
                      <div className="mt-1 space-y-1 max-h-64 overflow-y-auto">
                        {debugInfo.sampleRecords?.map((record: any, index: number) => (
                          <div key={index} className="text-xs bg-amber-100 p-2 rounded">
                            <strong>{record.companyName}</strong> ({record.totalFields} total fields)
                            <br />
                            {record.hasServiceFields ? (
                              <div className="mt-1">
                                <span className="text-green-600">✓ Has service fields:</span>
                                {Object.entries(record.serviceRelatedFields || {}).map(([fieldName, value]: [string, any], idx: number) => (
                                  <div key={idx} className="ml-2 mt-1">
                                    <span className="font-medium text-blue-700">{fieldName}:</span> 
                                    <span className="ml-1 font-mono text-xs">
                                      {value === null || value === undefined ? 'null' :
                                       Array.isArray(value) ? `[${value.length} items: ${value.join(', ')}]` : 
                                       String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1">
                                <span className="text-red-600">✗ No service fields found</span>
                                <br />
                                <span className="text-gray-600">First 10 fields: {(record.allFieldNames || []).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {debugInfo?.serviceFieldNames && Array.isArray(debugInfo.serviceFieldNames) && debugInfo.serviceFieldNames.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-amber-800">
                            Service-related fields found in table ({debugInfo.recordsWithServiceFields}/{debugInfo.sampleRecords.length} records have service data):
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {debugInfo.serviceFieldNames?.map((fieldName: string, idx: number) => (
                              <span key={idx} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                {fieldName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {debugInfo?.allFieldNames && Array.isArray(debugInfo.allFieldNames) && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-gray-600">View all field names in table</summary>
                          <div className="mt-1 text-xs text-gray-500 max-h-20 overflow-y-auto">
                            {debugInfo.allFieldNames.join(', ')}
                          </div>
                        </details>
                      )}
                      
                      <button 
                        onClick={checkServicesTable}
                        className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 mr-2"
                      >
                        Check Services Corporate Table
                      </button>
                      <button 
                        onClick={runDiagnostic}
                        className="mt-2 text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                      >
                        Show Raw Data Structure
                      </button>
                    </div>
                  )}
                  
                  {availableTables.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-amber-800">Available tables in your base:</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {availableTables.map((tableName, index) => (
                          <span key={index} className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                            {tableName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-amber-600 mt-2">Using demo data for now.</p>
                </div>
              )}
            </div>
            <button 
              onClick={fetchBookkeepingData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Three-Step Filter Active</h3>
              <p className="text-sm text-blue-700">
                Step 1: Find "Bookkeeping Clients" record ID in Services Corporate table<br/>
                Step 2: Filter for <span className="font-medium">Status = "Active"</span><br/>
                Step 3: From Active records, find <span className="font-medium">Services lookup field</span> containing the record ID
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${stats.monthlyRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Fee</p>
                <p className="text-2xl font-bold text-gray-900">${stats.averageFee.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentClients}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-6 shadow-sm border mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan</label>
              <select 
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
                <option value="Professional">Professional</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              "Bookkeeping Clients" Subscribers ({(filteredSubscriptions || []).length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing only clients with the exact service: "Bookkeeping Clients"
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Billing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(filteredSubscriptions || []).length > 0 ? (
                  filteredSubscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {subscription.fields['Company Name'] || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            Service: {subscription.fields.Services || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {subscription.fields['Contact Person'] || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {subscription.fields.Email || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {subscription.fields.Phone || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanColor(subscription.fields['Subscription Plan'] || '')}`}>
                          {subscription.fields['Subscription Plan'] || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.fields.Status || '')}`}>
                          {subscription.fields.Status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${subscription.fields['Monthly Fee']?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {subscription.fields['Next Billing'] ? 
                          new Date(subscription.fields['Next Billing']).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          View Details
                        </button>
                        <button className="text-green-600 hover:text-green-900 mr-3">
                          Edit
                        </button>
                        <button className="text-orange-600 hover:text-orange-900">
                          Invoice
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No "Bookkeeping Clients" subscribers found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          No clients are currently subscribed to the "Bookkeeping Clients" service with the selected filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service Information */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About "Bookkeeping Clients" Service</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Service Name</h4>
              <p className="text-sm text-gray-600">
                This dashboard shows clients subscribed to: <span className="font-mono bg-white px-2 py-1 rounded">"Bookkeeping Clients"</span>
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Data Source</h4>
              <p className="text-sm text-gray-600">
                Filters records where the Services lookup field (linked to Services Corporate table) contains "Bookkeeping Clients"
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Lookup Field</h4>
              <p className="text-sm text-gray-600">
                Searches in Services lookup arrays from your Services Corporate table relationship
              </p>
            </div>
          </div>
          
          {servicesTableInfo && (
            <div className="mt-4 p-4 bg-white rounded border">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Services Corporate Table Info</h4>
              {servicesTableInfo.success ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Found {servicesTableInfo.data.totalServices} services in "{servicesTableInfo.data.tableName}" table
                  </p>
                  <p className="text-sm mb-2">
                    <strong>Bookkeeping Clients service exists:</strong> 
                    <span className={servicesTableInfo.data.bookkeepingServiceExists ? 'text-green-600' : 'text-red-600'}>
                      {servicesTableInfo.data.bookkeepingServiceExists ? ' ✓ Yes' : ' ✗ No'}
                    </span>
                  </p>
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                      View all services ({(servicesTableInfo.data.serviceNames || []).length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div className="max-h-32 overflow-y-auto">
                        {(servicesTableInfo.data.services || []).map((service: any, index: number) => (
                          <div key={index} className={`p-2 text-xs rounded ${
                            service.name === 'Bookkeeping Clients' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            <strong>{service.name}</strong>
                            {service.nameField && <span className="text-gray-500"> (from field: {service.nameField})</span>}
                          </div>
                        ))}
                      </div>
                      
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">Field Analysis</summary>
                        <div className="mt-1 bg-gray-50 p-2 rounded">
                          <p><strong>All fields in Services table:</strong></p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(servicesTableInfo.data.fieldAnalysis?.allUniqueFields || []).map((field: string, idx: number) => (
                              <span key={idx} className="bg-white px-1 py-0.5 rounded text-xs">{field}</span>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                  </details>
                </div>
              ) : (
                <p className="text-sm text-red-600">{servicesTableInfo.error}</p>
              )}
            </div>
          )}
          
          <button 
            onClick={checkServicesTable}
            className="mt-3 text-sm bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 mr-3"
          >
            Check Services Corporate Table
          </button>
          <button 
            onClick={runDiagnostic}
            className="mt-3 text-sm bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600"
          >
            Show Raw Data Structure
          </button>
        </div>
        
        {/* Diagnostic Information */}
        {diagnosticInfo && (
          <div className="mt-6 bg-yellow-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Raw Data Diagnostic</h3>
            
            {diagnosticInfo.success ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">All Field Names in Your Table:</h4>
                  <div className="flex flex-wrap gap-1">
                    {(diagnosticInfo.data.allUniqueFieldNames || []).map((fieldName: string, index: number) => (
                      <span 
                        key={index} 
                        className={`text-xs px-2 py-1 rounded ${
                          fieldName.toLowerCase().includes('service') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {fieldName}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Service-Related Fields Analysis:</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(diagnosticInfo.data.serviceFieldAnalysis || []).map((record: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border text-sm">
                        <strong>{record.companyName}</strong>
                        <div className="mt-1">
                          {Object.keys(record.serviceRelatedFields || {}).length > 0 ? (
                            Object.entries(record.serviceRelatedFields || {}).map(([fieldName, value]: [string, any], idx: number) => (
                              <div key={idx} className="ml-2">
                                <span className="font-medium text-blue-700">{fieldName}:</span> 
                                <span className="ml-1 font-mono text-xs">
                                  {Array.isArray(value) ? `[${value.join(', ')}]` : String(value)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-500 ml-2">No service-related fields found</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <details className="mt-4">
                  <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                    View Complete First 3 Records (Raw Data)
                  </summary>
                  <div className="mt-2 bg-gray-100 p-3 rounded overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(diagnosticInfo.data.firstThreeRecords, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-red-600">{diagnosticInfo.error}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}