// app/bookkeeping-billing/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface SubscriptionRecord {
  id: string;
  fields: {
    'Company Name'?: string;
    'Contact Person'?: string;
    'Email'?: string;
    'Services'?: string;
    'Status'?: string;
    'Monthly Fee'?: number;
  };
  createdTime: string;
}

interface Stats {
  totalClients: number;
  activeClients: number;
  monthlyRevenue: number;
  averageFee: number;
  recentClients: number;
}

export default function BookkeepingBillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeClients: 0,
    monthlyRevenue: 0,
    averageFee: 0,
    recentClients: 0
  });
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching data from /api/bookkeeping-billing');
      
      const response = await fetch('/api/bookkeeping-billing');
      const text = await response.text();
      
      console.log('Response status:', response.status);
      console.log('Response text (first 200 chars):', text.substring(0, 200));
      
      // Check if response is HTML
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('Received HTML instead of JSON. The API route might not exist or there\'s a server error.');
      }
      
      const data = JSON.parse(text);
      console.log('Parsed data:', data);
      
      if (data.data) {
        setSubscriptions(data.data.subscriptions || []);
        setStats(data.data.stats || {
          totalClients: 0,
          activeClients: 0,
          monthlyRevenue: 0,
          averageFee: 0,
          recentClients: 0
        });
        setUsingMockData(data.usingMockData || false);
        
        if (!data.success) {
          setError(data.error || 'API returned error status');
        }
      } else {
        throw new Error('Invalid response structure');
      }
      
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Set fallback data
      setSubscriptions([
        {
          id: 'fallback1',
          fields: {
            'Company Name': 'Fallback Company',
            'Contact Person': 'Test User',
            'Email': 'test@example.com',
            'Services': 'Bookkeeping Clients',
            'Status': 'Active',
            'Monthly Fee': 500
          },
          createdTime: new Date().toISOString()
        }
      ]);
      setStats({
        totalClients: 1,
        activeClients: 1,
        monthlyRevenue: 500,
        averageFee: 500,
        recentClients: 1
      });
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bookkeeping data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bookkeeping Billing Dashboard</h1>
              <p className="text-gray-600">Simple billing overview</p>
            </div>
            <button 
              onClick={fetchData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
          
          {/* Status Banner */}
          {(error || usingMockData) && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    {usingMockData ? 'Using Demo Data' : 'Connection Issue'}
                  </h3>
                  {error && (
                    <p className="mt-1 text-sm text-yellow-700">{error}</p>
                  )}
                  <p className="mt-1 text-sm text-yellow-700">
                    {usingMockData ? 'Configure your .env.local file to connect to real Airtable data.' : 'Check your API configuration.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">Total Clients</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalClients}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">Active Clients</h3>
            <p className="text-3xl font-bold text-green-600">{stats.activeClients}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue</h3>
            <p className="text-3xl font-bold text-yellow-600">${stats.monthlyRevenue}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">Average Fee</h3>
            <p className="text-3xl font-bold text-purple-600">${stats.averageFee}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900">Recent Clients</h3>
            <p className="text-3xl font-bold text-indigo-600">{stats.recentClients}</p>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              Bookkeeping Clients ({subscriptions.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Fee</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.fields['Company Name'] || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {subscription.fields['Contact Person'] || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {subscription.fields.Email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {subscription.fields.Status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${subscription.fields['Monthly Fee'] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Information</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Status: {error ? 'Error' : 'Success'}</p>
            <p>Using Mock Data: {usingMockData ? 'Yes' : 'No'}</p>
            <p>Records Loaded: {subscriptions.length}</p>
            <p>Last Updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="mt-2 space-x-2">
            <button 
              onClick={() => window.open('/api/bookkeeping-billing', '_blank')}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
            >
              Test API
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}