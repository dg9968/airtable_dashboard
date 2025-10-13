/**
 * Helper utilities for server
 */

/**
 * Generate a random 4-digit code
 */
export function generateClientCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Validate if a string is a valid 4-digit client code
 */
export function isValidClientCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

/**
 * Validate tax year
 */
export function isValidTaxYear(year: string): boolean {
  const validYears = ['2022', '2023', '2024', '2025', 'N/A'];
  return validYears.includes(year);
}

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Validate file size (max 10MB)
 */
export function isValidFileSize(size: number, maxSizeMB: number = 10): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

/**
 * Generate unique document ID
 */
export function generateDocumentId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
