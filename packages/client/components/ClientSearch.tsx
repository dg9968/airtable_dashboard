// components/ClientSearch.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  fields: {
    'Full Name'?: string;
    'Client Code'?: string;
    'Email'?: string;
    '📞Phone number'?: string;
    'SSN'?: string;
    'Spouse Name'?: string;
    'Spouse Client Code'?: string;
  };
}

interface ClientSearchProps {
  onClientSelect: (clientCode: string, personalId: string, spouseClientCode?: string) => void;
  initialClientCode?: string;
}

export default function ClientSearch({ onClientSelect, initialClientCode }: ClientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const searchClients = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/personal/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Search failed');
      }

      setSearchResults(result.data || []);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if less than 2 characters
    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Set loading state immediately for better UX
    setIsSearching(true);
    setShowSearchResults(true);

    // Debounce the search - wait 500ms after user stops typing
    debounceTimerRef.current = setTimeout(() => {
      searchClients(value);
    }, 500);
  };

  const selectClient = (client: Client) => {
    const code = client.fields['Client Code'];
    const spouseCode = client.fields['Spouse Client Code'];
    if (code) {
      setSelectedClient(client);
      setSearchTerm('');
      setShowSearchResults(false);
      setSearchResults([]);
      onClientSelect(code, client.id, spouseCode);
    }
  };

  const clearSelection = () => {
    setSelectedClient(null);
    onClientSelect('', '', undefined);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Search Existing Clients</h2>
        <p className="text-sm text-gray-500 mb-3">Search by name, email, phone, or last 4 digits of SSN</p>

        {/* Selected Client Display */}
        {selectedClient && (
          <div className="alert alert-success mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">{selectedClient.fields['Full Name'] || 'No Name'}</div>
                  <div className="text-sm mt-1 space-y-0.5">
                    <div>Client Code: <span className="font-mono font-bold">{selectedClient.fields['Client Code']}</span></div>
                    {selectedClient.fields['Email'] && (
                      <div>Email: {selectedClient.fields['Email']}</div>
                    )}
                    {selectedClient.fields['📞Phone number'] && (
                      <div>Phone: {selectedClient.fields['📞Phone number']}</div>
                    )}
                    {selectedClient.fields['Spouse Name'] && (
                      <div>Spouse: {selectedClient.fields['Spouse Name']}
                        {selectedClient.fields['Spouse Client Code'] && (
                          <span className="ml-1">(Code: <span className="font-mono">{selectedClient.fields['Spouse Client Code']}</span>)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/client-intake?id=${selectedClient.id}`} className="btn btn-sm btn-primary">
                    View Client
                  </Link>
                  <button className="btn btn-sm btn-ghost" onClick={clearSelection}>
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Input */}
        {!selectedClient && (
          <div className="form-control relative" ref={searchRef}>
            <input
              type="text"
              placeholder="Start typing to search..."
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {isSearching && (
              <span className="loading loading-spinner loading-sm absolute right-3 top-3"></span>
            )}

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-y-auto top-full">
                {searchResults.map((client) => (
                  <button
                    key={client.id}
                    className="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors"
                    onClick={() => selectClient(client)}
                  >
                    <div className="font-semibold text-sm">{client.fields['Full Name'] || 'No Name'}</div>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      {client.fields['Client Code'] && (
                        <div>Client Code: <span className="font-mono">{client.fields['Client Code']}</span></div>
                      )}
                      {client.fields['Email'] && (
                        <div>Email: {client.fields['Email']}</div>
                      )}
                      {client.fields['📞Phone number'] && (
                        <div>Phone: {client.fields['📞Phone number']}</div>
                      )}
                      {client.fields['SSN'] && (
                        <div>SSN: ***-**-{client.fields['SSN'].slice(-4)}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results Message */}
            {showSearchResults && searchResults.length === 0 && !isSearching && searchTerm.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-4 top-full">
                <p className="text-sm text-gray-500 text-center">No clients found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
