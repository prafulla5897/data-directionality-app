import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import type { RawRow, Series, Anomaly } from '../../src/types/index.js';
import { detectSchema } from '../../src/utils/schemaDetector.js';
import { buildSeries, generateDimensionSubsets } from '../../src/utils/aggregator.js';
import { generateAnomalies } from '../../src/utils/ruleEngine.js';

// ─── fixture setup ────────────────────────────────────────────────────────────

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures');
const csvContent = readFileSync(path.join(fixtureDir, 'sample_campaigns.csv'), 'utf-8');
const parseResult = Papa.parse<RawRow>(csvContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
});
const rawRows = parseResult.data;
const schema = detectSchema(Object.keys(rawRows[0]), rawRows.slice(0, 20));

const baselineWindow = { start: new Date('2024-01-01'), end: new Date('2024-02-29') };
const anomalyWindow  = { start: new Date('2024-01-31'), end: new Date('2024-02-29') };

// ─── generateDimensionSubsets ─────────────────────────────────────────────────

describe('generateDimensionSubsets', () => {
  it("returns 7 subsets for ['a','b','c']", () => {
    expect(generateDimensionSubsets(['a', 'b', 'c'])).toHaveLength(7);
  });

  it('returns all 2^n−1 subsets for varying n', () => {
    expect(generateDimensionSubsets(['a'])).toHaveLength(1);
    expect(generateDimensionSubsets(['a', 'b'])).toHaveLength(3);
    expect(generateDimensionSubsets(['a', 'b', 'c', 'd'])).toHaveLength(15);
  });

  it('returns empty for 0 dimensions', () => {
    expect(generateDimensionSubsets([])).toHaveLength(0);
  });

  it('single-dim subset contains the dimension', () => {
    expect(generateDimensionSubsets(['campaign'])[0]).toEqual(['campaign']);
  });
});

// ─── buildSeries on sample_campaigns.csv ─────────────────────────────────────

describe('buildSeries on sample_campaigns.csv', () => {
  let series: Series[];

  beforeAll(() => {
    series = buildSeries(rawRows, schema, 'daily', ['campaign']);
  });

  it('returns 3 Series (one per campaign)', () => {
    expect(series).toHaveLength(3);
  });

  it('each series has 60 dates', () => {
    series.forEach(s => expect(s.dates).toHaveLength(60));
  });

  it('value arrays are parallel to dates array', () => {
    series.forEach(s => {
      Object.values(s.values).forEach(vals => {
        expect(vals).toHaveLength(s.dates.length);
      });
    });
  });

  it('dates are sorted ascending', () => {
    series.forEach(s => {
      for (let i = 1; i < s.dates.length; i++) {
        expect(s.dates[i].getTime()).toBeGreaterThan(s.dates[i - 1].getTime());
      }
    });
  });

  it('each series has spend, impressions, clicks metrics', () => {
    series.forEach(s => {
      expect(Object.keys(s.values)).toContain('spend');
      expect(Object.keys(s.values)).toContain('impressions');
      expect(Object.keys(s.values)).toContain('clicks');
    });
  });

  it('all spend values are positive numbers', () => {
    series.forEach(s => {
      s.values['spend'].forEach(v => {
        if (v !== null) expect(v).toBeGreaterThan(0);
      });
    });
  });
});

// ─── generateAnomalies on sample_campaigns.csv ───────────────────────────────

describe('generateAnomalies on sample_campaigns.csv', () => {
  let series: Series[];
  let anomalies: Anomaly[];

  beforeAll(() => {
    series   = buildSeries(rawRows, schema, 'daily', ['campaign']);
    anomalies = generateAnomalies(series, baselineWindow, anomalyWindow, 60);
  });

  it('produces at least one CRITICAL anomaly', () => {
    expect(anomalies.some(a => a.severity === 'critical')).toBe(true);
  });

  it('first anomaly has severity "critical" (sorted critical first)', () => {
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].severity).toBe('critical');
  });

  it('anomalies are sorted critical → warning → info', () => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < anomalies.length; i++) {
      expect(order[anomalies[i].severity]).toBeGreaterThanOrEqual(
        order[anomalies[i - 1].severity]
      );
    }
  });

  it('no anomaly title exceeds 80 characters', () => {
    anomalies.forEach(a => expect(a.title.length).toBeLessThanOrEqual(80));
  });

  it('no forbidden jargon words in body text', () => {
    const forbidden = ['elasticity', 'r-value', 'sigma', 'pearson', 'coefficient', 'standard deviation', 'variance', 'correlation'];
    anomalies.forEach(a => {
      forbidden.forEach(word => {
        expect(a.body.toLowerCase()).not.toContain(word);
      });
    });
  });

  it('all anomalies have valid metricPair (two metric names)', () => {
    anomalies.forEach(a => {
      expect(a.metricPair).toHaveLength(2);
      expect(typeof a.metricPair[0]).toBe('string');
      expect(typeof a.metricPair[1]).toBe('string');
    });
  });

  it('all anomalies have periodStart ≤ periodEnd', () => {
    anomalies.forEach(a => {
      expect(a.periodStart.getTime()).toBeLessThanOrEqual(a.periodEnd.getTime());
    });
  });

  it('all anomalies have persistencePeriods ≥ 1', () => {
    anomalies.forEach(a => expect(a.persistencePeriods).toBeGreaterThanOrEqual(1));
  });

  it('critical anomalies have persistencePeriods ≥ CRITICAL_PERSISTENCE (3)', () => {
    anomalies
      .filter(a => a.severity === 'critical')
      .forEach(a => expect(a.persistencePeriods).toBeGreaterThanOrEqual(3));
  });
});
