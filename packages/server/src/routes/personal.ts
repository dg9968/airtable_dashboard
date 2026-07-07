/**
 * Personal API Routes (Postgres-backed)
 *
 * Handles personal table operations for client intake. Responses keep the
 * legacy Airtable record shape ({ id, fields, createdTime }) via serializers.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { personal } from "../db/schema";
import {
  personalToAirtableRecord,
  personalFieldsToColumns,
  loadPersonalRelationships,
  computeClientCode,
} from "../db/serializers";
import {
  findPersonBySSN,
  createSpouseRecord,
  linkSpouses,
  createDependentRecord,
  linkDependent,
  validateUniqueFamilySSN,
  parseName,
  type FamilyMemberData,
  type DependentData,
} from "../lib/family-record-helpers";
import { generateUniqueClientCode } from "../utils/helpers";

const app = new Hono();

/** Fetch all personal rows and serialize to the legacy record shape. */
async function fetchAllAsRecords() {
  const db = getDb();
  const rows = await db.select().from(personal);
  const { relMap, lookup } = await loadPersonalRelationships(db);
  return rows.map((row) => personalToAirtableRecord(row, relMap.get(row.id), lookup));
}

/**
 * GET /api/personal
 * Fetch all personal records
 */
app.get("/", async (c) => {
  try {
    const records = await fetchAllAsRecords();

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching personal records:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch personal records",
      },
      500
    );
  }
});

/**
 * GET /api/personal/search?q=searchTerm
 * Search personal records by name, SSN (last 4), email, or phone
 */
app.get("/search", async (c) => {
  try {
    const searchTerm = c.req.query("q")?.toLowerCase() || "";

    if (!searchTerm || searchTerm.length < 2) {
      return c.json({
        success: true,
        data: [],
      });
    }

    // Same in-memory filter semantics as before (searchable text spans
    // several fields, including SSN last-4 and spouse name).
    const allRecords = await fetchAllAsRecords();

    const records = allRecords.filter((record) => {
      const fields = record.fields as Record<string, any>;
      const searchableText = [
        fields["Full Name"],
        fields["First Name"],
        fields["Last Name"],
        fields["Email"],
        fields["📞Phone number"],
        fields["SSN"]?.slice(-4), // Last 4 of SSN only
        fields["Spouse Name"],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Error searching personal records:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search personal records",
      },
      500
    );
  }
});

/**
 * GET /api/personal/generate-code
 * Generate a unique 6-digit client code
 */
app.get("/generate-code", async (c) => {
  try {
    const code = await generateUniqueClientCode();

    return c.json({
      success: true,
      code,
    });
  } catch (error) {
    console.error("Error generating unique client code:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate unique client code",
      },
      500
    );
  }
});

/**
 * GET /api/personal/:id
 * Fetch a single personal record by ID
 */
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const db = getDb();

    const [row] = await db.select().from(personal).where(eq(personal.id, id)).limit(1);

    if (!row) {
      return c.json({ success: false, error: "Record not found" }, 404);
    }

    const { relMap, lookup } = await loadPersonalRelationships(db, [id]);

    return c.json({
      success: true,
      data: personalToAirtableRecord(row, relMap.get(id), lookup),
    });
  } catch (error) {
    console.error("Error fetching personal record:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch personal record",
      },
      500
    );
  }
});

/** Shared spouse/dependent processing for POST and PATCH. */
async function processFamily(
  primaryId: string,
  fields: Record<string, any>,
  spouse: any,
  dependents: any[],
  spouseSameAddress: boolean
) {
  // Handle spouse creation and linking
  let spouseResult = null;
  if (spouse && spouse.name && spouse.ssn && spouse.dob) {
    console.log("Processing spouse creation/linking...");

    const existingSpouse = await findPersonBySSN(spouse.ssn);

    if (existingSpouse) {
      console.log(`Found existing spouse record: ${existingSpouse.id}`);
      const linkResult = await linkSpouses(primaryId, existingSpouse.id);
      spouseResult = {
        ...linkResult,
        recordId: existingSpouse.id,
        existing: true,
      };
    } else {
      console.log("Creating new spouse record...");
      const nameData = parseName(spouse.name);
      const spouseData: FamilyMemberData = {
        firstName: nameData.firstName,
        lastName: nameData.lastName,
        ssn: spouse.ssn,
        dob: spouse.dob,
        occupation: spouse.occupation,
        driverLicense: spouse.driverLicense,
      };

      if (spouseSameAddress) {
        spouseData.address = fields["Mailing Address"];
        spouseData.city = fields.City;
        spouseData.state = fields.State;
        spouseData.zip = fields.ZIP;
        spouseData.phone = fields["📞Phone number"];
        spouseData.email = fields.Email;
      }

      const createResult = await createSpouseRecord(
        spouseData,
        String(fields["Tax Year"] || new Date().getFullYear())
      );

      if (createResult.success && createResult.recordId) {
        const linkResult = await linkSpouses(primaryId, createResult.recordId);
        spouseResult = {
          ...linkResult,
          recordId: createResult.recordId,
          existing: false,
        };
      } else {
        spouseResult = createResult;
      }
    }
  }

  // Handle dependents creation and linking
  const dependentResults = [];
  if (dependents && dependents.length > 0) {
    console.log(`Processing ${dependents.length} dependent(s)...`);

    for (const dep of dependents) {
      if (!dep.name || !dep.ssn || !dep.dob) {
        console.log("Skipping incomplete dependent");
        continue;
      }

      const existingDependent = await findPersonBySSN(dep.ssn);

      if (existingDependent) {
        console.log(`Found existing dependent record: ${existingDependent.id}`);
        const linkResult = await linkDependent(
          primaryId,
          existingDependent.id,
          dep.relationshipType || "Other Dependent"
        );
        dependentResults.push({
          ...linkResult,
          recordId: existingDependent.id,
          existing: true,
        });
      } else {
        console.log("Creating new dependent record...");
        const nameData = parseName(dep.name);
        const dependentData: DependentData = {
          firstName: nameData.firstName,
          lastName: nameData.lastName,
          ssn: dep.ssn,
          dob: dep.dob,
          relationshipType: dep.relationshipType || "Other Dependent",
        };

        dependentData.address = fields["Mailing Address"];
        dependentData.city = fields.City;
        dependentData.state = fields.State;
        dependentData.zip = fields.ZIP;

        const createResult = await createDependentRecord(
          dependentData,
          String(fields["Tax Year"] || new Date().getFullYear())
        );

        if (createResult.success && createResult.recordId) {
          const linkResult = await linkDependent(
            primaryId,
            createResult.recordId,
            dep.relationshipType || "Other Dependent"
          );
          dependentResults.push({
            ...linkResult,
            recordId: createResult.recordId,
            existing: false,
          });
        } else {
          dependentResults.push(createResult);
        }
      }
    }
  }

  return { spouseResult, dependentResults };
}

/** Serialize a personal row (with fresh relationships) to the legacy shape. */
async function serializeOne(id: string) {
  const db = getDb();
  const [row] = await db.select().from(personal).where(eq(personal.id, id)).limit(1);
  if (!row) return null;
  const { relMap, lookup } = await loadPersonalRelationships(db, [id]);
  return personalToAirtableRecord(row, relMap.get(id), lookup);
}

/**
 * POST /api/personal
 * Create a new personal record with optional spouse and dependents
 */
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const fields = body.fields;
    const spouse = body.spouse;
    const dependents = body.dependents || [];
    const spouseSameAddress = body.spouseSameAddress !== false; // Default to true

    // Validate unique SSNs across family if spouse or dependents provided
    if (spouse || (dependents && dependents.length > 0)) {
      const validation = validateUniqueFamilySSN(
        fields.SSN,
        spouse?.ssn,
        dependents.map((d: any) => d.ssn)
      );

      if (!validation.valid) {
        return c.json(
          {
            success: false,
            errors: validation.errors,
          },
          400
        );
      }
    }

    const values = personalFieldsToColumns(fields);

    // Generate unique 6-digit client code for new clients
    if (!values.clientCodeOverride) {
      const uniqueCode = await generateUniqueClientCode();
      values.clientCodeOverride = uniqueCode;
      console.log("Generated unique client code:", uniqueCode);
    }
    values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ssn ?? null);

    console.log("Creating personal record with columns:", Object.keys(values));

    const [row] = await getDb().insert(personal).values(values).returning();
    const primaryId = row.id;

    const { spouseResult, dependentResults } = await processFamily(
      primaryId,
      fields,
      spouse,
      dependents,
      spouseSameAddress
    );

    const primaryRecord = await serializeOne(primaryId);

    return c.json({
      success: true,
      data: {
        primary: primaryRecord,
        spouse: spouseResult,
        dependents: dependentResults,
      },
    });
  } catch (error) {
    console.error("Error creating personal record:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : error
    );
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create personal record",
      },
      500
    );
  }
});

/**
 * PATCH /api/personal/:id
 * Update a personal record with optional spouse and dependents
 */
app.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const fields = body.fields;
    const spouse = body.spouse;
    const dependents = body.dependents || [];
    const spouseSameAddress = body.spouseSameAddress !== false; // Default to true

    // Validate unique SSNs across family if spouse or dependents provided
    if (spouse || (dependents && dependents.length > 0)) {
      const validation = validateUniqueFamilySSN(
        fields.SSN || "",
        spouse?.ssn,
        dependents.map((d: any) => d.ssn)
      );

      if (!validation.valid) {
        return c.json(
          {
            success: false,
            errors: validation.errors,
          },
          400
        );
      }
    }

    const values = personalFieldsToColumns(fields);

    const db = getDb();
    const [existing] = await db.select().from(personal).where(eq(personal.id, id)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: "Record not found" }, 404);
    }

    // Recompute the materialized client code with the post-update values
    const override = (values.clientCodeOverride ?? existing.clientCodeOverride) || null;
    const ssn = (values.ssn ?? existing.ssn) || null;
    values.clientCode = computeClientCode(override, ssn);

    console.log("Updating personal record:", id);
    console.log("Updated columns:", Object.keys(values));

    await db.update(personal).set(values).where(eq(personal.id, id));

    const { spouseResult, dependentResults } = await processFamily(
      id,
      fields,
      spouse,
      dependents,
      spouseSameAddress
    );

    const primaryRecord = await serializeOne(id);

    return c.json({
      success: true,
      data: {
        primary: primaryRecord,
        spouse: spouseResult,
        dependents: dependentResults,
      },
    });
  } catch (error) {
    console.error("Error updating personal record:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : error
    );
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update personal record",
      },
      500
    );
  }
});

/**
 * DELETE /api/personal/:id
 * Delete a personal record
 */
app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    await getDb().delete(personal).where(eq(personal.id, id));

    return c.json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting personal record:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete personal record",
      },
      500
    );
  }
});

export default app;
