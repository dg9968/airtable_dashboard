/**
 * Airtable Helper Functions
 * Fixes compatibility issues with eachPage in Node.js environments
 */

import Airtable from 'airtable';

/**
 * Wrapper for Airtable eachPage that returns a Promise
 * Fixes "Expected signal to be an instanceof AbortSignal" error
 */
export async function fetchAllRecords(
  base: Airtable.Base,
  tableName: string,
  options?: {
    view?: string;
    filterByFormula?: string;
    sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  }
): Promise<any[]> {
  // Use .all() instead of .eachPage() to avoid AbortSignal issues
  const airtableRecords = await base(tableName)
    .select(options || {})
    .all();

  // Map to consistent format
  return airtableRecords.map((record) => ({
    id: record.id,
    fields: record.fields,
    createdTime: record._rawJson.createdTime,
  }));
}
