'use client';

import { useState, useRef } from 'react';

export interface CorporateClient {
  id: string;
  clientCode?: string;
  name: string;
  ein: string;
  entityNumber: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
}

interface MultiClientSearchProps {
  onClientsChange: (clients: CorporateClient[]) => void;
  selectedClients: CorporateClient[];
  maxSelection?: number;
  placeholder?: string;
  className?: string;
}

export default function MultiClientSearch({
  onClientsChange,
  selectedClients,
  maxSelection,
  placeholder = "Search corporate clients...",
  className = ""
}: MultiClientSearchProps) {
  const [searchResults, setSearchResults] = useState<CorporateClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSelected, setShowSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create a Set of selected client IDs for efficient lookup
  const selectedIds = new Set(selectedClients.map(c => c.id));

  const searchCorporateClients = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/companies/search?q=${encodeURIComponent(query)}`);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      if (data.data) {
        const clientsList: CorporateClient[] = data.data
          .map((company: any) => {
            const clientCode = (company.clientCode || '').toString().trim();
            const name = (company.name || '').toString().trim();
            const displayName = name || (clientCode ? `Client ${clientCode}` : '');

            return {
              id: company.id,
              clientCode,
              name: displayName,
              ein: (company.taxId || '').toString().trim(),
              entityNumber: (company.entityNumber || '').toString().trim(),
              address: (company.address || '').toString().trim(),
              city: (company.city || '').toString().trim(),
              state: (company.state || '').toString().trim(),
              zipCode: (company.zipCode || '').toString().trim(),
              phone: (company.phone || '').toString().trim(),
              email: (company.email || '').toString().trim()
            };
          })
          .filter((client: CorporateClient) => client.name);

        setSearchResults(clientsList);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Error searching clients:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleClientSelection = (client: CorporateClient) => {
    if (selectedIds.has(client.id)) {
      // Deselect
      onClientsChange(selectedClients.filter(c => c.id !== client.id));
    } else {
      // Select (check max limit)
      if (maxSelection && selectedClients.length >= maxSelection) {
        setError(`Maximum ${maxSelection} clients can be selected`);
        setTimeout(() => setError(null), 3000);
        return;
      }
      onClientsChange([...selectedClients, client]);
    }
  };

  const selectAllVisible = () => {
    if (maxSelection && searchResults.length > maxSelection) {
      setError(`Cannot select all: Maximum ${maxSelection} clients allowed`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Add all visible results that aren't already selected
    const newSelections = searchResults.filter(client => !selectedIds.has(client.id));
    onClientsChange([...selectedClients, ...newSelections]);
  };

  const clearAllSelections = () => {
    onClientsChange([]);
  };

  const removeClient = (clientId: string) => {
    onClientsChange(selectedClients.filter(c => c.id !== clientId));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }
  };

  const handleSearch = () => {
    if (searchTerm.length < 2) {
      setError('Please enter at least 2 characters');
      setTimeout(() => setError(null), 3000);
      return;
    }
    searchCorporateClients(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={className}>
      {/* Search Input with Button */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="input input-bordered w-full"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || searchTerm.length < 2}
          className="btn btn-primary"
        >
          {isSearching ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              Searching
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              Search
            </>
          )}
        </button>
      </div>

      {/* Selected Clients Counter and Actions */}
      {selectedClients.length > 0 && (
        <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="badge badge-primary badge-lg">
                {selectedClients.length} {selectedClients.length === 1 ? 'Client' : 'Clients'} Selected
              </span>
              {maxSelection && (
                <span className="text-sm text-base-content/60">
                  (Max: {maxSelection})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSelected(!showSelected)}
                className="btn btn-sm btn-ghost"
              >
                {showSelected ? 'Hide' : 'Show'} Selected
              </button>
              <button
                type="button"
                onClick={clearAllSelections}
                className="btn btn-sm btn-outline btn-error"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Selected Clients List */}
          {showSelected && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {selectedClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-base-100 rounded-lg border border-base-300"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{client.name}</div>
                    <div className="text-xs text-base-content/70 space-x-3">
                      {client.clientCode && <span className="font-mono">{client.clientCode}</span>}
                      {client.ein && <span>EIN: {client.ein}</span>}
                      {client.city && client.state && <span>{client.city}, {client.state}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClient(client.id)}
                    className="btn btn-sm btn-circle btn-ghost text-error"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Search Results List with Checkboxes */}
      {searchResults.length > 0 && (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <div className="bg-base-200 px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-sm">
              Search Results ({searchResults.length})
            </span>
            <button
              type="button"
              onClick={selectAllVisible}
              className="btn btn-xs btn-primary"
            >
              Select All Visible
            </button>
          </div>
          <div className="divide-y divide-base-200 max-h-96 overflow-y-auto">
            {searchResults.map((client) => {
              const isSelected = selectedIds.has(client.id);
              return (
                <button
                  key={client.id}
                  type="button"
                  className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-primary/10'
                      : 'hover:bg-base-200'
                  }`}
                  onClick={() => toggleClientSelection(client)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={isSelected}
                    readOnly
                  />

                  {/* Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {client.name}
                      {client.name.startsWith('Client ') && (
                        <span className="badge badge-xs badge-warning">
                          No Name
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5 space-x-3 text-base-content/70">
                      {client.clientCode && !client.name.startsWith('Client ') && (
                        <span className="font-mono">{client.clientCode}</span>
                      )}
                      {client.ein && <span>EIN: {client.ein}</span>}
                      {client.entityNumber && <span>Entity: {client.entityNumber}</span>}
                    </div>
                    {(client.city || client.state) && (
                      <div className="text-xs mt-0.5 text-base-content/50">
                        {client.city && client.state ? `${client.city}, ${client.state}` :
                         client.city || client.state}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
        <div className="text-center py-8 text-base-content/60">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <p className="font-semibold">No companies found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {/* Loading state */}
      {isSearching && (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/60">Searching...</p>
        </div>
      )}
    </div>
  );
}
