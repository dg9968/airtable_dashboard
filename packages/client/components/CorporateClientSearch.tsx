'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Update search term when selected client changes
  useEffect(() => {
    if (selectedClient) {
      setSearchTerm(selectedClient.name);
      setIsDropdownOpen(false);
    } else {
      setSearchTerm('');
    }
  }, [selectedClient]);

  const searchCorporateClients = async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setIsDropdownOpen(false);
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
          .map((company: any) => ({
            id: company.id,
            clientCode: (company.clientCode || '').toString().trim(),
            name: (company.name || '').toString().trim(),
            ein: (company.taxId || '').toString().trim(),
            entityNumber: (company.entityNumber || '').toString().trim(),
            address: (company.address || '').toString().trim(),
            city: (company.city || '').toString().trim(),
            state: (company.state || '').toString().trim(),
            zipCode: (company.zipCode || '').toString().trim(),
            phone: (company.phone || '').toString().trim()
          }))
          .filter((client: CorporateClient) => client.name);

        setSearchResults(clientsList);
        setIsDropdownOpen(true);
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
    setIsDropdownOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear selection if user starts typing
    if (selectedClient && value !== selectedClient.name) {
      onClientSelect(null);
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Don't search if empty
    if (value.length < 1) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      setIsSearching(false);
      return;
    }

    // Show dropdown immediately when typing (but don't disable input)
    setIsDropdownOpen(true);

    // Debounce: wait 500ms after user stops typing before searching
    debounceTimerRef.current = setTimeout(() => {
      searchCorporateClients(value);
    }, 500);
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 2) {
      setIsDropdownOpen(true);
    }
  };

  const clearSelection = () => {
    onClientSelect(null);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={`input input-bordered w-full ${selectedClient ? 'pr-20' : 'pr-10'}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />

        {/* Right side icons/buttons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {isSearching && (
            <span className="loading loading-spinner loading-xs"></span>
          )}

          {selectedClient && !isSearching && (
            <>
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <button
                type="button"
                onClick={clearSelection}
                className="btn btn-ghost btn-xs btn-circle"
                title="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-error mt-1">{error}</div>
      )}

      {/* Selected Client Card - Compact */}
      {selectedClient && (
        <div className="mt-2 p-3 bg-base-200 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{selectedClient.name}</div>
              <div className="text-xs text-base-content/70 space-x-3">
                {selectedClient.clientCode && (
                  <span className="font-mono">{selectedClient.clientCode}</span>
                )}
                {selectedClient.ein && (
                  <span>EIN: {selectedClient.ein}</span>
                )}
                {selectedClient.entityNumber && (
                  <span>Entity: {selectedClient.entityNumber}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Results */}
      {isDropdownOpen && !selectedClient && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center">
              <span className="loading loading-spinner loading-sm"></span>
              <div className="text-xs text-base-content/60 mt-2">Searching...</div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-base-content/60">
              {searchTerm ? 'No clients found' : 'Start typing to search...'}
            </div>
          ) : (
            <div className="divide-y divide-base-200">
              {searchResults.map((client) => (
                <button
                  key={client.id}
                  className="w-full px-4 py-2.5 text-left hover:bg-base-200 transition-colors"
                  onClick={() => handleClientSelect(client)}
                >
                  <div className="font-medium text-sm">{client.name}</div>
                  <div className="text-xs text-base-content/70 mt-0.5 space-x-3">
                    {client.clientCode && (
                      <span className="font-mono">{client.clientCode}</span>
                    )}
                    {client.ein && <span>EIN: {client.ein}</span>}
                    {client.entityNumber && <span>Entity: {client.entityNumber}</span>}
                  </div>
                  {(client.city || client.state) && (
                    <div className="text-xs text-base-content/50 mt-0.5">
                      {client.city && client.state ? `${client.city}, ${client.state}` :
                       client.city || client.state}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}