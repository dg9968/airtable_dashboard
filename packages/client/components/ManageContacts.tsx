// components/ManageContacts.tsx
'use client';

import { useState, useEffect } from 'react';

// ===== TYPES =====
interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type?: string;
}

interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  registeredAgent?: string;
}

interface Relationship {
  id: string;
  contactId: string;
  companyId: string;
  contactName: string;
  companyName: string;
  role?: string;
  isPrimary: boolean;
  workEmail?: string;
  workPhone?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  status: string;
}

interface RelationshipFormData {
  contactId: string;
  companyId: string;
  role: string;
  isPrimary: boolean;
  workEmail: string;
  workPhone: string;
  department: string;
  startDate: string;
}

// ===== COMPONENT =====
export default function ManageContacts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<RelationshipFormData>({
    contactId: '',
    companyId: '',
    role: '',
    isPrimary: false,
    workEmail: '',
    workPhone: '',
    department: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  // ===== EFFECTS =====
  useEffect(() => {
    fetchContacts();
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedContact || selectedCompany) {
      fetchRelationships();
    }
  }, [selectedContact, selectedCompany]);

  // ===== API CALLS =====
  const fetchContacts = async () => {
    try {
      // TODO: Replace with actual contacts endpoint when available
      const response = await fetch(`${apiUrl}/api/contacts`);
      if (response.ok) {
        const result = await response.json();
        setContacts(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      // TODO: Replace with actual companies endpoint when available
      const response = await fetch(`${apiUrl}/api/companies`);
      if (response.ok) {
        const result = await response.json();
        setCompanies(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchRelationships = async () => {
    try {
      let url = `${apiUrl}/api/company-contacts?`;
      if (selectedContact) url += `contactId=${selectedContact.id}&`;
      if (selectedCompany) url += `companyId=${selectedCompany.id}&`;

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setRelationships(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching relationships:', err);
    }
  };

  const createRelationship = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/company-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: formData.contactId,
          companyId: formData.companyId,
          role: formData.role,
          isPrimary: formData.isPrimary,
          workEmail: formData.workEmail,
          workPhone: formData.workPhone,
          department: formData.department,
          startDate: formData.startDate
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Relationship created successfully!');
        setShowForm(false);
        resetForm();
        fetchRelationships();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to create relationship');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create relationship');
    } finally {
      setLoading(false);
    }
  };

  const updateRelationship = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/company-contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: formData.role,
          isPrimary: formData.isPrimary,
          workEmail: formData.workEmail,
          workPhone: formData.workPhone,
          department: formData.department,
          startDate: formData.startDate
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Relationship updated successfully!');
        setShowForm(false);
        setEditingRelationship(null);
        resetForm();
        fetchRelationships();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to update relationship');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update relationship');
    } finally {
      setLoading(false);
    }
  };

  const deleteRelationship = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this relationship?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/company-contacts/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Relationship deactivated successfully!');
        fetchRelationships();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to deactivate relationship');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate relationship');
    } finally {
      setLoading(false);
    }
  };

  const setPrimaryContact = async (contactId: string, companyId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/company-contacts/contact/${contactId}/set-primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Primary contact updated!');
        fetchRelationships();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to set primary contact');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set primary contact');
    } finally {
      setLoading(false);
    }
  };

  // ===== HANDLERS =====
  const handleCreateNew = () => {
    if (!selectedContact && !selectedCompany) {
      setError('Please select a contact or company first');
      return;
    }

    setFormData({
      contactId: selectedContact?.id || '',
      companyId: selectedCompany?.id || '',
      role: '',
      isPrimary: false,
      workEmail: '',
      workPhone: '',
      department: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    setEditingRelationship(null);
    setShowForm(true);
  };

  const handleEdit = (relationship: Relationship) => {
    setFormData({
      contactId: relationship.contactId,
      companyId: relationship.companyId,
      role: relationship.role || '',
      isPrimary: relationship.isPrimary,
      workEmail: relationship.workEmail || '',
      workPhone: relationship.workPhone || '',
      department: relationship.department || '',
      startDate: relationship.startDate || new Date().toISOString().split('T')[0]
    });
    setEditingRelationship(relationship);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.contactId || !formData.companyId) {
      setError('Contact and Company are required');
      return;
    }

    if (editingRelationship) {
      updateRelationship(editingRelationship.id);
    } else {
      createRelationship();
    }
  };

  const resetForm = () => {
    setFormData({
      contactId: '',
      companyId: '',
      role: '',
      isPrimary: false,
      workEmail: '',
      workPhone: '',
      department: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    setEditingRelationship(null);
  };

  // ===== FILTERED DATA =====
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Manage Contacts</h1>
              <p className="text-gray-300 mt-2">Link contacts to companies and manage work relationships</p>
            </div>
            <a href="/" className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Dashboard</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-200">❌ {error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <p className="text-green-200">✅ {success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Search */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Search */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Search Contacts</h2>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <p className="text-gray-400 text-sm">No contacts found</p>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedContact?.id === contact.id
                          ? 'bg-blue-900 border-2 border-blue-500'
                          : 'bg-gray-700 border-2 border-transparent hover:border-gray-600'
                      }`}
                    >
                      <p className="font-medium text-white">{contact.name}</p>
                      {contact.email && (
                        <p className="text-sm text-gray-400">{contact.email}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Company Search */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Search Companies</h2>
              <input
                type="text"
                placeholder="Search by company name..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                  <p className="text-gray-400 text-sm">No companies found</p>
                ) : (
                  filteredCompanies.map((company) => (
                    <div
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedCompany?.id === company.id
                          ? 'bg-blue-900 border-2 border-blue-500'
                          : 'bg-gray-700 border-2 border-transparent hover:border-gray-600'
                      }`}
                    >
                      <p className="font-medium text-white">{company.name}</p>
                      {company.registeredAgent && (
                        <p className="text-sm text-gray-400">Agent: {company.registeredAgent}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Relationships & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selection Summary */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Current Selection</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Contact</p>
                  {selectedContact ? (
                    <div className="flex items-center justify-between p-3 bg-blue-900/30 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{selectedContact.name}</p>
                        {selectedContact.email && (
                          <p className="text-sm text-gray-400">{selectedContact.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedContact(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No contact selected</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-400 mb-1">Company</p>
                  {selectedCompany ? (
                    <div className="flex items-center justify-between p-3 bg-blue-900/30 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{selectedCompany.name}</p>
                      </div>
                      <button
                        onClick={() => setSelectedCompany(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No company selected</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleCreateNew}
                disabled={(!selectedContact && !selectedCompany) || loading}
                className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create New Relationship
              </button>
            </div>

            {/* Relationship Form */}
            {showForm && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    {editingRelationship ? 'Edit Relationship' : 'New Relationship'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Role / Title *
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        placeholder="e.g., CFO, Accountant, Manager"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Department
                      </label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="e.g., Finance, Operations"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Work Email
                      </label>
                      <input
                        type="email"
                        value={formData.workEmail}
                        onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                        placeholder="work@company.com"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Work Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.workPhone}
                        onChange={(e) => setFormData({ ...formData, workPhone: e.target.value })}
                        placeholder="+1-555-0100"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isPrimary}
                          onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                          className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 text-white">Primary Contact</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-4 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : editingRelationship ? 'Update Relationship' : 'Create Relationship'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Relationships List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Relationships ({relationships.length})
              </h2>

              {relationships.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No relationships found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Select a contact and company to create a new relationship
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {relationships.map((rel) => (
                    <div key={rel.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-white">{rel.contactName}</h3>
                            <span className="text-gray-400">→</span>
                            <h3 className="font-semibold text-white">{rel.companyName}</h3>
                            {rel.isPrimary && (
                              <span className="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded-full">
                                Primary
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              rel.status === 'Active'
                                ? 'bg-green-900 text-green-300'
                                : 'bg-gray-600 text-gray-300'
                            }`}>
                              {rel.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            {rel.role && (
                              <div>
                                <span className="text-gray-400">Role:</span>
                                <span className="ml-2 text-white">{rel.role}</span>
                              </div>
                            )}
                            {rel.department && (
                              <div>
                                <span className="text-gray-400">Department:</span>
                                <span className="ml-2 text-white">{rel.department}</span>
                              </div>
                            )}
                            {rel.workEmail && (
                              <div>
                                <span className="text-gray-400">Work Email:</span>
                                <span className="ml-2 text-white">{rel.workEmail}</span>
                              </div>
                            )}
                            {rel.workPhone && (
                              <div>
                                <span className="text-gray-400">Work Phone:</span>
                                <span className="ml-2 text-white">{rel.workPhone}</span>
                              </div>
                            )}
                            {rel.startDate && (
                              <div>
                                <span className="text-gray-400">Start Date:</span>
                                <span className="ml-2 text-white">{rel.startDate}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-2 ml-4">
                          {!rel.isPrimary && rel.status === 'Active' && (
                            <button
                              onClick={() => setPrimaryContact(rel.contactId, rel.companyId)}
                              disabled={loading}
                              className="px-3 py-1 text-sm bg-blue-900 text-blue-300 rounded hover:bg-blue-800 transition-colors disabled:opacity-50"
                              title="Set as primary contact"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(rel)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
                          >
                            Edit
                          </button>
                          {rel.status === 'Active' && (
                            <button
                              onClick={() => deleteRelationship(rel.id)}
                              disabled={loading}
                              className="px-3 py-1 text-sm bg-red-900 text-red-300 rounded hover:bg-red-800 transition-colors disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
