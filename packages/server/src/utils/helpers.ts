/**
 * Helper utilities for server
 */

import { fetchAllRecords } from "../lib/airtable-helpers";

/**
 * Generate a random 6-digit code (100000-999999)
 */
export function generateClientCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate if a string is a valid client code
 * Supports both legacy 4-digit codes and new 6-digit codes
 */
export function isValidClientCode(code: string): boolean {
  const trimmed = code.trim();
  return /^\d{4}$/.test(trimmed) || /^\d{6}$/.test(trimmed);
}

/**
 * Check if a client code already exists in Airtable
 * Checks both the "Client Code" formula field and "Client Code Override" field
 */
export async function isClientCodeUnique(code: string): Promise<boolean> {
  const baseId = process.env.AIRTABLE_BASE_ID || "";

  // Check Personal table - check both formula result and override field
  const personalRecords = await fetchAllRecords(baseId, "Personal", {
    filterByFormula: `OR({Client Code} = '${code}', {Client Code Override} = '${code}')`,
    maxRecords: 1,
  });

  if (personalRecords.length > 0) {
    return false;
  }

  // Check Corporations table - check both formula result and override field
  const corporateRecords = await fetchAllRecords(baseId, "Corporations", {
    filterByFormula: `OR({Client Code} = '${code}', {Client Code Override} = '${code}')`,
    maxRecords: 1,
  });

  return corporateRecords.length === 0;
}

/**
 * Generate a unique client code that doesn't exist in Airtable
 * Retries up to 10 times to find a unique code
 */
export async function generateUniqueClientCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateClientCode();
    const isUnique = await isClientCodeUnique(code);

    if (isUnique) {
      return code;
    }
  }

  throw new Error("Failed to generate unique client code after multiple attempts");
}

/**
 * Validate tax year
 */
export function isValidTaxYear(year: string): boolean {
  const validYears = ['2022', '2023', '2024', '2025', '2026', 'N/A'];
  return validYears.includes(year);
}

/**
 * Validate file type by MIME type
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'text/x-pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-word',
    'application/doc',
    'application/docx',
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/x-qbo',
    'application/qbo',
    'application/octet-stream' // Fallback for .qbo and other binary files
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * Validate file extension
 */
export function isAllowedFileExtension(filename: string): boolean {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.csv', '.xls', '.xlsx', '.qbo'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return allowedExtensions.includes(ext);
}

/**
 * Validate file size (max 20MB)
 */
export function isValidFileSize(size: number, maxSizeMB: number = 20): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

/**
 * Generate unique document ID
 */
export function generateDocumentId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
