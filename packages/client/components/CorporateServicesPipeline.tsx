"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface PipelineCompany {
  id: string;
  corporateId?: string;
  companyName: string;
  ein: string;
  phone: string;
  email?: string;
  processor?: string[];
  serviceName?: string;
  addedAt: string;
  status?: string;
  priority?: number;
  notes?: string;
  billingAmount?: number;
}

interface Processor {
  id: string;
  name: string;
  email: string;
}

export default function CorporateServicesPipeline() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pipelineCompanies, setPipelineCompanies] = useState<PipelineCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "priority">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [updating, setUpdating] = useState<string | null>(null);
  const [processorFilter, setProcessorFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCompanyForStatus, setSelectedCompanyForStatus] = useState<string | null>(null);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [selectedCompanyForCompletion, setSelectedCompanyForCompletion] = useState<string | null>(null);
  const [quotedAmount, setQuotedAmount] = useState<string>("");
  const [billingNote, setBillingNote] = useState<string>("");
  const [corporateIdFilter, setCorporateIdFilter] = useState<string>("");
  const [filteredByCorporate, setFilteredByCorporate] = useState(false);
  const [filteredCompanyName, setFilteredCompanyName] = useState<string>("");

  // Available services - these match the view names in Airtable
  const services = [
    { name: "Reconciling Banks for Tax Prep", view: "Reconciling Banks for Tax Prep" },
    { name: "Tax Returns", view: "Tax Returns" },
    { name: "Payroll", view: "Payroll" },
    { name: "Annual Report", view: "Annual Report" },
    { name: "Sales Tax Monthly", view: "Monthly Sales Tax" },
    { name: "Sales Tax Quarterly", view: "Quarterly Sales Tax" },
    { name: "Registered Agent", view: "Registered Agent" },
    { name: "1099 Filing", view: "1099 Filing" },
    { name: "Corporate Cases", view: "Corporate Cases" }
  ];

  // Fetch processors from Teams table
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch(`/api/teams`);
        const data = await response.json();

        if (data.success) {
          setProcessors(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    };

    fetchTeams();
  }, []);

  // Fetch pipeline from Airtable - fetch based on selected service view or corporate filter
  useEffect(() => {
    let isCancelled = false;

    const fetchPipeline = async () => {
      try {
        setLoading(true);

        // Read companyId from URL parameter (support both old and new parameter names)
        const corporateIdFromUrl = searchParams.get('companyId') || searchParams.get('corporateId');

        // Update state to show/hide filter banner
        if (corporateIdFromUrl) {
          // Always update when URL parameter changes
          if (corporateIdFilter !== corporateIdFromUrl) {
            setCorporateIdFilter(corporateIdFromUrl);
            setFilteredByCorporate(true);

            // Fetch company name for the filter banner
            try {
              const companyResponse = await fetch(`/api/view/Corporations/${corporateIdFromUrl}`);
              const companyData = await companyResponse.json();
              if (companyData.success && companyData.data) {
                const name = companyData.data.fields?.['Company'] ||
                            companyData.data.fields?.['Company Name'] ||
                            'Selected Company';
                setFilteredCompanyName(name);
              }
            } catch (error) {
              console.error('[Pipeline] Error fetching company name:', error);
              setFilteredCompanyName('Selected Company');
            }
          }
        } else {
          // No corporate filter in URL, clear the state
          if (filteredByCorporate || corporateIdFilter || filteredCompanyName) {
            setCorporateIdFilter("");
            setFilteredByCorporate(false);
            setFilteredCompanyName("");
          }
        }

        // Build URL with corporate filter first, then service view, or default to all
        const url = corporateIdFromUrl
          ? `/api/subscriptions-corporate/corporate/${corporateIdFromUrl}`
          : serviceFilter
          ? `/api/subscriptions-corporate?view=${encodeURIComponent(serviceFilter)}`
          : `/api/subscriptions-corporate`;

        const response = await fetch(url);
        const data = await response.json();

        if (isCancelled) return;

        if (data.success && data.data && data.data.length > 0) {
          const pipeline = data.data.map((record: any, index: number) => {
            // Company name has TWO spaces: "Company  (from Customer)"
            const companyName = record.fields["Company  (from Customer)"] || "";
            const companyNameStr = Array.isArray(companyName)
              ? companyName[0]
              : companyName || "Unknown Company";

            // Get EIN - could be a lookup field
            const ein = record.fields["EIN (from Customer)"] ||
                       record.fields["EIN"] ||
                       record.fields["EIN (from Corporations)"] ||
                       record.fields["🔢 EIN (from Customer)"] ||
                       "";
            const einStr = Array.isArray(ein) ? ein[0] : ein;

            // Get phone - could be a lookup field
            const phone = record.fields["Phone (from Customer)"] ||
                         record.fields["Phone"] ||
                         record.fields["📞 Phone (from Customer)"] ||
                         "";
            const phoneStr = Array.isArray(phone) ? phone[0] : phone;

            // Get email - could be a lookup field
            const email =
              record.fields["🤷‍♂️Email (from Customer)"] ||
              record.fields["🤷‍♂️Email"] ||
              record.fields["Email (from Customer)"] ||
              record.fields["Email"] ||
              "";
            const emailStr = Array.isArray(email) ? email[0] : email;

            // Get the Corporate ID from the "Customer" link field
            const corporateId = record.fields["Customer"] || record.fields["Corporations"];
            const corporateIdStr = Array.isArray(corporateId)
              ? corporateId[0]
              : corporateId;

            // Get Service Name from lookup field - try multiple possible field names
            const serviceName = record.fields["Service Name (from Services)"] ||
                               record.fields["Services (from Services)"] ||
                               record.fields["Service Name"] ||
                               record.fields["Service Name (from Services Corporate)"] ||
                               record.fields["Name (from Services)"] ||
                               "";
            const serviceNameStr = Array.isArray(serviceName) ? serviceName[0] : serviceName;

            // Get Processor (multiple select field or link field)
            const processor = record.fields["Processor"] || [];

            // Get Status field
            const status = record.fields["Status"] || "Active";

            // Get Notes field
            const notes = record.fields["Notes"] || "";

            // Get Billing Amount field
            const billingAmount = record.fields["Billing Amount"] || null;

            // Calculate priority (days in pipeline)
            const addedDate = new Date(record.createdTime);
            const today = new Date();
            const daysInPipeline = Math.floor(
              (today.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
              id: record.id,
              corporateId: corporateIdStr,
              companyName: companyNameStr,
              ein: einStr,
              phone: phoneStr,
              email: emailStr,
              serviceName: serviceNameStr,
              processor: Array.isArray(processor)
                ? processor
                : [processor],
              addedAt: record.createdTime,
              status,
              priority: daysInPipeline,
              notes,
              billingAmount: billingAmount ? parseFloat(billingAmount.toString()) : undefined,
            };
          });

          // Debug: Check what we got before filtering
          console.log(`[DEBUG] Total records from API: ${pipeline.length}`);
          pipeline.forEach((company: PipelineCompany, idx: number) => {
            console.log(`[DEBUG] Record ${idx + 1}: Company="${company.companyName}", Service="${company.serviceName}", Status="${company.status}"`);
          });

          // Filter out completed services from active view
          const activePipeline = pipeline.filter((company: PipelineCompany) =>
            company.status !== "Complete Service" && company.status !== "Completed"
          );

          console.log(`[DEBUG] After filtering completed: ${activePipeline.length} active records`);

          setPipelineCompanies(activePipeline);
        } else {
          console.log("No data returned from API or empty dataset");
          console.log("API Response:", data);
          setPipelineCompanies([]);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
        setPipelineCompanies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter, searchParams]);

  // Filter companies by search term, processor, and status (service filter is handled by view in fetch)
  const filteredCompanies = pipelineCompanies.filter((company) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      company.companyName.toLowerCase().includes(searchLower) ||
      company.ein.includes(searchTerm) ||
      company.phone.includes(searchTerm) ||
      (company.email && company.email.toLowerCase().includes(searchLower));

    let matchesProcessor = true;
    if (processorFilter === "unassigned") {
      matchesProcessor = !company.processor || company.processor.length === 0;
    } else if (processorFilter) {
      matchesProcessor = Boolean(company.processor && company.processor.includes(processorFilter));
    }

    const matchesStatus = !statusFilter || company.status === statusFilter;

    return matchesSearch && matchesProcessor && matchesStatus;
  });

  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (sortBy === "name") {
      const nameA = a.companyName.toLowerCase();
      const nameB = b.companyName.toLowerCase();
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
      setSortOrder(field === "priority" ? "desc" : "asc"); // Default to descending for priority (highest priority first)
    }
  };

  const updateProcessor = async (companyId: string, newProcessorId: string) => {
    try {
      setUpdating(companyId);

      // Build fields object
      const fields: any = {};

      // Processor field: send array value (linked record field)
      if (newProcessorId && newProcessorId !== "") {
        fields["Processor"] = [newProcessorId];
      } else {
        // Send empty array to clear the field
        fields["Processor"] = [];
      }

      console.log("Updating processor:", { companyId, newProcessorId, fields });

      const response = await fetch(`/api/subscriptions-corporate/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error response:", data);
        console.error("Request was:", { companyId, fields });
        const errorMsg = data.error || "Failed to update processor";
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineCompanies((prevCompanies) =>
        prevCompanies.map((company) =>
          company.id === companyId
            ? { ...company, processor: newProcessorId ? [newProcessorId] : [] }
            : company
        )
      );
    } catch (error) {
      console.error("Error updating processor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update processor. Please try again.";
      alert(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const updateStatus = async (companyId: string, newStatus: string) => {
    try {
      setUpdating(companyId);

      const response = await fetch(`/api/subscriptions-corporate/${companyId}`, {
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

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error response:", data);
        const errorMsg = data.error || "Failed to update status";
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineCompanies((prevCompanies) =>
        prevCompanies.map((company) =>
          company.id === companyId
            ? { ...company, status: newStatus }
            : company
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
    if (priority >= 30) {
      return (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-error"></span>
          <span className="text-xs whitespace-nowrap">High ({priority}d)</span>
        </div>
      );
    } else if (priority >= 14) {
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
      case "Complete Service":
        return (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-success"></span>
            <span className="text-xs whitespace-nowrap">Completed</span>
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

  const updateNotes = async (companyId: string, newNotes: string) => {
    try {
      const response = await fetch(`/api/subscriptions-corporate/${companyId}`, {
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

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error response:", data);
        const errorMsg = data.error || "Failed to update notes";
        throw new Error(errorMsg);
      }

      // Update local state
      setPipelineCompanies((prevCompanies) =>
        prevCompanies.map((company) =>
          company.id === companyId
            ? { ...company, notes: newNotes }
            : company
        )
      );
    } catch (error) {
      console.error("Error updating notes:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update notes. Please try again.";
      alert(errorMessage);
    }
  };

  const handleCompleteService = async (companyId: string, amount?: number, note?: string) => {
    try {
      setUpdating(companyId);
      console.log('[CorporateServicesPipeline] Starting handleCompleteService for:', companyId);

      // Find the company to get their details
      const company = pipelineCompanies.find((c) => c.id === companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      console.log('[CorporateServicesPipeline] Found company:', company.companyName);

      // Use provided amount, or fall back to billing amount from subscription
      const billingAmount = amount !== undefined ? amount : (company.billingAmount || null);
      console.log('[CorporateServicesPipeline] Billing amount:', billingAmount);

      const requestBody = {
        subscriptionId: companyId,
        subscriptionType: "corporate",
        serviceDate: new Date().toISOString(),
        amountCharged: billingAmount,
        notes: note || undefined,
      };

      console.log('[CorporateServicesPipeline] Sending POST request to /api/services-rendered');
      console.log('[CorporateServicesPipeline] Request body:', requestBody);

      // Create Services Rendered entry (unbilled)
      const servicesRenderedResponse = await fetch(`/api/services-rendered`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[CorporateServicesPipeline] Response status:', servicesRenderedResponse.status);
      console.log('[CorporateServicesPipeline] Response ok:', servicesRenderedResponse.ok);

      const servicesRenderedData = await servicesRenderedResponse.json();
      console.log('[CorporateServicesPipeline] Response data:', servicesRenderedData);

      if (!servicesRenderedResponse.ok) {
        console.error('[CorporateServicesPipeline] Failed to create service record:', servicesRenderedData);
        throw new Error(servicesRenderedData.error || "Failed to create service record");
      }

      console.log('[CorporateServicesPipeline] Service record created successfully:', servicesRenderedData.data?.id);

      // Delete the subscription record from Subscriptions Corporate table
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const deleteResponse = await fetch(`${apiUrl}/api/subscriptions-corporate/${companyId}`, {
        method: "DELETE",
      });

      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok) {
        console.error("[CorporateServicesPipeline] Warning: Failed to delete subscription record:", deleteData.error);
        // Continue even if delete fails - the service was still rendered
      } else {
        console.log('[CorporateServicesPipeline] Subscription deleted successfully');
      }

      // Remove from local state
      setPipelineCompanies((prevCompanies) =>
        prevCompanies.filter((c) => c.id !== companyId)
      );

      console.log('[CorporateServicesPipeline] Service completion successful');
      alert("✅ Service completed and removed from pipeline!");
    } catch (error) {
      console.error("[CorporateServicesPipeline] Error completing service:", error);
      alert(error instanceof Error ? error.message : "Failed to complete service");
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = (companyId: string, newStatus: string) => {
    if (newStatus === "Complete Service") {
      // Show modal to capture quoted amount and billing note
      setSelectedCompanyForCompletion(companyId);
      const company = pipelineCompanies.find((c) => c.id === companyId);
      // Pre-fill with billing amount if available
      setQuotedAmount(company?.billingAmount?.toString() || "");
      setBillingNote("");
      setShowAmountModal(true);
    } else {
      // Update status directly
      updateStatus(companyId, newStatus);
    }
  };

  const handleAmountModalSubmit = () => {
    if (selectedCompanyForCompletion) {
      const amount = quotedAmount ? parseFloat(quotedAmount) : undefined;
      const note = billingNote.trim() || undefined;
      handleCompleteService(selectedCompanyForCompletion, amount, note);
      setShowAmountModal(false);
      setSelectedCompanyForCompletion(null);
      setQuotedAmount("");
      setBillingNote("");
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <header className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/corporate-client-intake" className="btn btn-ghost btn-sm">
                ← Back to Corporate Intake
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-base-content">
                  🏢 Corporate Services Pipeline
                </h1>
                <p className="text-sm text-base-content/70">
                  Manage and track all companies across all corporate services
                </p>
              </div>
            </div>
            <div className="badge badge-primary badge-lg">
              {pipelineCompanies.length} Total Companies
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
                    placeholder="Search by company name, EIN, phone, or email..."
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
              <div className="form-control w-full md:w-64">
                <select
                  className="select select-bordered w-full"
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                >
                  <option value="">All Services</option>
                  {services.map((service) => (
                    <option key={service.view} value={service.view}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Processor Filter */}
              <div className="form-control w-full md:w-48">
                <select
                  className="select select-bordered w-full"
                  value={processorFilter}
                  onChange={(e) => setProcessorFilter(e.target.value)}
                >
                  <option value="">All Processors</option>
                  <option value="unassigned">Unassigned</option>
                  {processors.map((processor) => (
                    <option key={processor.id} value={processor.id}>
                      {processor.name}
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
                  <option value="Complete Service">Complete Service</option>
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

        {/* Corporate Filter Indicator */}
        {filteredByCorporate && corporateIdFilter && (
          <div className="alert alert-info mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <div className="font-bold">Filtered by Client</div>
              <div className="text-sm">
                Showing services for: {filteredCompanyName || 'Selected Company'}
              </div>
            </div>
            <button
              onClick={() => {
                setCorporateIdFilter("");
                setFilteredByCorporate(false);
                setFilteredCompanyName("");
                router.push('/corporate-services-pipeline');
              }}
              className="btn btn-sm btn-ghost"
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* Pipeline Table */}
        <div className="card bg-base-100 shadow-xl overflow-visible">
          <div className="card-body overflow-visible">
            <h2 className="card-title mb-4">
              Pipeline Companies ({sortedCompanies.length})
            </h2>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : sortedCompanies.length > 0 ? (
              <div className="overflow-x-auto overflow-y-visible">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th
                        className="cursor-pointer hover:bg-base-200 w-15"
                        onClick={() => toggleSort("priority")}
                      >
                        Priority {sortBy === "priority" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th>Status</th>
                      <th
                        className="cursor-pointer hover:bg-base-200 max-w-[100px]"
                        onClick={() => toggleSort("name")}
                      >
                        Company Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="max-w-[120px]">Service</th>
                      <th>Processor</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompanies.map((company, index) => (
                      <tr key={company.id}>
                        <td>{index + 1}</td>
                        <td>{getPriorityBadge(company.priority || 0)}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(company.status)}
                            <button
                              className="btn btn-xs btn-ghost"
                              onClick={() => {
                                setSelectedCompanyForStatus(company.id);
                                setShowStatusModal(true);
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </td>
                        <td className="max-w-[100px]">
                          <div className="font-semibold truncate">
                            {company.companyName}
                          </div>
                        </td>
                        <td className="max-w-[120px]">
                          <span className="badge badge-sm truncate max-w-full">{company.serviceName || "N/A"}</span>
                        </td>
                        <td>
                          <select
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={company.processor?.[0] || ""}
                            onChange={(e) =>
                              updateProcessor(company.id, e.target.value)
                            }
                            disabled={updating === company.id}
                          >
                            <option value="">Unassigned</option>
                            {processors.map((processor) => (
                              <option key={processor.id} value={processor.id}>
                                {processor.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <textarea
                            className="textarea textarea-bordered textarea-xs w-full min-w-[200px]"
                            placeholder="Add notes..."
                            value={company.notes || ""}
                            onChange={(e) => {
                              // Update local state immediately for smooth UX
                              const newNotes = e.target.value;
                              setPipelineCompanies((prevCompanies) =>
                                prevCompanies.map((c) =>
                                  c.id === company.id ? { ...c, notes: newNotes } : c
                                )
                              );
                            }}
                            onBlur={(e) => updateNotes(company.id, e.target.value)}
                            rows={1}
                          />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {company.corporateId && (
                              <>
                                <Link
                                  href={`/corporate-client-intake?id=${company.corporateId}`}
                                  className="btn btn-sm btn-ghost"
                                  title="View company details"
                                >
                                  🏢 View
                                </Link>
                                <Link
                                  href={`/corporate-document-management?companyId=${company.corporateId}`}
                                  className="btn btn-sm btn-info"
                                  title="View documents"
                                >
                                  📄 Docs
                                </Link>
                              </>
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
                <div className="text-6xl mb-4">🏦</div>
                <h3 className="text-xl font-semibold mb-2">No Companies Found</h3>
                <p className="text-base-content/70">
                  {searchTerm
                    ? "Try adjusting your search criteria"
                    : "Add companies to the pipeline from the Corporate Client Intake page"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
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
            <div className="stat-title">Total Subscriptions</div>
            <div className="stat-value text-primary">
              {pipelineCompanies.length}
            </div>
            <div className="stat-desc">Across all services</div>
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
              {sortedCompanies.length}
            </div>
            <div className="stat-desc">Matching criteria</div>
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
                pipelineCompanies.filter((company) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(company.addedAt) >= weekAgo;
                }).length
              }
            </div>
            <div className="stat-desc">Added in last 7 days</div>
          </div>

          <div className="stat bg-base-100 shadow-xl rounded-box">
            <div className="stat-figure text-info">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Services</div>
            <div className="stat-value text-info">{services.length}</div>
            <div className="stat-desc">Available services</div>
          </div>
        </div>
      </main>

      {/* Status Change Modal */}
      {showStatusModal && selectedCompanyForStatus && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Change Status</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Select the new status for this company:
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedCompanyForStatus, "Active");
                  setShowStatusModal(false);
                  setSelectedCompanyForStatus(null);
                }}
              >
                ▶️ Set Active
              </button>
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedCompanyForStatus, "Hold for Customer");
                  setShowStatusModal(false);
                  setSelectedCompanyForStatus(null);
                }}
              >
                ⏸️ Hold for Customer
              </button>
              <button
                className="btn btn-outline btn-block justify-start"
                onClick={() => {
                  handleStatusChange(selectedCompanyForStatus, "Escalate to Manager");
                  setShowStatusModal(false);
                  setSelectedCompanyForStatus(null);
                }}
              >
                ⬆️ Escalate to Manager
              </button>
              <button
                className="btn btn-success btn-block justify-start font-semibold"
                onClick={() => {
                  handleStatusChange(selectedCompanyForStatus, "Complete Service");
                  setShowStatusModal(false);
                  setSelectedCompanyForStatus(null);
                }}
              >
                ✅ Complete Service
              </button>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedCompanyForStatus(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amount Modal */}
      {showAmountModal && selectedCompanyForCompletion && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Complete Service Details</h3>
            <p className="text-sm opacity-70 mb-4">
              How much was quoted to{" "}
              {pipelineCompanies.find((c) => c.id === selectedCompanyForCompletion)?.companyName}?
            </p>
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
                  setSelectedCompanyForCompletion(null);
                  setQuotedAmount("");
                  setBillingNote("");
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
    </div>
  );
}
