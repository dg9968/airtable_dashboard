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
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-medium">Corporate Client</span>
          {selectedClient && (
            <button
              type="button"
              onClick={clearSelection}
              className="label-text-alt text-error hover:text-error-focus"
            >
              Clear
            </button>
          )}
        </label>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className={`input input-bordered w-full pr-10 ${selectedClient ? 'input-success' : ''}`}
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
          />

          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className="loading loading-spinner loading-xs"></span>
            </div>
          )}

          {selectedClient && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>

        {/* Selected Client Details */}
        {selectedClient && (
          <div className="mt-2 p-3 bg-success/10 border border-success/20 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-success">{selectedClient.name}</div>
              {selectedClient.clientCode && (
                <div className="text-base-content/70">
                  <span className="font-medium">Client Code:</span> <span className="font-mono">{selectedClient.clientCode}</span>
                </div>
              )}
              {selectedClient.ein && (
                <div className="text-base-content/70">
                  <span className="font-medium">EIN:</span> {selectedClient.ein}
                </div>
              )}
              {selectedClient.entityNumber && (
                <div className="text-base-content/70">
                  <span className="font-medium">Entity #:</span> {selectedClient.entityNumber}
                </div>
              )}
              {(selectedClient.city || selectedClient.state) && (
                <div className="text-base-content/60 text-xs">
                  {selectedClient.city && selectedClient.state ? `${selectedClient.city}, ${selectedClient.state}` :
                   selectedClient.city || selectedClient.state}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="label">
            <span className="label-text-alt text-error">{error}</span>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isDropdownOpen && !selectedClient && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center">
              <span className="loading loading-spinner loading-sm"></span>
              <div className="text-sm text-base-content/60 mt-2">Searching...</div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-base-content/60">
              {searchTerm ? 'No clients found matching your search' : 'Type to search corporate clients'}
            </div>
          ) : (
            <div className="py-1">
              {searchResults.map((client) => (
                <button
                  key={client.id}
                  className="w-full px-4 py-3 text-left hover:bg-base-200 border-b border-base-200 last:border-b-0 transition-colors"
                  onClick={() => handleClientSelect(client)}
                >
                  <div className="font-medium text-base-content">{client.name}</div>
                  <div className="text-sm text-base-content/70 space-y-1">
                    {client.clientCode && (
                      <div><span className="font-medium">Client Code:</span> <span className="font-mono">{client.clientCode}</span></div>
                    )}
                    {client.ein && (
                      <div><span className="font-medium">EIN:</span> {client.ein}</div>
                    )}
                    {client.entityNumber && (
                      <div><span className="font-medium">Entity #:</span> {client.entityNumber}</div>
                    )}
                    {(client.city || client.state) && (
                      <div className="text-base-content/60">
                        {client.city && client.state ? `${client.city}, ${client.state}` :
                         client.city || client.state}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}