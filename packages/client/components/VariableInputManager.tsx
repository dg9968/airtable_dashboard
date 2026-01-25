'use client';

import { useState, useEffect } from 'react';
import { CorporateClient } from './MultiClientSearch';
import { VariableDefinition } from './TemplateSelector';

export interface VariableValues {
  mode: 'bulk' | 'per-client';
  bulkValues: Record<string, any>;
  perClientValues: Record<string, Record<string, any>>;
}

interface VariableInputManagerProps {
  customVariables: VariableDefinition[];
  selectedClients: CorporateClient[];
  variableValues: VariableValues;
  onVariableValuesChange: (values: VariableValues) => void;
  className?: string;
}

export default function VariableInputManager({
  customVariables,
  selectedClients,
  variableValues,
  onVariableValuesChange,
  className = ""
}: VariableInputManagerProps) {
  const [mode, setMode] = useState<'bulk' | 'per-client'>(variableValues.mode);

  useEffect(() => {
    setMode(variableValues.mode);
  }, [variableValues.mode]);

  const handleModeChange = (newMode: 'bulk' | 'per-client') => {
    setMode(newMode);
    onVariableValuesChange({
      ...variableValues,
      mode: newMode,
    });
  };

  const handleBulkValueChange = (variableName: string, value: any) => {
    onVariableValuesChange({
      ...variableValues,
      bulkValues: {
        ...variableValues.bulkValues,
        [variableName]: value,
      },
    });
  };

  const handlePerClientValueChange = (clientId: string, variableName: string, value: any) => {
    onVariableValuesChange({
      ...variableValues,
      perClientValues: {
        ...variableValues.perClientValues,
        [clientId]: {
          ...(variableValues.perClientValues[clientId] || {}),
          [variableName]: value,
        },
      },
    });
  };

  const applyBulkToAll = () => {
    const newPerClientValues: Record<string, Record<string, any>> = {};

    selectedClients.forEach(client => {
      newPerClientValues[client.id] = { ...variableValues.bulkValues };
    });

    onVariableValuesChange({
      ...variableValues,
      perClientValues: newPerClientValues,
    });
  };

  const getClientValue = (clientId: string, variableName: string): any => {
    return variableValues.perClientValues[clientId]?.[variableName] || '';
  };

  const isMissingRequired = (variable: VariableDefinition, clientId?: string): boolean => {
    if (!variable.required) return false;

    if (mode === 'bulk') {
      const value = variableValues.bulkValues[variable.name];
      return !value || value.toString().trim() === '';
    } else if (clientId) {
      const value = getClientValue(clientId, variable.name);
      return !value || value.toString().trim() === '';
    }

    return false;
  };

  if (customVariables.length === 0) {
    return (
      <div className={`alert alert-info ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>This template has no custom variables. All values will be auto-filled from Airtable.</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mode Toggle */}
      <div className="form-control mb-6">
        <label className="label">
          <span className="label-text font-semibold">Variable Input Mode</span>
        </label>
        <div className="btn-group w-full">
          <button
            type="button"
            className={`btn flex-1 ${mode === 'bulk' ? 'btn-active' : ''}`}
            onClick={() => handleModeChange('bulk')}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
            Same for All
          </button>
          <button
            type="button"
            className={`btn flex-1 ${mode === 'per-client' ? 'btn-active' : ''}`}
            onClick={() => handleModeChange('per-client')}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
            Per-Client
          </button>
        </div>
        <label className="label">
          <span className="label-text-alt text-base-content/60">
            {mode === 'bulk'
              ? 'Enter values once and apply to all selected clients'
              : 'Enter different values for each client'}
          </span>
        </label>
      </div>

      {/* Bulk Mode */}
      {mode === 'bulk' && (
        <div className="space-y-4">
          {customVariables.map(variable => (
            <div key={variable.name} className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  {variable.label}
                  {variable.required && <span className="text-error ml-1">*</span>}
                </span>
                <span className="label-text-alt font-mono text-xs bg-base-200 px-2 py-1 rounded">
                  {`{{${variable.name}}}`}
                </span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${
                  isMissingRequired(variable) ? 'input-error' : ''
                }`}
                placeholder={variable.defaultValue || `Enter ${variable.label.toLowerCase()}...`}
                value={variableValues.bulkValues[variable.name] || ''}
                onChange={(e) => handleBulkValueChange(variable.name, e.target.value)}
              />
              {isMissingRequired(variable) && (
                <label className="label">
                  <span className="label-text-alt text-error">This field is required</span>
                </label>
              )}
            </div>
          ))}

          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>These values will be used for all {selectedClients.length} selected client{selectedClients.length !== 1 ? 's' : ''}.</span>
          </div>
        </div>
      )}

      {/* Per-Client Mode */}
      {mode === 'per-client' && (
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={applyBulkToAll}
              className="btn btn-sm btn-outline"
              title="Copy bulk values to all clients"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              Apply Bulk Values to All
            </button>
          </div>

          {/* Per-Client Table */}
          <div className="overflow-x-auto border border-base-300 rounded-lg">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th className="bg-base-200">Client</th>
                  {customVariables.map(variable => (
                    <th key={variable.name} className="bg-base-200">
                      {variable.label}
                      {variable.required && <span className="text-error ml-1">*</span>}
                      <div className="font-mono text-xs font-normal opacity-60">
                        {`{{${variable.name}}}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedClients.map(client => (
                  <tr key={client.id}>
                    <td className="font-semibold">
                      <div>{client.name}</div>
                      <div className="text-xs text-base-content/60">
                        {client.clientCode && `Code: ${client.clientCode}`}
                      </div>
                    </td>
                    {customVariables.map(variable => (
                      <td key={variable.name}>
                        <input
                          type="text"
                          className={`input input-bordered input-sm w-full ${
                            isMissingRequired(variable, client.id) ? 'input-error' : ''
                          }`}
                          placeholder={variable.defaultValue || ''}
                          value={getClientValue(client.id, variable.name)}
                          onChange={(e) => handlePerClientValueChange(client.id, variable.name, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation Summary */}
          {customVariables.some(v => v.required) && (
            <div className="alert alert-warning">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                Please ensure all required fields (marked with <span className="text-error">*</span>) are filled for each client.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
