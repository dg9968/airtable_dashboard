'use client';

import { useState, useRef, useEffect } from 'react';

interface CorporateClient {
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
}

interface CorporateClientSearchProps {
  onClientSelect: (client: CorporateClient | null) => void;
  selectedClient?: CorporateClient | null;
  placeholder?: string;
  className?: string;
}

export default function CorporateClientSearch({
  onClientSelect,
  selectedClient,
  placeholder = "Search corporate clients...",
  className = ""
}: CorporateClientSearchProps) {
  const [searchResults, setSearchResults] = useState<CorporateClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // When a client is pre-selected (from URL), automatically search to show it in the list
  useEffect(() => {
    if (selectedClient && searchResults.length === 0) {
      // Search using EIN (most precise), then client code, then name
      // EIN ensures we get exactly one result since client code is last 4 digits of EIN
      const searchQuery = selectedClient.ein || selectedClient.clientCode || selectedClient.name;
      if (searchQuery && searchQuery.length >= 2) {
        setSearchTerm(searchQuery);
        searchCorporateClients(searchQuery);
      }
    }
  }, [selectedClient?.id]); // Only run when selectedClient.id changes

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

            // Use client code as fallback if company name is missing
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
              phone: (company.phone || '').toString().trim()
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

  const handleClientSelect = (client: CorporateClient) => {
    onClientSelect(client);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear results when input is too short
    if (value.length < 2) {
      setSearchResults([]);
      return;
    }
  };

  const handleSearch = () => {
    if (searchTerm.length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }
    searchCorporateClients(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSelection = () => {
    onClientSelect(null);
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

        {/* Search Button */}
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

        {/* Clear Selection Button */}
        {selectedClient && (
          <button
            type="button"
            onClick={clearSelection}
            className="btn btn-outline btn-error"
            title="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Search Results List - Always visible when there are results */}
      {searchResults.length > 0 && (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <div className="bg-base-200 px-4 py-2 font-semibold text-sm">
            Search Results ({searchResults.length})
          </div>
          <div className="divide-y divide-base-200 max-h-96 overflow-y-auto">
            {searchResults.map((client) => {
              const isSelected = selectedClient?.id === client.id;
              return (
                <button
                  key={client.id}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-content'
                      : 'hover:bg-base-200'
                  }`}
                  onClick={() => handleClientSelect(client)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {client.name}
                        {client.name.startsWith('Client ') && (
                          <span className={`badge badge-xs ${isSelected ? 'badge-warning' : 'badge-warning'}`}>
                            No Name
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 space-x-3 ${isSelected ? 'opacity-90' : 'text-base-content/70'}`}>
                        {client.clientCode && !client.name.startsWith('Client ') && (
                          <span className="font-mono">{client.clientCode}</span>
                        )}
                        {client.ein && <span>EIN: {client.ein}</span>}
                        {client.entityNumber && <span>Entity: {client.entityNumber}</span>}
                      </div>
                      {(client.city || client.state) && (
                        <div className={`text-xs mt-0.5 ${isSelected ? 'opacity-80' : 'text-base-content/50'}`}>
                          {client.city && client.state ? `${client.city}, ${client.state}` :
                           client.city || client.state}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when searching but no results */}
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
