'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface VariableDefinition {
  name: string;
  label: string;
  type: 'airtable_field' | 'custom';
  source?: string;
  required: boolean;
  defaultValue?: string;
}

interface MessageTemplate {
  id: string;
  templateName: string;
  templateCode: string;
  subjectTemplate: string;
  contentTemplate: string;
  description: string;
  variableDefinitions: {
    variables: VariableDefinition[];
  };
  category: string;
  status: string;
  createdDate: string;
  lastUsedDate?: string;
}

export default function TemplateManagementPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchTemplates();
  }, [statusFilter, categoryFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`${apiUrl}/api/message-templates?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setShowCreateModal(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to archive this template?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/message-templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive template');
      }

      fetchTemplates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive template';
      alert(errorMessage);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/message-templates/${templateId}/duplicate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to duplicate template');
      }

      fetchTemplates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate template';
      alert(errorMessage);
    }
  };

  const filteredTemplates = templates.filter(template =>
    searchTerm === '' ||
    template.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

  return (
    <div className="min-h-screen bg-base-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push('/communications')} className="btn btn-ghost btn-sm mb-4">
          ← Back to Communications
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-base-content/70 mt-1">Create and manage reusable message templates</p>
          </div>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowCreateModal(true);
            }}
            className="btn btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Search</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {categories.length > 0 && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Category</span>
                </label>
                <select
                  className="select select-bordered"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Templates Grid */}
      {!loading && filteredTemplates.length === 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-16">
            <svg className="w-24 h-24 mx-auto mb-4 text-base-content/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 className="text-2xl font-bold mb-2">No templates found</h3>
            <p className="text-base-content/60 mb-4">Get started by creating your first message template</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create Template
            </button>
          </div>
        </div>
      )}

      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="card-title text-lg">{template.templateName}</h2>
                  <div className="dropdown dropdown-end">
                    <button tabIndex={0} className="btn btn-ghost btn-sm btn-circle">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                      </svg>
                    </button>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
                      <li><a onClick={() => handleEdit(template)}>Edit</a></li>
                      <li><a onClick={() => handleDuplicate(template.id)}>Duplicate</a></li>
                      <li><a onClick={() => handleDelete(template.id)} className="text-error">Archive</a></li>
                    </ul>
                  </div>
                </div>

                <p className="text-sm text-base-content/70 mb-3 line-clamp-2">
                  {template.description || 'No description'}
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {template.category && (
                    <span className="badge badge-primary badge-sm">{template.category}</span>
                  )}
                  <span className={`badge badge-sm ${
                    template.status === 'Active' ? 'badge-success' :
                    template.status === 'Draft' ? 'badge-warning' :
                    'badge-ghost'
                  }`}>
                    {template.status}
                  </span>
                  <span className="badge badge-ghost badge-sm">
                    {template.variableDefinitions.variables.length} variable{template.variableDefinitions.variables.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="text-xs text-base-content/60 mb-3">
                  <div className="font-semibold mb-1">Subject:</div>
                  <div className="bg-base-200 p-2 rounded font-mono text-xs line-clamp-2">
                    {template.subjectTemplate}
                  </div>
                </div>

                <div className="text-xs text-base-content/60">
                  <div className="font-semibold mb-1">Content Preview:</div>
                  <div className="bg-base-200 p-2 rounded font-mono text-xs line-clamp-3">
                    {template.contentTemplate}
                  </div>
                </div>

                <div className="card-actions justify-end mt-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="btn btn-sm btn-primary"
                  >
                    Edit Template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal - Placeholder */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            <p className="text-base-content/70 mb-4">
              Template editor coming soon. For now, please create templates directly in Airtable.
            </p>
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>See READY_TO_TEST.md for instructions on creating templates in Airtable</span>
            </div>
            <div className="modal-action">
              <button onClick={() => setShowCreateModal(false)} className="btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
