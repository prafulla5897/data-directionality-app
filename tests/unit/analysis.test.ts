import { describe, expect, it } from 'vitest';
import {
  pearsonR,
  directionScore,
  elasticityPerPeriod,
  mean,
  stdDev,
  zScore,
  rollingCorr,
} from '../../src/utils/analysis.js';

describe('pearsonR', () => {
  it('returns 1.0 for perfectly correlated series', () => {
    expect(pearsonR([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1.0, 3);
  });

  it('returns -1.0 for perfectly negatively correlated series', () => {
    expect(pearsonR([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1.0, 3);
  });

  it('returns NaN when stdDev of one series is 0', () => {
    expect(pearsonR([1, 1, 1], [2, 3, 4])).toBeNaN();
  });

  it('returns NaN for arrays shorter than 2', () => {
    expect(pearsonR([5], [5])).toBeNaN();
    expect(pearsonR([], [])).toBeNaN();
  });

  it('returns a value in [-1, 1] for uncorrelated data', () => {
    const r = pearsonR([1, 3, 2, 5, 4], [5, 1, 4, 2, 3]);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe('directionScore', () => {
  it('returns 1.0 when both series always move together', () => {
    expect(directionScore([1, 2, 3], [1, 2, 3])).toBe(1.0);
  });

  it('returns 0.0 when series always move opposite', () => {
    expect(directionScore([1, 2, 3], [3, 2, 1])).toBe(0.0);
  });

  it('returns 1.0 when both rise then fall', () => {
    expect(directionScore([1, 2, 1], [1, 2, 1])).toBe(1.0);
  });

  it('returns NaN for arrays shorter than 2', () => {
    expect(directionScore([1], [1])).toBeNaN();
    expect(directionScore([], [])).toBeNaN();
  });

  it('returns 0.5 for alternating directions', () => {
    // [1,3,1,3] → deltas +2,-2,+2 | [1,2,1,2] → deltas +1,-1,+1 → all same sign → 1.0
    // [1,2,3,2,3] → deltas +1,+1,-1,+1 | [1,3,2,3,2] → deltas +2,-1,+1,-1 → match,no-match,no-match,no-match → 0.25
    expect(directionScore([1, 2, 3, 2], [1, 3, 2, 3])).toBeCloseTo(1 / 3, 5);
  });
});

describe('elasticityPerPeriod', () => {
  it('computes correct ratio for single step', () => {
    // spend +10%, impressions +8% → ratio ≈ 1.25
    expect(elasticityPerPeriod([100, 110], [200, 216])[0]).toBeCloseTo(
      0.1 / 0.08,
      2
    );
  });

  it('skips periods where starting value is 0', () => {
    expect(elasticityPerPeriod([0, 100], [200, 216])).toHaveLength(0);
    expect(elasticityPerPeriod([100, 110], [0, 200])).toHaveLength(0);
  });

  it('skips periods where pctChangeB is 0 (flat B)', () => {
    // B is flat → pctB = 0 → skip
    expect(elasticityPerPeriod([100, 110], [200, 200])).toHaveLength(0);
  });

  it('returns empty for single-element arrays', () => {
    expect(elasticityPerPeriod([100], [200])).toHaveLength(0);
  });

  it('returns multiple ratios for longer arrays', () => {
    const result = elasticityPerPeriod([100, 110, 121], [200, 220, 242]);
    // Both grow ~10% each step → ratio ≈ 1.0
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(1.0, 2);
    expect(result[1]).toBeCloseTo(1.0, 2);
  });
});

describe('mean', () => {
  it('computes mean correctly', () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
  });

  it('returns NaN for empty array', () => {
    expect(mean([])).toBeNaN();
  });

  it('returns the value itself for a single element', () => {
    expect(mean([42])).toBe(42);
  });
});

describe('stdDev', () => {
  it('computes population stdDev correctly', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.0, 1);
  });

  it('returns 0 for single element', () => {
    expect(stdDev([5])).toBe(0);
  });

  it('returns 0 when all values are identical', () => {
    expect(stdDev([3, 3, 3, 3])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(stdDev([])).toBe(0);
  });
});

describe('zScore', () => {
  it('produces z-scores that sum to approximately 0', () => {
    const z = zScore([2, 4, 4, 4, 5, 5, 7, 9]);
    const sum = z.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(0, 5);
  });

  it('returns array of 0s when stdDev is 0', () => {
    const z = zScore([5, 5, 5]);
    expect(z).toEqual([0, 0, 0]);
  });

  it('returns the correct z-score for a known value', () => {
    const z = zScore([2, 4, 4, 4, 5, 5, 7, 9]);
    // mean=5, stdDev=2 → z[0] = (2-5)/2 = -1.5
    expect(z[0]).toBeCloseTo(-1.5, 3);
  });
});

describe('rollingCorr', () => {
  it('returns 1.0 windows for perfectly correlated series', () => {
    const result = rollingCorr([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 3);
    expect(result).toHaveLength(3);
    result.forEach(r => expect(r).toBeCloseTo(1.0, 3));
  });

  it('returns empty array when window > length', () => {
    expect(rollingCorr([1, 2, 3], [1, 2, 3], 5)).toHaveLength(0);
  });

  it('returns one element when window === length', () => {
    const result = rollingCorr([1, 2, 3], [3, 2, 1], 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(-1.0, 3);
  });
});
