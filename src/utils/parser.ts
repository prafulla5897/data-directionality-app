/**
 * File parsing utilities — File → RawRow[].
 * Supports .csv (PapaParse) and .xlsx/.xls (SheetJS).
 */

import type { RawRow } from '../types/index.js';
import { THRESHOLDS } from '../constants/index.js';

/**
 * Validate a file before parsing.
 * Checks file type and size limits.
 * @param file - The File object to validate
 * @returns Object with valid flag and optional error message
 * @example
 * const result = validateFile(myFile);
 * if (!result.valid) alert(result.error);
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const sizeMB = file.size / (1024 * 1024);
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
    return { valid: false, error: 'Unsupported format. Please upload .csv, .xlsx, or .xls.' };
  }
  if (sizeMB > THRESHOLDS.MAX_FILE_SIZE_MB) {
    return { valid: false, error: 'File too large. Please reduce file size.' };
  }
  return { valid: true };
}

/**
 * Parse an uploaded file into raw row objects.
 * Supports .csv (PapaParse) and .xlsx/.xls (SheetJS).
 * @param file - The uploaded File object
 * @returns Array of plain objects keyed by column header
 * @throws Error if file cannot be parsed or has unsupported type
 * @example
 * const rows = await parseFile(myFile);
 */
export async function parseFile(_file: File): Promise<RawRow[]> {
  throw new Error('parseFile: not implemented — Phase 1');
}
