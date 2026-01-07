'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireRole } from '@/hooks/useAuth';
import Link from 'next/link';

interface Person {
  id: string;
  fields: {
    'Full Name'?: string;
    'First Name'?: string;
    'Last Name'?: string;
    'Client Code'?: string;
    'SSN'?: string;
    'Date of Birth'?: string;
    'Filing Status'?: string;
    '📞Phone number'?: string;
    'Email'?: string;
    'Spouse (Linked)'?: string[];
    'Parent (Linked)'?: string[];
    'Dependent (Linked)'?: string[];
    'Child (Linked)'?: string[];
    'Spouse Client Code'?: string;
    'Spouse First Name'?: string[];
    'Spouse Last Name'?: string[];
  };
}

interface TaxFamily {
  primary: Person;
  spouse?: Person;
  dependents: Person[];
  children: Person[];
  parents: Person[];
}

function TaxFamilyDashboardContent() {
  const { session, status } = useRequireRole(['staff', 'admin']);
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [taxFamily, setTaxFamily] = useState<TaxFamily | null>(null);
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);
  const [showAddSpouse, setShowAddSpouse] = useState(false);
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [allPersons, setAllPersons] = useState<Person[]>([]);

  // Define functions before useEffect hooks that use them
  const loadTaxFamily = async (person: Person) => {
    setIsLoadingFamily(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const family: TaxFamily = {
        primary: person,
        spouse: undefined,
        dependents: [],
        children: [],
        parents: [],
      };

      // Load spouse if exists
      if (person.fields['Spouse (Linked)'] && person.fields['Spouse (Linked)'].length > 0) {
        const spouseId = person.fields['Spouse (Linked)'][0];
        const spouseResponse = await fetch(`${apiUrl}/api/personal/${spouseId}`);
        const spouseResult = await spouseResponse.json();
        if (spouseResult.success) {
          family.spouse = spouseResult.data;
        }
      }

      // Load dependents if exist
      if (person.fields['Dependent (Linked)'] && person.fields['Dependent (Linked)'].length > 0) {
        for (const depId of person.fields['Dependent (Linked)']) {
          const depResponse = await fetch(`${apiUrl}/api/personal/${depId}`);
          const depResult = await depResponse.json();
          if (depResult.success) {
            family.dependents.push(depResult.data);
          }
        }
      }

      // Load children if exist
      if (person.fields['Child (Linked)'] && person.fields['Child (Linked)'].length > 0) {
        for (const childId of person.fields['Child (Linked)']) {
          const childResponse = await fetch(`${apiUrl}/api/personal/${childId}`);
          const childResult = await childResponse.json();
          if (childResult.success) {
            family.children.push(childResult.data);
          }
        }
      }

      // Load parents if exist
      if (person.fields['Parent (Linked)'] && person.fields['Parent (Linked)'].length > 0) {
        for (const parentId of person.fields['Parent (Linked)']) {
          const parentResponse = await fetch(`${apiUrl}/api/personal/${parentId}`);
          const parentResult = await parentResponse.json();
          if (parentResult.success) {
            family.parents.push(parentResult.data);
          }
        }
      }

      setTaxFamily(family);
    } catch (err) {
      console.error('Error loading tax family:', err);
    } finally {
      setIsLoadingFamily(false);
    }
  };

  const selectPerson = (person: Person) => {
    setSelectedPerson(person);
    setSearchTerm('');
    setSearchResults([]);
    loadTaxFamily(person);
  };

  // All hooks must be called before any conditional returns
  useEffect(() => {
    const loadAllPersons = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/personal`);
        const result = await response.json();

        if (result.success) {
          setAllPersons(result.data || []);
        }
      } catch (err) {
        console.error('Error loading persons:', err);
      }
    };

    loadAllPersons();
  }, []);

  // Load person from URL parameter if provided
  useEffect(() => {
    const loadPersonFromUrl = async () => {
      const personId = searchParams.get('id');
      if (!personId || selectedPerson) return;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/personal/${personId}`);
        const result = await response.json();

        if (result.success && result.data) {
          selectPerson(result.data);
        }
      } catch (err) {
        console.error('Error loading person from URL:', err);
      }
    };

    loadPersonFromUrl();
  }, [searchParams, selectedPerson]);

  // Conditional returns after all hooks
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userRole = (session.user as any)?.role;
  if (userRole !== 'staff' && userRole !== 'admin') {
    return null;
  }

  const searchClients = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
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
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addSpouseToFamily = async (spouseId: string) => {
    if (!selectedPerson) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Update primary person to link spouse
      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Spouse (Linked)': [spouseId]
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to update primary person');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }

      setShowAddSpouse(false);
    } catch (err) {
      console.error('Error adding spouse:', err);
      alert('Failed to add spouse. Please try again.');
    }
  };

  const addDependentToFamily = async (dependentId: string) => {
    if (!selectedPerson) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Get current dependents
      const currentDependents = selectedPerson.fields['Dependent (Linked)'] || [];

      // Check if dependent already exists
      if (currentDependents.includes(dependentId)) {
        alert('This person is already a dependent in this tax family.');
        return;
      }

      // Update primary person to add dependent
      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Dependent (Linked)': [...currentDependents, dependentId]
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to update primary person');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }

      setShowAddDependent(false);
    } catch (err) {
      console.error('Error adding dependent:', err);
      alert('Failed to add dependent. Please try again.');
    }
  };

  const addChildToFamily = async (childId: string) => {
    if (!selectedPerson) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Get current children
      const currentChildren = selectedPerson.fields['Child (Linked)'] || [];

      // Check if child already exists
      if (currentChildren.includes(childId)) {
        alert('This person is already a child in this tax family.');
        return;
      }

      // Update primary person to add child
      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Child (Linked)': [...currentChildren, childId]
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to update primary person');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }

      setShowAddChild(false);
    } catch (err) {
      console.error('Error adding child:', err);
      alert('Failed to add child. Please try again.');
    }
  };

  const removeSpouse = async () => {
    if (!selectedPerson || !confirm('Are you sure you want to remove this spouse relationship?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Spouse (Linked)': []
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to remove spouse');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }
    } catch (err) {
      console.error('Error removing spouse:', err);
      alert('Failed to remove spouse. Please try again.');
    }
  };

  const removeDependent = async (dependentId: string) => {
    if (!selectedPerson || !confirm('Are you sure you want to remove this dependent relationship?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const currentDependents = selectedPerson.fields['Dependent (Linked)'] || [];
      const updatedDependents = currentDependents.filter(id => id !== dependentId);

      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Dependent (Linked)': updatedDependents
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to remove dependent');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }
    } catch (err) {
      console.error('Error removing dependent:', err);
      alert('Failed to remove dependent. Please try again.');
    }
  };

  const removeChild = async (childId: string) => {
    if (!selectedPerson || !confirm('Are you sure you want to remove this child relationship?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const currentChildren = selectedPerson.fields['Child (Linked)'] || [];
      const updatedChildren = currentChildren.filter(id => id !== childId);

      const updatePrimary = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Child (Linked)': updatedChildren
          }
        })
      });

      if (!updatePrimary.ok) {
        throw new Error('Failed to remove child');
      }

      // Reload the family
      const updatedPrimaryResponse = await fetch(`${apiUrl}/api/personal/${selectedPerson.id}`);
      const updatedPrimaryResult = await updatedPrimaryResponse.json();
      if (updatedPrimaryResult.success) {
        selectPerson(updatedPrimaryResult.data);
      }
    } catch (err) {
      console.error('Error removing child:', err);
      alert('Failed to remove child. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tax Family Dashboard</h1>
        <p className="text-gray-600">
          Manage tax family relationships including spouses, dependents, and parents
        </p>
      </div>

      {/* Search Section */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Search Client</h2>
          <div className="form-control relative">
            <input
              type="text"
              placeholder="Search by name, email, phone, or SSN..."
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                searchClients(e.target.value);
              }}
            />
            {isSearching && (
              <span className="loading loading-spinner loading-sm absolute right-3 top-3"></span>
            )}

            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-y-auto top-full">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    className="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0"
                    onClick={() => selectPerson(person)}
                  >
                    <div className="font-semibold">{person.fields['Full Name'] || 'No Name'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {person.fields['Client Code'] && (
                        <span>Client Code: {person.fields['Client Code']} • </span>
                      )}
                      {person.fields['SSN'] && (
                        <span>SSN: ***-**-{person.fields['SSN'].slice(-4)}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tax Family Visualization */}
      {selectedPerson && (
        <div className="grid grid-cols-1 gap-6">
          {/* Primary Person */}
          <div className="card bg-primary text-primary-content shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <span>👤</span>
                Primary Tax Filer
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-lg">{selectedPerson.fields['Full Name']}</p>
                  <p className="text-sm opacity-90">Client Code: {selectedPerson.fields['Client Code']}</p>
                  <p className="text-sm opacity-90">Filing Status: {selectedPerson.fields['Filing Status'] || 'N/A'}</p>
                </div>
                <div className="text-sm opacity-90">
                  {selectedPerson.fields['📞Phone number'] && (
                    <p>Phone: {selectedPerson.fields['📞Phone number']}</p>
                  )}
                  {selectedPerson.fields['Email'] && (
                    <p>Email: {selectedPerson.fields['Email']}</p>
                  )}
                  {selectedPerson.fields['Date of Birth'] && (
                    <p>DOB: {selectedPerson.fields['Date of Birth']}</p>
                  )}
                </div>
              </div>
              <div className="card-actions justify-end mt-4">
                <Link href={`/client-intake?id=${selectedPerson.id}`} className="btn btn-sm">
                  View Details
                </Link>
              </div>
            </div>
          </div>

          {/* Spouse */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <span>💑</span>
                Spouse
              </h2>
              {isLoadingFamily ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner"></span>
                </div>
              ) : taxFamily?.spouse ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-bold">{taxFamily.spouse.fields['Full Name']}</p>
                      <p className="text-sm">Client Code: {taxFamily.spouse.fields['Client Code']}</p>
                    </div>
                    <div className="text-sm">
                      {taxFamily.spouse.fields['📞Phone number'] && (
                        <p>Phone: {taxFamily.spouse.fields['📞Phone number']}</p>
                      )}
                      {taxFamily.spouse.fields['Email'] && (
                        <p>Email: {taxFamily.spouse.fields['Email']}</p>
                      )}
                    </div>
                  </div>
                  <div className="card-actions justify-end mt-4">
                    <Link href={`/client-intake?id=${taxFamily.spouse.id}`} className="btn btn-sm btn-ghost">
                      View Details
                    </Link>
                    <button onClick={removeSpouse} className="btn btn-sm btn-error">
                      Remove Spouse
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No spouse linked</p>
                  <button onClick={() => setShowAddSpouse(true)} className="btn btn-primary">
                    + Add Spouse
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dependents */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <span>👶</span>
                Dependents
              </h2>
              {isLoadingFamily ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner"></span>
                </div>
              ) : taxFamily && taxFamily.dependents.length > 0 ? (
                <div className="space-y-4">
                  {taxFamily.dependents.map((dependent) => (
                    <div key={dependent.id} className="border border-base-300 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{dependent.fields['Full Name']}</p>
                          <p className="text-sm">Client Code: {dependent.fields['Client Code']}</p>
                          {dependent.fields['Date of Birth'] && (
                            <p className="text-sm">DOB: {dependent.fields['Date of Birth']}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/client-intake?id=${dependent.id}`} className="btn btn-sm btn-ghost">
                            View
                          </Link>
                          <button onClick={() => removeDependent(dependent.id)} className="btn btn-sm btn-error">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowAddDependent(true)} className="btn btn-outline btn-block">
                    + Add Another Dependent
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No dependents linked</p>
                  <button onClick={() => setShowAddDependent(true)} className="btn btn-primary">
                    + Add Dependent
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Children */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <span>👧👦</span>
                Children
              </h2>
              {isLoadingFamily ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner"></span>
                </div>
              ) : taxFamily && taxFamily.children.length > 0 ? (
                <div className="space-y-4">
                  {taxFamily.children.map((child) => (
                    <div key={child.id} className="border border-base-300 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{child.fields['Full Name']}</p>
                          <p className="text-sm">Client Code: {child.fields['Client Code']}</p>
                          {child.fields['Date of Birth'] && (
                            <p className="text-sm">DOB: {child.fields['Date of Birth']}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/client-intake?id=${child.id}`} className="btn btn-sm btn-ghost">
                            View
                          </Link>
                          <button onClick={() => removeChild(child.id)} className="btn btn-sm btn-error">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowAddChild(true)} className="btn btn-outline btn-block">
                    + Add Another Child
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No children linked</p>
                  <button onClick={() => setShowAddChild(true)} className="btn btn-primary">
                    + Add Child
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Parents */}
          {taxFamily && taxFamily.parents.length > 0 && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                  <span>👪</span>
                  Parents (Listed as Dependent Of)
                </h2>
                <div className="space-y-4">
                  {taxFamily.parents.map((parent) => (
                    <div key={parent.id} className="border border-base-300 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{parent.fields['Full Name']}</p>
                          <p className="text-sm">Client Code: {parent.fields['Client Code']}</p>
                        </div>
                        <Link href={`/client-intake?id=${parent.id}`} className="btn btn-sm btn-ghost">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Spouse Modal */}
      {showAddSpouse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Add Spouse</h3>
            <div className="form-control mb-4">
              <input
                type="text"
                placeholder="Search for spouse..."
                className="input input-bordered"
                onChange={(e) => searchClients(e.target.value)}
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.filter(p => p.id !== selectedPerson?.id).map((person) => (
                <button
                  key={person.id}
                  className="w-full text-left px-4 py-3 hover:bg-base-200 border-b"
                  onClick={() => addSpouseToFamily(person.id)}
                >
                  <div className="font-semibold">{person.fields['Full Name']}</div>
                  <div className="text-sm text-gray-500">
                    Client Code: {person.fields['Client Code']}
                  </div>
                </button>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddSpouse(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Dependent Modal */}
      {showAddDependent && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Add Dependent</h3>
            <div className="form-control mb-4">
              <input
                type="text"
                placeholder="Search for dependent..."
                className="input input-bordered"
                onChange={(e) => searchClients(e.target.value)}
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.filter(p => p.id !== selectedPerson?.id).map((person) => (
                <button
                  key={person.id}
                  className="w-full text-left px-4 py-3 hover:bg-base-200 border-b"
                  onClick={() => addDependentToFamily(person.id)}
                >
                  <div className="font-semibold">{person.fields['Full Name']}</div>
                  <div className="text-sm text-gray-500">
                    Client Code: {person.fields['Client Code']}
                    {person.fields['Date of Birth'] && ` • DOB: ${person.fields['Date of Birth']}`}
                  </div>
                </button>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddDependent(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {showAddChild && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Add Child</h3>
            <div className="form-control mb-4">
              <input
                type="text"
                placeholder="Search for child..."
                className="input input-bordered"
                onChange={(e) => searchClients(e.target.value)}
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.filter(p => p.id !== selectedPerson?.id).map((person) => (
                <button
                  key={person.id}
                  className="w-full text-left px-4 py-3 hover:bg-base-200 border-b"
                  onClick={() => addChildToFamily(person.id)}
                >
                  <div className="font-semibold">{person.fields['Full Name']}</div>
                  <div className="text-sm text-gray-500">
                    Client Code: {person.fields['Client Code']}
                    {person.fields['Date of Birth'] && ` • DOB: ${person.fields['Date of Birth']}`}
                  </div>
                </button>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddChild(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!selectedPerson && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-12">
            <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
            <h3 className="text-xl font-semibold mb-2">No Client Selected</h3>
            <p className="text-base-content/70">
              Search for a client above to view and manage their tax family relationships
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaxFamilyDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    }>
      <TaxFamilyDashboardContent />
    </Suspense>
  );
}
