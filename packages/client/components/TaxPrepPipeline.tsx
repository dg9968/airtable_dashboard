"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PipelineClient {
  id: string;
  personalId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  clientCode?: string;
  taxPreparer?: string[];
  addedAt: string;
  status?: string; // "Active" | "Hold for Customer" | "Escalate to Manager"
  priority?: number; // Auto-calculated based on addedAt
  notes?: string; // Notes field for tracking client information
}

interface TaxPreparer {
  id: string;
  name: string;
  email: string;
}

export default function TaxPrepPipeline() {
  const [pipelineClients, setPipelineClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "priority">("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [updating, setUpdating] = useState<string | null>(null);
  const [taxPreparerFilter, setTaxPreparerFilter] = useState<string>("");
  const [taxPreparers, setTaxPreparers] = useState<TaxPreparer[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [selectedClientForReturn, setSelectedClientForReturn] = useState<string | null>(null);
  const [amountCharged, setAmountCharged] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

  // Fetch tax preparers from Teams table
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/teams`);
        const data = await response.json();

        if (data.success) {
          setTaxPreparers(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    };

    fetchTeams();
  }, []);

  // Fetch pipeline from Airtable
  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/subscriptions-personal`);
        const data = await response.json();

        if (data.success) {
          const pipeline = data.data.map((record: any) => {
            // Full Name is a lookup field
            const fullName = record.fields["Full Name"];
            const fullNameStr = Array.isArray(fullName)
              ? fullName[0]
              : fullName || "";

            // Split Full Name into First Name and Last Name
            const nameParts = fullNameStr.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Get phone - it's a lookup field with emoji
            const phone = record.fields["📞Phone number"] || "";
            const phoneStr = Array.isArray(phone) ? phone[0] : phone;

            // Get email
            const email = record.fields["📧 Email"] || "";
            const emailStr = Array.isArray(email) ? email[0] : email;

            // Get the Personal ID from the "Last Name" link field
            const personalId = record.fields["Last Name"];
            const personalIdStr = Array.isArray(personalId)
              ? personalId[0]
              : personalId;

            // Get Client Code (lookup field from Personal table)
            const clientCode = record.fields["Client Code"];
            const clientCodeStr = Array.isArray(clientCode)
              ? clientCode[0]
              : clientCode;

            // Get Tax Preparer (multiple select field)
            const taxPreparer = record.fields["Tax Preparer"] || [];

            // Get Status (single select field)
            const status = record.fields["Status"] || "Active";

            // Get Notes (long text field)
            const notes = record.fields["Notes"] || "";

            // Calculate priority based on how long ago they were added (in days)
            const addedDate = new Date(record.createdTime);
            const today = new Date();
            const daysInPipeline = Math.floor(
              (today.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
              id: record.id,
              personalId: personalIdStr,
              firstName,
              lastName,
              phone: phoneStr,
              email: emailStr,
              clientCode: clientCodeStr,
              taxPreparer: Array.isArray(taxPreparer)
                ? taxPreparer
                : [taxPreparer],
              addedAt: record.createdTime,
              status,
              priority: daysInPipeline,
              notes,
            };
          });

          // Filter out clients with "File Return" or "Filed" status - they should not appear in active pipeline
          const activePipeline = pipeline.filter((client: PipelineClient) =>
            client.status !== "File Return" && client.status !== "Filed"
          );
          setPipelineClients(activePipeline);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, []);

  // Filter clients by search term, tax preparer, and status
  const filteredClients = pipelineClients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      client.firstName.toLowerCase().includes(searchLower) ||
      client.lastName.toLowerCase().includes(searchLower) ||
      client.phone.includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(searchLower));

    let matchesTaxPreparer = true;
    if (taxPreparerFilter === "unassigned") {
      matchesTaxPreparer = !client.taxPreparer || client.taxPreparer.length === 0;
    } else if (taxPreparerFilter) {
      // taxPreparerFilter is now a record ID, check if it's in the client's taxPreparer array
      matchesTaxPreparer = Boolean(client.taxPreparer && client.taxPreparer.includes(taxPreparerFilter));
    }

    const matchesStatus = !statusFilter || client.status === statusFilter;

    return matchesSearch && matchesTaxPreparer && matchesStatus;
  });

  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === "name") {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    } else if (sortBy === "priority") {
      // Higher priority (more days) should come first when desc
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      return sortOrder === "asc" ? priorityA - priorityB : priorityB - priorityA;
    } else {
      const dateA = new Date(a.addedAt).getTime();
      const dateB = new Date(b.addedAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleSort = (field: "name" | "date" | "priority") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "priority" ? "desc" : "asc");
    }
  };

  const updateTaxPreparer = async (clientId: string, newPreparerId: string) => {
    try {
      setUpdating(clientId);

      // Update via API - send the record ID from the Teams table
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      console.log('Updating tax preparer:', { clientId, newPreparerId, apiUrl });

      const response = await fetch(`${apiUrl}/api/subscriptions-personal/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "Tax Preparer": newPreparerId ? [newPreparerId] : [],
          },
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        console.error("Server error response:", data);
        const errorMsg = data.error || data.message || `Server error: ${response.status}`;
        if (data.details) {
          console.error("Error details:", data.details);
        }
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineClients((prevClients) =>
        prevClients.map((client) =>
          client.id === clientId
            ? { ...client, taxPreparer: newPreparerId ? [newPreparerId] : [] }
            : client
        )
      );
    } catch (error) {
      console.error("Error updating tax preparer:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update tax preparer. Please try again.";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const updateStatus = async (clientId: string, newStatus: string) => {
    try {
      setUpdating(clientId);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      console.log('Updating status:', { clientId, newStatus, apiUrl });

      const response = await fetch(`${apiUrl}/api/subscriptions-personal/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "Status": newStatus,
          },
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        console.error("Server error response:", data);
        const errorMsg = data.error || data.message || `Server error: ${response.status}`;
        if (data.details) {
          console.error("Error details:", data.details);
        }
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineClients((prevClients) =>
        prevClients.map((client) =>
          client.id === clientId
            ? { ...client, status: newStatus }
            : client
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update status. Please try again.";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 14) {
      return (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-error"></span>
          <span className="text-xs whitespace-nowrap">High ({priority}d)</span>
        </div>
      );
    } else if (priority >= 7) {
      return (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-warning"></span>
          <span className="text-xs whitespace-nowrap">Medium ({priority}d)</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-success"></span>
          <span className="text-xs whitespace-nowrap">Normal ({priority}d)</span>
        </div>
      );
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Hold for Customer":
        return (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-warning"></span>
            <span className="text-xs whitespace-nowrap">On Hold</span>
          </div>
        );
      case "Escalate to Manager":
        return (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-error"></span>
            <span className="text-xs whitespace-nowrap">Escalated</span>
          </div>
        );
      case "File Return":
        return (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-success"></span>
            <span className="text-xs whitespace-nowrap">Filed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-info"></span>
            <span className="text-xs whitespace-nowrap">Active</span>
          </div>
        );
    }
  };

  const updateNotes = async (clientId: string, newNotes: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      console.log('Updating notes:', { clientId, newNotes, apiUrl });

      const response = await fetch(`${apiUrl}/api/subscriptions-personal/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "Notes": newNotes,
          },
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        console.error("Server error response:", data);
        const errorMsg = data.error || data.message || `Server error: ${response.status}`;
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineClients((prevClients) =>
        prevClients.map((client) =>
          client.id === clientId
            ? { ...client, notes: newNotes }
            : client
        )
      );
    } catch (error) {
      console.error("Error updating notes:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update notes. Please try again.";
      alert(errorMessage);
    }
  };

  const handleFileReturn = async () => {
    if (!selectedClientForReturn || !amountCharged || !paymentMethod) {
      alert("Please enter the amount charged and payment method");
      return;
    }

    try {
      setUpdating(selectedClientForReturn);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Find the client to get their name
      const client = pipelineClients.find((c) => c.id === selectedClientForReturn);
      if (!client) {
        throw new Error("Client not found");
      }

      const clientName = `${client.firstName} ${client.lastName}`;

      // Create ledger entry
      const ledgerResponse = await fetch(`${apiUrl}/api/ledger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId: selectedClientForReturn,
          clientName: clientName,
          amountCharged: parseFloat(amountCharged),
          receiptDate: new Date().toISOString(),
          paymentMethod: paymentMethod,
        }),
      });

      const ledgerData = await ledgerResponse.json();

      if (!ledgerResponse.ok) {
        throw new Error(ledgerData.error || "Failed to create ledger entry");
      }

      // Update status to File Return (keeps record but marks as filed)
      await updateStatus(selectedClientForReturn, "File Return");

      // Remove from local state (will be filtered out from pipeline view)
      setPipelineClients((prevClients) =>
        prevClients.filter((client) => client.id !== selectedClientForReturn)
      );

      // Close modal and reset
      setShowAmountModal(false);
      setSelectedClientForReturn(null);
      setAmountCharged("");
      setPaymentMethod("");

      alert("✅ File Return completed! Ledger entry created.");
    } catch (error) {
      console.error("Error handling file return:", error);
      alert(error instanceof Error ? error.message : "Failed to process file return");
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = (clientId: string, newStatus: string) => {
    if (newStatus === "File Return") {
      // Show modal to get amount charged
      setSelectedClientForReturn(clientId);
      setShowAmountModal(true);
    } else {
      // Update status directly
      updateStatus(clientId, newStatus);
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

              {/* Tax Preparer Filter */}
              <div className="form-control w-full md:w-48">
                <select
                  className="select select-bordered w-full"
                  value={taxPreparerFilter}
                  onChange={(e) => setTaxPreparerFilter(e.target.value)}
                >
                  <option value="">All Tax Preparers</option>
                  <option value="unassigned">Unassigned</option>
                  {taxPreparers.map((preparer) => (
                    <option key={preparer.id} value={preparer.id}>
                      {preparer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="form-control w-full md:w-48">
                <select
                  className="select select-bordered w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Hold for Customer">Hold for Customer</option>
                  <option value="Escalate to Manager">Escalate to Manager</option>
                  <option value="File Return">File Return</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSort("priority")}
                  className={`btn ${
                    sortBy === "priority" ? "btn-primary" : "btn-outline"
                  }`}
                >
                  Priority {sortBy === "priority" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  onClick={() => toggleSort("name")}
                  className={`btn ${
                    sortBy === "name" ? "btn-primary" : "btn-outline"
                  }`}
                >
                  Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  onClick={() => toggleSort("date")}
                  className={`btn ${
                    sortBy === "date" ? "btn-primary" : "btn-outline"
                  }`}
                >
                  Date {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
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
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Tax Preparer</th>
                      <th>Notes</th>
                      <th>Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClients.map((client, index) => (
                      <tr key={client.id}>
                        <td>{index + 1}</td>
                        <td>{getPriorityBadge(client.priority || 0)}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(client.status)}
                            <div className="dropdown dropdown-bottom">
                              <label tabIndex={0} className="btn btn-xs btn-ghost">
                                Change
                              </label>
                              <ul
                                tabIndex={0}
                                className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-56"
                              >
                                <li>
                                  <button onClick={() => handleStatusChange(client.id, "Active")}>
                                    ▶️ Set Active
                                  </button>
                                </li>
                                <li>
                                  <button onClick={() => handleStatusChange(client.id, "Hold for Customer")}>
                                    ⏸️ Hold for Customer
                                  </button>
                                </li>
                                <li>
                                  <button onClick={() => handleStatusChange(client.id, "Escalate to Manager")}>
                                    ⬆️ Escalate to Manager
                                  </button>
                                </li>
                                <li>
                                  <button onClick={() => handleStatusChange(client.id, "File Return")} className="text-success font-semibold">
                                    ✅ File Return
                                  </button>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold">
                            {client.firstName} {client.lastName}
                          </div>
                        </td>
                        <td>{client.phone || "N/A"}</td>
                        <td>
                          <select
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={client.taxPreparer?.[0] || ""}
                            onChange={(e) =>
                              updateTaxPreparer(client.id, e.target.value)
                            }
                            disabled={updating === client.id}
                          >
                            <option value="">Unassigned</option>
                            {taxPreparers.map((preparer) => (
                              <option key={preparer.id} value={preparer.id}>
                                {preparer.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <textarea
                            className="textarea textarea-bordered textarea-xs w-full min-w-[200px] text-xs leading-tight rounded-sm"
                            placeholder="Add notes..."
                            value={client.notes || ""}
                            onChange={(e) => {
                              // Update local state immediately for responsiveness
                              setPipelineClients((prevClients) =>
                                prevClients.map((c) =>
                                  c.id === client.id ? { ...c, notes: e.target.value } : c
                                )
                              );
                            }}
                            onBlur={(e) => {
                              // Save to server when user finishes editing
                              updateNotes(client.id, e.target.value);
                            }}
                            rows={1}
                          />
                        </td>
                        <td>
                          <div className="text-xs">
                            {formatDate(client.addedAt)}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {client.personalId && (
                              <Link
                                href={`/client-intake?id=${client.personalId}`}
                                className="btn btn-sm btn-ghost"
                                title="View client details"
                              >
                                👤
                              </Link>
                            )}
                            {client.clientCode && (
                              <Link
                                href={`/document-management?clientCode=${client.clientCode}&personalId=${client.personalId}`}
                                className="btn btn-sm btn-primary"
                                title="View client documents"
                              >
                                📄
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
                    ? "Try adjusting your search criteria"
                    : "Add clients to the pipeline from the Client Intake page"}
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
            <div className="stat-value text-primary">
              {pipelineClients.length}
            </div>
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
            <div className="stat-value text-secondary">
              {sortedClients.length}
            </div>
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

      {/* Amount Charged Modal */}
      {showAmountModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">File Return - Enter Amount Charged</h3>
            <p className="text-sm text-base-content/70 mb-4">
              This will create a permanent ledger entry for "Personal Tax Return" with the client's name, today's date, amount charged, and payment method.
            </p>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Amount Charged ($)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input input-bordered"
                value={amountCharged}
                onChange={(e) => setAmountCharged(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Payment Method</span>
              </label>
              <select
                className="select select-bordered"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select payment method...</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Zelle">Zelle</option>
                <option value="TPG Bank Product">TPG Bank Product</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowAmountModal(false);
                  setSelectedClientForReturn(null);
                  setAmountCharged("");
                  setPaymentMethod("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleFileReturn}
                disabled={!amountCharged || parseFloat(amountCharged) <= 0 || !paymentMethod}
              >
                ✅ Complete File Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
