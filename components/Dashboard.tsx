'use client';

import { useState, useEffect } from 'react';

// Types for Airtable data
interface TableSummary {
  name: string;
  recordCount: number;
  fields: string[];
  recentActivity: string;
  error?: string;
}

interface DashboardStats {
  totalTables: number;
  totalRecords: number;
  totalFields: number;
  lastUpdated: string;
}

interface AirtableResponse {
  success: boolean;
  data?: {
    tables: TableSummary[];
    stats: DashboardStats;
  };
  error?: string;
  suggestion?: string;
}

export default function Dashboard() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0,
    totalRecords: 0,
    totalFields: 0,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    fetchAirtableData();
  }, []);

  const fetchAirtableData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuggestion(null);
      setUsingMockData(false);
      
      const response = await fetch('/api/airtable');
      const data: AirtableResponse = await response.json();
      
      if (data.success && data.data) {
        setTables(data.data.tables);
        setStats(data.data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Airtable data';
      setError(errorMessage);
      
      // Try to get suggestion from API response
      if (err instanceof Error && err.message.includes('suggestion:')) {
        const parts = err.message.split('suggestion:');
        setError(parts[0].trim());
        setSuggestion(parts[1].trim());
      }
      
      console.error('Error:', err);
      setUsingMockData(true);
      
      // Fallback to mock data for demonstration
      const mockTables: TableSummary[] = [
        {
          name: 'Users',
          recordCount: 156,
          fields: ['Name', 'Email', 'Role', 'Created Date'],
          recentActivity: '2 hours ago'
        },
        {
          name: 'Projects',
          recordCount: 23,
          fields: ['Title', 'Status', 'Assignee', 'Due Date', 'Priority'],
          recentActivity: '1 day ago'
        },
        {
          name: 'Tasks',
          recordCount: 89,
          fields: ['Task Name', 'Description', 'Project', 'Status', 'Assignee'],
          recentActivity: '30 minutes ago'
        }
      ];

      const mockStats: DashboardStats = {
        totalTables: mockTables.length,
        totalRecords: mockTables.reduce((sum, table) => sum + table.recordCount, 0),
        totalFields: mockTables.reduce((sum, table) => sum + table.fields.length, 0),
        lastUpdated: new Date().toISOString()
      };

      setTables(mockTables);
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Airtable data...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Airtable Dashboard</h1>
              <p className="text-gray-600">Overview of your Airtable database</p>
              {usingMockData && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">⚠️ Using demo data</span>
                  </p>
                  {error && <p className="text-sm text-amber-700 mt-1">{error}</p>}
                  {suggestion && (
                    <p className="text-sm text-amber-700 mt-2">
                      <span className="font-medium">💡 Suggestion:</span> {suggestion}
                    </p>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={fetchAirtableData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tables</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTables}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Fields</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFields}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Last Updated</p>
                <p className="text-sm font-bold text-gray-900">
                  {new Date(stats.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tables Overview */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Tables Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fields
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tables.map((table, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">{table.name}</div>
                        {table.error && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Error
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{table.recordCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{table.fields.length} fields</div>
                      <div className="text-xs text-gray-500">
                        {table.fields.slice(0, 3).join(', ')}
                        {table.fields.length > 3 && '...'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {table.recentActivity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        View Details
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h3>
            <div className="space-y-3">
              <a href="/bookkeeping-dashboard" className="block w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="font-medium text-gray-900">📊 Bookkeeping Dashboard</div>
                <div className="text-sm text-gray-500">View filtered bookkeeping subscriptions</div>
              </a>
              <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Export All Data</div>
                <div className="text-sm text-gray-500">Download complete database backup</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Generate Report</div>
                <div className="text-sm text-gray-500">Create a summary report</div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recent Activity</h3>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Tasks</span> updated 30 minutes ago
              </div>
              <div className="text-sm">
                <span className="font-medium">Users</span> updated 2 hours ago
              </div>
              <div className="text-sm">
                <span className="font-medium">Projects</span> updated 1 day ago
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Health</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Complete Records</span>
                <span className="text-sm font-medium text-green-600">98%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Data Quality</span>
                <span className="text-sm font-medium text-green-600">Good</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Last Backup</span>
                <span className="text-sm font-medium">Today</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}