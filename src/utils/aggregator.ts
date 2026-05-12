/**
 * Aggregation utilities — RawRow[] → Series[] at a chosen grain.
 */

import type { RawRow, Schema, Grain, Series, MetricConfig } from '../types/index.js';

// ─── private helpers ──────────────────────────────────────────────────────────

function parseRawDate(val: string | number | null, dateFormat: string): Date | null {
  if (val === null || val === undefined) return null;

  if (typeof val === 'number' || dateFormat === 'Excel serial') {
    const serial = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(serial)) return null;
    const d = new Date((serial - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(val).trim();
  if (!str) return null;

  if (dateFormat === 'ISO 8601' || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  if (dateFormat === 'MM/DD/YYYY') {
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  }

  // DD-MMM-YYYY and fallback — let JS Date parse directly
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function grainKey(date: Date, grain: Grain, weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
  switch (grain) {
    case 'daily':
      return date.toISOString().slice(0, 10);
    case 'weekly': {
      const d = new Date(date.getTime());
      const day = d.getUTCDay();
      const diff = -((day - weekStartDay + 7) % 7);
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().slice(0, 10);
    }
    case 'monthly':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'quarterly': {
      const q = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${date.getUTCFullYear()}-Q${q}`;
    }
  }
}

function grainPeriodStart(key: string, grain: Grain): Date {
  switch (grain) {
    case 'daily':
    case 'weekly':
      return new Date(key);
    case 'monthly': {
      const [y, mo] = key.split('-').map(Number);
      return new Date(Date.UTC(y, mo - 1, 1));
    }
    case 'quarterly': {
      const [yStr, qStr] = key.split('-');
      const q = parseInt(qStr.slice(1));
      return new Date(Date.UTC(parseInt(yStr), (q - 1) * 3, 1));
    }
  }
}

/** Simple left-to-right formula evaluator for constrained formula strings. */
function evaluateFormula(formula: string, values: Record<string, number>): number {
  const tokens = formula.trim().split(/\s+/);
  let result: number | null = null;
  let op: string | null = null;

  for (const token of tokens) {
    if (token === '/' || token === '*' || token === '+' || token === '-') {
      op = token;
    } else {
      const num = Object.prototype.hasOwnProperty.call(values, token)
        ? values[token]
        : parseFloat(token);
      if (isNaN(num)) return NaN;
      if (result === null) {
        result = num;
      } else if (op !== null) {
        if (op === '/') result = result / num;
        else if (op === '*') result = result * num;
        else if (op === '+') result = result + num;
        else if (op === '-') result = result - num;
        op = null;
      }
    }
  }

  return result ?? NaN;
}

function toNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function aggregateMetric(rows: RawRow[], metric: MetricConfig): number | null {
  if (metric.aggregation === 'sum') {
    let sum = 0;
    let hasValue = false;
    for (const row of rows) {
      const v = toNumber(row[metric.name]);
      if (v !== null) { sum += v; hasValue = true; }
    }
    return hasValue ? sum : null;
  }

  if (metric.aggregation === 'recalculate') {
    if (!metric.formula || !metric.components) return null;
    const sums: Record<string, number> = {};
    for (const comp of metric.components) {
      let s = 0;
      let has = false;
      for (const row of rows) {
        const v = toNumber(row[comp]);
        if (v !== null) { s += v; has = true; }
      }
      if (!has) return null;
      sums[comp] = s;
    }
    const result = evaluateFormula(metric.formula, sums);
    return isFinite(result) ? result : null;
  }

  // 'raw' — unique metrics: use last non-null value
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = toNumber(rows[i][metric.name]);
    if (v !== null) return v;
  }
  return null;
}

// ─── exported functions ───────────────────────────────────────────────────────

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
 * @param weekStartDay - 0=Sun, 1=Mon (default), 2=Tue … 6=Sat. Only affects weekly grain.
 * @returns Array of Series objects, one per unique dimension combination
 * @example
 * const series = buildSeries(rows, schema, 'weekly', ['campaign'], 1);
 */
export function buildSeries(
  rows: RawRow[],
  schema: Schema,
  grain: Grain,
  dimensions: string[],
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
): Series[] {
  type GrainMap = Map<string, RawRow[]>;
  const groups = new Map<string, GrainMap>();
  const dimValuesByKey = new Map<string, Record<string, string>>();

  for (const row of rows) {
    const date = parseRawDate(row[schema.dateCol], schema.dateFormat);
    if (!date) continue;

    const dimValues: Record<string, string> = {};
    for (const dim of dimensions) {
      dimValues[dim] = String(row[dim] ?? '');
    }

    const dimKey = dimensions.length === 0
      ? '__all__'
      : dimensions.map(d => dimValues[d]).join('\x00');
    const gKey = grainKey(date, grain, weekStartDay);

    if (!groups.has(dimKey)) {
      groups.set(dimKey, new Map());
      dimValuesByKey.set(dimKey, dimValues);
    }
    const dimGroup = groups.get(dimKey)!;
    if (!dimGroup.has(gKey)) dimGroup.set(gKey, []);
    dimGroup.get(gKey)!.push(row);
  }

  const seriesList: Series[] = [];

  for (const [dimKey, grainGroups] of groups) {
    const dimValues = dimValuesByKey.get(dimKey)!;
    const label = dimensions.length === 0
      ? 'All'
      : dimensions.map(d => dimValues[d]).filter(Boolean).join(' · ') || 'All';

    const sortedKeys = [...grainGroups.keys()].sort();
    const dates = sortedKeys.map(k => grainPeriodStart(k, grain));

    const values: Record<string, (number | null)[]> = {};
    for (const metric of schema.metrics) {
      values[metric.name] = sortedKeys.map(k =>
        aggregateMetric(grainGroups.get(k)!, metric)
      );
    }

    seriesList.push({ label, dimensionValues: dimValues, dates, values });
  }

  return seriesList;
}
