/**
 * Two-file fuzzy merge utilities.
 * Matches dimension columns across files and combines rows.
 */

import type { RawRow, Schema, ColumnMapping } from '../types/index.js';

const DATE_HINTS = ['date', 'day', 'week', 'month', 'period', 'time', 'dt'];

function colSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[_\s-]/g, '');
  const nb = b.toLowerCase().replace(/[_\s-]/g, '');
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Bigram Dice coefficient
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.slice(i, i + 2));
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.slice(i, i + 2));
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function findDateCol(rows: RawRow[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  return cols.find(c => DATE_HINTS.some(h => c.toLowerCase().includes(h))) ?? cols[0] ?? '';
}

/**
 * Fuzzy-match dimension column names across two schemas.
 * Uses name similarity heuristics (e.g. "campaign_name" ≈ "campaign").
 * @param schema1 - Detected schema from file 1
 * @param schema2 - Detected schema from file 2
 * @returns Suggested mappings sorted by confidence descending
 * @example
 * suggestColumnMappings(s1, s2);
 * // [{ file1Col: 'campaign_name', file2Col: 'campaign', confidence: 0.85 }]
 */
export function suggestColumnMappings(
  schema1: Schema,
  schema2: Schema
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  for (const col1 of schema1.dimensionCols) {
    let bestCol = '';
    let bestScore = 0;
    for (const col2 of schema2.dimensionCols) {
      const score = colSimilarity(col1, col2);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col2;
      }
    }
    if (bestScore > 0.3) {
      mappings.push({ file1Col: col1, file2Col: bestCol, confidence: bestScore });
    }
  }
  return mappings.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Merge two parsed datasets using confirmed column mappings.
 * Groups by date × common dimensions, combines metrics from both files.
 * Suffixes conflicting metric names with _f1 / _f2.
 * @param rows1 - Parsed rows from file 1
 * @param rows2 - Parsed rows from file 2
 * @param mappings - Confirmed dimension column mappings
 * @returns Single merged RawRow array treated as one dataset
 * @throws Error if no matching rows found between the two files
 * @example
 * const merged = mergeFiles(rows1, rows2, mappings);
 */
export function mergeFiles(
  rows1: RawRow[],
  rows2: RawRow[],
  mappings: ColumnMapping[]
): RawRow[] {
  const dateKey1 = findDateCol(rows1);
  const dateKey2 = findDateCol(rows2);

  // Identify columns in each file
  const dimCols1 = new Set(mappings.map(m => m.file1Col));
  const dimCols2 = new Set(mappings.map(m => m.file2Col));
  const metricCols1 = Object.keys(rows1[0] ?? {}).filter(k => k !== dateKey1 && !dimCols1.has(k));
  const metricCols2 = Object.keys(rows2[0] ?? {}).filter(k => k !== dateKey2 && !dimCols2.has(k));
  const conflicts = new Set(metricCols1.filter(k => metricCols2.includes(k)));

  // Build index of rows2 keyed by date + mapped dims
  const index2 = new Map<string, RawRow>();
  for (const row of rows2) {
    const parts = [String(row[dateKey2] ?? '')];
    for (const m of mappings) parts.push(String(row[m.file2Col] ?? ''));
    index2.set(parts.join('\x00'), row);
  }

  const merged: RawRow[] = [];
  for (const row1 of rows1) {
    const parts = [String(row1[dateKey1] ?? '')];
    for (const m of mappings) parts.push(String(row1[m.file1Col] ?? ''));
    const row2 = index2.get(parts.join('\x00'));

    const out: RawRow = {};
    for (const [k, v] of Object.entries(row1)) {
      const outKey = conflicts.has(k) && k !== dateKey1 && !dimCols1.has(k) ? `${k}_f1` : k;
      out[outKey] = v;
    }
    if (row2) {
      for (const [k, v] of Object.entries(row2)) {
        if (k === dateKey2 || dimCols2.has(k)) continue;
        out[conflicts.has(k) ? `${k}_f2` : k] = v;
      }
    }
    merged.push(out);
  }

  if (merged.length === 0) {
    throw new Error(
      'No matching rows found between the two files. Check dimension column mapping.'
    );
  }
  return merged;
}
