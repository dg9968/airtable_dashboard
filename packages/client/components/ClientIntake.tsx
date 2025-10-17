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
        const response = await fetch('/api/subscriptions-personal');
        const data = await response.json();

        if (data.success) {
          // Transform Airtable records to pipeline format
          const pipeline = data.data.map((record: any) => {
            // Full Name is a lookup field in Subscriptions Personal
            const fullName = record.fields['Full Name'];
            const fullNameStr = Array.isArray(fullName) ? fullName[0] : fullName || '';

            // Split Full Name into First Name and Last Name
            const nameParts = fullNameStr.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const phone = record.fields['Phone'] || record.fields['📞Phone number'] || '';
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
        console.error('Failed to fetch pipeline data:', error);
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
    const fullName = client.fields["Full Name"] ||
      `${client.fields["First Name"] || ""} ${client.fields["Last Name"] || ""}`.trim();
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
        ? '/api/personal'
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
      setError("Please enter both First Name and Phone Number before adding to pipeline");
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
      const servicesResponse = await fetch('/api/services-personal');
      const servicesData = await servicesResponse.json();

      if (!servicesData.success) {
        throw new Error('Failed to fetch personal services');
      }

      // Find the Tax Prep Pipeline service
      const taxPrepService = servicesData.services?.find(
        (service: any) => service.name === 'Tax Prep Pipeline'
      );

      if (!taxPrepService) {
        setError('Tax Prep Pipeline service not found in Personal Services table. Please create it first.');
        setTimeout(() => setError(null), 5000);
        return;
      }

      // Create the junction record in Subscriptions Personal
      const subscriptionResponse = await fetch('/api/subscriptions-personal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalId: selectedClient.id,
          serviceId: taxPrepService.id,
        }),
      });

      const subscriptionData = await subscriptionResponse.json();

      if (!subscriptionData.success) {
        throw new Error(subscriptionData.error || 'Failed to create subscription');
      }

      // Refresh pipeline from Airtable
      const pipelineResponse = await fetch('/api/subscriptions-personal');
      const pipelineData = await pipelineResponse.json();

      if (pipelineData.success) {
        const pipeline = pipelineData.data.map((record: any) => {
          // Full Name is a lookup field in Subscriptions Personal
          const fullName = record.fields['Full Name'];
          const fullNameStr = Array.isArray(fullName) ? fullName[0] : fullName || '';

          // Split Full Name into First Name and Last Name
          const nameParts = fullNameStr.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          const phone = record.fields['Phone'] || record.fields['📞Phone number'] || '';
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
      setSuccessMessage(`✅ ${fullName} added to Tax Prep Pipeline in Airtable!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to pipeline');
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
              <h1 className="text-3xl font-bold text-base-content">Client Intake</h1>
              <p className="text-base-content/70 mt-1">
                {isNewClient
                  ? "Create new client record"
                  : `Editing: ${
                      formData["Full Name"] ||
                      `${formData["First Name"] || ""} ${formData["Last Name"] || ""}`.trim()
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
        {/* Search Existing Clients */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-base-content">Search Existing Clients</h2>
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
                            `${client.fields["First Name"] || ""} ${client.fields["Last Name"] || ""}`.trim()}
                        </p>
                        <p className="text-sm text-base-content/60">
                          {client.fields["Email"]} • {client.fields["📞Phone number"]}
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
            <h2 className="card-title text-base-content">Personal Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Tax Year */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">Tax Year *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Tax Year"] || ""}
                  onChange={(e) =>
                    handleInputChange("Tax Year", e.target.value)
                  }
                />
              </div>

              {/* Filing Status */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Filing Status *
                  </span>
                </label>
                <select
                  className="select select-bordered"
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
              </div>

              {/* Primary Taxpayer Information */}
              <div className="col-span-2">
                <h3 className="text-xl font-semibold text-base-content mb-4 border-b border-base-300 pb-2">
                  Primary Taxpayer
                </h3>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    First Name *
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["First Name"] || ""}
                  onChange={(e) =>
                    handleInputChange("First Name", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Last Name *
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Last Name"] || ""}
                  onChange={(e) =>
                    handleInputChange("Last Name", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Social Security Number *
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="XXX-XX-XXXX"
                  value={formData["SSN"] || ""}
                  onChange={(e) => handleInputChange("SSN", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Date of Birth *
                  </span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={formData["Date of Birth"] || ""}
                  onChange={(e) =>
                    handleInputChange("Date of Birth", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">Occupation</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Occupation"] || ""}
                  onChange={(e) =>
                    handleInputChange("Occupation", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Driver's License / State ID
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Driver License"] || ""}
                  onChange={(e) =>
                    handleInputChange("Driver License", e.target.value)
                  }
                />
              </div>

              {/* Spouse Information */}
              {(formData["Filing Status"] === "Married Filing Jointly" ||
                formData["Filing Status"] === "Married Filing Separately") && (
                <>
                  <div className="col-span-2">
                    <h3 className="text-xl font-semibold text-base-content mb-4 mt-6 border-b border-base-300 pb-2">
                      Spouse Information
                    </h3>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base-content/70">
                        Spouse Full Name
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData["Spouse Name"] || ""}
                      onChange={(e) =>
                        handleInputChange("Spouse Name", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base-content/70">
                        Spouse SSN
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder="XXX-XX-XXXX"
                      value={formData["Spouse SSN"] || ""}
                      onChange={(e) =>
                        handleInputChange("Spouse SSN", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base-content/70">
                        Spouse Date of Birth
                      </span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={formData["Spouse DOB"] || ""}
                      onChange={(e) =>
                        handleInputChange("Spouse DOB", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base-content/70">
                        Spouse Occupation
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData["Spouse Occupation"] || ""}
                      onChange={(e) =>
                        handleInputChange("Spouse Occupation", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-base-content/70">
                        Spouse Driver's License
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData["Spouse Driver License"] || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "Spouse Driver License",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </>
              )}

              {/* Contact Information */}
              <div className="col-span-2">
                <h3 className="text-xl font-semibold text-base-content mb-4 mt-6 border-b border-base-300 pb-2">
                  Contact Information
                </h3>
              </div>

              <div className="form-control col-span-2">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Mailing Address *
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Mailing Address"] || ""}
                  onChange={(e) =>
                    handleInputChange("Mailing Address", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">City *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["City"] || ""}
                  onChange={(e) => handleInputChange("City", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">State *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="e.g., CA"
                  value={formData["State"] || ""}
                  onChange={(e) => handleInputChange("State", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">ZIP Code *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["ZIP"] || ""}
                  onChange={(e) => handleInputChange("ZIP", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Primary Phone *
                  </span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered"
                  value={formData["📞Phone number"] || ""}
                  onChange={(e) => handleInputChange("📞Phone number", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Secondary Phone
                  </span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered"
                  value={formData["Secondary Phone"] || ""}
                  onChange={(e) =>
                    handleInputChange("Secondary Phone", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Email Address *
                  </span>
                </label>
                <input
                  type="email"
                  className="input input-bordered"
                  value={formData["Email"] || ""}
                  onChange={(e) => handleInputChange("Email", e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Preferred Contact Method
                  </span>
                </label>
                <select
                  className="select select-bordered"
                  value={formData["Preferred Contact"] || ""}
                  onChange={(e) =>
                    handleInputChange("Preferred Contact", e.target.value)
                  }
                >
                  <option value="Phone">Phone</option>
                  <option value="Email">Email</option>
                  <option value="Text">Text</option>
                </select>
              </div>

              {/* Bank Information */}
              <div className="col-span-2">
                <h3 className="text-xl font-semibold text-base-content mb-4 mt-6 border-b border-base-300 pb-2">
                  Bank Information (for Direct Deposit/Withdrawal)
                </h3>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">Bank Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Bank Name"] || ""}
                  onChange={(e) =>
                    handleInputChange("Bank Name", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Routing Number
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Routing Number"] || ""}
                  onChange={(e) =>
                    handleInputChange("Routing Number", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Account Number
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Account Number"] || ""}
                  onChange={(e) =>
                    handleInputChange("Account Number", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">Account Type</span>
                </label>
                <select
                  className="select select-bordered"
                  value={formData["Account Type"] || ""}
                  onChange={(e) =>
                    handleInputChange("Account Type", e.target.value)
                  }
                >
                  <option value="Checking">Checking</option>
                  <option value="Savings">Savings</option>
                </select>
              </div>

              {/* Prior Year Information */}
              <div className="col-span-2">
                <h3 className="text-xl font-semibold text-base-content mb-4 mt-6 border-b border-base-300 pb-2">
                  Prior Year Information
                </h3>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Prior Year AGI
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="$"
                  value={formData["Prior Year AGI"] || ""}
                  onChange={(e) =>
                    handleInputChange("Prior Year AGI", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Identity Protection PIN
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Identity Protection PIN"] || ""}
                  onChange={(e) =>
                    handleInputChange("Identity Protection PIN", e.target.value)
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-base-content/70">
                    Spouse Identity Protection PIN
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData["Spouse Identity Protection PIN"] || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "Spouse Identity Protection PIN",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

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
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-base-content mb-4">Document Checklist</h2>
              <p className="text-base-content/60 mb-6">
                Track which documents have been received for this client's tax
                return. In the future, this will link to the document management
                system for file uploads.
              </p>
              <DocumentChecklist />
            </div>
          </div>

          {/* Tax Prep Pipeline */}
          <div className="card bg-base-100 shadow-xl">
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
                  Pipeline data is synced with Airtable Subscriptions Personal table.
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
                                    { method: 'DELETE' }
                                  );

                                  if (response.ok) {
                                    // Refresh pipeline from Airtable
                                    const pipelineResponse = await fetch('/api/subscriptions-personal');
                                    const pipelineData = await pipelineResponse.json();

                                    if (pipelineData.success) {
                                      const pipeline = pipelineData.data.map((record: any) => {
                                        // Full Name is a lookup field in Subscriptions Personal
                                        const fullName = record.fields['Full Name'];
                                        const fullNameStr = Array.isArray(fullName) ? fullName[0] : fullName || '';

                                        // Split Full Name into First Name and Last Name
                                        const nameParts = fullNameStr.split(' ');
                                        const firstName = nameParts[0] || '';
                                        const lastName = nameParts.slice(1).join(' ') || '';

                                        const phone = record.fields['Phone'] || record.fields['📞Phone number'] || '';
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
                                  }
                                } catch (error) {
                                  console.error('Failed to remove from pipeline:', error);
                                  setError('Failed to remove client from pipeline');
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
                  No clients in pipeline yet. Add clients using the button above.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
