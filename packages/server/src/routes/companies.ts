/**
 * Companies Routes
 * Manage company/corporate entities
 */

import { Hono } from "hono";
import { fetchRecords, findRecord } from "../lib/airtable-service";

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

export default app;
