/**
 * Schema auto-detection from column names and sample values.
 */

import type { RawRow, Schema } from '../types/index.js';

/**
 * Classify a single column as date, dimension, or metric.
 * Uses name hints and sample value types to decide.
 * @param name - Column header name
 * @param samples - Sample values from the first ~20 rows
 * @returns Column classification
 * @example
 * classifyColumn('campaign', ['Brand Awareness', 'Retargeting']); // 'dimension'
 * classifyColumn('spend', [1200, 1350, 980]); // 'metric'
 */
export function classifyColumn(
  _name: string,
  _samples: (string | number | null)[]
): 'date' | 'dimension' | 'metric' {
  throw new Error('classifyColumn: not implemented — Phase 1');
}

/**
 * Auto-detect schema from column names and sample values.
 * Date detection tries formats in order: ISO 8601, MM/DD/YYYY,
 * DD/MM/YYYY, DD-MMM-YYYY, Excel serial numbers.
 * Picks the format where >90% of sample rows parse successfully.
 * Known derived metrics (CTR, CPM, CPC, ROAS) are auto-classified.
 * @param columns - Array of column header strings
 * @param sampleRows - First 20 rows of data for type inference
 * @returns Detected schema with dateCol, dimensionCols, and metrics
 * @example
 * const schema = detectSchema(['date','campaign','spend'], rows);
 */
export function detectSchema(_columns: string[], _sampleRows: RawRow[]): Schema {
  throw new Error('detectSchema: not implemented — Phase 1');
}
