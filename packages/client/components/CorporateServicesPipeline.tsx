"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
}

interface Processor {
  id: string;
  name: string;
  email: string;
}

export default function CorporateServicesPipeline() {
  const [pipelineCompanies, setPipelineCompanies] = useState<PipelineCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [updating, setUpdating] = useState<string | null>(null);
  const [processorFilter, setProcessorFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [processors, setProcessors] = useState<Processor[]>([]);

  // Available services - these match the view names in Airtable
  const services = [
    { name: "Reconciling Banks for Tax Prep", view: "Reconciling Banks for Tax Prep" },
    { name: "Payroll", view: "Payroll" },
    { name: "Bookkeeping", view: "Bookkeeping" },
    { name: "Annual Report", view: "Annual Report" }
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

  // Fetch pipeline from Airtable - fetch based on selected service view
  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true);
        // Build URL with view parameter if service is selected
        const url = serviceFilter
          ? `/api/subscriptions-corporate?view=${encodeURIComponent(serviceFilter)}`
          : `/api/subscriptions-corporate`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          const pipeline = data.data.map((record: any) => {
            // Company name has TWO spaces: "Company  (from Customer)"
            const companyName = record.fields["Company  (from Customer)"] || "";
            const companyNameStr = Array.isArray(companyName)
              ? companyName[0]
              : companyName || "Unknown Company";

            // Get EIN - could be a lookup field
            const ein = record.fields["EIN (from Customer)"] || record.fields["EIN"] || "";
            const einStr = Array.isArray(ein) ? ein[0] : ein;

            // Get phone - could be a lookup field
            const phone = record.fields["Phone (from Customer)"] || record.fields["Phone"] || "";
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
            const corporateId = record.fields["Customer"];
            const corporateIdStr = Array.isArray(corporateId)
              ? corporateId[0]
              : corporateId;

            // Get Service Name from lookup field
            const serviceName = record.fields["Service Name (from Services)"] ||
                               record.fields["Services (from Services)"] || "";
            const serviceNameStr = Array.isArray(serviceName) ? serviceName[0] : serviceName;

            // Get Processor (multiple select field or link field)
            const processor = record.fields["Processor"] || [];

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
            };
          });
          setPipelineCompanies(pipeline);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, [serviceFilter]);

  // Filter companies by search term and processor (service filter is handled by view in fetch)
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

    return matchesSearch && matchesProcessor;
  });

  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (sortBy === "name") {
      const nameA = a.companyName.toLowerCase();
      const nameB = b.companyName.toLowerCase();
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
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

  const toggleSort = (field: "name" | "date") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const updateProcessor = async (companyId: string, newProcessorId: string) => {
    try {
      setUpdating(companyId);

      const response = await fetch(`/api/subscriptions-corporate/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "Processor": newProcessorId ? [newProcessorId] : [],
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error response:", data);
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
              <div className="form-control w-full md:w-64">
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

              {/* Sort Options */}
              <div className="flex gap-2">
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
              Pipeline Companies ({sortedCompanies.length})
            </h2>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : sortedCompanies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th
                        className="cursor-pointer hover:bg-base-200"
                        onClick={() => toggleSort("date")}
                      >
                        Added to Pipeline {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="cursor-pointer hover:bg-base-200"
                        onClick={() => toggleSort("name")}
                      >
                        Company Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th>EIN</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Processor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompanies.map((company, index) => (
                      <tr key={company.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="text-sm">
                            {formatDate(company.addedAt)}
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold">
                            {company.companyName}
                          </div>
                        </td>
                        <td>{company.ein || "N/A"}</td>
                        <td>{company.phone || "N/A"}</td>
                        <td>{company.email || "N/A"}</td>
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
                          <div className="flex gap-2">
                            {company.corporateId && (
                              <Link
                                href={`/corporate-client-intake?id=${company.corporateId}`}
                                className="btn btn-sm btn-ghost"
                                title="View company details"
                              >
                                🏢 View
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
    </div>
  );
}
