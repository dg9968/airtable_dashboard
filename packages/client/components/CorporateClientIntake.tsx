"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Types
interface CorporateRecord {
  id: string;
  fields: {
    "Company"?: string;
    "Company Name"?: string;
    "EIN"?: string;
    "ADDRESS"?: string;
    "Address"?: string;
    "CITY"?: string;
    "City"?: string;
    "STATE"?: string;
    "State"?: string;
    "ZIP CODE"?: string;
    "ZIP"?: string;
    "Phone"?: string;
    "🤷‍♂️Email"?: string;
    "Email"?: string;
    "Type of Entity"?: string;
    "Date Incorporated"?: string;
    "Fiscal Year End"?: string;
    "Industry"?: string;
    "Website"?: string;
    "Notes"?: string;
  };
  createdTime: string;
}

interface ContactRecord {
  id: string;
  fields: {
    "First Name"?: string;
    "Last Name"?: string;
    "Full Name"?: string;
    "Email"?: string;
    "📞Phone number"?: string;
    "Phone"?: string;
  };
}

interface CompanyContactRelationship {
  contactId: string;
  contactName?: string;
  role?: string;
  isPrimary: boolean;
  workEmail?: string;
  workPhone?: string;
  department?: string;
}

export default function CorporateClientIntake() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CorporateRecord[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CorporateRecord | null>(null);
  const [isNewCompany, setIsNewCompany] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("company-info");

  // Contact search and management
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<ContactRecord[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<CompanyContactRelationship[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  // Pipeline management
  const [pipelineCompanies, setPipelineCompanies] = useState<any[]>([]);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("Reconciling Banks for Tax Prep");

  // Available services
  const services = [
    "Reconciling Banks for Tax Prep",
    "Payroll",
    "Bookkeeping",
    "Annual Report"
  ];

  // Form data
  const [formData, setFormData] = useState({
    companyName: "",
    ein: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    entityType: "",
    dateIncorporated: "",
    fiscalYearEnd: "",
    industry: "",
    website: "",
    notes: ""
  });

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

  // Check for ID in URL params to load existing company
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      loadCompanyById(id);
    }
  }, [searchParams]);

  // Fetch pipeline data to check if company is already in pipeline
  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const response = await fetch(`/api/subscriptions-corporate`);
        const data = await response.json();

        if (data.success) {
          setPipelineCompanies(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
      }
    };

    fetchPipeline();
  }, []);

  const loadCompanyById = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/view/Corporations/${id}`);
      const result = await response.json();

      if (result.success && result.data) {
        setSelectedCompany(result.data);
        setIsNewCompany(false);
        populateFormFromRecord(result.data);

        // Load contacts for this company
        await loadCompanyContacts(id);
      }
    } catch (err) {
      console.error("Error loading company:", err);
      setError("Failed to load company data");
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyContacts = async (companyId: string) => {
    try {
      console.log(`Loading contacts for company: ${companyId}`);
      const response = await fetch(`/api/company-contacts/company/${companyId}/contacts`);
      const result = await response.json();
      console.log('Company contacts API response:', result);

      if (result.success && result.contacts) {
        const relationships = result.contacts.map((contact: any) => ({
          contactId: contact.contactId,
          contactName: contact.contactName,
          role: contact.role,
          isPrimary: contact.isPrimary,
          workEmail: contact.workEmail,
          workPhone: contact.workPhone,
          department: contact.department
        }));
        console.log('Mapped relationships:', relationships);
        setSelectedContacts(relationships);
      } else {
        console.log('No contacts found or API failed:', result);
      }
    } catch (err) {
      console.error("Error loading company contacts:", err);
    }
  };

  const populateFormFromRecord = (record: CorporateRecord) => {
    setFormData({
      companyName: record.fields["Company"] || record.fields["Company Name"] || "",
      ein: record.fields["EIN"] || "",
      address: record.fields["ADDRESS"] || "",
      city: record.fields["CITY"] || "",
      state: record.fields["STATE"] || "",
      zip: record.fields["ZIP CODE"] || "",
      phone: record.fields["Phone"] || "",
      email: record.fields["🤷‍♂️Email"] || record.fields["Email"] || "",
      entityType: record.fields["Type of Entity"] || "",
      dateIncorporated: record.fields["Date Incorporated"] || "",
      fiscalYearEnd: record.fields["Fiscal Year End"] || "",
      industry: record.fields["Industry"] || "",
      website: record.fields["Website"] || "",
      notes: record.fields["Notes"] || ""
    });
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError("Please enter a company name or EIN to search");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/view?table=Corporations&view=Grid view`);
      const result = await response.json();

      if (result.success && result.data) {
        const filtered = result.data.records.filter((record: CorporateRecord) => {
          const companyName = (record.fields["Company"] || record.fields["Company Name"] || "").toLowerCase();
          const ein = (record.fields["EIN"] || "").toLowerCase();
          const search = searchTerm.toLowerCase();
          return companyName.includes(search) || ein.includes(search);
        });

        setSearchResults(filtered);

        if (filtered.length === 0) {
          setError("No companies found. You can create a new one.");
          setIsNewCompany(true);
        }
      }
    } catch (err) {
      console.error("Error searching companies:", err);
      setError("Failed to search companies");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (company: CorporateRecord) => {
    setSelectedCompany(company);
    setIsNewCompany(false);
    populateFormFromRecord(company);
    setSearchResults([]);
    loadCompanyContacts(company.id);
  };

  const handleSearchContacts = async () => {
    if (!contactSearchTerm.trim()) return;

    setSearchingContacts(true);
    try {
      const response = await fetch(`/api/view?table=Personal&view=Grid view`);
      const result = await response.json();

      if (result.success && result.data) {
        const filtered = result.data.records.filter((record: ContactRecord) => {
          const fullName = (record.fields["Full Name"] || "").toLowerCase();
          const email = (record.fields["Email"] || "").toLowerCase();
          const search = contactSearchTerm.toLowerCase();
          return fullName.includes(search) || email.includes(search);
        });

        setContactSearchResults(filtered);
      }
    } catch (err) {
      console.error("Error searching contacts:", err);
    } finally {
      setSearchingContacts(false);
    }
  };

  const handleAddContact = (contact: ContactRecord, isPrimary: boolean = false) => {
    // Check if already added
    if (selectedContacts.some(c => c.contactId === contact.id)) {
      setError("This contact is already added");
      return;
    }

    // If setting as primary, remove primary from others
    const updatedContacts = isPrimary
      ? selectedContacts.map(c => ({ ...c, isPrimary: false }))
      : selectedContacts;

    setSelectedContacts([
      ...updatedContacts,
      {
        contactId: contact.id,
        contactName: contact.fields["Full Name"] || "",
        role: "",
        isPrimary,
        workEmail: contact.fields["Email"] || "",
        workPhone: contact.fields["📞Phone number"] || contact.fields["Phone"] || "",
        department: ""
      }
    ]);

    setContactSearchResults([]);
    setContactSearchTerm("");
  };

  const handleRemoveContact = (contactId: string) => {
    setSelectedContacts(selectedContacts.filter(c => c.contactId !== contactId));
  };

  const handleSetPrimaryContact = (contactId: string) => {
    setSelectedContacts(
      selectedContacts.map(c => ({
        ...c,
        isPrimary: c.contactId === contactId
      }))
    );
  };

  const handleUpdateContactRole = (contactId: string, role: string) => {
    setSelectedContacts(
      selectedContacts.map(c =>
        c.contactId === contactId ? { ...c, role } : c
      )
    );
  };

  const handleSave = async () => {
    // Validation
    if (!formData.companyName.trim()) {
      setError("Company name is required");
      return;
    }

    if (!formData.ein.trim()) {
      setError("EIN is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Step 1: Create or update the company
      const companyData: any = {
        Company: formData.companyName,
        EIN: formData.ein
      };

      // Only add optional fields if they have values
      if (formData.address) companyData.ADDRESS = formData.address;
      if (formData.city) companyData.CITY = formData.city;
      if (formData.state) companyData.STATE = formData.state;
      if (formData.zip) companyData["ZIP CODE"] = formData.zip;
      if (formData.phone) companyData.Phone = formData.phone;
      if (formData.email) companyData["🤷‍♂️Email"] = formData.email;
      if (formData.entityType) companyData["Type of Entity"] = formData.entityType;
      if (formData.dateIncorporated) companyData["Date Incorporated"] = formData.dateIncorporated;
      if (formData.fiscalYearEnd) companyData["Fiscal Year End"] = formData.fiscalYearEnd;
      if (formData.industry) companyData.Industry = formData.industry;
      if (formData.website) companyData.Website = formData.website;
      if (formData.notes) companyData.Notes = formData.notes;

      let companyId: string;

      if (isNewCompany) {
        // Create new company
        const response = await fetch(`${apiUrl}/api/view/Corporations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: companyData })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        companyId = result.data.id;
        setSelectedCompany(result.data);
        setIsNewCompany(false);
      } else {
        // Update existing company
        if (!selectedCompany) throw new Error("No company selected");

        const response = await fetch(`${apiUrl}/api/view/Corporations/${selectedCompany.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: companyData })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        companyId = selectedCompany.id;
      }

      // Step 2: Handle company-contact relationships
      if (selectedContacts.length > 0) {
        // Get existing relationships
        const existingResponse = await fetch(`${apiUrl}/api/company-contacts/company/${companyId}/contacts`);
        const existingResult = await existingResponse.json();
        const existingContactIds = new Set(
          existingResult.success && existingResult.contacts
            ? existingResult.contacts.map((c: any) => c.contactId)
            : []
        );

        // Only create relationships for contacts that don't already exist
        for (const contact of selectedContacts) {
          if (!existingContactIds.has(contact.contactId)) {
            try {
              const contactResponse = await fetch(`${apiUrl}/api/company-contacts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contactId: contact.contactId,
                  companyId: companyId,
                  role: contact.role,
                  isPrimary: contact.isPrimary,
                  workEmail: contact.workEmail,
                  workPhone: contact.workPhone,
                  department: contact.department
                })
              });

              const contactResult = await contactResponse.json();
              if (!contactResult.success && !contactResult.error?.includes('already exists')) {
                console.warn(`Failed to create relationship for contact ${contact.contactId}:`, contactResult.error);
              }
            } catch (err) {
              console.warn(`Error creating relationship for contact ${contact.contactId}:`, err);
              // Continue with other contacts
            }
          } else {
            console.log(`Relationship already exists for contact ${contact.contactId}, skipping...`);
          }
        }
      }

      setSuccessMessage(
        isNewCompany
          ? "Company created successfully!"
          : "Company updated successfully!"
      );

      // Redirect to company view or stay on page
      setTimeout(() => {
        router.push(`/corporate-client-intake?id=${companyId}`);
      }, 1500);

    } catch (err) {
      console.error("Error saving company:", err);
      setError(err instanceof Error ? err.message : "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const handleNewCompany = () => {
    setIsNewCompany(true);
    setSelectedCompany(null);
    setSelectedContacts([]);
    setFormData({
      companyName: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      phone: "",
      email: "",
      entityType: "",
      dateIncorporated: "",
      fiscalYearEnd: "",
      industry: "",
      website: "",
      notes: ""
    });
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleAddToPipeline = async () => {
    if (!selectedCompany) {
      setError("Please save the company first before adding to pipeline");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setAddingToPipeline(true);

      // First, fetch all services from Services Corporate to find the service ID
      const servicesResponse = await fetch(`/api/services`);
      const servicesData = await servicesResponse.json();

      if (!servicesData.success) {
        throw new Error("Failed to fetch services");
      }

      // Find the selected service
      const selectedServiceRecord = servicesData.data?.services?.find(
        (service: any) => service.name === selectedService
      );

      if (!selectedServiceRecord) {
        setError(
          `${selectedService} service not found in Services Corporate table. Please create it first.`
        );
        setTimeout(() => setError(null), 5000);
        setAddingToPipeline(false);
        return;
      }

      // Refresh pipeline data to get latest subscriptions
      const latestPipelineResponse = await fetch(`/api/subscriptions-corporate`);
      const latestPipelineData = await latestPipelineResponse.json();
      const currentSubscriptions = latestPipelineData.success ? latestPipelineData.data : [];

      console.log('Checking for existing subscription:', {
        companyId: selectedCompany.id,
        serviceId: selectedServiceRecord.id,
        serviceName: selectedService,
        totalSubscriptions: currentSubscriptions.length
      });

      // Check if company is already subscribed to THIS specific service
      const existingSubscription = currentSubscriptions.find((subscription: any) => {
        const companyIds = subscription.fields["Customer"];
        const companyIdArray = Array.isArray(companyIds) ? companyIds : [companyIds];
        const serviceIds = subscription.fields["Services"];
        const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];

        const matches = companyIdArray.includes(selectedCompany.id) &&
               serviceIdArray.includes(selectedServiceRecord.id);

        if (companyIdArray.includes(selectedCompany.id)) {
          console.log('Found subscription for this company:', {
            subscriptionId: subscription.id,
            companyIds,
            serviceIds,
            matchesService: serviceIdArray.includes(selectedServiceRecord.id)
          });
        }

        return matches;
      });

      if (existingSubscription) {
        const addedDate = existingSubscription.createdTime
          ? new Date(existingSubscription.createdTime).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Unknown date";

        setError(
          `⚠️ Company "${formData.companyName}" is already subscribed to ${selectedService}. Originally added on: ${addedDate}`
        );
        setTimeout(() => setError(null), 6000);
        setAddingToPipeline(false);
        return;
      }

      // Create the junction record in Subscriptions Corporate
      const subscriptionResponse = await fetch(`/api/subscriptions-corporate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          corporateId: selectedCompany.id,
          serviceId: selectedServiceRecord.id,
        }),
      });

      const subscriptionData = await subscriptionResponse.json();

      if (!subscriptionData.success) {
        throw new Error(
          subscriptionData.error || "Failed to create subscription"
        );
      }

      // Refresh pipeline data
      const pipelineResponse = await fetch(`/api/subscriptions-corporate`);
      const pipelineData = await pipelineResponse.json();

      if (pipelineData.success) {
        setPipelineCompanies(pipelineData.data);
      }

      setSuccessMessage(
        `✅ Company "${formData.companyName}" has been successfully added to ${selectedService}!`
      );
      setTimeout(() => setSuccessMessage(null), 5000);

    } catch (err) {
      console.error("Error adding to pipeline:", err);
      setError(err instanceof Error ? err.message : "Failed to add company to pipeline");
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingToPipeline(false);
    }
  };

  // Form sections
  const formSections = [
    { id: "company-info", label: "Company Information", icon: "🏢" },
    { id: "contact-info", label: "Contact Details", icon: "📞" },
    { id: "business-info", label: "Business Details", icon: "📋" },
    { id: "representatives", label: "Company Representatives", icon: "👥" },
  ];

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
                Corporate Client Intake
              </h1>
              <p className="text-base-content/70 mt-2">
                {isNewCompany ? "Create new corporate client" : "Update corporate client information"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/corporate-services-pipeline" className="btn btn-accent btn-sm">
                🏦 View Pipeline
              </Link>
              <button onClick={handleNewCompany} className="btn btn-primary btn-sm">
                + New Company
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Search/Select Company Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl sticky top-4">
              <div className="card-body">
                <h3 className="card-title text-lg">Find Company</h3>

                <div className="form-control">
                  <input
                    type="text"
                    placeholder="Company name or EIN"
                    className="input input-bordered"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="btn btn-primary btn-sm"
                >
                  {loading ? <span className="loading loading-spinner loading-sm"></span> : "Search"}
                </button>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((company) => (
                      <div
                        key={company.id}
                        onClick={() => handleSelectCompany(company)}
                        className="p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
                      >
                        <p className="font-medium text-sm">
                          {company.fields["Company"] || company.fields["Company Name"]}
                        </p>
                        <p className="text-xs text-base-content/60">
                          EIN: {company.fields["EIN"]}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedCompany && (
                  <div className="alert alert-info mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className="text-xs">
                      Editing: {selectedCompany.fields["Company"] || selectedCompany.fields["Company Name"]}
                    </span>
                  </div>
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

                {/* Company Information Section */}
                {activeSection === "company-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">🏢 Company Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Company Name <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="ABC Corporation"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">EIN (Employer Identification Number) <span className="text-error">*</span></span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.ein}
                          onChange={(e) => setFormData({ ...formData, ein: e.target.value })}
                          placeholder="XX-XXXXXXX"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Type of Entity</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={formData.entityType}
                          onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                        >
                          <option value="">Select entity type</option>
                          <option value="C Corporation">C Corporation</option>
                          <option value="S Corporation">S Corporation</option>
                          <option value="LLC">LLC</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Sole Proprietorship">Sole Proprietorship</option>
                          <option value="Non-Profit">Non-Profit</option>
                        </select>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Date Incorporated</span>
                        </label>
                        <input
                          type="date"
                          className="input input-bordered"
                          value={formData.dateIncorporated}
                          onChange={(e) => setFormData({ ...formData, dateIncorporated: e.target.value })}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Fiscal Year End</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.fiscalYearEnd}
                          onChange={(e) => setFormData({ ...formData, fiscalYearEnd: e.target.value })}
                          placeholder="12/31 or MM/DD"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Details Section */}
                {activeSection === "contact-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">📞 Contact Details</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Address</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="123 Main Street"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">City</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">State</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          maxLength={2}
                          placeholder="CA"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">ZIP Code</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.zip}
                          onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Phone</span>
                        </label>
                        <input
                          type="tel"
                          className="input input-bordered"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Email</span>
                        </label>
                        <input
                          type="email"
                          className="input input-bordered"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Business Details Section */}
                {activeSection === "business-info" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">📋 Business Details</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Industry</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          placeholder="e.g., Technology, Retail, Healthcare"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Website</span>
                        </label>
                        <input
                          type="url"
                          className="input input-bordered"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>

                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Notes</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered h-32"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Additional information about the company..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Company Representatives Section */}
                {activeSection === "representatives" && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold">👥 Company Representatives</h2>
                    <p className="text-base-content/70">
                      Link existing contacts from the Personal table to this company
                    </p>

                    {/* Search Contacts */}
                    <div className="card bg-base-200">
                      <div className="card-body">
                        <h3 className="font-semibold">Add Representative</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Search by name or email"
                            className="input input-bordered flex-1"
                            value={contactSearchTerm}
                            onChange={(e) => setContactSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearchContacts()}
                          />
                          <button
                            onClick={handleSearchContacts}
                            disabled={searchingContacts}
                            className="btn btn-primary"
                          >
                            {searchingContacts ? <span className="loading loading-spinner loading-sm"></span> : "Search"}
                          </button>
                        </div>

                        {/* Contact Search Results */}
                        {contactSearchResults.length > 0 && (
                          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                            {contactSearchResults.map((contact) => (
                              <div
                                key={contact.id}
                                className="flex items-center justify-between p-3 bg-base-100 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{contact.fields["Full Name"]}</p>
                                  <p className="text-sm text-base-content/60">{contact.fields["Email"]}</p>
                                </div>
                                <button
                                  onClick={() => handleAddContact(contact)}
                                  className="btn btn-sm btn-primary"
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Contacts */}
                    {selectedContacts.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold">Selected Representatives ({selectedContacts.length})</h3>
                        {selectedContacts.map((contact) => (
                          <div key={contact.contactId} className="card bg-base-200">
                            <div className="card-body p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{contact.contactName}</p>
                                    {contact.isPrimary && (
                                      <span className="badge badge-primary badge-sm">Primary</span>
                                    )}
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div className="form-control">
                                      <label className="label py-1">
                                        <span className="label-text text-xs">Role</span>
                                      </label>
                                      <input
                                        type="text"
                                        className="input input-bordered input-sm"
                                        value={contact.role || ""}
                                        onChange={(e) => handleUpdateContactRole(contact.contactId, e.target.value)}
                                        placeholder="e.g., CEO, CFO, Owner"
                                      />
                                    </div>
                                    <div className="form-control">
                                      <label className="label py-1">
                                        <span className="label-text text-xs">Department</span>
                                      </label>
                                      <input
                                        type="text"
                                        className="input input-bordered input-sm"
                                        value={contact.department || ""}
                                        onChange={(e) => {
                                          setSelectedContacts(
                                            selectedContacts.map(c =>
                                              c.contactId === contact.contactId ? { ...c, department: e.target.value } : c
                                            )
                                          );
                                        }}
                                        placeholder="e.g., Finance, Operations"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {!contact.isPrimary && (
                                    <button
                                      onClick={() => handleSetPrimaryContact(contact.contactId)}
                                      className="btn btn-xs btn-ghost"
                                    >
                                      Set Primary
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRemoveContact(contact.contactId)}
                                    className="btn btn-xs btn-error"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedContacts.length === 0 && (
                      <div className="alert">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>No representatives added yet. Search and add contacts above.</span>
                      </div>
                    )}
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
                          {isNewCompany ? "Create Company" : "Update Company"}
                        </>
                      )}
                    </button>

                    {!isNewCompany && selectedCompany && (
                      <div className="flex gap-2 items-center">
                        <select
                          value={selectedService}
                          onChange={(e) => setSelectedService(e.target.value)}
                          className="select select-bordered"
                          disabled={addingToPipeline}
                        >
                          {services.map((service) => (
                            <option key={service} value={service}>
                              {service}
                            </option>
                          ))}
                        </select>
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
                              🏦 Add to Service
                            </>
                          )}
                        </button>
                      </div>
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
