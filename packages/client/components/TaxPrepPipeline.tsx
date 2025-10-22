'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PipelineClient {
  id: string;
  personalId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  addedAt: string;
}

export default function TaxPrepPipeline() {
  const [pipelineClients, setPipelineClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch pipeline from Airtable
  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/subscriptions-personal');
        const data = await response.json();

        if (data.success) {
          const pipeline = data.data.map((record: any) => {
            // Full Name is a lookup field
            const fullName = record.fields['Full Name'];
            const fullNameStr = Array.isArray(fullName) ? fullName[0] : fullName || '';

            // Split Full Name into First Name and Last Name
            const nameParts = fullNameStr.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Get phone - it's a lookup field with emoji
            const phone = record.fields['📞Phone number'] || '';
            const phoneStr = Array.isArray(phone) ? phone[0] : phone;

            // Get email
            const email = record.fields['📧 Email'] || '';
            const emailStr = Array.isArray(email) ? email[0] : email;

            // Get the Personal ID from the "Last Name" link field
            const personalId = record.fields['Last Name'];
            const personalIdStr = Array.isArray(personalId) ? personalId[0] : personalId;

            return {
              id: record.id,
              personalId: personalIdStr,
              firstName,
              lastName,
              phone: phoneStr,
              email: emailStr,
              addedAt: record.createdTime,
            };
          });
          setPipelineClients(pipeline);
        }
      } catch (error) {
        console.error('Failed to fetch pipeline data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, []);

  // Filter clients by search term
  const filteredClients = pipelineClients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.firstName.toLowerCase().includes(searchLower) ||
      client.lastName.toLowerCase().includes(searchLower) ||
      client.phone.includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(searchLower))
    );
  });

  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else {
      const dateA = new Date(a.addedAt).getTime();
      const dateB = new Date(b.addedAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleSort = (field: 'name' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <header className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/client-intake" className="btn btn-ghost btn-sm">
                ← Back to Client Intake
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-base-content">
                  📋 Tax Prep Pipeline
                </h1>
                <p className="text-sm text-base-content/70">
                  Manage and track all clients in the tax preparation pipeline
                </p>
              </div>
            </div>
            <div className="badge badge-primary badge-lg">
              {pipelineClients.length} Total Clients
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Bar */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="form-control flex-1">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Search by name, phone, or email..."
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-square">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sort Options */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSort('name')}
                  className={`btn ${sortBy === 'name' ? 'btn-primary' : 'btn-outline'}`}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => toggleSort('date')}
                  className={`btn ${sortBy === 'date' ? 'btn-primary' : 'btn-outline'}`}
                >
                  Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Table */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">
              Pipeline Clients ({sortedClients.length})
            </h2>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : sortedClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Added to Pipeline</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClients.map((client, index) => (
                      <tr key={client.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="font-semibold">
                            {client.firstName} {client.lastName}
                          </div>
                        </td>
                        <td>{client.phone || 'N/A'}</td>
                        <td>{client.email || 'N/A'}</td>
                        <td>
                          <div className="text-sm">
                            {formatDate(client.addedAt)}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {client.personalId && (
                              <Link
                                href={`/client-intake?id=${client.personalId}`}
                                className="btn btn-sm btn-ghost"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold mb-2">No Clients Found</h3>
                <p className="text-base-content/70">
                  {searchTerm
                    ? 'Try adjusting your search criteria'
                    : 'Add clients to the pipeline from the Client Intake page'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="stat bg-base-100 shadow-xl rounded-box">
            <div className="stat-figure text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Total Clients</div>
            <div className="stat-value text-primary">{pipelineClients.length}</div>
            <div className="stat-desc">In tax prep pipeline</div>
          </div>

          <div className="stat bg-base-100 shadow-xl rounded-box">
            <div className="stat-figure text-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Filtered</div>
            <div className="stat-value text-secondary">{sortedClients.length}</div>
            <div className="stat-desc">Matching search criteria</div>
          </div>

          <div className="stat bg-base-100 shadow-xl rounded-box">
            <div className="stat-figure text-accent">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">This Week</div>
            <div className="stat-value text-accent">
              {
                pipelineClients.filter((client) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(client.addedAt) >= weekAgo;
                }).length
              }
            </div>
            <div className="stat-desc">Added in last 7 days</div>
          </div>
        </div>
      </main>
    </div>
  );
}
