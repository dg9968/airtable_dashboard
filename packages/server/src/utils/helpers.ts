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
