/**
 * Airtable Service
 * Centralized service for all Airtable operations
 */

import Airtable from "airtable";

// Validate environment variables
function validateEnvironment() {
  if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    throw new Error(
      "AIRTABLE_PERSONAL_ACCESS_TOKEN is required. Please set it in your .env file."
    );
  }
  if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error(
      "AIRTABLE_BASE_ID is required. Please set it in your .env file."
    );
  }
}

/**
 * Get configured Airtable instance
 */
export function getAirtable() {
  validateEnvironment();
  return new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
  });
}

/**
 * Get configured Airtable base
 */
export function getBase() {
  const airtable = getAirtable();
  return airtable.base(process.env.AIRTABLE_BASE_ID || "");
}

/**
 * Get table instance from base
 */
export function getTable(tableName: string) {
  const base = getBase();
  return base(tableName);
}

// Type definitions
export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

export interface SelectOptions {
  view?: string;
  maxRecords?: number;
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
  filterByFormula?: string;
}

/**
 * Fetch all records from a table with pagination support
 */
export async function fetchRecords(
  tableName: string,
  options: SelectOptions = {}
): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const records: AirtableRecord[] = [];

    // Build select options
    const selectOptions: any = {
      view: options.view || "Grid view",
    };

    if (options.maxRecords && options.maxRecords > 0) {
      selectOptions.maxRecords = options.maxRecords;
    }

    if (options.sort) {
      selectOptions.sort = options.sort;
    }

    if (options.filterByFormula) {
      selectOptions.filterByFormula = options.filterByFormula;
    }

    await table.select(selectOptions).eachPage((pageRecords, fetchNextPage) => {
      pageRecords.forEach((record) => {
        records.push({
          id: record.id,
          fields: record.fields,
          createdTime: record._rawJson.createdTime,
        });
      });

      if (records.length % 100 === 0) {
        console.log(
          `Fetched ${records.length} records so far from ${tableName}...`
        );
      }

      fetchNextPage();
    });

    console.log(`Total records fetched from ${tableName}: ${records.length}`);
    return records;
  } catch (error) {
    console.error(`Error fetching records from table ${tableName}:`, error);
    if (error instanceof Error && error.message.includes("NOT_FOUND")) {
      throw new Error(
        `Table "${tableName}" not found. Please check the table name.`
      );
    }
    throw error;
  }
}

/**
 * Find a single record by ID
 */
export async function findRecord(
  tableName: string,
  recordId: string
): Promise<AirtableRecord> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const record = await table.find(recordId);

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime,
    };
  } catch (error) {
    console.error(
      `Error finding record ${recordId} in table ${tableName}:`,
      error
    );
    throw error;
  }
}

/**
 * Create new records in a table
 */
export async function createRecords(
  tableName: string,
  records: Array<{ fields: Record<string, any> }>
): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const createdRecords = await table.create(records);

    return createdRecords.map((record) => ({
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime,
    }));
  } catch (error) {
    console.error(`Error creating records in table ${tableName}:`, error);
    throw error;
  }
}

/**
 * Update existing records in a table
 */
export async function updateRecords(
  tableName: string,
  records: Array<{ id: string; fields: Record<string, any> }>
): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const updatedRecords = await table.update(records);

    return updatedRecords.map((record) => ({
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime,
    }));
  } catch (error) {
    console.error(`Error updating records in table ${tableName}:`, error);
    throw error;
  }
}

/**
 * Delete records from a table
 */
export async function deleteRecords(
  tableName: string,
  recordIds: string[]
): Promise<{ id: string; deleted: boolean }[]> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const deletedRecords = await table.destroy(recordIds);

    return deletedRecords.map((record) => ({
      id: record.id,
      deleted: true,
    }));
  } catch (error) {
    console.error(`Error deleting records from table ${tableName}:`, error);
    throw error;
  }
}

/**
 * Find first page of records matching a filter
 */
export async function findRecordsByFilter(
  tableName: string,
  filterByFormula: string
): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();

    const table = getTable(tableName);
    const records = await table.select({ filterByFormula }).firstPage();

    return records.map((record) => ({
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime,
    }));
  } catch (error) {
    console.error(
      `Error finding records in table ${tableName} with filter:`,
      error
    );
    throw error;
  }
}

/**
 * Test connection to Airtable
 */
export async function testConnection() {
  try {
    validateEnvironment();

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Invalid Personal Access Token. Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN."
        );
      }
      if (response.status === 404) {
        throw new Error("Base not found. Please check your AIRTABLE_BASE_ID.");
      }
      throw new Error(`Connection failed: ${response.statusText}`);
    }

    return { success: true, message: "Connection successful" };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown connection error",
    };
  }
}

// Type definitions for base schema
export interface Table {
  id: string;
  name: string;
  fields?: any[];
}

interface BaseSchemaResponse {
  tables: Table[];
}

/**
 * Get base schema using Airtable Web API
 */
export async function getBaseSchema(): Promise<Table[]> {
  try {
    validateEnvironment();

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch base schema: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;

    // runtime guard to ensure shape matches expectations
    if (
      !data ||
      typeof data !== "object" ||
      !("tables" in data) ||
      !Array.isArray((data as any).tables)
    ) {
      throw new Error("Invalid response format for base schema");
    }

    return (data as BaseSchemaResponse).tables;
  } catch (error) {
    console.error("Error fetching base schema:", error);
    throw error;
  }
}

/**
 * Get all tables metadata
 */
export async function getTablesMetadata() {
  try {
    const tables = await getBaseSchema();
    return tables.map((table: any) => ({
      id: table.id,
      name: table.name,
      fields: table.fields || [],
    }));
  } catch (error) {
    console.error("Error getting tables metadata:", error);
    throw error;
  }
}

/**
 * Analyze table data and create summary statistics
 */
export function analyzeTableData(records: AirtableRecord[]) {
  const totalRecords = records.length;
  const fields = records.length > 0 ? Object.keys(records[0].fields) : [];

  // Basic statistics
  const stats = {
    totalRecords,
    fields,
    fieldCount: fields.length,
    recentRecords: records
      .sort(
        (a, b) =>
          new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
      )
      .slice(0, 5),
  };

  // Field type analysis
  const fieldTypes: Record<string, string> = {};
  if (records.length > 0) {
    fields.forEach((field) => {
      const sampleValue = records[0].fields[field];
      if (Array.isArray(sampleValue)) {
        fieldTypes[field] = "array";
      } else if (sampleValue instanceof Date) {
        fieldTypes[field] = "date";
      } else if (typeof sampleValue === "number") {
        fieldTypes[field] = "number";
      } else if (typeof sampleValue === "boolean") {
        fieldTypes[field] = "boolean";
      } else if (sampleValue && typeof sampleValue === "object") {
        fieldTypes[field] = "object";
      } else {
        fieldTypes[field] = "text";
      }
    });
  }

  return { ...stats, fieldTypes };
}
