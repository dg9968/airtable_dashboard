"use client";

import { useState, useEffect } from "react";
import DocumentChecklist from "./DocumentChecklist";

// Types
interface PersonalRecord {
  id: string;
  fields: {
    "First Name"?: string;
    "Last Name"?: string;
    "Full Name"?: string; // Read-only computed field
    "Last modified time"?: string; // Read-only computed field
    "last name first name"?: string; // Read-only computed field
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

interface DocumentChecklistItem {
  category: string;
  items: {
    label: string;
    field: string;
    type: "checkbox" | "number";
  }[];
}

export default function ClientIntake() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PersonalRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<PersonalRecord | null>(
    null
  );
  const [isNewClient, setIsNewClient] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("primary-taxpayer");

  // Form navigation sections
  const formSections = [
    { id: "tax-info", label: "Tax Information", icon: "📋" },
    { id: "primary-taxpayer", label: "Primary Taxpayer", icon: "👤" },
    { id: "spouse-info", label: "Spouse Information", icon: "💑" },
    { id: "contact-info", label: "Contact Information", icon: "📞" },
    { id: "bank-info", label: "Bank Information", icon: "🏦" },
    { id: "prior-year", label: "Prior Year Info", icon: "📅" },
    { id: "document-checklist", label: "Document Checklist", icon: "📄" },
    { id: "tax-prep-pipeline", label: "Tax Prep Pipeline", icon: "📊" },
  ];

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(sectionId);
    }
  };

  // Form state
  const [formData, setFormData] = useState<PersonalRecord["fields"]>({
    "Tax Year": new Date().getFullYear().toString(),
    "Filing Status": "Single",
    "Preferred Contact": "Email",
    "Account Type": "Checking",
  });

  // Document checklist state
  const [documentChecklist, setDocumentChecklist] = useState<
    Record<string, boolean | number>
  >({});

  // Tax prep pipeline state - fetched from Airtable
  const [pipelineClients, setPipelineClients] = useState<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      addedAt: string;
    }>
  >([]);

  // Fetch pipeline from Airtable on mount
  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const response = await fetch("/api/subscriptions-personal");
        const data = await response.json();

        if (data.success) {
          // Transform Airtable records to pipeline format
          const pipeline = data.data.map((record: any) => {
            // Full Name is a lookup field in Subscriptions Personal
            const fullName = record.fields["Full Name"];
            const fullNameStr = Array.isArray(fullName)
              ? fullName[0]
              : fullName || "";

            // Split Full Name into First Name and Last Name
            const nameParts = fullNameStr.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const phone =
              record.fields["Phone"] || record.fields["📞Phone number"] || "";
            const phoneStr = Array.isArray(phone) ? phone[0] : phone;

            return {
              id: record.id,
              firstName,
              lastName,
              phone: phoneStr,
              addedAt: record.createdTime,
            };
          });
          setPipelineClients(pipeline);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
      }
    };

    fetchPipeline();
  }, []);

  // Search for existing clients
  const handleSearch = async () => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/personal/search?q=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data);
      } else {
        setError(data.error || "Failed to search clients");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search clients");
    } finally {
      setLoading(false);
    }
  };

  // Load selected client data into form
  const handleSelectClient = (client: PersonalRecord) => {
    setSelectedClient(client);
    setFormData(client.fields);
    setIsNewClient(false);
    setSearchResults([]);
    setSearchTerm("");
    const fullName =
      client.fields["Full Name"] ||
      `${client.fields["First Name"] || ""} ${
        client.fields["Last Name"] || ""
      }`.trim();
    setSuccessMessage(`Loaded client: ${fullName}`);
    setTimeout(() => setSuccessMessage(null), 3000);
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const phoneNumber = value.replace(/\D/g, '');

    // Format based on length
    if (phoneNumber.length === 0) {
      return '';
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
    // Remove all non-numeric characters
    const ssn = value.replace(/\D/g, '');

    // Format based on length
    if (ssn.length === 0) {
      return '';
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

  // Add client to tax prep pipeline
  const handleAddToPipeline = async () => {
    const firstName = formData["First Name"];
    const lastName = formData["Last Name"];
    const phone = formData["📞Phone number"];

    if (!firstName || !phone) {
      setError(
        "Please enter both First Name and Phone Number before adding to pipeline"
      );
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check if client is saved (has an ID)
    if (!selectedClient?.id) {
      setError("Please save the client first before adding to pipeline");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check if already in pipeline
    const alreadyExists = pipelineClients.some(
      (client) => client.phone === phone
    );

    if (alreadyExists) {
      setError("Client already in pipeline");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setSaving(true);

      // First, fetch all personal services to find "Tax Prep Pipeline" service ID
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

      // Refresh pipeline from Airtable
      const pipelineResponse = await fetch("/api/subscriptions-personal");
      const pipelineData = await pipelineResponse.json();

      if (pipelineData.success) {
        const pipeline = pipelineData.data.map((record: any) => {
          // Full Name is a lookup field in Subscriptions Personal
          const fullName = record.fields["Full Name"];
          const fullNameStr = Array.isArray(fullName)
            ? fullName[0]
            : fullName || "";

          // Split Full Name into First Name and Last Name
          const nameParts = fullNameStr.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const phone =
            record.fields["Phone"] || record.fields["📞Phone number"] || "";
          const phoneStr = Array.isArray(phone) ? phone[0] : phone;

          return {
            id: record.id,
            firstName,
            lastName,
            phone: phoneStr,
            addedAt: record.createdTime,
          };
        });
        setPipelineClients(pipeline);
      }

      const fullName = `${firstName} ${lastName}`.trim();
      setSuccessMessage(
        `✅ ${fullName} added to Tax Prep Pipeline in Airtable!`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add to pipeline"
      );
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <header className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <a
                href="/"
                className="text-primary hover:text-primary-focus mb-2 inline-block"
              >
                ← Back to Dashboard
              </a>
              <h1 className="text-3xl font-bold text-base-content">
                Client Intake
              </h1>
              <p className="text-base-content/70 mt-1">
                {isNewClient
                  ? "Create new client record"
                  : `Editing: ${
                      formData["Full Name"] ||
                      `${formData["First Name"] || ""} ${
                        formData["Last Name"] || ""
                      }`.trim()
                    }`}
              </p>
            </div>
            <button
              onClick={handleNewClient}
              className="btn btn-outline btn-sm"
            >
              + New Client
            </button>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="alert alert-success mt-4">
              <span>✅ {successMessage}</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error mt-4">
              <span>❌ {error}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Form Navigation */}
        <div className="sticky top-0 z-10 bg-base-200 pb-4 mb-8">
          <div className="flex gap-2 overflow-x-auto py-2">
            {formSections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`btn btn-sm whitespace-nowrap ${
                  activeSection === section.id ? "btn-primary" : "btn-ghost"
                }`}
              >
                <span className="mr-1">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Existing Clients */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-base-content">
              Search Existing Clients
            </h2>
            <p className="text-base-content/60 text-sm">
              Search by name, email, phone, or last 4 digits of SSN
            </p>
            <div className="flex gap-4 mt-4">
              <input
                type="text"
                placeholder="Start typing to search..."
                className="input input-bordered flex-1"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length >= 2) {
                    handleSearch();
                  }
                }}
              />
              <button
                onClick={handleSearch}
                className="btn btn-primary"
                disabled={loading || searchTerm.length < 2}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 bg-base-200 rounded-lg hover:bg-base-300 cursor-pointer"
                    onClick={() => handleSelectClient(client)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-base-content">
                          {client.fields["Full Name"] ||
                            `${client.fields["First Name"] || ""} ${
                              client.fields["Last Name"] || ""
                            }`.trim()}
                        </p>
                        <p className="text-sm text-base-content/60">
                          {client.fields["Email"]} •{" "}
                          {client.fields["📞Phone number"]}
                        </p>
                      </div>
                      <div className="text-sm text-base-content/60">
                        Tax Year: {client.fields["Tax Year"] || "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Client Intake Form */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-base-content">
              Personal Information
            </h2>

            {/* Tax Information Section */}
            <section id="tax-info" className="scroll-mt-24">
              <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                  📋 Tax Information
                </h3>
              </div>

              <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4 md:p-6">
                  <form className="grid grid-cols-12 gap-4 md:gap-6">
                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="taxYear">
                        <span className="label-text text-base-content/70">
                          Tax Year <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <input
                        id="taxYear"
                        type="text"
                        className="input input-bordered w-full"
                        value={formData["Tax Year"] || ""}
                        onChange={(e) =>
                          handleInputChange("Tax Year", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Enter the tax year for this return
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="filingStatus">
                        <span className="label-text text-base-content/70">
                          Filing Status <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <select
                        id="filingStatus"
                        className="select select-bordered w-full"
                        value={formData["Filing Status"] || ""}
                        onChange={(e) =>
                          handleInputChange("Filing Status", e.target.value)
                        }
                      >
                        <option value="Single">Single</option>
                        <option value="Married Filing Jointly">
                          Married Filing Jointly
                        </option>
                        <option value="Married Filing Separately">
                          Married Filing Separately
                        </option>
                        <option value="Head of Household">Head of Household</option>
                        <option value="Qualifying Widow(er)">
                          Qualifying Widow(er)
                        </option>
                      </select>
                      <span className="label-text-alt opacity-60 mt-1">
                        Select your filing status
                      </span>
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSave();
                          scrollToSection('primary-taxpayer');
                        }}
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save & Continue'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Primary Taxpayer Information */}
              <section id="primary-taxpayer" className="scroll-mt-24">
                <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                  <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                    Primary Taxpayer
                  </h3>
                </div>

                <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                  <div className="card-body p-4 md:p-6">
                    <form className="grid grid-cols-12 gap-4 md:gap-6">
                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="firstName">
                          <span className="label-text text-base-content/70">
                            First Name <span className="text-error">*</span>
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            as on ID
                          </span>
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          className="input input-bordered w-full"
                          value={formData["First Name"] || ""}
                          onChange={(e) =>
                            handleInputChange("First Name", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Enter legal first name
                        </span>
                      </div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="lastName">
                          <span className="label-text text-base-content/70">
                            Last Name <span className="text-error">*</span>
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            required
                          </span>
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          className="input input-bordered w-full"
                          value={formData["Last Name"] || ""}
                          onChange={(e) =>
                            handleInputChange("Last Name", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Surname / family name
                        </span>
                      </div>

                      <div className="divider col-span-12 my-1"></div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="ssn">
                          <span className="label-text text-base-content/70">
                            Social Security Number{" "}
                            <span className="text-error">*</span>
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            Format: 123-45-6789
                          </span>
                        </label>
                        <input
                          id="ssn"
                          type="text"
                          className="input input-bordered w-full tracking-wider"
                          placeholder="XXX-XX-XXXX"
                          value={formData.SSN || ""}
                          onChange={(e) =>
                            handleInputChange("SSN", formatSSN(e.target.value))
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          We only use this for tax filing
                        </span>
                      </div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="dob">
                          <span className="label-text text-base-content/70">
                            Date of Birth <span className="text-error">*</span>
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            MM/DD/YYYY
                          </span>
                        </label>
                        <input
                          id="dob"
                          type="date"
                          className="input input-bordered w-full"
                          value={formData["Date of Birth"] || ""}
                          onChange={(e) =>
                            handleInputChange("Date of Birth", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Required for eligibility checks
                        </span>
                      </div>

                      <div className="divider col-span-12 my-1"></div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="occupation">
                          <span className="label-text text-base-content/70">
                            Occupation
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            optional
                          </span>
                        </label>
                        <input
                          id="occupation"
                          type="text"
                          className="input input-bordered w-full"
                          value={formData.Occupation || ""}
                          onChange={(e) =>
                            handleInputChange("Occupation", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Used for certain credits/deductions
                        </span>
                      </div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="dl">
                          <span className="label-text text-base-content/70">
                            Driver's License / State ID
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            optional
                          </span>
                        </label>
                        <div className="join w-full">
                          <input
                            id="dl"
                            type="text"
                            className="input input-bordered join-item w-full uppercase"
                            value={formData["Driver License"] || ""}
                            onChange={(e) =>
                              handleInputChange(
                                "Driver License",
                                e.target.value.toUpperCase()
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-ghost join-item tooltip"
                            data-tip="Why we ask"
                            onClick={() =>
                              alert(
                                "We use ID to e-file in some states and prevent identity theft."
                              )
                            }
                          >
                            ?
                          </button>
                        </div>
                        <span className="label-text-alt opacity-60 mt-1">
                          Uppercased automatically
                        </span>
                      </div>

                      <div className="col-span-12">
                        <div className="alert bg-base-200/60 border border-base-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M11.484 2.394a.75.75 0 0 1 1.032 0l8.25 7.875a.75.75 0 1 1-1.032 1.088L12 3.987 4.266 11.357a.75.75 0 1 1-1.032-1.088l8.25-7.875Zm.516 5.106a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75ZM12 19.5a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div>
                            <h4 className="font-medium">
                              Your information is encrypted.
                            </h4>
                            <p className="text-sm opacity-70">
                              We follow industry standards and never share your
                              SSN or ID outside your return.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSave();
                            const nextSection = (formData["Filing Status"] === "Married Filing Jointly" ||
                                               formData["Filing Status"] === "Married Filing Separately")
                              ? 'spouse-info'
                              : 'contact-info';
                            scrollToSection(nextSection);
                          }}
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>

            {/* Spouse Information */}
            {(formData["Filing Status"] === "Married Filing Jointly" ||
              formData["Filing Status"] === "Married Filing Separately") && (
              <section id="spouse-info" className="scroll-mt-24">
                <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                  <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                    💑 Spouse Information
                  </h3>
                </div>

                <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                  <div className="card-body p-4 md:p-6">
                    <form className="grid grid-cols-12 gap-4 md:gap-6">
                      <div className="form-control col-span-12">
                        <label className="label" htmlFor="spouseName">
                          <span className="label-text text-base-content/70">
                            Spouse Full Name
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            optional
                          </span>
                        </label>
                        <input
                          id="spouseName"
                          type="text"
                          className="input input-bordered w-full"
                          value={formData["Spouse Name"] || ""}
                          onChange={(e) =>
                            handleInputChange("Spouse Name", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Full legal name of spouse
                        </span>
                      </div>

                      <div className="divider col-span-12 my-1"></div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="spouseSSN">
                          <span className="label-text text-base-content/70">
                            Spouse Social Security Number
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            Format: 123-45-6789
                          </span>
                        </label>
                        <input
                          id="spouseSSN"
                          type="text"
                          className="input input-bordered w-full tracking-wider"
                          placeholder="XXX-XX-XXXX"
                          value={formData["Spouse SSN"] || ""}
                          onChange={(e) =>
                            handleInputChange("Spouse SSN", formatSSN(e.target.value))
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Required for joint filing
                        </span>
                      </div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="spouseDOB">
                          <span className="label-text text-base-content/70">
                            Spouse Date of Birth
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            MM/DD/YYYY
                          </span>
                        </label>
                        <input
                          id="spouseDOB"
                          type="date"
                          className="input input-bordered w-full"
                          value={formData["Spouse DOB"] || ""}
                          onChange={(e) =>
                            handleInputChange("Spouse DOB", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Required for eligibility checks
                        </span>
                      </div>

                      <div className="divider col-span-12 my-1"></div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="spouseOccupation">
                          <span className="label-text text-base-content/70">
                            Spouse Occupation
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            optional
                          </span>
                        </label>
                        <input
                          id="spouseOccupation"
                          type="text"
                          className="input input-bordered w-full"
                          value={formData["Spouse Occupation"] || ""}
                          onChange={(e) =>
                            handleInputChange("Spouse Occupation", e.target.value)
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Used for certain credits/deductions
                        </span>
                      </div>

                      <div className="form-control col-span-12 md:col-span-6">
                        <label className="label" htmlFor="spouseDL">
                          <span className="label-text text-base-content/70">
                            Spouse Driver's License / State ID
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            optional
                          </span>
                        </label>
                        <input
                          id="spouseDL"
                          type="text"
                          className="input input-bordered w-full uppercase"
                          value={formData["Spouse Driver License"] || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "Spouse Driver License",
                              e.target.value.toUpperCase()
                            )
                          }
                        />
                        <span className="label-text-alt opacity-60 mt-1">
                          Uppercased automatically
                        </span>
                      </div>

                      <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSave();
                            scrollToSection('contact-info');
                          }}
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            )}

            {/* Contact Information */}
            <section id="contact-info" className="scroll-mt-24">
              <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                  📞 Contact Information
                </h3>
              </div>

              <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4 md:p-6">
                  <form className="grid grid-cols-12 gap-4 md:gap-6">
                    <div className="form-control col-span-12">
                      <label className="label" htmlFor="mailingAddress">
                        <span className="label-text text-base-content/70">
                          Mailing Address <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <input
                        id="mailingAddress"
                        type="text"
                        className="input input-bordered w-full"
                        value={formData["Mailing Address"] || ""}
                        onChange={(e) =>
                          handleInputChange("Mailing Address", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Street address, apartment, suite, etc.
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-5">
                      <label className="label" htmlFor="city">
                        <span className="label-text text-base-content/70">
                          City <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <input
                        id="city"
                        type="text"
                        className="input input-bordered w-full"
                        value={formData["City"] || ""}
                        onChange={(e) => handleInputChange("City", e.target.value)}
                      />
                    </div>

                    <div className="form-control col-span-12 md:col-span-3">
                      <label className="label" htmlFor="state">
                        <span className="label-text text-base-content/70">
                          State <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          2-letter code
                        </span>
                      </label>
                      <input
                        id="state"
                        type="text"
                        className="input input-bordered w-full uppercase"
                        placeholder="CA"
                        maxLength={2}
                        value={formData["State"] || ""}
                        onChange={(e) => handleInputChange("State", e.target.value.toUpperCase())}
                      />
                    </div>

                    <div className="form-control col-span-12 md:col-span-4">
                      <label className="label" htmlFor="zip">
                        <span className="label-text text-base-content/70">
                          ZIP Code <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          5-digit code
                        </span>
                      </label>
                      <input
                        id="zip"
                        type="text"
                        className="input input-bordered w-full"
                        maxLength={5}
                        value={formData["ZIP"] || ""}
                        onChange={(e) => handleInputChange("ZIP", e.target.value)}
                      />
                    </div>

                    <div className="divider col-span-12 my-1"></div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="primaryPhone">
                        <span className="label-text text-base-content/70">
                          Primary Phone <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <input
                        id="primaryPhone"
                        type="tel"
                        className="input input-bordered w-full"
                        placeholder="(555) 123-4567"
                        value={formData["📞Phone number"] || ""}
                        onChange={(e) =>
                          handleInputChange("📞Phone number", formatPhoneNumber(e.target.value))
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Best number to reach you
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="secondaryPhone">
                        <span className="label-text text-base-content/70">
                          Secondary Phone
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="secondaryPhone"
                        type="tel"
                        className="input input-bordered w-full"
                        placeholder="(555) 123-4567"
                        value={formData["Secondary Phone"] || ""}
                        onChange={(e) =>
                          handleInputChange("Secondary Phone", formatPhoneNumber(e.target.value))
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Alternative contact number
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="email">
                        <span className="label-text text-base-content/70">
                          Email Address <span className="text-error">*</span>
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          required
                        </span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        className="input input-bordered w-full"
                        placeholder="your@email.com"
                        value={formData["Email"] || ""}
                        onChange={(e) => handleInputChange("Email", e.target.value)}
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        For document delivery and updates
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="preferredContact">
                        <span className="label-text text-base-content/70">
                          Preferred Contact Method
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <select
                        id="preferredContact"
                        className="select select-bordered w-full"
                        value={formData["Preferred Contact"] || ""}
                        onChange={(e) =>
                          handleInputChange("Preferred Contact", e.target.value)
                        }
                      >
                        <option value="Phone">Phone</option>
                        <option value="Email">Email</option>
                        <option value="Text">Text</option>
                      </select>
                      <span className="label-text-alt opacity-60 mt-1">
                        How would you like us to reach you?
                      </span>
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSave();
                          scrollToSection('bank-info');
                        }}
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save & Continue'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Bank Information */}
            <section id="bank-info" className="scroll-mt-24">
              <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                  🏦 Bank Information
                </h3>
              </div>

              <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4 md:p-6">
                  <div className="alert bg-info/10 border border-info/20 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M11.484 2.394a.75.75 0 0 1 1.032 0l8.25 7.875a.75.75 0 1 1-1.032 1.088L12 3.987 4.266 11.357a.75.75 0 1 1-1.032-1.088l8.25-7.875Zm.516 5.106a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75ZM12 19.5a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
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

                  <form className="grid grid-cols-12 gap-4 md:gap-6">
                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="bankName">
                        <span className="label-text text-base-content/70">
                          Bank Name
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="bankName"
                        type="text"
                        className="input input-bordered w-full"
                        placeholder="e.g., Chase, Bank of America"
                        value={formData["Bank Name"] || ""}
                        onChange={(e) =>
                          handleInputChange("Bank Name", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Name of your bank
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="accountType">
                        <span className="label-text text-base-content/70">
                          Account Type
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <select
                        id="accountType"
                        className="select select-bordered w-full"
                        value={formData["Account Type"] || ""}
                        onChange={(e) =>
                          handleInputChange("Account Type", e.target.value)
                        }
                      >
                        <option value="Checking">Checking</option>
                        <option value="Savings">Savings</option>
                      </select>
                      <span className="label-text-alt opacity-60 mt-1">
                        Type of account
                      </span>
                    </div>

                    <div className="divider col-span-12 my-1"></div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="routingNumber">
                        <span className="label-text text-base-content/70">
                          Routing Number
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          9 digits
                        </span>
                      </label>
                      <input
                        id="routingNumber"
                        type="text"
                        className="input input-bordered w-full tracking-wider"
                        placeholder="000000000"
                        maxLength={9}
                        value={formData["Routing Number"] || ""}
                        onChange={(e) =>
                          handleInputChange("Routing Number", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Found on bottom of check
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="accountNumber">
                        <span className="label-text text-base-content/70">
                          Account Number
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="accountNumber"
                        type="text"
                        className="input input-bordered w-full tracking-wider"
                        placeholder="Enter account number"
                        value={formData["Account Number"] || ""}
                        onChange={(e) =>
                          handleInputChange("Account Number", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Your bank account number
                      </span>
                    </div>

                    <div className="col-span-12">
                      <div className="alert bg-base-200/60 border border-base-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <h4 className="font-medium">Your banking details are secure.</h4>
                          <p className="text-sm opacity-70">
                            We use bank-level encryption and never share your account information.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSave();
                          scrollToSection('prior-year');
                        }}
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save & Continue'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Prior Year Information */}
            <section id="prior-year" className="scroll-mt-24">
              <div className="sticky top-0 z-10 -mx-4 md:mx-0 bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/60">
                <h3 className="text-xl md:text-2xl font-semibold text-base-content px-4 md:px-0 pt-3 pb-2 border-b border-base-300">
                  📅 Prior Year Information
                </h3>
              </div>

              <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4 md:p-6">
                  <form className="grid grid-cols-12 gap-4 md:gap-6">
                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="priorYearAGI">
                        <span className="label-text text-base-content/70">
                          Prior Year AGI
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="priorYearAGI"
                        type="text"
                        className="input input-bordered w-full"
                        placeholder="$0"
                        value={formData["Prior Year AGI"] || ""}
                        onChange={(e) =>
                          handleInputChange("Prior Year AGI", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        Adjusted Gross Income from last year
                      </span>
                    </div>

                    <div className="col-span-12 md:col-span-6">
                      <div className="alert bg-info/10 border border-info/20 h-full flex items-center">
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
                          <p className="text-xs">
                            Used to verify your identity with the IRS when e-filing
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divider col-span-12 my-1"></div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="identityProtectionPIN">
                        <span className="label-text text-base-content/70">
                          Identity Protection PIN
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="identityProtectionPIN"
                        type="text"
                        className="input input-bordered w-full tracking-wider"
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={formData["Identity Protection PIN"] || ""}
                        onChange={(e) =>
                          handleInputChange("Identity Protection PIN", e.target.value)
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        If issued by the IRS
                      </span>
                    </div>

                    <div className="form-control col-span-12 md:col-span-6">
                      <label className="label" htmlFor="spouseIdentityProtectionPIN">
                        <span className="label-text text-base-content/70">
                          Spouse Identity Protection PIN
                        </span>
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </label>
                      <input
                        id="spouseIdentityProtectionPIN"
                        type="text"
                        className="input input-bordered w-full tracking-wider"
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={formData["Spouse Identity Protection PIN"] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "Spouse Identity Protection PIN",
                            e.target.value
                          )
                        }
                      />
                      <span className="label-text-alt opacity-60 mt-1">
                        If issued by the IRS for spouse
                      </span>
                    </div>

                    <div className="col-span-12">
                      <div className="alert bg-warning/10 border border-warning/20">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <h4 className="font-medium text-sm">About IP PINs</h4>
                          <p className="text-xs opacity-70">
                            The IRS issues Identity Protection PINs to victims of tax-related identity theft. If you have one, you must provide it to file electronically.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSave();
                          scrollToSection('document-checklist');
                        }}
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save & Continue'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="card-actions justify-end mt-8 gap-4">
              {!isNewClient && (
                <button
                  onClick={handleSave}
                  className="btn btn-warning btn-lg"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "💾 Update Client Info"}
                </button>
              )}
              <button
                onClick={handleAddToPipeline}
                className="btn btn-success btn-lg"
                disabled={saving}
              >
                📋 Add to Tax Prep Pipeline
              </button>
              {isNewClient && (
                <button
                  onClick={handleSave}
                  className="btn btn-primary btn-lg"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Create Client"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Document Checklist and Tax Prep Pipeline - Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Document Checklist */}
          <div
            id="document-checklist"
            className="card bg-base-100 shadow-xl scroll-mt-24"
          >
            <div className="card-body">
              <h2 className="card-title text-base-content mb-4">
                Document Checklist
              </h2>
              <p className="text-base-content/60 mb-6">
                Track which documents have been received for this client's tax
                return. In the future, this will link to the document management
                system for file uploads.
              </p>
              <DocumentChecklist />
            </div>
          </div>

          {/* Tax Prep Pipeline */}
          <div
            id="tax-prep-pipeline"
            className="card bg-base-100 shadow-xl scroll-mt-24"
          >
            <div className="card-body">
              <h2 className="card-title text-base-content mb-4">
                📋 Tax Prep Pipeline ({pipelineClients.length} clients)
              </h2>
              <div className="alert alert-info mb-4 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>
                  Pipeline data is synced with Airtable Subscriptions Personal
                  table.
                </span>
              </div>
              {pipelineClients.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-sm">
                    <thead>
                      <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Phone</th>
                        <th>Added</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineClients.map((client, index) => (
                        <tr key={index}>
                          <td className="font-semibold">{client.firstName}</td>
                          <td className="font-semibold">{client.lastName}</td>
                          <td>{client.phone}</td>
                          <td className="text-xs">
                            {new Date(client.addedAt).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              className="btn btn-error btn-xs"
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/subscriptions-personal/${client.id}`,
                                    { method: "DELETE" }
                                  );

                                  if (response.ok) {
                                    // Refresh pipeline from Airtable
                                    const pipelineResponse = await fetch(
                                      "/api/subscriptions-personal"
                                    );
                                    const pipelineData =
                                      await pipelineResponse.json();

                                    if (pipelineData.success) {
                                      const pipeline = pipelineData.data.map(
                                        (record: any) => {
                                          // Full Name is a lookup field in Subscriptions Personal
                                          const fullName =
                                            record.fields["Full Name"];
                                          const fullNameStr = Array.isArray(
                                            fullName
                                          )
                                            ? fullName[0]
                                            : fullName || "";

                                          // Split Full Name into First Name and Last Name
                                          const nameParts =
                                            fullNameStr.split(" ");
                                          const firstName = nameParts[0] || "";
                                          const lastName =
                                            nameParts.slice(1).join(" ") || "";

                                          const phone =
                                            record.fields["Phone"] ||
                                            record.fields["📞Phone number"] ||
                                            "";
                                          const phoneStr = Array.isArray(phone)
                                            ? phone[0]
                                            : phone;

                                          return {
                                            id: record.id,
                                            firstName,
                                            lastName,
                                            phone: phoneStr,
                                            addedAt: record.createdTime,
                                          };
                                        }
                                      );
                                      setPipelineClients(pipeline);
                                    }
                                  }
                                } catch (error) {
                                  console.error(
                                    "Failed to remove from pipeline:",
                                    error
                                  );
                                  setError(
                                    "Failed to remove client from pipeline"
                                  );
                                  setTimeout(() => setError(null), 3000);
                                }
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-base-content/60 py-8">
                  No clients in pipeline yet. Add clients using the button
                  above.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
