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

/**
 * Create records in Airtable using REST API
 */
export async function createRecords(
  baseId: string,
  tableName: string,
  records: Array<{ fields: Record<string, any> }>
): Promise<any[]> {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.records.map((record: any) => ({
    id: record.id,
    fields: record.fields,
    createdTime: record.createdTime,
  }));
}

/**
 * Update records in Airtable using REST API
 */
export async function updateRecords(
  baseId: string,
  tableName: string,
  records: Array<{ id: string; fields: Record<string, any> }>
): Promise<any[]> {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.records.map((record: any) => ({
    id: record.id,
    fields: record.fields,
    createdTime: record.createdTime,
  }));
}

/**
 * Delete records in Airtable using REST API
 */
export async function deleteRecords(
  baseId: string,
  tableName: string,
  recordIds: string[]
): Promise<any[]> {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
  }

  const params = new URLSearchParams();
  recordIds.forEach(id => params.append('records[]', id));

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.records.map((record: any) => ({ id: record.id, deleted: record.deleted }));
}

/**
 * Get a single record by ID using REST API
 */
export async function getRecord(
  baseId: string,
  tableName: string,
  recordId: string
): Promise<any> {
  const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  if (!apiKey) {
    throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable API error: ${response.statusText}`);
  }

  const record = await response.json();
  return {
    id: record.id,
    fields: record.fields,
    createdTime: record.createdTime,
  };
}
