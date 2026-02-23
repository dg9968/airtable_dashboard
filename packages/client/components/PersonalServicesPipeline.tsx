"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import PipelineNotes from "./PipelineNotes";

interface PipelineClient {
  id: string;
  personalId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  clientCode?: string;
  taxPreparer?: string[];
  serviceName?: string;
  addedAt: string;
  status?: string;
  priority?: number;
  notes?: string;
  messageCount?: number;
}

interface TaxPreparer {
  id: string;
  name: string;
  email: string;
}

export default function PersonalServicesPipeline() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pipelineClients, setPipelineClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "priority">("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [updating, setUpdating] = useState<string | null>(null);
  const [taxPreparerFilter, setTaxPreparerFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [taxPreparers, setTaxPreparers] = useState<TaxPreparer[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedClientForStatus, setSelectedClientForStatus] = useState<string | null>(null);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [selectedClientForFiling, setSelectedClientForFiling] = useState<string | null>(null);
  const [quotedAmount, setQuotedAmount] = useState<string>("");
  const [billingNote, setBillingNote] = useState<string>("");
  const [personalIdFilter, setPersonalIdFilter] = useState<string>("");
  const [filteredByPersonal, setFilteredByPersonal] = useState(false);
  const [filteredClientName, setFilteredClientName] = useState<string>("");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedClientForNotes, setSelectedClientForNotes] = useState<PipelineClient | null>(null);
  const [billingType, setBillingType] = useState<'standard' | 'subscription' | 'waived'>('standard');

  // Available services - these match the view names in Airtable
  const services = [
    { name: "Tax Prep Pipeline", view: "Tax Prep Pipeline" },
    { name: "Tax Planning", view: "Tax Planning" },
    { name: "IRS Resolution", view: "IRS Resolution" },
    { name: "Amended Returns", view: "Amended Returns" },
    { name: "Prior Year Returns", view: "Prior Year Returns" },
    { name: "File Extension", view: "File Extension" }
  ];

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
    let isCancelled = false;

    const fetchPipeline = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Read personalId from URL parameter
        const personalIdFromUrl = searchParams.get('personalId');

        // Update state to show/hide filter banner
        if (personalIdFromUrl) {
          if (personalIdFilter !== personalIdFromUrl) {
            setPersonalIdFilter(personalIdFromUrl);
            setFilteredByPersonal(true);

            // Fetch client name for the filter banner
            try {
              const clientResponse = await fetch(`${apiUrl}/api/personal/${personalIdFromUrl}`);
              const clientData = await clientResponse.json();
              if (clientData.success && clientData.data) {
                const name = clientData.data.fields?.['Full Name'] ||
                            `${clientData.data.fields?.['First Name'] || ''} ${clientData.data.fields?.['Last Name'] || ''}`.trim() ||
                            'Selected Client';
                setFilteredClientName(name);
              }
            } catch (error) {
              console.error('[Pipeline] Error fetching client name:', error);
              setFilteredClientName('Selected Client');
            }
          }
        } else {
          // No personal filter in URL, clear the state
          if (filteredByPersonal || personalIdFilter || filteredClientName) {
            setPersonalIdFilter("");
            setFilteredByPersonal(false);
            setFilteredClientName("");
          }
        }

        // Build URL with personal filter first, then service view, or default
        let url: string;
        if (personalIdFromUrl) {
          url = `${apiUrl}/api/subscriptions-personal/personal/${personalIdFromUrl}`;
        } else if (serviceFilter) {
          url = `${apiUrl}/api/subscriptions-personal?view=${encodeURIComponent(serviceFilter)}`;
        } else {
          url = `${apiUrl}/api/subscriptions-personal`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (isCancelled) return;

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

            // Get Service Name from lookup field - try multiple possible field names
            const serviceName = record.fields["Service Name (from Service)"] ||
                               record.fields["Name (from Service)"] ||
                               record.fields["Service Name"] ||
                               record.fields["Service Name (from Personal Services)"] ||
                               record.fields["Name (from Personal Services)"] ||
                               "";
            const serviceNameStr = Array.isArray(serviceName) ? serviceName[0] : serviceName;

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
              serviceName: serviceNameStr,
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

    return () => {
      isCancelled = true;
    };
  }, [searchParams, serviceFilter]);

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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

      let data;
      try {
        data = await response.json();
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

      let data;
      try {
        data = await response.json();
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

  const handleFileReturn = async (clientId: string, amount?: number, note?: string, billingStatus?: string) => {
    try {
      setUpdating(clientId);

      const client = pipelineClients.find((c) => c.id === clientId);
      if (!client) {
        throw new Error("Client not found");
      }

      const requestBody: {
        subscriptionId: string;
        subscriptionType: string;
        serviceDate: string;
        amountCharged?: number;
        notes?: string;
        billingStatus?: string;
      } = {
        subscriptionId: clientId,
        subscriptionType: "personal",
        serviceDate: new Date().toISOString(),
        amountCharged: amount,
        notes: note || undefined,
      };

      // Add billing status if provided (for Part of Subscription or Waived)
      if (billingStatus) {
        requestBody.billingStatus = billingStatus;
      }

      // Create Services Rendered entry
      const servicesRenderedResponse = await fetch(`/api/services-rendered`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const servicesRenderedData = await servicesRenderedResponse.json();

      if (!servicesRenderedResponse.ok) {
        throw new Error(servicesRenderedData.error || "Failed to create service record");
      }

      // Delete the subscription record from Subscriptions Personal table
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const deleteResponse = await fetch(`${apiUrl}/api/subscriptions-personal/${clientId}`, {
        method: "DELETE",
      });

      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok) {
        console.error("Warning: Failed to delete subscription record:", deleteData.error);
      }

      // Remove from local state
      setPipelineClients((prevClients) =>
        prevClients.filter((c) => c.id !== clientId)
      );

      alert("Service completed and removed from pipeline!");
    } catch (error) {
      console.error("Error handling file return:", error);
      alert(error instanceof Error ? error.message : "Failed to process completion");
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = (clientId: string, newStatus: string) => {
    if (newStatus === "File Return") {
      setSelectedClientForFiling(clientId);
      setQuotedAmount("");
      setBillingNote("");
      setBillingType('standard');
      setShowAmountModal(true);
    } else {
      updateStatus(clientId, newStatus);
    }
  };

  const handleAmountModalSubmit = () => {
    if (selectedClientForFiling) {
      // Determine amount and billing status based on billing type
      let amount: number | undefined;
      let billingStatusValue: string | undefined;

      if (billingType === 'standard') {
        amount = quotedAmount ? parseFloat(quotedAmount) : undefined;
        billingStatusValue = undefined; // Will default to 'Unbilled' on server
      } else if (billingType === 'subscription') {
        amount = 0;
        billingStatusValue = 'Part of Subscription';
      } else if (billingType === 'waived') {
        amount = 0;
        billingStatusValue = 'Waived';
      }

      const note = billingNote.trim() || undefined;
      handleFileReturn(selectedClientForFiling, amount, note, billingStatusValue);
      setShowAmountModal(false);
      setSelectedClientForFiling(null);
      setQuotedAmount("");
      setBillingNote("");
      setBillingType('standard');
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
                  Personal Services Pipeline
                </h1>
                <p className="text-sm text-base-content/70">
                  Manage and track all personal clients across services
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

              {/* Service Filter */}
              <div className="form-control w-full md:w-48">
                <select
                  className="select select-bordered w-full"
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                >
                  <option value="">All Services</option>
                  {services.map((service) => (
                    <option key={service.name} value={service.view}>
                      {service.name}
                    </option>
                  ))}
                </select>
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

        {/* Client Filter Indicator */}
        {filteredByPersonal && personalIdFilter && (
          <div className="alert alert-info mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <div className="font-bold">Filtered by Client</div>
              <div className="text-sm">
                Showing pipeline for: {filteredClientName || 'Selected Client'}
              </div>
            </div>
            <button
              onClick={() => {
                setPersonalIdFilter("");
                setFilteredByPersonal(false);
                setFilteredClientName("");
                router.push('/personal-services-pipeline');
              }}
              className="btn btn-sm btn-ghost"
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* Service Filter Indicator */}
        {serviceFilter && (
          <div className="alert alert-success mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <div className="font-bold">Filtered by Service</div>
              <div className="text-sm">
                Showing: {services.find(s => s.view === serviceFilter)?.name || serviceFilter}
              </div>
            </div>
            <button
              onClick={() => setServiceFilter("")}
              className="btn btn-sm btn-ghost"
            >
              Clear Filter
            </button>
          </div>
        )}

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
                      <th>Service</th>
                      <th>Phone</th>
                      <th>Tax Preparer</th>
                      <th>Conversation</th>
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
                            <button
                              className="btn btn-xs btn-ghost"
                              onClick={() => {
                                setSelectedClientForStatus(client.id);
                                setShowStatusModal(true);
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold">
                            {client.firstName} {client.lastName}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-ghost badge-sm">
                            {client.serviceName || "N/A"}
                          </span>
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
                          <button
                            className="btn btn-ghost btn-sm gap-2"
                            onClick={() => {
                              setSelectedClientForNotes(client);
                              setShowNotesModal(true);
                            }}
                          >
                            View
                            {client.messageCount !== undefined && client.messageCount > 0 && (
                              <span className="badge badge-primary badge-sm">
                                {client.messageCount}
                              </span>
                            )}
                          </button>
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
                                View
                              </Link>
                            )}
                            {client.clientCode && (
                              <Link
                                href={`/document-management?clientCode=${client.clientCode}&personalId=${client.personalId}`}
                                className="btn btn-sm btn-primary"
                                title="View client documents"
                              >
                                Docs
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
                    : "Add clients to a service from the Client Intake page"}
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
            <div className="stat-desc">In services pipeline</div>
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

      {/* Status Change Modal */}
      {showStatusModal && selectedClientForStatus && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Change Status</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Select the new status for this client:
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedClientForStatus, "Active");
                  setShowStatusModal(false);
                  setSelectedClientForStatus(null);
                }}
              >
                Set Active
              </button>
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedClientForStatus, "Hold for Customer");
                  setShowStatusModal(false);
                  setSelectedClientForStatus(null);
                }}
              >
                Hold for Customer
              </button>
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedClientForStatus, "Escalate to Manager");
                  setShowStatusModal(false);
                  setSelectedClientForStatus(null);
                }}
              >
                Escalate to Manager
              </button>
              <button
                className="btn btn-success btn-block justify-start font-semibold"
                onClick={() => {
                  handleStatusChange(selectedClientForStatus, "File Return");
                  setShowStatusModal(false);
                  setSelectedClientForStatus(null);
                }}
              >
                Complete Service
              </button>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedClientForStatus(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amount Modal */}
      {showAmountModal && selectedClientForFiling && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Complete Service Details</h3>
            <p className="text-sm opacity-70 mb-4">
              Complete service for{" "}
              {(() => {
                const client = pipelineClients.find((c) => c.id === selectedClientForFiling);
                return client ? `${client.firstName} ${client.lastName}` : '';
              })()}
            </p>

            {/* Billing Type Selection */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">Billing Type</span>
              </label>
              <div className="flex flex-col gap-2">
                <label className="label cursor-pointer justify-start gap-3 py-1">
                  <input
                    type="radio"
                    name="billingType"
                    className="radio radio-primary radio-sm"
                    checked={billingType === 'standard'}
                    onChange={() => setBillingType('standard')}
                  />
                  <span className="label-text">Standard Billing</span>
                </label>
                <label className="label cursor-pointer justify-start gap-3 py-1">
                  <input
                    type="radio"
                    name="billingType"
                    className="radio radio-info radio-sm"
                    checked={billingType === 'subscription'}
                    onChange={() => setBillingType('subscription')}
                  />
                  <span className="label-text">Part of Subscription</span>
                </label>
                <label className="label cursor-pointer justify-start gap-3 py-1">
                  <input
                    type="radio"
                    name="billingType"
                    className="radio radio-sm"
                    checked={billingType === 'waived'}
                    onChange={() => setBillingType('waived')}
                  />
                  <span className="label-text">Waive Fee</span>
                </label>
              </div>
            </div>

            {/* Quoted Amount - Only show for standard billing */}
            {billingType === 'standard' && (
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Quoted Amount ($)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered"
                  placeholder="0.00"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  autoFocus
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">
                    Leave blank if no amount was quoted
                  </span>
                </label>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Billing Note (Optional)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                rows={3}
                placeholder="Add any notes for the billing department..."
                value={billingNote}
                onChange={(e) => setBillingNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleAmountModalSubmit();
                  }
                }}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowAmountModal(false);
                  setSelectedClientForFiling(null);
                  setQuotedAmount("");
                  setBillingNote("");
                  setBillingType('standard');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAmountModalSubmit}
              >
                Complete Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation/Notes Modal */}
      {showNotesModal && selectedClientForNotes && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => {
                setShowNotesModal(false);
                setSelectedClientForNotes(null);
              }}
            >
              ✕
            </button>

            <PipelineNotes
              subscriptionId={selectedClientForNotes.id}
              clientName={`${selectedClientForNotes.firstName} ${selectedClientForNotes.lastName}`}
            />
          </div>
          <div className="modal-backdrop" onClick={() => {
            setShowNotesModal(false);
            setSelectedClientForNotes(null);
          }} />
        </div>
      )}
    </div>
  );
}
