'use client';

import { useState, useEffect } from 'react';
import { CorporateClient } from './MultiClientSearch';

export interface VariableDefinition {
  name: string;
  label: string;
  type: 'airtable_field' | 'custom';
  source?: string;
  required: boolean;
  defaultValue?: string;
}

export interface MessageTemplate {
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

interface TemplateSelectorProps {
  onTemplateSelect: (template: MessageTemplate | null) => void;
  selectedTemplate: MessageTemplate | null;
  previewClient?: CorporateClient | null;
  className?: string;
}

export default function TemplateSelector({
  onTemplateSelect,
  selectedTemplate,
  previewClient,
  className = ""
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [previewMode, setPreviewMode] = useState<'placeholders' | 'preview'>('placeholders');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams({ status: 'Active' });

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

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchTerm === '' ||
      template.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === '' || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

  const highlightVariables = (text: string) => {
    return text.split(/(\{\{\w+\}\})/).map((part, index) => {
      if (part.match(/^\{\{\w+\}\}$/)) {
        return (
          <span key={index} className="bg-warning/30 text-warning-content px-1 rounded font-mono text-sm">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getCustomVariables = () => {
    if (!selectedTemplate) return [];
    return selectedTemplate.variableDefinitions.variables.filter(v => v.type === 'custom');
  };

  const getAirtableVariables = () => {
    if (!selectedTemplate) return [];
    return selectedTemplate.variableDefinitions.variables.filter(v => v.type === 'airtable_field');
  };

  return (
    <div className={className}>
      {/* Template Selection Dropdown */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text font-semibold">Select Template</span>
          <button
            type="button"
            onClick={fetchTemplates}
            className="btn btn-xs btn-ghost"
            title="Refresh templates"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </label>

        {/* Search and Filter */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {categories.length > 0 && (
            <select
              className="select select-bordered w-48"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Templates List */}
        {!loading && !error && (
          <div className="border border-base-300 rounded-lg divide-y divide-base-200 max-h-64 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-base-content/60">
                <p>No templates found</p>
                <button
                  type="button"
                  onClick={() => window.open('/communications/templates', '_blank')}
                  className="btn btn-sm btn-primary mt-2"
                >
                  Create New Template
                </button>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'bg-primary text-primary-content'
                      : 'hover:bg-base-200'
                  }`}
                  onClick={() => onTemplateSelect(template)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{template.templateName}</div>
                      {template.description && (
                        <div className="text-xs mt-1 opacity-80 line-clamp-1">
                          {template.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {template.category && (
                          <span className={`badge badge-xs ${
                            selectedTemplate?.id === template.id ? 'badge-secondary' : 'badge-ghost'
                          }`}>
                            {template.category}
                          </span>
                        )}
                        <span className="text-xs opacity-70">
                          {template.variableDefinitions.variables.length} variable{template.variableDefinitions.variables.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Clear Selection */}
        {selectedTemplate && (
          <button
            type="button"
            onClick={() => onTemplateSelect(null)}
            className="btn btn-sm btn-ghost mt-2"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title text-lg">Template Preview</h3>
              {previewClient && (
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${previewMode === 'placeholders' ? 'btn-active' : ''}`}
                    onClick={() => setPreviewMode('placeholders')}
                  >
                    Placeholders
                  </button>
                  <button
                    className={`btn ${previewMode === 'preview' ? 'btn-active' : ''}`}
                    onClick={() => setPreviewMode('preview')}
                  >
                    Preview
                  </button>
                </div>
              )}
            </div>

            {/* Subject Preview */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-semibold">Subject:</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg text-sm">
                {previewMode === 'placeholders' || !previewClient
                  ? highlightVariables(selectedTemplate.subjectTemplate)
                  : selectedTemplate.subjectTemplate}
              </div>
            </div>

            {/* Content Preview */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-semibold">Content:</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {previewMode === 'placeholders' || !previewClient
                  ? highlightVariables(selectedTemplate.contentTemplate)
                  : selectedTemplate.contentTemplate}
              </div>
            </div>

            {/* Variable Legend */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Variables:</span>
              </label>

              {/* Airtable Variables */}
              {getAirtableVariables().length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-base-content/70 mb-2">
                    Auto-filled from Airtable:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getAirtableVariables().map(variable => (
                      <div
                        key={variable.name}
                        className="badge badge-info gap-1"
                        title={`Source: ${variable.source}`}
                      >
                        <span className="font-mono text-xs">
                          {`{{${variable.name}}}`}
                        </span>
                        {variable.required && <span className="text-error">*</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Variables */}
              {getCustomVariables().length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-base-content/70 mb-2">
                    You will provide:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getCustomVariables().map(variable => (
                      <div
                        key={variable.name}
                        className="badge badge-warning gap-1"
                        title={variable.label}
                      >
                        <span className="font-mono text-xs">
                          {`{{${variable.name}}}`}
                        </span>
                        {variable.required && <span className="text-error">*</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTemplate.variableDefinitions.variables.length === 0 && (
                <p className="text-sm text-base-content/60">No variables in this template</p>
              )}

              <div className="mt-2 text-xs text-base-content/60">
                <span className="text-error">*</span> = Required
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
