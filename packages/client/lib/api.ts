/**
 * API Client Utilities
 *
 * Handles communication between Next.js client and Hono server
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Make a call to the Hono API server
 * Use this for all non-auth API calls (Airtable, documents, etc.)
 */
export async function apiCall(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    return response;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Make a GET request to the API server
 */
export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const response = await apiCall(endpoint, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`API GET ${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a POST request to the API server
 */
export async function apiPost<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await apiCall(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API POST ${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a PUT request to the API server
 */
export async function apiPut<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await apiCall(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API PUT ${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a DELETE request to the API server
 */
export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const response = await apiCall(endpoint, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`API DELETE ${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload a file to the API server
 */
export async function apiUpload(endpoint: string, file: File, additionalData?: Record<string, any>) {
  const formData = new FormData();
  formData.append('file', file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`File upload failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the API server URL
 */
export function getApiUrl(): string {
  return API_URL;
}
