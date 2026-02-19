/**
 * Companies Routes
 * Manage company/corporate entities
 */

import { Hono } from "hono";
import { fetchRecords, findRecord, createRecords } from "../lib/airtable-service";
import { generateUniqueClientCode } from "../utils/helpers";

const app = new Hono();

const COMPANIES_TABLE = "Corporations"; // Using "Corporations" table in Airtable

/**
 * GET /api/companies
 * Get all companies
 */
app.get("/", async (c) => {
  try {
    const records = await fetchRecords(COMPANIES_TABLE, { view: "Grid view" });

    const companies = records.map((record, index) => {
      // Log first record to see actual field names
      if (index === 0) {
        console.log(
          "Sample company record fields:",
          Object.keys(record.fields)
        );
      }

      // Extract registered agent - it might be an object
      let registeredAgent = record.fields["Registered Agent"];
      if (registeredAgent && typeof registeredAgent === "object") {
        registeredAgent =
          registeredAgent.value ||
          registeredAgent.name ||
          JSON.stringify(registeredAgent);
      }

      return {
        id: record.id,
        clientCode: record.fields["Client Code"],
        name:
          record.fields["Company"] ||
          record.fields["Company Name"] ||
          record.fields["Name"] ||
          record.fields["Business Name"] ||
          record.fields["Legal Name"] ||
          "Unnamed Company",
        email: record.fields["🤷‍♂️Email"] || record.fields["Email"],
        phone: record.fields["Phone"],
        registeredAgent:
          typeof registeredAgent === "string" ? registeredAgent : undefined,
        taxId: record.fields["EIN"] || record.fields["Tax ID"],
        status: record.fields["Status"] || "Active",
        entityNumber: record.fields["Entity Number"] || record.fields["Business Partner Number"] || record.fields["Sunbiz Document Number"],
        address: record.fields["ADDRESS"] || record.fields["Address"],
        city: record.fields["CITY"] || record.fields["City"],
        state: record.fields["STATE"] || record.fields["State"],
        zipCode: record.fields["ZIP CODE"] || record.fields["Zip Code"] || record.fields["ZIP"],
      };
    });

    return c.json({
      success: true,
      data: companies,
      count: companies.length,
    });
  } catch (error) {
    console.error("Error fetching companies:", error);

    // Check if it's a table not found error
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch companies";
    const isNotAuthorized =
      errorMessage.includes("NOT_AUTHORIZED") ||
      errorMessage.includes("not authorized");

    return c.json(
      {
        success: false,
        error: isNotAuthorized
          ? `The "${COMPANIES_TABLE}" table does not exist in your Airtable base`
          : errorMessage,
        suggestion: isNotAuthorized
          ? `Please create a "${COMPANIES_TABLE}" table in Airtable with fields: Company Name (or Name), Company Email, Company Phone, Registered Agent, Tax ID, Status`
          : "Check your Airtable configuration and try again",
        setupRequired: isNotAuthorized,
        data: [], // Return empty array so UI doesn't break
      },
      isNotAuthorized ? 200 : 500 // Return 200 with empty data instead of error
    );
  }
});

/**
 * GET /api/companies/search
 * Search companies by name, EIN, entity number, or client code
 */
app.get("/search", async (c) => {
  try {
    const query = c.req.query("q");

    if (!query || query.trim().length < 1) {
      return c.json({
        success: true,
        data: [],
        message: "Query must be at least 1 character"
      });
    }

    const searchTerm = query.trim();

    // Use Airtable filterByFormula for server-side filtering (much faster!)
    // Using only fields that exist, with error handling for optional fields
    const filterFormula = `OR(
      FIND(LOWER("${searchTerm}"), LOWER({Company})),
      FIND(LOWER("${searchTerm}"), LOWER(CONCATENATE({EIN}))),
      FIND(LOWER("${searchTerm}"), LOWER(CONCATENATE({Entity Number}))),
      FIND(LOWER("${searchTerm}"), LOWER(CONCATENATE({Client Code})))
    )`;

    const records = await fetchRecords(COMPANIES_TABLE, {
      view: "Grid view",
      filterByFormula: filterFormula,
      maxRecords: 50, // Limit results for performance
    });

    console.log(`[Companies Search] Found ${records.length} results for query: "${searchTerm}"`);

    const filteredCompanies = records.map((record, index) => {
      // Log first record's fields to help debug
      if (index === 0) {
        console.log('[Companies Search] Sample record fields:', Object.keys(record.fields));
        console.log('[Companies Search] Sample record field values:', {
          Company: record.fields["Company"],
          'Company Name': record.fields["Company Name"],
          Name: record.fields["Name"],
          'Name ': record.fields["Name "], // Check for trailing space
        });
      }

      // Extract registered agent
      let registeredAgent = record.fields["Registered Agent"];
      if (registeredAgent && typeof registeredAgent === "object") {
        registeredAgent =
          registeredAgent.value ||
          registeredAgent.name ||
          JSON.stringify(registeredAgent);
      }

      // Try to get the company name from various possible field names
      // The primary field in Airtable is usually the first column
      const name =
        record.fields["Name "] ||  // Check with trailing space (common Airtable issue)
        record.fields["Company"] ||
        record.fields["Company Name"] ||
        record.fields["Name"] ||
        record.fields["Business Name"] ||
        record.fields["Legal Name"] ||
        "";

      const clientCode = record.fields["Client Code"] || "";
      const ein = record.fields["EIN"] || record.fields["Tax ID"] || "";
      const entityNumber =
        record.fields["Entity Number"] ||
        record.fields["Business Partner Number"] ||
        record.fields["Sunbiz Document Number"] ||
        "";

      return {
        id: record.id,
        clientCode,
        name,
        email: record.fields["🤷‍♂️Email"] || record.fields["Email"],
        phone: record.fields["Phone"],
        registeredAgent:
          typeof registeredAgent === "string" ? registeredAgent : undefined,
        taxId: ein,
        ein,
        status: record.fields["Status"] || "Active",
        entityNumber,
        address: record.fields["ADDRESS"] || record.fields["Address"],
        city: record.fields["CITY"] || record.fields["City"],
        state: record.fields["STATE"] || record.fields["State"],
        zipCode: record.fields["ZIP CODE"] || record.fields["Zip Code"] || record.fields["ZIP"],
      };
    });

    return c.json({
      success: true,
      data: filteredCompanies,
      count: filteredCompanies.length,
    });
  } catch (error) {
    console.error("Error searching companies:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      },
      500
    );
  }
});

/**
 * GET /api/companies/:id
 * Get a specific company
 */
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const record = await findRecord(COMPANIES_TABLE, id);

    // Extract registered agent - it might be an object
    let registeredAgent = record.fields["Registered Agent"];
    if (registeredAgent && typeof registeredAgent === "object") {
      registeredAgent =
        registeredAgent.value ||
        registeredAgent.name ||
        JSON.stringify(registeredAgent);
    }

    return c.json({
      success: true,
      data: {
        id: record.id,
        clientCode: record.fields["Client Code"],
        name:
          record.fields["Company"] ||
          record.fields["Company Name"] ||
          record.fields["Name"],
        email: record.fields["🤷‍♂️Email"] || record.fields["Email"],
        phone: record.fields["Phone"],
        registeredAgent:
          typeof registeredAgent === "string" ? registeredAgent : undefined,
        taxId: record.fields["EIN"] || record.fields["Tax ID"],
        status: record.fields["Status"],
        fields: record.fields,
      },
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Company not found",
      },
      404
    );
  }
});

/**
 * POST /api/companies
 * Create a new company with auto-generated unique client code
 */
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const fields = body.fields || body;

    // List of computed/formula fields that Airtable doesn't accept
    const computedFields = [
      "Client Code", // Formula field
      "Created time",
      "Last modified time",
      "Record ID",
    ];

    // Clean the fields - remove computed fields and empty values
    const cleanedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (computedFields.includes(key)) {
        continue;
      }
      if (value !== "" && value !== undefined && value !== null) {
        cleanedFields[key] = value;
      }
    }

    // Generate unique 6-digit client code for new corporations
    // This gets stored in "Client Code Override" field which the formula uses
    if (!cleanedFields["Client Code Override"]) {
      const uniqueCode = await generateUniqueClientCode();
      cleanedFields["Client Code Override"] = uniqueCode;
      console.log("Generated unique client code for corporation:", uniqueCode);
    }

    console.log(
      "Creating corporation with fields:",
      Object.keys(cleanedFields)
    );

    const records = await createRecords(COMPANIES_TABLE, [{ fields: cleanedFields }]);
    const record = records[0];

    return c.json({
      success: true,
      data: {
        id: record.id,
        clientCode: record.fields["Client Code"] || cleanedFields["Client Code Override"],
        name:
          record.fields["Company"] ||
          record.fields["Company Name"] ||
          record.fields["Name"],
        fields: record.fields,
      },
    });
  } catch (error) {
    console.error("Error creating company:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create company",
      },
      500
    );
  }
});

export default app;
