/**
 * Aggregation utilities — RawRow[] → Series[] at a chosen grain.
 */

import type { RawRow, Schema, Grain, Series } from '../types/index.js';

/**
 * Generate all 2^n − 1 non-empty subsets of selected dimensions.
 * Used to enumerate all dimension combinations for analysis.
 * @param dimensions - e.g. ["campaign", "creative", "account"]
 * @returns All non-empty subsets e.g. [["campaign"], ["campaign","creative"], ...]
 * @example
 * generateDimensionSubsets(['a','b']); // [['a'], ['b'], ['a','b']]
 */
export function generateDimensionSubsets(dimensions: string[]): string[][] {
  if (dimensions.length === 0) return [];
  const result: string[][] = [];
  const total = 1 << dimensions.length;
  for (let mask = 1; mask < total; mask++) {
    const subset: string[] = [];
    for (let i = 0; i < dimensions.length; i++) {
      if (mask & (1 << i)) subset.push(dimensions[i]);
    }
    result.push(subset);
  }
  return result;
}

/**
 * Group rows by dimension combinations and aggregate metrics to the chosen grain.
 * Handles summable (SUM), derived (recalculate from components), and unique (raw) types.
 * Missing values (null, undefined, NaN) are skipped, never imputed.
 * All series are sorted ascending by date before return.
 * @param rows - Filtered raw rows (within the analysis window)
 * @param schema - Confirmed schema with metric types and formulas
 * @param grain - Time granularity for aggregation
 * @param dimensions - Selected dimension column names
 * @returns Array of Series objects, one per unique dimension combination
 * @example
 * const series = buildSeries(rows, schema, 'weekly', ['campaign']);
 */
export function buildSeries(
  _rows: RawRow[],
  _schema: Schema,
  _grain: Grain,
  _dimensions: string[]
): Series[] {
  throw new Error('buildSeries: not implemented — Phase 3');
}
