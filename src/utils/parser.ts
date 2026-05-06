/**
 * File parsing utilities — File → RawRow[].
 * Supports .csv (PapaParse) and .xlsx/.xls (SheetJS).
 */

import type { RawRow } from '../types/index.js';
import { THRESHOLDS } from '../constants/index.js';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';

/**
 * Validate a file before parsing.
 * Checks extension and size against configured limits.
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
 * Dispatches to PapaParse for .csv and SheetJS for .xlsx/.xls.
 * @param file - The uploaded File object
 * @returns Array of plain objects keyed by column header
 * @throws Error if file type is unsupported or parsing fails
 * @example
 * const rows = await parseFile(myFile);
 * rows.length; // 180
 */
export async function parseFile(file: File): Promise<RawRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);
  throw new Error('Unsupported format. Please upload .csv, .xlsx, or .xls.');
}

function parseCsv(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err: { message: string }) => reject(new Error(err.message)),
    });
  });
}

async function parseExcel(file: File): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in Excel file.');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('Sheet not found in Excel file.');
  return utils.sheet_to_json<RawRow>(sheet, { defval: null });
}
