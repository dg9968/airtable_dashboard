/**
 * Airtable Helper Functions
 * Uses REST API directly to avoid Airtable library's AbortSignal bug
 */

/**
 * Fetch all records from Airtable using REST API
 * Avoids "Expected signal to be an instanceof AbortSignal" error
 */
export async function fetchAllRecords(
  baseId: string,
  tableName: string,
  options?: {
    view?: string;
    filterByFormula?: string;
    sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  }
): Promise<any[]> {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
  }

  const records: any[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (options?.view) params.append('view', options.view);
    if (options?.filterByFormula) params.append('filterByFormula', options.filterByFormula);
    if (offset) params.append('offset', offset);

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.records) {
      data.records.forEach((record: any) => {
        records.push({
          id: record.id,
          fields: record.fields,
          createdTime: record.createdTime,
        });
      });
    }

    offset = data.offset;
  } while (offset);

  return records;
}
