'use client';

import { useState, useEffect } from 'react';

// Types for view data
interface ViewRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface ViewStats {
  totalRecords: number;
  fieldCount: number;
  tableName: string;
  viewName: string;
  lastUpdated: string;
  recentActivity: string;
}

interface ViewData {
  records: ViewRecord[];
  stats: ViewStats;
  fieldNames: string[];
  fieldTypes: Record<string, string>;
  recentRecords: ViewRecord[];
  queryParams: {
    tableName: string;
    viewName: string;
    maxRecords?: number;
    sortField?: string;
    sortDirection?: string;
    filterByFormula?: string;
  };
}

export default function ViewDisplay() {
  const [viewData, setViewData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Query parameters state
  const [tableName, setTableName] = useState('Subscriptions Corporate');
  const [viewName, setViewName] = useState('Grid view');
  const [maxRecords, setMaxRecords] = useState<number | ''>('');
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterByFormula, setFilterByFormula] = useState('');

  // Available tables
  const availableTables = [
    'Subscriptions Corporate',
    'Services Corporate', 
    'Users',
    'Projects',
    'Tasks'
  ];

  useEffect(() => {
    fetchViewData();
  }, []);

  const fetchViewData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuggestion(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        table: tableName,
        view: viewName,
      });
      
      if (maxRecords && maxRecords > 0) {
        params.append('maxRecords', maxRecords.toString());
      }
      
      if (sortField) {
        params.append('sortField', sortField);
        params.append('sortDirection', sortDirection);
      }
      
      if (filterByFormula) {
        params.append('filterByFormula', filterByFormula);
      }
      
      const response = await fetch(`/api/view?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setViewData(data.data);
        console.log(`Loaded ${data.data.records.length} records from view "${viewName}"`);
      } else {
        throw new Error(data.error || 'Failed to fetch view data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch view data';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFieldValue = (value: any, fieldType: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (fieldType) {
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'object':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'array': return '📋';
      case 'date': return '📅';
      case 'number': return '🔢';
      case 'boolean': return '✅';
      case 'object': return '🔗';
      default: return '📝';
    }
  };

  const getFieldTypeColor = (fieldType: string) => {
    switch (fieldType) {
      case 'array': return 'bg-blue-100 text-blue-800';
      case 'date': return 'bg-green-100 text-green-800';
      case 'number': return 'bg-yellow-100 text-yellow-800';
      case 'boolean': return 'bg-purple-100 text-purple-800';
      case 'object': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading view data...</p>
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
              <h1 className="text-3xl font-bold text-white mt-2">Airtable View Display</h1>
              <p className="text-gray-300">
                {viewData ? 
                  `Showing view "${viewData.stats.viewName}" from table "${viewData.stats.tableName}"` :
                  'Configure and display any Airtable view'
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
              onClick={fetchViewData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 mb-8">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">View Configuration</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Table Name</label>
                <select 
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {availableTables.map((table) => (
                    <option key={table} value={table}>{table}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">View Name</label>
                <input 
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Grid view"
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Records</label>
                <input 
                  type="number"
                  value={maxRecords}
                  onChange={(e) => setMaxRecords(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="All records"
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort Field</label>
                <input 
                  type="text"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  placeholder="Field name to sort by"
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort Direction</label>
                <select 
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Filter Formula</label>
                <input 
                  type="text"
                  value={filterByFormula}
                  onChange={(e) => setFilterByFormula(e.target.value)}
                  placeholder="e.g., {Status} = 'Active'"
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Examples: {`{Status} = 'Active'`}, {`{Fee} > 100`}, {`AND({Status} = 'Active', {Fee} > 0)`}
                </p>
              </div>
            </div>
            
            <button 
              onClick={fetchViewData}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Load View Data
            </button>
          </div>
        </div>

        {viewData && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-900 rounded-lg">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Total Records</p>
                    <p className="text-2xl font-bold text-white">{viewData.stats.totalRecords}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-green-900 rounded-lg">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Fields</p>
                    <p className="text-2xl font-bold text-white">{viewData.stats.fieldCount}</p>
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
                    <p className="text-sm font-medium text-gray-400">Table</p>
                    <p className="text-lg font-bold text-white">{viewData.stats.tableName}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-900 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">View</p>
                    <p className="text-lg font-bold text-white">{viewData.stats.viewName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Types Overview */}
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 mb-8">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Field Types</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {viewData.fieldNames.map((fieldName) => (
                    <div key={fieldName} className="flex items-center space-x-2">
                      <span className="text-lg">{getFieldTypeIcon(viewData.fieldTypes[fieldName])}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate" title={fieldName}>
                          {fieldName}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getFieldTypeColor(viewData.fieldTypes[fieldName])}`}>
                          {viewData.fieldTypes[fieldName]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Records Table */}
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                  Records from "{viewData.stats.viewName}" ({viewData.records.length} records)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Record ID
                      </th>
                      {viewData.fieldNames.slice(0, 6).map((fieldName) => (
                        <th key={fieldName} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          <div className="flex items-center space-x-1">
                            <span>{getFieldTypeIcon(viewData.fieldTypes[fieldName])}</span>
                            <span className="truncate max-w-32" title={fieldName}>{fieldName}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {viewData.records.slice(0, 50).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-400">
                          {record.id}
                        </td>
                        {viewData.fieldNames.slice(0, 6).map((fieldName) => (
                          <td key={fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="max-w-48 truncate" title={formatFieldValue(record.fields[fieldName], viewData.fieldTypes[fieldName])}>
                              {formatFieldValue(record.fields[fieldName], viewData.fieldTypes[fieldName])}
                            </div>
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {new Date(record.createdTime).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {viewData.records.length > 50 && (
                  <div className="px-6 py-4 bg-gray-900 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                      Showing first 50 records of {viewData.records.length} total records.
                      Adjust your view or add filters to see more specific data.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}