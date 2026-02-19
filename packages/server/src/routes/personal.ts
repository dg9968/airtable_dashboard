/**
 * Personal API Routes
 *
 * Handles Personal table operations for client intake
 */

import { Hono } from "hono";
import { testConnection } from "../airtable";
import { fetchAllRecords, createRecords, updateRecords, deleteRecords, getRecord } from "../lib/airtable-helpers";
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

/**
 * GET /api/personal
 * Fetch all personal records
 */
app.get("/", async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
        },
        401
      );
    }

    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await fetchAllRecords(baseId, "Personal", {
      view: "Grid view",
    });

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

    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const allRecords = await fetchAllRecords(baseId, "Personal", {
      view: "Grid view",
    });

    // Filter records based on search term
    const records = allRecords.filter((record) => {
      const fields = record.fields;
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
    const baseId = process.env.AIRTABLE_BASE_ID || "";

    const record = await getRecord(baseId, "Personal", id);

    return c.json({
      success: true,
      data: record,
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

    // List of computed/lookup fields that Airtable doesn't accept
    const computedFields = [
      "Full Name",
      "Last modified time",
      "Created time",
      "Last Modified By",
      "Created By",
      "last name first name",
      "Record ID",
      "Client Code",
      // Spouse text fields - these are legacy, we use linked records instead
      "Spouse Name",
      "Spouse SSN",
      "Spouse DOB",
      "Spouse Occupation",
      "Spouse Driver License",
      "Spouse Identity Protection PIN",
      // Spouse lookup fields
      "Spouse First Name",
      "Spouse Last Name",
    ];

    // Fields that should be numbers in Airtable
    const numericFields = ["Tax Year", "Prior Year AGI"];

    // Remove empty string values, undefined values, and computed fields
    // Airtable doesn't like empty strings for some field types
    const cleanedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      // Skip computed fields
      if (computedFields.includes(key)) {
        continue;
      }
      // Skip empty values
      if (value !== "" && value !== undefined && value !== null) {
        // Convert numeric fields from string to number
        if (numericFields.includes(key) && typeof value === "string") {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            cleanedFields[key] = numValue;
          }
        } else {
          cleanedFields[key] = value;
        }
      }
    }

    // Generate unique 6-digit client code for new clients
    // This gets stored in "Client Code Override" field which the formula uses
    if (!cleanedFields["Client Code Override"]) {
      const uniqueCode = await generateUniqueClientCode();
      cleanedFields["Client Code Override"] = uniqueCode;
      console.log("Generated unique client code:", uniqueCode);
    }

    console.log(
      "Creating personal record with fields:",
      Object.keys(cleanedFields)
    );

    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await createRecords(baseId, "Personal", [
      { fields: cleanedFields },
    ]);

    const primaryRecord = records[0];
    const primaryId = primaryRecord.id;

    // Handle spouse creation and linking
    let spouseResult = null;
    if (spouse && spouse.name && spouse.ssn && spouse.dob) {
      console.log("Processing spouse creation/linking...");

      // Check if spouse already exists
      const existingSpouse = await findPersonBySSN(spouse.ssn);

      if (existingSpouse) {
        console.log(`Found existing spouse record: ${existingSpouse.id}`);
        // Link to existing spouse
        const linkResult = await linkSpouses(primaryId, existingSpouse.id);
        spouseResult = {
          ...linkResult,
          recordId: existingSpouse.id,
          existing: true,
        };
      } else {
        console.log("Creating new spouse record...");
        // Create new spouse record
        const nameData = parseName(spouse.name);
        const spouseData: FamilyMemberData = {
          firstName: nameData.firstName,
          lastName: nameData.lastName,
          ssn: spouse.ssn,
          dob: spouse.dob,
          occupation: spouse.occupation,
          driverLicense: spouse.driverLicense,
        };

        // Copy address if spouse has same address
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
          // Link the spouse bidirectionally
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
        // Skip incomplete dependents
        if (!dep.name || !dep.ssn || !dep.dob) {
          console.log("Skipping incomplete dependent");
          continue;
        }

        // Check if dependent already exists
        const existingDependent = await findPersonBySSN(dep.ssn);

        if (existingDependent) {
          console.log(`Found existing dependent record: ${existingDependent.id}`);
          // Link to existing dependent
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
          // Create new dependent record
          const nameData = parseName(dep.name);
          const dependentData: DependentData = {
            firstName: nameData.firstName,
            lastName: nameData.lastName,
            ssn: dep.ssn,
            dob: dep.dob,
            relationshipType: dep.relationshipType || "Other Dependent",
          };

          // Copy address from primary by default
          dependentData.address = fields["Mailing Address"];
          dependentData.city = fields.City;
          dependentData.state = fields.State;
          dependentData.zip = fields.ZIP;

          const createResult = await createDependentRecord(
            dependentData,
            String(fields["Tax Year"] || new Date().getFullYear())
          );

          if (createResult.success && createResult.recordId) {
            // Link the dependent
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

    // List of computed/lookup fields that Airtable doesn't accept
    const computedFields = [
      "Full Name",
      "Last modified time",
      "Created time",
      "Last Modified By",
      "Created By",
      "last name first name",
      "Record ID",
      "Client Code",
      // Spouse text fields - these are legacy, we use linked records instead
      "Spouse Name",
      "Spouse SSN",
      "Spouse DOB",
      "Spouse Occupation",
      "Spouse Driver License",
      "Spouse Identity Protection PIN",
      // Spouse lookup fields
      "Spouse First Name",
      "Spouse Last Name",
    ];

    // Fields that should be numbers in Airtable
    const numericFields = ["Tax Year", "Prior Year AGI"];

    // Remove empty string values, undefined values, and computed fields
    // Airtable doesn't like empty strings for some field types
    const cleanedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      // Skip computed fields
      if (computedFields.includes(key)) {
        continue;
      }
      // Skip empty values
      if (value !== "" && value !== undefined && value !== null) {
        // Convert numeric fields from string to number
        if (numericFields.includes(key) && typeof value === "string") {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            cleanedFields[key] = numValue;
          }
        } else {
          cleanedFields[key] = value;
        }
      }
    }

    console.log("Updating personal record:", id);
    console.log("Cleaned fields:", Object.keys(cleanedFields));

    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await updateRecords(baseId, "Personal", [
      {
        id,
        fields: cleanedFields,
      },
    ]);

    const primaryRecord = records[0];

    // Handle spouse creation and linking (same logic as POST)
    let spouseResult = null;
    if (spouse && spouse.name && spouse.ssn && spouse.dob) {
      console.log("Processing spouse update/creation...");

      // Check if spouse already exists
      const existingSpouse = await findPersonBySSN(spouse.ssn);

      if (existingSpouse) {
        console.log(`Found existing spouse record: ${existingSpouse.id}`);
        // Link to existing spouse
        const linkResult = await linkSpouses(id, existingSpouse.id);
        spouseResult = {
          ...linkResult,
          recordId: existingSpouse.id,
          existing: true,
        };
      } else {
        console.log("Creating new spouse record...");
        // Create new spouse record
        const nameData = parseName(spouse.name);
        const spouseData: FamilyMemberData = {
          firstName: nameData.firstName,
          lastName: nameData.lastName,
          ssn: spouse.ssn,
          dob: spouse.dob,
          occupation: spouse.occupation,
          driverLicense: spouse.driverLicense,
        };

        // Copy address if spouse has same address
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
          // Link the spouse bidirectionally
          const linkResult = await linkSpouses(id, createResult.recordId);
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

    // Handle dependents creation and linking (same logic as POST)
    const dependentResults = [];
    if (dependents && dependents.length > 0) {
      console.log(`Processing ${dependents.length} dependent(s)...`);

      for (const dep of dependents) {
        // Skip incomplete dependents
        if (!dep.name || !dep.ssn || !dep.dob) {
          console.log("Skipping incomplete dependent");
          continue;
        }

        // Check if dependent already exists
        const existingDependent = await findPersonBySSN(dep.ssn);

        if (existingDependent) {
          console.log(`Found existing dependent record: ${existingDependent.id}`);
          // Link to existing dependent
          const linkResult = await linkDependent(
            id,
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
          // Create new dependent record
          const nameData = parseName(dep.name);
          const dependentData: DependentData = {
            firstName: nameData.firstName,
            lastName: nameData.lastName,
            ssn: dep.ssn,
            dob: dep.dob,
            relationshipType: dep.relationshipType || "Other Dependent",
          };

          // Copy address from primary by default
          dependentData.address = fields["Mailing Address"];
          dependentData.city = fields.City;
          dependentData.state = fields.State;
          dependentData.zip = fields.ZIP;

          const createResult = await createDependentRecord(
            dependentData,
            String(fields["Tax Year"] || new Date().getFullYear())
          );

          if (createResult.success && createResult.recordId) {
            // Link the dependent
            const linkResult = await linkDependent(
              id,
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
    const baseId = process.env.AIRTABLE_BASE_ID || "";

    await deleteRecords(baseId, "Personal", [id]);

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
