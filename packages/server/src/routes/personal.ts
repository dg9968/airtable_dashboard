/**
 * Personal API Routes
 *
 * Handles Personal table operations for client intake
 */

import { Hono } from "hono";
import Airtable from "airtable";
import { testConnection } from "../airtable";

const app = new Hono();

// Initialize Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || "");

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

    const records: any[] = [];

    await base("Personal")
      .select({
        view: "Grid view",
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            fields: record.fields,
            createdTime: record._rawJson.createdTime,
          });
        });
        fetchNextPage();
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

    const records: any[] = [];

    await base("Personal")
      .select({
        view: "Grid view",
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
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

          if (searchableText.includes(searchTerm)) {
            records.push({
              id: record.id,
              fields: record.fields,
              createdTime: record._rawJson.createdTime,
            });
          }
        });
        fetchNextPage();
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
    const record = await base("Personal").find(id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        fields: record.fields,
        createdTime: record._rawJson.createdTime,
      },
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
        cleanedFields[key] = value;
      }
    }

    console.log(
      "Creating personal record with fields:",
      Object.keys(cleanedFields)
    );

    const record = await base("Personal").create([
      {
        fields: cleanedFields,
      },
    ]);

    return c.json({
      success: true,
      data: {
        id: record[0].id,
        fields: record[0].fields,
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
        cleanedFields[key] = value;
      }
    }

    console.log("Updating personal record:", id);
    console.log("Cleaned fields:", Object.keys(cleanedFields));

    const record = await base("Personal").update([
      {
        id,
        fields: cleanedFields,
      },
    ]);

    return c.json({
      success: true,
      data: {
        id: record[0].id,
        fields: record[0].fields,
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
    await base("Personal").destroy([id]);

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
