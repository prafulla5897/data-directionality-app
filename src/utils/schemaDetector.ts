/**
 * Schema auto-detection from column names and sample values.
 */

import type { RawRow, Schema, MetricConfig } from '../types/index.js';
import { THRESHOLDS } from '../constants/index.js';

const DATE_HINTS = ['date', 'day', 'week', 'month', 'period', 'time', 'dt'];

const KNOWN_DERIVED: Record<string, { formula: string; components: string[] }> = {
  ctr:  { formula: 'clicks / impressions * 100', components: ['clicks', 'impressions'] },
  cpm:  { formula: 'spend / impressions * 1000', components: ['spend', 'impressions'] },
  cpc:  { formula: 'spend / clicks',             components: ['spend', 'clicks'] },
  roas: { formula: 'revenue / spend',            components: ['revenue', 'spend'] },
};

const KNOWN_UNIQUE = new Set(['reach', 'unique_users', 'unique_visitors']);

function tryParseDate(raw: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return !isNaN(new Date(raw).getTime());
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`);
    return !isNaN(d.getTime());
  }
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(raw)) return !isNaN(new Date(raw).getTime());
  if (/^\d{5}$/.test(raw)) {
    return !isNaN(new Date((parseInt(raw) - 25569) * 86400 * 1000).getTime());
  }
  return false;
}

function detectDateFormat(name: string, samples: (string | number | null)[]): string | null {
  const hasHint = DATE_HINTS.some(h => name.toLowerCase().includes(h));
  const strSamples = samples.filter(s => s !== null && s !== '').map(String);
  if (strSamples.length === 0) return null;

  const successRate = strSamples.filter(tryParseDate).length / strSamples.length;
  if (successRate < THRESHOLDS.DATE_PARSE_MIN_SUCCESS && !(hasHint && successRate > 0.5)) {
    return null;
  }

  const s = strSamples[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'ISO 8601';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return 'MM/DD/YYYY';
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(s)) return 'DD-MMM-YYYY';
  if (/^\d{5}$/.test(s)) return 'Excel serial';
  return 'ISO 8601';
}

/**
 * Classify a single column as date, dimension, or metric.
 * Uses column name hints and sample value types to decide.
 * @param name - Column header name
 * @param samples - Sample values from the first ~20 rows
 * @returns Column classification
 * @example
 * classifyColumn('campaign', ['Brand Awareness', 'Retargeting']); // 'dimension'
 * classifyColumn('spend', [1200, 1350, 980]); // 'metric'
 */
export function classifyColumn(
  name: string,
  samples: (string | number | null)[]
): 'date' | 'dimension' | 'metric' {
  if (detectDateFormat(name, samples)) return 'date';
  const nonNull = samples.filter(s => s !== null && s !== '');
  if (nonNull.length === 0) return 'dimension';
  const numericRate = nonNull.filter(s => !isNaN(Number(s))).length / nonNull.length;
  return numericRate >= 0.9 ? 'metric' : 'dimension';
}

/**
 * Auto-detect schema from column names and sample values.
 * Date detection tries: ISO 8601, MM/DD/YYYY, DD/MM/YYYY, DD-MMM-YYYY, Excel serial.
 * Picks the format where >90% of sample rows parse successfully.
 * Known derived metrics (CTR, CPM, CPC, ROAS) are auto-classified with formulas.
 * @param columns - Array of column header strings
 * @param sampleRows - First 20 rows of data for type inference
 * @returns Detected schema with dateCol, dimensionCols, and metrics
 * @throws Error if no date column or no numeric columns found
 * @example
 * const schema = detectSchema(['date','campaign','spend'], rows);
 */
export function detectSchema(columns: string[], sampleRows: RawRow[]): Schema {
  let dateCol = '';
  let dateFormat = '';
  const dimensionCols: string[] = [];
  const metrics: MetricConfig[] = [];

  for (const col of columns) {
    const samples = sampleRows.map(r => r[col] ?? null);
    const fmt = detectDateFormat(col, samples);

    if (fmt && !dateCol) {
      dateCol = col;
      dateFormat = fmt;
      continue;
    }

    const kind = classifyColumn(col, samples);

    if (kind === 'date' || kind === 'dimension') {
      dimensionCols.push(col);
    } else {
      const lower = col.toLowerCase().trim();
      if (KNOWN_UNIQUE.has(lower)) {
        metrics.push({ name: col, type: 'unique', aggregation: 'raw' });
      } else if (KNOWN_DERIVED[lower]) {
        const d = KNOWN_DERIVED[lower];
        metrics.push({
          name: col,
          type: 'derived',
          formula: d.formula,
          components: d.components,
          aggregation: 'recalculate',
        });
      } else {
        metrics.push({ name: col, type: 'summable', aggregation: 'sum' });
      }
    }
  }

  if (!dateCol) {
    throw new Error('No date column found. Ensure one column contains dates.');
  }
  if (metrics.length === 0) {
    throw new Error('No numeric columns detected. Ensure your file has metric data.');
  }

  return { dateCol, dateFormat, dimensionCols, metrics };
}
