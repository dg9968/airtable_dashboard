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
  const records: any[] = [];

  await new Promise<void>((resolve, reject) => {
    base(tableName)
      .select(options || {})
      .eachPage(
        (pageRecords, fetchNextPage) => {
          pageRecords.forEach((record) => {
            records.push({
              id: record.id,
              fields: record.fields,
              createdTime: record._rawJson.createdTime,
            });
          });
          fetchNextPage();
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
  });

  return records;
}
