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

/**
 * Parse a single raw date value from a RawRow cell into a JavaScript Date.
 * Supports ISO 8601, MM/DD/YYYY, DD-MMM-YYYY, and Excel serial number formats.
 * @param raw - Raw cell value from a RawRow (string, number, or null)
 * @returns Parsed Date object, or null if the value cannot be parsed
 * @example
 * parseDateValue('2024-01-15'); // Date representing Jan 15 2024
 * parseDateValue('01/15/2024'); // Date representing Jan 15 2024
 * parseDateValue(45000);        // Excel serial → corresponding Date
 */
export function parseDateValue(raw: string | number | null): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{5}$/.test(s)) {
    const d = new Date((parseInt(s) - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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
