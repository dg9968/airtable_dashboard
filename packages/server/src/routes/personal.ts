/**
 * Personal API Routes
 *
 * Handles Personal table operations for client intake
 */

import { Hono } from "hono";
import { testConnection } from "../airtable";
import { fetchAllRecords, createRecords, updateRecords, deleteRecords, getRecord } from "../lib/airtable-helpers";

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
 * Create a new personal record
 */
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const fields = body.fields;

    // List of computed fields that Airtable doesn't accept
    const computedFields = [
      "Full Name",
      "Last modified time",
      "Created time",
      "Last Modified By",
      "Created By",
      "last name first name",
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

    console.log(
      "Creating personal record with fields:",
      Object.keys(cleanedFields)
    );

    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const records = await createRecords(baseId, "Personal", [
      { fields: cleanedFields },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
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
 * Update a personal record
 */
app.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const fields = body.fields;

    // List of computed fields that Airtable doesn't accept
    const computedFields = [
      "Full Name",
      "Last modified time",
      "Created time",
      "Last Modified By",
      "Created By",
      "last name first name",
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

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
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
