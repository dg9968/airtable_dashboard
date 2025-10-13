// lib/airtable.ts
import Airtable from 'airtable';

// Configure Airtable with Personal Access Token
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

// Initialize base
const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

// Type definitions for Airtable records
export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

// Validate environment variables
function validateEnvironment() {
  if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN is required. Please set it in your .env.local file.');
  }
  if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error('AIRTABLE_BASE_ID is required. Please set it in your .env.local file.');
  }
}

// Test connection to Airtable
export async function testConnection() {
  try {
    validateEnvironment();
    
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Personal Access Token. Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN.');
      }
      if (response.status === 404) {
        throw new Error('Base not found. Please check your AIRTABLE_BASE_ID.');
      }
      throw new Error(`Connection failed: ${response.statusText}`);
    }

    return { success: true, message: 'Connection successful' };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown connection error' 
    };
  }
}

// Function to get base schema using Airtable Web API
export async function getBaseSchema() {
  try {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch base schema: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tables || [];
  } catch (error) {
    console.error('Error fetching base schema:', error);
    // Fallback to manual table list if schema fetch fails
    return [
      { id: 'tbl1', name: 'Users' },
      { id: 'tbl2', name: 'Projects' },
      { id: 'tbl3', name: 'Tasks' },
    ];
  }
}

// Function to get all tables metadata
export async function getTablesMetadata() {
  try {
    const tables = await getBaseSchema();
    return tables.map((table: any) => ({
      id: table.id,
      name: table.name,
      fields: table.fields || []
    }));
  } catch (error) {
    console.error('Error getting tables metadata:', error);
    // Fallback to basic structure
    return [
      { id: 'table1', name: 'Users', fields: [] },
      { id: 'table2', name: 'Projects', fields: [] },
      { id: 'table3', name: 'Tasks', fields: [] },
    ];
  }
}

// Generic function to fetch records from any table
export async function fetchTableData(tableName: string, maxRecords?: number): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();
    
    const records: AirtableRecord[] = [];
    
    // Build select options conditionally
    const selectOptions: any = {
      view: 'Grid view' // Default view name, adjust as needed
    };
    
    // Only add maxRecords if it's specified
    if (maxRecords && maxRecords > 0) {
      selectOptions.maxRecords = maxRecords;
    }
    
    await base(tableName)
      .select(selectOptions)
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            fields: record.fields,
            createdTime: record._rawJson.createdTime
          });
        });
        fetchNextPage();
      });

    return records;
  } catch (error) {
    console.error(`Error fetching data from table ${tableName}:`, error);
    if (error instanceof Error && error.message.includes('NOT_FOUND')) {
      throw new Error(`Table "${tableName}" not found. Please check the table name.`);
    }
    throw error;
  }
}

// Function to fetch ALL records from a table (no limit)
export async function fetchAllTableData(tableName: string): Promise<AirtableRecord[]> {
  try {
    validateEnvironment();
    
    const records: AirtableRecord[] = [];
    
    await base(tableName)
      .select({
        view: 'Grid view'
        // No maxRecords at all - let Airtable handle pagination naturally
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            fields: record.fields,
            createdTime: record._rawJson.createdTime
          });
        });
        if (records.length % 100 === 0) {
          console.log(`Fetched ${records.length} records so far from ${tableName}...`);
        }
        fetchNextPage();
      });

    console.log(`Total records fetched from ${tableName}: ${records.length}`);
    return records;
  } catch (error) {
    console.error(`Error fetching all data from table ${tableName}:`, error);
    if (error instanceof Error && error.message.includes('NOT_FOUND')) {
      throw new Error(`Table "${tableName}" not found. Please check the table name.`);
    }
    throw error;
  }
}

// Function to analyze data and create summary statistics
export function analyzeTableData(records: AirtableRecord[]) {
  const totalRecords = records.length;
  const fields = records.length > 0 ? Object.keys(records[0].fields) : [];
  
  // Basic statistics
  const stats = {
    totalRecords,
    fields,
    fieldCount: fields.length,
    recentRecords: records
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .slice(0, 5)
  };

  // Field type analysis
  const fieldTypes: Record<string, string> = {};
  if (records.length > 0) {
    fields.forEach(field => {
      const sampleValue = records[0].fields[field];
      fieldTypes[field] = typeof sampleValue;
    });
  }

  return { ...stats, fieldTypes };
}