/**
 * Companies Routes (Postgres-backed)
 * Manage company/corporate entities
 */

import { Hono } from "hono";
import { eq, ilike, or } from "drizzle-orm";
import { getDb } from "../db/client";
import { corporations } from "../db/schema";
import {
  corporationToAirtableRecord,
  corporationFieldsToColumns,
  computeClientCode,
} from "../db/serializers";
import { generateUniqueClientCode } from "../utils/helpers";

const app = new Hono();

type CorporationRow = typeof corporations.$inferSelect;

function mapRowToCompany(row: CorporationRow) {
  return {
    id: row.id,
    clientCode: row.clientCode ?? undefined,
    name: row.company || "Unnamed Company",
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    registeredAgent: row.registeredAgent ?? undefined,
    taxId: row.ein ?? undefined,
    status: "Active", // legacy Status field never held data in Airtable
    entityNumber: row.entityNumber || row.sunbizDocumentNumber || undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zipCode: row.zip ?? undefined,
  };
}

/**
 * GET /api/companies
 * Get all companies
 */
app.get("/", async (c) => {
  try {
    const rows = await getDb().select().from(corporations);

    const companies = rows.map(mapRowToCompany);

    return c.json({
      success: true,
      data: companies,
      count: companies.length,
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch companies",
        suggestion: "Check the database connection and try again",
        data: [],
      },
      500
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

    const searchTerm = `%${query.trim()}%`;

    const rows = await getDb()
      .select()
      .from(corporations)
      .where(
        or(
          ilike(corporations.company, searchTerm),
          ilike(corporations.ein, searchTerm),
          ilike(corporations.entityNumber, searchTerm),
          ilike(corporations.sunbizDocumentNumber, searchTerm),
          ilike(corporations.clientCode, searchTerm)
        )
      )
      .limit(50);

    console.log(`[Companies Search] Found ${rows.length} results for query: "${query.trim()}"`);

    const filteredCompanies = rows.map((row) => ({
      ...mapRowToCompany(row),
      name: row.company || "",
      clientCode: row.clientCode || "",
      ein: row.ein || "",
      taxId: row.ein || "",
      entityNumber: row.entityNumber || row.sunbizDocumentNumber || "",
    }));

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

    const [row] = await getDb()
      .select()
      .from(corporations)
      .where(eq(corporations.id, id))
      .limit(1);

    if (!row) {
      return c.json({ success: false, error: "Company not found" }, 404);
    }

    const record = corporationToAirtableRecord(row);

    return c.json({
      success: true,
      data: {
        id: row.id,
        clientCode: row.clientCode ?? undefined,
        name: row.company ?? undefined,
        email: row.email ?? undefined,
        phone: row.phone ?? undefined,
        registeredAgent: row.registeredAgent ?? undefined,
        taxId: row.ein ?? undefined,
        status: undefined,
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

    const values = corporationFieldsToColumns(fields);

    // Generate unique 6-digit client code for new corporations
    if (!values.clientCodeOverride) {
      const uniqueCode = await generateUniqueClientCode();
      values.clientCodeOverride = uniqueCode;
      console.log("Generated unique client code for corporation:", uniqueCode);
    }
    values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ein ?? null);

    console.log("Creating corporation with columns:", Object.keys(values));

    const [row] = await getDb().insert(corporations).values(values).returning();
    const record = corporationToAirtableRecord(row);

    return c.json({
      success: true,
      data: {
        id: row.id,
        clientCode: row.clientCode || values.clientCodeOverride,
        name: row.company ?? undefined,
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
