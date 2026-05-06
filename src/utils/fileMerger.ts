/**
 * Two-file fuzzy merge utilities.
 * Matches dimension columns across files and combines rows.
 */

import type { RawRow, Schema, ColumnMapping } from '../types/index.js';

/**
 * Fuzzy-match dimension column names across two files.
 * Uses name similarity heuristics (e.g. "campaign_name" ≈ "campaign").
 * @param schema1 - Detected schema from file 1
 * @param schema2 - Detected schema from file 2
 * @returns Array of suggested column mappings sorted by confidence descending
 * @example
 * const mappings = suggestColumnMappings(schema1, schema2);
 * // [{ file1Col: 'campaign_name', file2Col: 'campaign', confidence: 0.92 }]
 */
export function suggestColumnMappings(
  _schema1: Schema,
  _schema2: Schema
): ColumnMapping[] {
  throw new Error('suggestColumnMappings: not implemented — Phase 1');
}

/**
 * Merge two parsed datasets using confirmed column mappings.
 * Groups by common dimensions across both files and combines metrics.
 * If the same metric name appears in both files, suffixes with _f1 / _f2.
 * @param rows1 - Parsed rows from file 1
 * @param rows2 - Parsed rows from file 2
 * @param mappings - Confirmed column mappings (from suggestColumnMappings or user-edited)
 * @returns Single merged RawRow array treated as one dataset for all further steps
 * @throws Error if no matching rows found between the two files
 * @example
 * const merged = mergeFiles(rows1, rows2, mappings);
 */
export function mergeFiles(
  _rows1: RawRow[],
  _rows2: RawRow[],
  _mappings: ColumnMapping[]
): RawRow[] {
  throw new Error('mergeFiles: not implemented — Phase 1');
}
