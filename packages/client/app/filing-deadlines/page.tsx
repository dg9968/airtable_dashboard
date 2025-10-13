// app/filing-deadlines/page.tsx (Enhanced Version)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Simple password protection
const DASHBOARD_PASSWORD = 'taxpro2024';
const ADMIN_PASSWORD = 'taxpro2024admin'; // Additional admin password for editing

interface DeadlineItem {
  id: string;
  title: string;
  description: string;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'One-time';
  dueDate: string;
  nextDue: Date;
  daysUntil: number;
  priority: 'high' | 'medium' | 'low';
  forms: string[];
  clients: string[];
  isActive: boolean;
  notes?: string;
}

export default function EnhancedFilingDeadlinesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<DeadlineItem | null>(null);
  const [filterActive, setFilterActive] = useState(true);
  const router = useRouter();

  // Form state for adding/editing deadlines
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    frequency: 'Monthly' as 'Monthly' | 'Quarterly' | 'Yearly' | 'One-time',
    dueDate: '',
    forms: '',
    clients: '',
    notes: ''
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
      if (isAuthenticated) {
        calculateDeadlines();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem('filingDashboardAuth');
    const adminAuth = sessionStorage.getItem('filingDashboardAdmin');
    if (isAuth === 'true') {
      setIsAuthenticated(true);
      setIsAdmin(adminAuth === 'true');
      loadStoredDeadlines();
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DASHBOARD_PASSWORD || password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      sessionStorage.setItem('filingDashboardAuth', 'true');
      
      if (password === ADMIN_PASSWORD) {
        setIsAdmin(true);
        sessionStorage.setItem('filingDashboardAdmin', 'true');
      }
      
      loadStoredDeadlines();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    sessionStorage.removeItem('filingDashboardAuth');
    sessionStorage.removeItem('filingDashboardAdmin');
    setPassword('');
  };

  const loadStoredDeadlines = () => {
    const stored = localStorage.getItem('customDeadlines');
    const customDeadlines = stored ? JSON.parse(stored) : [];
    
    const defaultDeadlines = getDefaultDeadlines();
    const allDeadlines = [...defaultDeadlines, ...customDeadlines];
    
    // Calculate dates and sort
    allDeadlines.forEach(item => {
      item.nextDue = calculateNextDueDate(item.frequency, item.dueDate);
      const timeDiff = item.nextDue.getTime() - new Date().getTime();
      item.daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      if (item.daysUntil <= 7) {
        item.priority = 'high';
      } else if (item.daysUntil <= 30) {
        item.priority = 'medium';
      } else {
        item.priority = 'low';
      }
    });

    allDeadlines.sort((a, b) => a.daysUntil - b.daysUntil);
    setDeadlines(allDeadlines);
  };

  const calculateNextDueDate = (frequency: string, dueDate: string): Date => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    switch (frequency) {
      case 'Monthly':
        if (dueDate.includes('20th')) {
          return currentDay <= 20 
            ? new Date(currentYear, currentMonth, 20)
            : new Date(currentYear, currentMonth + 1, 20);
        }
        break;
      case 'Quarterly':
        // Logic for quarterly dates
        if (dueDate.includes('April 30')) {
          return new Date(currentYear + (currentMonth >= 3 ? 1 : 0), 3, 30);
        } else if (dueDate.includes('July 31')) {
          return new Date(currentYear + (currentMonth >= 6 ? 1 : 0), 6, 31);
        } else if (dueDate.includes('October 31')) {
          return new Date(currentYear + (currentMonth >= 9 ? 1 : 0), 9, 31);
        } else if (dueDate.includes('January 31')) {
          return new Date(currentYear + 1, 0, 31);
        }
        break;
      case 'Yearly':
        if (dueDate.includes('April 15')) {
          return new Date(currentYear + (currentMonth >= 3 && currentDay > 15 ? 1 : 0), 3, 15);
        } else if (dueDate.includes('March 15')) {
          return new Date(currentYear + (currentMonth >= 2 && currentDay > 15 ? 1 : 0), 2, 15);
        }
        break;
    }
    
    // Default fallback - return current date plus 30 days
    return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  };

  const getDefaultDeadlines = (): DeadlineItem[] => {
    return [
      {
        id: 'sales-tax-monthly',
        title: 'Sales Tax Returns',
        description: 'Monthly sales tax filing for all applicable clients',
        frequency: 'Monthly',
        dueDate: '20th of each month',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'high',
        forms: ['State Sales Tax Return', 'Local Tax Returns'],
        clients: ['ABC Corp', 'XYZ LLC', 'Retail Store Inc'],
        isActive: true
      },
      {
        id: 'form-941-q1',
        title: 'Form 941 - Q1',
        description: 'Quarterly payroll tax return for Q1 (Jan-Mar)',
        frequency: 'Quarterly',
        dueDate: 'April 30th',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'high',
        forms: ['Form 941', 'State Unemployment Returns'],
        clients: ['All Payroll Clients'],
        isActive: true
      },
      {
        id: 'form-941-q2',
        title: 'Form 941 - Q2',
        description: 'Quarterly payroll tax return for Q2 (Apr-Jun)',
        frequency: 'Quarterly',
        dueDate: 'July 31st',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'medium',
        forms: ['Form 941', 'State Unemployment Returns'],
        clients: ['All Payroll Clients'],
        isActive: true
      },
      {
        id: 'form-941-q3',
        title: 'Form 941 - Q3',
        description: 'Quarterly payroll tax return for Q3 (Jul-Sep)',
        frequency: 'Quarterly',
        dueDate: 'October 31st',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'medium',
        forms: ['Form 941', 'State Unemployment Returns'],
        clients: ['All Payroll Clients'],
        isActive: true
      },
      {
        id: 'form-941-q4',
        title: 'Form 941 - Q4',
        description: 'Quarterly payroll tax return for Q4 (Oct-Dec)',
        frequency: 'Quarterly',
        dueDate: 'January 31st',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'medium',
        forms: ['Form 941', 'State Unemployment Returns'],
        clients: ['All Payroll Clients'],
        isActive: true
      },
      {
        id: 'individual-tax-returns',
        title: 'Individual Tax Returns',
        description: 'Annual individual income tax returns',
        frequency: 'Yearly',
        dueDate: 'April 15th',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'high',
        forms: ['Form 1040', 'State Income Tax Returns'],
        clients: ['150+ Individual Clients'],
        isActive: true
      },
      {
        id: 'corporate-tax-returns',
        title: 'Corporate Tax Returns',
        description: 'Annual corporate income tax returns',
        frequency: 'Yearly',
        dueDate: 'March 15th (C-Corp)',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'high',
        forms: ['Form 1120', 'Form 1120S', 'State Corporate Returns'],
        clients: ['Corporate Clients'],
        isActive: true
      },
      {
        id: 'partnership-returns',
        title: 'Partnership Tax Returns',
        description: 'Annual partnership and LLC tax returns',
        frequency: 'Yearly',
        dueDate: 'March 15th',
        nextDue: new Date(),
        daysUntil: 0,
        priority: 'high',
        forms: ['Form 1065', 'State Partnership Returns'],
        clients: ['Partnership Clients'],
        isActive: true
      }
    ];
  };

  const calculateDeadlines = () => {
    loadStoredDeadlines();
  };

  const handleAddDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newDeadline: DeadlineItem = {
      id: `custom-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      frequency: formData.frequency,
      dueDate: formData.dueDate,
      nextDue: new Date(),
      daysUntil: 0,
      priority: 'medium',
      forms: formData.forms.split(',').map(f => f.trim()),
      clients: formData.clients.split(',').map(c => c.trim()),
      isActive: true,
      notes: formData.notes
    };

    const stored = localStorage.getItem('customDeadlines');
    const customDeadlines = stored ? JSON.parse(stored) : [];
    customDeadlines.push(newDeadline);
    localStorage.setItem('customDeadlines', JSON.stringify(customDeadlines));

    setFormData({
      title: '',
      description: '',
      frequency: 'Monthly',
      dueDate: '',
      forms: '',
      clients: '',
      notes: ''
    });
    setShowAddForm(false);
    loadStoredDeadlines();
  };

  const handleEditDeadline = (deadline: DeadlineItem) => {
    setEditingDeadline(deadline);
    setFormData({
      title: deadline.title,
      description: deadline.description,
      frequency: deadline.frequency,
      dueDate: deadline.dueDate,
      forms: deadline.forms.join(', '),
      clients: deadline.clients.join(', '),
      notes: deadline.notes || ''
    });
    setShowAddForm(true);
  };

  const handleUpdateDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingDeadline) return;

    const stored = localStorage.getItem('customDeadlines');
    const customDeadlines = stored ? JSON.parse(stored) : [];
    
    const updatedDeadlines = customDeadlines.map((deadline: DeadlineItem) => 
      deadline.id === editingDeadline.id ? {
        ...deadline,
        title: formData.title,
        description: formData.description,
        frequency: formData.frequency,
        dueDate: formData.dueDate,
        forms: formData.forms.split(',').map((f: string) => f.trim()),
        clients: formData.clients.split(',').map((c: string) => c.trim()),
        notes: formData.notes
      } : deadline
    );
    
    localStorage.setItem('customDeadlines', JSON.stringify(updatedDeadlines));
    
    setEditingDeadline(null);
    setFormData({
      title: '',
      description: '',
      frequency: 'Monthly',
      dueDate: '',
      forms: '',
      clients: '',
      notes: ''
    });
    setShowAddForm(false);
    loadStoredDeadlines();
  };

  const handleDeleteDeadline = (id: string) => {
    if (!confirm('Are you sure you want to delete this deadline?')) return;

    const stored = localStorage.getItem('customDeadlines');
    const customDeadlines = stored ? JSON.parse(stored) : [];
    const filteredDeadlines = customDeadlines.filter((deadline: DeadlineItem) => deadline.id !== id);
    localStorage.setItem('customDeadlines', JSON.stringify(filteredDeadlines));
    loadStoredDeadlines();
  };

  const toggleDeadlineActive = (id: string) => {
    const stored = localStorage.getItem('customDeadlines');
    const customDeadlines = stored ? JSON.parse(stored) : [];
    
    const updatedDeadlines = customDeadlines.map((deadline: DeadlineItem) => 
      deadline.id === id ? { ...deadline, isActive: !deadline.isActive } : deadline
    );
    
    localStorage.setItem('customDeadlines', JSON.stringify(updatedDeadlines));
    loadStoredDeadlines();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyMessage = (daysUntil: number) => {
    if (daysUntil < 0) return 'OVERDUE';
    if (daysUntil === 0) return 'DUE TODAY';
    if (daysUntil === 1) return 'DUE TOMORROW';
    return `${daysUntil} days left`;
  };

  const filteredDeadlines = filterActive ? deadlines.filter(d => d.isActive) : deadlines;

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Filing Deadlines Dashboard</h1>
            <p className="text-gray-400">Enter password to access</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter dashboard password"
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Access Dashboard
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 mb-4">
              Use 'taxpro2024admin' for full editing capabilities
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Filing Deadlines Dashboard</h1>
              <p className="text-gray-300 mt-2">
                Track all tax filing deadlines and stay compliant
                {isAdmin && <span className="text-green-400 ml-2">(Admin Mode)</span>}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Last updated: {currentDate.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filterActive}
                  onChange={(e) => setFilterActive(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Show active only</span>
              </label>
              {isAdmin && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add Deadline
                </button>
              )}
              <button
                onClick={calculateDeadlines}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-900 rounded-lg">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-300">Urgent (≤7 days)</p>
                <p className="text-2xl font-bold text-white">
                  {filteredDeadlines.filter(d => d.daysUntil <= 7 && d.daysUntil >= 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-900 rounded-lg">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-300">Coming Up (≤30 days)</p>
                <p className="text-2xl font-bold text-white">
                  {filteredDeadlines.filter(d => d.daysUntil > 7 && d.daysUntil <= 30).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300">Total Deadlines</p>
                <p className="text-2xl font-bold text-white">{filteredDeadlines.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-900/50 border border-purple-700 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-300">Overdue</p>
                <p className="text-2xl font-bold text-white">
                  {filteredDeadlines.filter(d => d.daysUntil < 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {showAddForm && isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                  {editingDeadline ? 'Edit Deadline' : 'Add New Deadline'}
                </h2>
              </div>
              <form onSubmit={editingDeadline ? handleUpdateDeadline : handleAddDeadline} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({...formData, frequency: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                      <option value="One-time">One-time</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                  <input
                    type="text"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    placeholder="e.g., 15th of each month, April 15th, etc."
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Forms (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.forms}
                    onChange={(e) => setFormData({...formData, forms: e.target.value})}
                    placeholder="Form 1040, State Return, etc."
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Clients (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.clients}
                    onChange={(e) => setFormData({...formData, clients: e.target.value})}
                    placeholder="Client A, Client B, etc."
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingDeadline ? 'Update' : 'Add'} Deadline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingDeadline(null);
                      setFormData({
                        title: '',
                        description: '',
                        frequency: 'Monthly',
                        dueDate: '',
                        forms: '',
                        clients: '',
                        notes: ''
                      });
                    }}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deadlines List */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Filing Deadlines</h2>
            <p className="text-sm text-gray-400 mt-1">Sorted by urgency</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {filteredDeadlines.map((deadline) => (
                <div key={deadline.id} className={`bg-gray-900 rounded-lg p-6 border border-gray-700 ${!deadline.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{deadline.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(deadline.priority)}`}>
                          {deadline.frequency}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          deadline.daysUntil < 0 ? 'bg-red-100 text-red-800 border-red-200' :
                          deadline.daysUntil <= 7 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {getUrgencyMessage(deadline.daysUntil)}
                        </span>
                        {!deadline.isActive && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-300 border border-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 mb-3">{deadline.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 font-medium">Due Date</p>
                          <p className="text-white">{deadline.dueDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium">Next Due</p>
                          <p className="text-white">{deadline.nextDue.toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium">Forms Required</p>
                          <p className="text-white">{deadline.forms.join(', ')}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-gray-400 font-medium text-sm">Affected Clients</p>
                        <p className="text-gray-300 text-sm">{deadline.clients.join(', ')}</p>
                      </div>
                      {deadline.notes && (
                        <div className="mt-3">
                          <p className="text-gray-400 font-medium text-sm">Notes</p>
                          <p className="text-gray-300 text-sm">{deadline.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    {isAdmin && deadline.id.startsWith('custom-') && (
                      <div className="ml-4 flex flex-col space-y-2">
                        <button
                          onClick={() => handleEditDeadline(deadline)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleDeadlineActive(deadline.id)}
                          className={`text-sm ${deadline.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                        >
                          {deadline.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteDeadline(deadline.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-blue-400 mb-2">Monthly Filings</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Sales Tax Returns (20th)</li>
                <li>• Payroll Tax Deposits (Various)</li>
                <li>• Monthly Financial Reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-yellow-400 mb-2">Quarterly Filings</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Form 941 (Last day of month after quarter)</li>
                <li>• State Unemployment Returns</li>
                <li>• Estimated Tax Payments</li>
                <li>• Quarterly Financial Reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-400 mb-2">Annual Filings</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Individual Returns (April 15)</li>
                <li>• Corporate Returns (March 15)</li>
                <li>• Partnership Returns (March 15)</li>
                <li>• Annual Information Returns</li>
              </ul>
            </div>
          </div>
          
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h4 className="font-medium text-purple-400 mb-2">Admin Features</h4>
              <ul className="text-gray-300 space-y-1 text-sm">
                <li>• Add custom deadlines for specific clients</li>
                <li>• Edit existing deadlines and client lists</li>
                <li>• Activate/deactivate deadlines as needed</li>
                <li>• All changes are saved locally in browser storage</li>
              </ul>
            </div>
          )}
        </div>

        {/* Export/Import Section for Admins */}
        {isAdmin && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  const stored = localStorage.getItem('customDeadlines');
                  const data = stored ? JSON.parse(stored) : [];
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `filing-deadlines-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Export Custom Deadlines
              </button>
              
              <label className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm cursor-pointer">
                Import Deadlines
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(event.target?.result as string);
                          localStorage.setItem('customDeadlines', JSON.stringify(data));
                          loadStoredDeadlines();
                          alert('Deadlines imported successfully!');
                        } catch (error) {
                          alert('Error importing file. Please check the format.');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
              
              <button
                onClick={() => {
                  if (confirm('This will delete all custom deadlines. Are you sure?')) {
                    localStorage.removeItem('customDeadlines');
                    loadStoredDeadlines();
                  }
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Clear Custom Deadlines
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Custom deadlines are stored locally in your browser. Export regularly to backup your data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
