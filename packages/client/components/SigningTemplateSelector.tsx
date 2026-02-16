'use client';

import { useState, useEffect } from 'react';

export interface SigningTemplate {
  id: string;
  templateName: string;
  templateCode: string;
  dropboxSignTemplateId: string;
  documentTypes: string[];
  clientType: 'Personal' | 'Corporate' | 'Both';
  numberOfSigners: number;
  description?: string;
  status: string;
  sortOrder?: number;
}

interface SigningTemplateSelectorProps {
  documentType?: string;
  clientType: 'personal' | 'corporate';
  selectedTemplateId: string | null;
  onTemplateSelect: (template: SigningTemplate | null) => void;
  disabled?: boolean;
}

export default function SigningTemplateSelector({
  documentType,
  clientType,
  selectedTemplateId,
  onTemplateSelect,
  disabled = false,
}: SigningTemplateSelectorProps) {
  const [templates, setTemplates] = useState<SigningTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [documentType, clientType]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();

      if (documentType) {
        params.append('documentType', documentType);
      }
      if (clientType) {
        params.append('clientType', clientType);
      }

      const response = await fetch(`${apiUrl}/api/docusign/templates?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch templates');
      }

      setTemplates(result.templates || []);

      // If no template selected and we have templates, don't auto-select
      // Let user choose explicitly
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    if (!templateId) {
      onTemplateSelect(null);
    } else {
      const template = templates.find(t => t.id === templateId);
      onTemplateSelect(template || null);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (isLoading) {
    return (
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">Signing Template</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="text-sm opacity-70">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">Signing Template</span>
        </label>
        <div className="text-sm text-warning flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Could not load templates. Proceeding without template.</span>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">Signing Template</span>
        </label>
        <div className="text-sm opacity-70">
          No templates available for this document type.
        </div>
      </div>
    );
  }

  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text">Signing Template</span>
        <span className="label-text-alt text-info">Optional</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={selectedTemplateId || ''}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="">Select a template (optional)</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.templateName}
            {template.numberOfSigners > 1 ? ` (${template.numberOfSigners} signers)` : ''}
          </option>
        ))}
      </select>

      {/* Template description */}
      {selectedTemplate && selectedTemplate.description && (
        <label className="label">
          <span className="label-text-alt">{selectedTemplate.description}</span>
        </label>
      )}

      {/* Multi-signer indicator */}
      {selectedTemplate && selectedTemplate.numberOfSigners > 1 && (
        <div className="mt-2 p-2 bg-info/10 rounded-lg">
          <p className="text-xs text-info flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            This template requires {selectedTemplate.numberOfSigners} signers (e.g., Married Filing Jointly)
          </p>
        </div>
      )}
    </div>
  );
}
