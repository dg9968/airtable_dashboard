"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Types
interface PersonalRecord {
  id: string;
  fields: {
    "First Name"?: string;
    "Last Name"?: string;
    "Full Name"?: string;
    "Last modified time"?: string;
    "last name first name"?: string;
    SSN?: string;
    "Date of Birth"?: string;
    Occupation?: string;
    "Driver License"?: string;
    "Spouse Name"?: string;
    "Spouse SSN"?: string;
    "Spouse DOB"?: string;
    "Spouse Occupation"?: string;
    "Spouse Driver License"?: string;
    "Mailing Address"?: string;
    City?: string;
    State?: string;
    ZIP?: string;
    "📞Phone number"?: string;
    "Secondary Phone"?: string;
    Email?: string;
    "Preferred Contact"?: string;
    "Filing Status"?: string;
    "Bank Name"?: string;
    "Routing Number"?: string;
    "Account Number"?: string;
    "Account Type"?: string;
    "Tax Year"?: string;
    "Prior Year AGI"?: string;
    "Identity Protection PIN"?: string;
    "Spouse Identity Protection PIN"?: string;
  };
  createdTime: string;
}

export default function ClientIntake() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PersonalRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<PersonalRecord | null>(null);
  const [isNewClient, setIsNewClient] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("primary-taxpayer");
  const [addingToPipeline, setAddingToPipeline] = useState(false);

  // Form state
  const [formData, setFormData] = useState<PersonalRecord["fields"]>({
    "Tax Year": new Date().getFullYear().toString(),
    "Filing Status": "Single",
    "Preferred Contact": "Email",
    "Account Type": "Checking",
  });

  // Form navigation sections
  const formSections = [
    { id: "primary-taxpayer", label: "Primary Taxpayer", icon: "👤" },
    { id: "contact-info", label: "Contact Information", icon: "📞" },
    { id: "spouse-info", label: "Spouse Information", icon: "💑" },
    { id: "tax-info", label: "Tax Information", icon: "📋" },
    { id: "bank-info", label: "Bank Information", icon: "🏦" },
    { id: "prior-year", label: "Prior Year Info", icon: "📅" },
  ];

  // Check authentication and authorization
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "staff" && userRole !== "admin") {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  // Load client data if 'id' query parameter is present
  useEffect(() => {
    const clientId = searchParams.get("id");
    if (clientId && status === "authenticated") {
      const loadClient = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/personal/${clientId}`);
          const data = await response.json();

          if (data.success) {
            const client: PersonalRecord = {
              id: data.data.id,
              fields: data.data.fields,
              createdTime: data.data.createdTime,
            };
            setSelectedClient(client);
            setFormData(client.fields);
            setIsNewClient(false);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load client");
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadClient();
    }
  }, [searchParams, status]);

  // Save selected client to localStorage for cross-page context
  useEffect(() => {
    if (selectedClient?.id) {
      const ssn = selectedClient.fields.SSN || "";
      const clientCode = ssn.replace(/-/g, "").slice(-4);
      if (clientCode) {
        localStorage.setItem("lastSelectedClient", JSON.stringify({
          id: selectedClient.id,
          clientCode: clientCode,
          name: selectedClient.fields["Full Name"] || `${selectedClient.fields["First Name"] || ""} ${selectedClient.fields["Last Name"] || ""}`.trim()
        }));
      }
    }
  }, [selectedClient]);

  // Search for existing clients
  const handleSearch = useCallback(async () => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/personal/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data);
      } else {
        setError(data.error || "Failed to search clients");
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search clients");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Debounce search - wait 500ms after user stops typing before searching
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, handleSearch]);

  // Load selected client data into form
  const handleSelectClient = (client: PersonalRecord) => {
    setSelectedClient(client);
    setFormData(client.fields);
    setIsNewClient(false);
    setSearchResults([]);
    setSearchTerm("");
  };

  // Reset to new client
  const handleNewClient = () => {
    setSelectedClient(null);
    setIsNewClient(true);
    setFormData({
      "Tax Year": new Date().getFullYear().toString(),
      "Filing Status": "Single",
      "Preferred Contact": "Email",
      "Account Type": "Checking",
    });
    setSearchTerm("");
    setSearchResults([]);
  };

  // Save client data
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const url = isNewClient
        ? "/api/personal"
        : `/api/personal/${selectedClient?.id}`;

      // Filter out computed fields that Airtable doesn't accept
      const {
        "Full Name": _fullName,
        "Last modified time": _lastModified,
        "last name first name": _lastNameFirstName,
        ...fieldsToSave
      } = formData;

      const response = await fetch(url, {
        method: isNewClient ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: fieldsToSave }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(
          isNewClient
            ? "Client created successfully!"
            : "Client updated successfully!"
        );
        if (isNewClient) {
          setSelectedClient({
            id: data.data.id,
            fields: data.data.fields,
            createdTime: new Date().toISOString(),
          });
          setIsNewClient(false);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to save client");
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Add client to tax prep pipeline
  const handleAddToPipeline = async () => {
    if (!selectedClient) {
      setError("Please save the client first before adding to pipeline");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setAddingToPipeline(true);

      // Fetch all personal services to find "Tax Prep Pipeline" service ID
      const servicesResponse = await fetch("/api/services-personal");
      const servicesData = await servicesResponse.json();

      if (!servicesData.success) {
        throw new Error("Failed to fetch personal services");
      }

      // Find the Tax Prep Pipeline service
      const taxPrepService = servicesData.services?.find(
        (service: any) => service.name === "Tax Prep Pipeline"
      );

      if (!taxPrepService) {
        setError(
          "Tax Prep Pipeline service not found in Personal Services table. Please create it first."
        );
        setTimeout(() => setError(null), 5000);
        setAddingToPipeline(false);
        return;
      }

      // Create the junction record in Subscriptions Personal
      const subscriptionResponse = await fetch("/api/subscriptions-personal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalId: selectedClient.id,
          serviceId: taxPrepService.id,
        }),
      });

      const subscriptionData = await subscriptionResponse.json();

      if (!subscriptionData.success) {
        throw new Error(
          subscriptionData.error || "Failed to create subscription"
        );
      }

      const fullName = `${formData["First Name"] || ""} ${formData["Last Name"] || ""}`.trim();
      setSuccessMessage(
        `✅ ${fullName} added to Tax Prep Pipeline!`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add to pipeline"
      );
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingToPipeline(false);
    }
  };

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, "");

    if (phoneNumber.length === 0) {
      return "";
    } else if (phoneNumber.length <= 3) {
      return `(${phoneNumber}`;
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
  };

  // Format SSN as XXX-XX-XXXX
  const formatSSN = (value: string) => {
    const ssn = value.replace(/\D/g, "");

    if (ssn.length === 0) {
      return "";
    } else if (ssn.length <= 3) {
      return ssn;
    } else if (ssn.length <= 5) {
      return `${ssn.slice(0, 3)}-${ssn.slice(3)}`;
    } else {
      return `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5, 9)}`;
    }
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <Link
                  href="/airtable-dashboard"
                  className="text-primary hover:text-primary-focus flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to Business Management</span>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-base-content">
                Personal Client Intake
              </h1>
              <p className="text-base-content/70 mt-2">
                {isNewClient ? "Create new personal client" : "Update personal client information"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/tax-prep-pipeline" className="btn btn-accent btn-sm">
                📊 View Pipeline
              </Link>
              <button onClick={handleNewClient} className="btn btn-primary btn-sm">
                + New Client
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Search/Select Client Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl sticky top-4">
              <div className="card-body">
                <h3 className="card-title text-lg">Find Client</h3>

                <div className="form-control">
                  <input
                    type="text"
                    placeholder="Name, email, phone, or SSN"
                    className="input input-bordered"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                  />
                  {searchTerm.length > 0 && searchTerm.length < 2 && (
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Type at least 2 characters to search
                      </span>
                    </label>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading || searchTerm.length < 2}
                  className="btn btn-primary btn-sm"
                >
                  {loading ? <span className="loading loading-spinner loading-sm"></span> : "Search"}
                </button>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className="p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
                      >
                        <p className="font-medium text-sm">
                          {client.fields["Full Name"] ||
                            `${client.fields["First Name"] || ""} ${client.fields["Last Name"] || ""}`.trim()}
                        </p>
                        <p className="text-xs text-base-content/60">
                          {client.fields["📞Phone number"]}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedClient && (
                  <>
                    <div className="alert alert-info mt-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span className="text-xs">
                        Editing: {selectedClient.fields["Full Name"] ||
                          `${selectedClient.fields["First Name"] || ""} ${selectedClient.fields["Last Name"] || ""}`.trim()}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const ssn = selectedClient.fields.SSN || "";
                        const clientCode = ssn.replace(/-/g, "").slice(-4);
                        if (clientCode) {
                          router.push(`/document-management?clientCode=${clientCode}&personalId=${selectedClient.id}`);
                        } else {
                          setError("Client code not available");
                          setTimeout(() => setError(null), 3000);
                        }
                      }}
                      className="btn btn-primary btn-sm w-full mt-2"
                    >
                      📄 Go to Documents
                    </button>
                    <Link
                      href={`/tax-family-dashboard?id=${selectedClient.id}`}
                      className="btn btn-outline btn-sm w-full mt-2"
                    >
                      👨‍👩‍👧‍👦 Tax Family
                    </Link>
                  </>
                )}

                {/* Section Navigation */}
                <div className="divider">Sections</div>
                <ul className="menu menu-compact">
                  {formSections.map((section) => (
                    <li key={section.id}>
                      <a
                        onClick={() => setActiveSection(section.id)}
                        className={activeSection === section.id ? "active" : ""}
                      >
                        <span className="text-lg">{section.icon}</span>
                        {section.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-3">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                {/* Error/Success Messages */}
                {error && (
                  <div className="alert alert-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="alert alert-success mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Tax Information Section */}
                {activeSection === "tax-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">📋 Tax Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Tax Year <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["Tax Year"] || ""}
                          onChange={(e) => handleInputChange("Tax Year", e.target.value)}
                          placeholder="2024"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Filing Status <span className="text-error">*</span></span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={formData["Filing Status"] || ""}
                          onChange={(e) => handleInputChange("Filing Status", e.target.value)}
                        >
                          <option value="Single">Single</option>
                          <option value="Married Filing Jointly">Married Filing Jointly</option>
                          <option value="Married Filing Separately">Married Filing Separately</option>
                          <option value="Head of Household">Head of Household</option>
                          <option value="Qualifying Widow(er)">Qualifying Widow(er)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Taxpayer Section */}
                {activeSection === "primary-taxpayer" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">👤 Primary Taxpayer</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">First Name <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["First Name"] || ""}
                          onChange={(e) => handleInputChange("First Name", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Last Name <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["Last Name"] || ""}
                          onChange={(e) => handleInputChange("Last Name", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Social Security Number <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="XXX-XX-XXXX"
                          value={formData.SSN || ""}
                          onChange={(e) => handleInputChange("SSN", formatSSN(e.target.value))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Date of Birth <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="date"
                          className="input input-bordered"
                          value={formData["Date of Birth"] || ""}
                          onChange={(e) => handleInputChange("Date of Birth", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Occupation</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.Occupation || ""}
                          onChange={(e) => handleInputChange("Occupation", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Driver's License / State ID</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered uppercase"
                          value={formData["Driver License"] || ""}
                          onChange={(e) => handleInputChange("Driver License", e.target.value.toUpperCase())}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Spouse Information Section */}
                {activeSection === "spouse-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">💑 Spouse Information</h2>
                    <p className="text-base-content/70">
                      {formData["Filing Status"] === "Married Filing Jointly" ||
                      formData["Filing Status"] === "Married Filing Separately"
                        ? "Please enter spouse information"
                        : "Spouse information only required for married filing jointly or separately"}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Spouse Full Name</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["Spouse Name"] || ""}
                          onChange={(e) => handleInputChange("Spouse Name", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Social Security Number</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="XXX-XX-XXXX"
                          value={formData["Spouse SSN"] || ""}
                          onChange={(e) => handleInputChange("Spouse SSN", formatSSN(e.target.value))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Date of Birth</span>
                        </label>
                        <input
                          type="date"
                          className="input input-bordered"
                          value={formData["Spouse DOB"] || ""}
                          onChange={(e) => handleInputChange("Spouse DOB", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Occupation</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["Spouse Occupation"] || ""}
                          onChange={(e) => handleInputChange("Spouse Occupation", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Driver's License / State ID</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered uppercase"
                          value={formData["Spouse Driver License"] || ""}
                          onChange={(e) => handleInputChange("Spouse Driver License", e.target.value.toUpperCase())}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Information Section */}
                {activeSection === "contact-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">📞 Contact Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Mailing Address <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData["Mailing Address"] || ""}
                          onChange={(e) => handleInputChange("Mailing Address", e.target.value)}
                          placeholder="123 Main Street"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">City <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.City || ""}
                          onChange={(e) => handleInputChange("City", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">State <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered uppercase"
                          placeholder="CA"
                          maxLength={2}
                          value={formData.State || ""}
                          onChange={(e) => handleInputChange("State", e.target.value.toUpperCase())}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">ZIP Code <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.ZIP || ""}
                          onChange={(e) => handleInputChange("ZIP", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Primary Phone <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="tel"
                          className="input input-bordered"
                          placeholder="(555) 123-4567"
                          value={formData["📞Phone number"] || ""}
                          onChange={(e) => handleInputChange("📞Phone number", formatPhoneNumber(e.target.value))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Secondary Phone</span>
                        </label>
                        <input
                          type="tel"
                          className="input input-bordered"
                          placeholder="(555) 123-4567"
                          value={formData["Secondary Phone"] || ""}
                          onChange={(e) => handleInputChange("Secondary Phone", formatPhoneNumber(e.target.value))}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Email Address <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="email"
                          className="input input-bordered"
                          placeholder="your@email.com"
                          value={formData.Email || ""}
                          onChange={(e) => handleInputChange("Email", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Preferred Contact Method</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={formData["Preferred Contact"] || ""}
                          onChange={(e) => handleInputChange("Preferred Contact", e.target.value)}
                        >
                          <option value="Phone">Phone</option>
                          <option value="Email">Email</option>
                          <option value="Text">Text</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Information Section */}
                {activeSection === "bank-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">🏦 Bank Information</h2>
                    <div className="alert bg-info/10 border border-info/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <h4 className="font-medium text-sm">For Direct Deposit/Withdrawal</h4>
                        <p className="text-xs opacity-70">
                          This information is used for refund direct deposit or tax payment withdrawal
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Bank Name</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="e.g., Chase, Bank of America"
                          value={formData["Bank Name"] || ""}
                          onChange={(e) => handleInputChange("Bank Name", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Account Type</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={formData["Account Type"] || ""}
                          onChange={(e) => handleInputChange("Account Type", e.target.value)}
                        >
                          <option value="Checking">Checking</option>
                          <option value="Savings">Savings</option>
                        </select>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Routing Number</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="000000000"
                          maxLength={9}
                          value={formData["Routing Number"] || ""}
                          onChange={(e) => handleInputChange("Routing Number", e.target.value)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Account Number</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="Enter account number"
                          value={formData["Account Number"] || ""}
                          onChange={(e) => handleInputChange("Account Number", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Prior Year Information Section */}
                {activeSection === "prior-year" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">📅 Prior Year Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Prior Year AGI</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="$0"
                          value={formData["Prior Year AGI"] || ""}
                          onChange={(e) => handleInputChange("Prior Year AGI", e.target.value)}
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Adjusted Gross Income from last year
                        </span>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Identity Protection PIN</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="6-digit PIN"
                          maxLength={6}
                          value={formData["Identity Protection PIN"] || ""}
                          onChange={(e) => handleInputChange("Identity Protection PIN", e.target.value)}
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          If issued by the IRS
                        </span>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Identity Protection PIN</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="6-digit PIN"
                          maxLength={6}
                          value={formData["Spouse Identity Protection PIN"] || ""}
                          onChange={(e) => handleInputChange("Spouse Identity Protection PIN", e.target.value)}
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          If issued by the IRS for spouse
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="divider"></div>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const currentIndex = formSections.findIndex(s => s.id === activeSection);
                        if (currentIndex > 0) {
                          setActiveSection(formSections[currentIndex - 1].id);
                        }
                      }}
                      className="btn btn-ghost btn-sm"
                      disabled={formSections.findIndex(s => s.id === activeSection) === 0}
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => {
                        const currentIndex = formSections.findIndex(s => s.id === activeSection);
                        if (currentIndex < formSections.length - 1) {
                          setActiveSection(formSections[currentIndex + 1].id);
                        }
                      }}
                      className="btn btn-ghost btn-sm"
                      disabled={formSections.findIndex(s => s.id === activeSection) === formSections.length - 1}
                    >
                      Next →
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          {isNewClient ? "Create Client" : "Update Client"}
                        </>
                      )}
                    </button>

                    {!isNewClient && selectedClient && (
                      <button
                        onClick={handleAddToPipeline}
                        disabled={addingToPipeline}
                        className="btn btn-success"
                      >
                        {addingToPipeline ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Adding...
                          </>
                        ) : (
                          <>
                            📊 Add to Pipeline
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
