"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Types
interface DependentFormData {
  name: string;
  ssn: string;
  dob: string;
  relationshipType: 'Child' | 'Parent' | 'Other Dependent';
}

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
    "Spouse (Linked)"?: string[];
    "Dependent (Linked)"?: string[];
    "Child (Linked)"?: string[];
    "Parent (Linked)"?: string[];
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

  // Family member state
  const [dependents, setDependents] = useState<DependentFormData[]>([]);
  const [spouseSameAddress, setSpouseSameAddress] = useState(true);
  const [spouseSearchTerm, setSpouseSearchTerm] = useState("");
  const [spouseSearchResults, setSpouseSearchResults] = useState<PersonalRecord[]>([]);
  const [isSearchingSpouse, setIsSearchingSpouse] = useState(false);
  const [showSpouseSearch, setShowSpouseSearch] = useState(false);
  const [linkedSpouseId, setLinkedSpouseId] = useState<string | null>(null);

  // Form navigation sections
  const formSections = [
    { id: "primary-taxpayer", label: "Primary Taxpayer", icon: "👤" },
    { id: "contact-info", label: "Contact Information", icon: "📞" },
    { id: "spouse-info", label: "Spouse Information", icon: "💑" },
    { id: "dependents-info", label: "Dependents", icon: "👨‍👩‍👧‍👦" },
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

            // Check if this client has a linked spouse
            if (client.fields["Spouse (Linked)"] && client.fields["Spouse (Linked)"].length > 0) {
              const spouseId = client.fields["Spouse (Linked)"][0];
              setLinkedSpouseId(spouseId);

              // Fetch the spouse's information
              const spouseResponse = await fetch(`/api/personal/${spouseId}`);
              const spouseData = await spouseResponse.json();

              if (spouseData.success) {
                const spouse = spouseData.data;
                // Populate the form fields with spouse info for display
                setFormData(prev => ({
                  ...prev,
                  "Spouse Name": spouse.fields["Full Name"] || `${spouse.fields["First Name"]} ${spouse.fields["Last Name"]}`,
                  "Spouse SSN": spouse.fields.SSN || "",
                  "Spouse DOB": spouse.fields["Date of Birth"] || "",
                  "Spouse Occupation": spouse.fields.Occupation || "",
                  "Spouse Driver License": spouse.fields["Driver License"] || "",
                }));
              }
            }

            // Load all linked dependents (children, parents, other dependents)
            const loadedDependents: DependentFormData[] = [];

            // Load children
            if (client.fields["Child (Linked)"] && client.fields["Child (Linked)"].length > 0) {
              for (const childId of client.fields["Child (Linked)"]) {
                try {
                  const childResponse = await fetch(`/api/personal/${childId}`);
                  const childData = await childResponse.json();
                  if (childData.success) {
                    const child = childData.data;
                    loadedDependents.push({
                      name: child.fields["Full Name"] || `${child.fields["First Name"]} ${child.fields["Last Name"]}`,
                      ssn: child.fields.SSN || "",
                      dob: child.fields["Date of Birth"] || "",
                      relationshipType: "Child",
                    });
                  }
                } catch (err) {
                  console.error('Error loading child:', err);
                }
              }
            }

            // Load parents
            if (client.fields["Parent (Linked)"] && client.fields["Parent (Linked)"].length > 0) {
              for (const parentId of client.fields["Parent (Linked)"]) {
                try {
                  const parentResponse = await fetch(`/api/personal/${parentId}`);
                  const parentData = await parentResponse.json();
                  if (parentData.success) {
                    const parent = parentData.data;
                    loadedDependents.push({
                      name: parent.fields["Full Name"] || `${parent.fields["First Name"]} ${parent.fields["Last Name"]}`,
                      ssn: parent.fields.SSN || "",
                      dob: parent.fields["Date of Birth"] || "",
                      relationshipType: "Parent",
                    });
                  }
                } catch (err) {
                  console.error('Error loading parent:', err);
                }
              }
            }

            // Load other dependents
            if (client.fields["Dependent (Linked)"] && client.fields["Dependent (Linked)"].length > 0) {
              for (const depId of client.fields["Dependent (Linked)"]) {
                try {
                  const depResponse = await fetch(`/api/personal/${depId}`);
                  const depData = await depResponse.json();
                  if (depData.success) {
                    const dep = depData.data;
                    loadedDependents.push({
                      name: dep.fields["Full Name"] || `${dep.fields["First Name"]} ${dep.fields["Last Name"]}`,
                      ssn: dep.fields.SSN || "",
                      dob: dep.fields["Date of Birth"] || "",
                      relationshipType: "Other Dependent",
                    });
                  }
                } catch (err) {
                  console.error('Error loading dependent:', err);
                }
              }
            }

            setDependents(loadedDependents);
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
  const handleSelectClient = async (client: PersonalRecord) => {
    setSelectedClient(client);
    setFormData(client.fields);
    setIsNewClient(false);
    setSearchResults([]);
    setSearchTerm("");

    // Reset and check for spouse link
    setLinkedSpouseId(null);
    setDependents([]);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Check if this client has a linked spouse
    if (client.fields["Spouse (Linked)"] && client.fields["Spouse (Linked)"].length > 0) {
      const spouseId = client.fields["Spouse (Linked)"][0];
      setLinkedSpouseId(spouseId);

      try {
        // Fetch the spouse's information
        const spouseResponse = await fetch(`${apiUrl}/api/personal/${spouseId}`);
        const spouseData = await spouseResponse.json();

        if (spouseData.success) {
          const spouse = spouseData.data;
          // Populate the form fields with spouse info for display
          setFormData(prev => ({
            ...prev,
            "Spouse Name": spouse.fields["Full Name"] || `${spouse.fields["First Name"]} ${spouse.fields["Last Name"]}`,
            "Spouse SSN": spouse.fields.SSN || "",
            "Spouse DOB": spouse.fields["Date of Birth"] || "",
            "Spouse Occupation": spouse.fields.Occupation || "",
            "Spouse Driver License": spouse.fields["Driver License"] || "",
          }));
        }
      } catch (err) {
        console.error('Error loading spouse data:', err);
      }
    } else {
      // Clear spouse fields if no spouse linked
      setFormData(prev => ({
        ...prev,
        "Spouse Name": "",
        "Spouse SSN": "",
        "Spouse DOB": "",
        "Spouse Occupation": "",
        "Spouse Driver License": "",
      }));
    }

    // Load all linked dependents (children, parents, other dependents)
    const loadedDependents: DependentFormData[] = [];

    try {
      // Load children
      if (client.fields["Child (Linked)"] && client.fields["Child (Linked)"].length > 0) {
        for (const childId of client.fields["Child (Linked)"]) {
          const childResponse = await fetch(`${apiUrl}/api/personal/${childId}`);
          const childData = await childResponse.json();
          if (childData.success) {
            const child = childData.data;
            loadedDependents.push({
              name: child.fields["Full Name"] || `${child.fields["First Name"]} ${child.fields["Last Name"]}`,
              ssn: child.fields.SSN || "",
              dob: child.fields["Date of Birth"] || "",
              relationshipType: "Child",
            });
          }
        }
      }

      // Load parents
      if (client.fields["Parent (Linked)"] && client.fields["Parent (Linked)"].length > 0) {
        for (const parentId of client.fields["Parent (Linked)"]) {
          const parentResponse = await fetch(`${apiUrl}/api/personal/${parentId}`);
          const parentData = await parentResponse.json();
          if (parentData.success) {
            const parent = parentData.data;
            loadedDependents.push({
              name: parent.fields["Full Name"] || `${parent.fields["First Name"]} ${parent.fields["Last Name"]}`,
              ssn: parent.fields.SSN || "",
              dob: parent.fields["Date of Birth"] || "",
              relationshipType: "Parent",
            });
          }
        }
      }

      // Load other dependents
      if (client.fields["Dependent (Linked)"] && client.fields["Dependent (Linked)"].length > 0) {
        for (const depId of client.fields["Dependent (Linked)"]) {
          const depResponse = await fetch(`${apiUrl}/api/personal/${depId}`);
          const depData = await depResponse.json();
          if (depData.success) {
            const dep = depData.data;
            loadedDependents.push({
              name: dep.fields["Full Name"] || `${dep.fields["First Name"]} ${dep.fields["Last Name"]}`,
              ssn: dep.fields.SSN || "",
              dob: dep.fields["Date of Birth"] || "",
              relationshipType: "Other Dependent",
            });
          }
        }
      }

      setDependents(loadedDependents);
    } catch (err) {
      console.error('Error loading dependents:', err);
    }
  };

  // Search for spouse
  const handleSpouseSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSpouseSearchResults([]);
      return;
    }

    try {
      setIsSearchingSpouse(true);
      const response = await fetch(`/api/personal/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        // Filter out the current client from results
        const filtered = data.data.filter((person: PersonalRecord) => person.id !== selectedClient?.id);
        setSpouseSearchResults(filtered);
      }
    } catch (err) {
      console.error("Error searching for spouse:", err);
    } finally {
      setIsSearchingSpouse(false);
    }
  }, [selectedClient?.id]);

  // Debounce spouse search
  useEffect(() => {
    if (spouseSearchTerm.length >= 2) {
      const timeoutId = setTimeout(() => {
        handleSpouseSearch(spouseSearchTerm);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setSpouseSearchResults([]);
    }
  }, [spouseSearchTerm, handleSpouseSearch]);

  // Link to existing spouse
  const handleLinkExistingSpouse = (spouse: PersonalRecord) => {
    // Populate spouse fields with existing person's data
    handleInputChange("Spouse Name", spouse.fields["Full Name"] || `${spouse.fields["First Name"]} ${spouse.fields["Last Name"]}`);
    handleInputChange("Spouse SSN", spouse.fields.SSN || "");
    handleInputChange("Spouse DOB", spouse.fields["Date of Birth"] || "");
    handleInputChange("Spouse Occupation", spouse.fields.Occupation || "");
    handleInputChange("Spouse Driver License", spouse.fields["Driver License"] || "");

    setLinkedSpouseId(spouse.id);
    setShowSpouseSearch(false);
    setSpouseSearchTerm("");
    setSpouseSearchResults([]);
  };

  // Reset to new client
  const handleNewClient = () => {
    setSelectedClient(null);
    setIsNewClient(true);
    setLinkedSpouseId(null);
    setDependents([]);
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

      // Validate spouse SSN vs primary SSN
      if (formData["Spouse SSN"] && formData.SSN === formData["Spouse SSN"]) {
        setError("Spouse SSN cannot be the same as primary taxpayer SSN");
        setTimeout(() => setError(null), 3000);
        setSaving(false);
        return;
      }

      // Validate dependent SSNs are unique within family
      const allSSNs = [
        formData.SSN,
        formData["Spouse SSN"],
        ...dependents.map(d => d.ssn)
      ].filter(Boolean);

      const uniqueSSNs = new Set(allSSNs);
      if (allSSNs.length !== uniqueSSNs.size) {
        setError("All family members must have unique SSNs");
        setTimeout(() => setError(null), 3000);
        setSaving(false);
        return;
      }

      const url = isNewClient
        ? "/api/personal"
        : `/api/personal/${selectedClient?.id}`;

      // Filter out computed fields that Airtable doesn't accept
      const {
        "Full Name": _fullName,
        "Last modified time": _lastModified,
        "last name first name": _lastNameFirstName,
        "Spouse Name": _spouseName,
        "Spouse SSN": _spouseSSN,
        "Spouse DOB": _spouseDOB,
        "Spouse Occupation": _spouseOccupation,
        "Spouse Driver License": _spouseDriverLicense,
        ...fieldsToSave
      } = formData;

      const response = await fetch(url, {
        method: isNewClient ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: fieldsToSave,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const message = isNewClient
          ? "Client created successfully!"
          : "Client updated successfully!";

        setSuccessMessage(message);

        if (isNewClient && data.data.primary) {
          setSelectedClient({
            id: data.data.primary.id,
            fields: data.data.primary.fields,
            createdTime: new Date().toISOString(),
          });
          setIsNewClient(false);
        }

        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(data.error || data.errors?.join(", ") || "Failed to save client");
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
                    <div className="whitespace-pre-line">{successMessage}</div>
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
                        ? "Search for an existing client or enter new spouse information below. A separate Personal record will be created and linked."
                        : "Spouse information only required for married filing jointly or separately"}
                    </p>

                    {/* Show linked spouse status */}
                    {linkedSpouseId && !isNewClient && (
                      <div className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold">Spouse Already Linked</p>
                          <p className="text-sm">This client has a linked spouse record. Information shown below is from the linked record.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              if (linkedSpouseId) {
                                window.open(`/client-intake?id=${linkedSpouseId}`, '_blank');
                              }
                            }}
                          >
                            View Spouse Record
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              if (confirm('This will unlink the spouse. To manage the relationship, use the Tax Family Dashboard. Continue?')) {
                                setLinkedSpouseId(null);
                                setFormData(prev => ({
                                  ...prev,
                                  "Spouse Name": "",
                                  "Spouse SSN": "",
                                  "Spouse DOB": "",
                                  "Spouse Occupation": "",
                                  "Spouse Driver License": "",
                                }));
                              }
                            }}
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show message when no spouse linked */}
                    {!linkedSpouseId && (
                      <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="font-semibold">No spouse linked</p>
                          <p className="text-sm">To add or link a spouse, use the Tax Family Dashboard after saving this client.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Spouse Full Name {linkedSpouseId && !isNewClient && <span className="text-info text-xs">(read-only, linked record)</span>}</span>
                        </label>
                        <input
                          type="text"
                          className={`input input-bordered ${linkedSpouseId && !isNewClient ? 'bg-base-200' : ''}`}
                          value={formData["Spouse Name"] || ""}
                          onChange={(e) => handleInputChange("Spouse Name", e.target.value)}
                          readOnly={!!(linkedSpouseId && !isNewClient)}
                          disabled={!!(linkedSpouseId && !isNewClient)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Social Security Number {linkedSpouseId && !isNewClient && <span className="text-info text-xs">(read-only, linked record)</span>}</span>
                        </label>
                        <input
                          type="text"
                          className={`input input-bordered ${linkedSpouseId && !isNewClient ? 'bg-base-200' : ''}`}
                          placeholder="XXX-XX-XXXX"
                          value={formData["Spouse SSN"] || ""}
                          onChange={(e) => handleInputChange("Spouse SSN", formatSSN(e.target.value))}
                          readOnly={!!(linkedSpouseId && !isNewClient)}
                          disabled={!!(linkedSpouseId && !isNewClient)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Date of Birth {linkedSpouseId && !isNewClient && <span className="text-info text-xs">(read-only, linked record)</span>}</span>
                        </label>
                        <input
                          type="date"
                          className={`input input-bordered ${linkedSpouseId && !isNewClient ? 'bg-base-200' : ''}`}
                          value={formData["Spouse DOB"] || ""}
                          onChange={(e) => handleInputChange("Spouse DOB", e.target.value)}
                          readOnly={!!(linkedSpouseId && !isNewClient)}
                          disabled={!!(linkedSpouseId && !isNewClient)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Occupation {linkedSpouseId && !isNewClient && <span className="text-info text-xs">(read-only, linked record)</span>}</span>
                        </label>
                        <input
                          type="text"
                          className={`input input-bordered ${linkedSpouseId && !isNewClient ? 'bg-base-200' : ''}`}
                          value={formData["Spouse Occupation"] || ""}
                          onChange={(e) => handleInputChange("Spouse Occupation", e.target.value)}
                          readOnly={!!(linkedSpouseId && !isNewClient)}
                          disabled={!!(linkedSpouseId && !isNewClient)}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Spouse Driver's License / State ID {linkedSpouseId && !isNewClient && <span className="text-info text-xs">(read-only, linked record)</span>}</span>
                        </label>
                        <input
                          type="text"
                          className={`input input-bordered uppercase ${linkedSpouseId && !isNewClient ? 'bg-base-200' : ''}`}
                          value={formData["Spouse Driver License"] || ""}
                          onChange={(e) => handleInputChange("Spouse Driver License", e.target.value.toUpperCase())}
                          readOnly={!!(linkedSpouseId && !isNewClient)}
                          disabled={!!(linkedSpouseId && !isNewClient)}
                        />
                      </div>

                      <div className="form-control md:col-span-2">
                        <label className="cursor-pointer label justify-start gap-4">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary"
                            checked={spouseSameAddress}
                            onChange={(e) => setSpouseSameAddress(e.target.checked)}
                          />
                          <span className="label-text">
                            Spouse has the same address as primary taxpayer
                          </span>
                        </label>
                        <p className="text-sm text-base-content/60 ml-10 mt-1">
                          {spouseSameAddress
                            ? "Spouse record will inherit the same contact information from the Contact Information section"
                            : "Uncheck to enter different address for spouse (future enhancement)"}
                        </p>
                        <div className="alert alert-info mt-4">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div>
                            <p className="font-semibold">How spouse information works:</p>
                            <ul className="text-sm mt-2 space-y-1">
                              <li>• <strong>If spouse already linked:</strong> All fields are read-only (displayed from the linked spouse record)</li>
                              <li>• <strong>To edit spouse info:</strong> Click "View Spouse Record" button to open and edit the spouse's own record</li>
                              <li>• <strong>To link a spouse:</strong> Use the Tax Family Dashboard after saving this client</li>
                              <li>• <strong>All relationships:</strong> Managed through the Tax Family Dashboard, not here</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dependents Section */}
                {activeSection === "dependents-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">👨‍👩‍👧‍👦 Dependents</h2>

                    {!isNewClient && dependents.length > 0 ? (
                      <>
                        <div className="alert alert-info">
                          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div>
                            <p className="font-semibold">Linked Dependents</p>
                            <p className="text-sm">The dependents below are linked records from Airtable. To manage relationships, use the Tax Family Dashboard.</p>
                          </div>
                        </div>
                        <p className="text-base-content/70">
                          Viewing dependents linked to this taxpayer. Information is read-only.
                        </p>
                      </>
                    ) : (
                      <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="font-semibold">No dependents linked</p>
                          <p className="text-sm">To add or link dependents, use the Tax Family Dashboard after saving this client.</p>
                        </div>
                      </div>
                    )}

                    {dependents.map((dep, index) => (
                      <div key={index} className="card bg-base-200 p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-semibold">
                            {dep.relationshipType} #{index + 1}
                            {!isNewClient && <span className="text-info text-xs ml-2">(read-only, linked record)</span>}
                          </h3>
                          {isNewClient && (
                            <button
                              type="button"
                              onClick={() => setDependents(dependents.filter((_, i) => i !== index))}
                              className="btn btn-error btn-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="form-control md:col-span-2">
                            <label className="label">
                              <span className="label-text">Full Name <span className="text-error">*</span></span>
                            </label>
                            <input
                              type="text"
                              className={`input input-bordered ${!isNewClient ? 'bg-base-300' : ''}`}
                              value={dep.name}
                              onChange={(e) => {
                                const updated = [...dependents];
                                updated[index].name = e.target.value;
                                setDependents(updated);
                              }}
                              placeholder="John Doe"
                              readOnly={!isNewClient}
                              disabled={!isNewClient}
                            />
                          </div>

                          <div className="form-control">
                            <label className="label">
                              <span className="label-text">Social Security Number <span className="text-error">*</span></span>
                            </label>
                            <input
                              type="text"
                              className={`input input-bordered ${!isNewClient ? 'bg-base-300' : ''}`}
                              placeholder="XXX-XX-XXXX"
                              value={dep.ssn}
                              onChange={(e) => {
                                const updated = [...dependents];
                                updated[index].ssn = formatSSN(e.target.value);
                                setDependents(updated);
                              }}
                              readOnly={!isNewClient}
                              disabled={!isNewClient}
                            />
                          </div>

                          <div className="form-control">
                            <label className="label">
                              <span className="label-text">Date of Birth <span className="text-error">*</span></span>
                            </label>
                            <input
                              type="date"
                              className={`input input-bordered ${!isNewClient ? 'bg-base-300' : ''}`}
                              value={dep.dob}
                              onChange={(e) => {
                                const updated = [...dependents];
                                updated[index].dob = e.target.value;
                                setDependents(updated);
                              }}
                              readOnly={!isNewClient}
                              disabled={!isNewClient}
                            />
                          </div>

                          <div className="form-control">
                            <label className="label">
                              <span className="label-text">Relationship Type <span className="text-error">*</span></span>
                            </label>
                            <select
                              className={`select select-bordered ${!isNewClient ? 'bg-base-300' : ''}`}
                              value={dep.relationshipType}
                              onChange={(e) => {
                                const updated = [...dependents];
                                updated[index].relationshipType = e.target.value as DependentFormData['relationshipType'];
                                setDependents(updated);
                              }}
                              disabled={!isNewClient}
                            >
                              <option value="Child">Child</option>
                              <option value="Parent">Parent</option>
                              <option value="Other Dependent">Other Dependent</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    {isNewClient && (
                      <>
                        {dependents.length === 0 && (
                          <div className="text-center py-8 border-2 border-dashed border-base-300 rounded-lg">
                            <p className="text-base-content/60 mb-4">No dependents added yet</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setDependents([...dependents, { name: '', ssn: '', dob: '', relationshipType: 'Child' }])}
                          className="btn btn-secondary btn-sm"
                          disabled={dependents.length >= 10}
                        >
                          + Add Dependent
                        </button>

                        {dependents.length >= 10 && (
                          <p className="text-sm text-warning">Maximum of 10 dependents reached</p>
                        )}
                      </>
                    )}
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
