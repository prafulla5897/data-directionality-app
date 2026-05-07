/**
 * Pure math functions for time-series analysis.
 * No DOM access, no side effects, no global state.
 */

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * @param a - First numeric array
 * @param b - Second numeric array (same length as a)
 * @returns Correlation coefficient in [−1, 1], or NaN if n < 2 or stdDev = 0
 * @example
 * pearsonR([1,2,3,4,5], [1,2,3,4,5]); // 1.0
 */
export function pearsonR(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || n !== b.length) return NaN;
  const mA = a.reduce((s, v) => s + v, 0) / n;
  const mB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA;
    const db = b[i] - mB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  if (denomA === 0 || denomB === 0) return NaN;
  return num / Math.sqrt(denomA * denomB);
}

/**
 * Direction score: fraction of consecutive period pairs where both metrics
 * moved in the same direction.
 * @param a - First metric value array (chronological)
 * @param b - Second metric value array (chronological, same length)
 * @returns Score in [0, 1], or NaN if fewer than 2 elements
 * @example
 * directionScore([1,2,3], [1,2,3]); // 1.0
 */
export function directionScore(a: number[], b: number[]): number {
  if (a.length < 2 || a.length !== b.length) return NaN;
  let matches = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const da = a[i + 1] - a[i];
    const db = b[i + 1] - b[i];
    if (Math.sign(da) === Math.sign(db)) matches++;
  }
  return matches / (a.length - 1);
}

/**
 * Elasticity per consecutive period: (pctChangeA / pctChangeB).
 * Skips any period where either starting value is 0 (avoids division by zero).
 * @param a - First metric value array (chronological)
 * @param b - Second metric value array (chronological, same length)
 * @returns Array of elasticity ratios (may be shorter than input by 1+)
 * @example
 * elasticityPerPeriod([100,110], [200,216])[0]; // ~0.8
 */
export function elasticityPerPeriod(a: number[], b: number[]): number[] {
  const result: number[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n - 1; i++) {
    if (a[i] === 0 || b[i] === 0) continue;
    const pctA = (a[i + 1] - a[i]) / a[i];
    const pctB = (b[i + 1] - b[i]) / b[i];
    if (pctB === 0) continue;
    result.push(pctA / pctB);
  }
  return result;
}

/**
 * Arithmetic mean of an array.
 * @param arr - Numeric array
 * @returns Mean value, or NaN if array is empty
 * @example
 * mean([2,4,4,4,5,5,7,9]); // 5
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return NaN;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Population standard deviation of an array.
 * @param arr - Numeric array
 * @returns Standard deviation; returns 0 if single element or all values identical
 * @example
 * stdDev([2,4,4,4,5,5,7,9]); // ~2.0
 */
export function stdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Z-score normalisation of an array.
 * @param arr - Numeric array
 * @returns Array of z-scores; returns array of 0s if stdDev = 0
 * @example
 * zScore([2,4,4,4,5,5,7,9]); // sum ≈ 0
 */
export function zScore(arr: number[]): number[] {
  const m = mean(arr);
  const sd = stdDev(arr);
  if (sd === 0) return arr.map(() => 0);
  return arr.map(v => (v - m) / sd);
}

/**
 * Rolling Pearson correlation with a fixed window size.
 * @param a - First metric value array
 * @param b - Second metric value array (same length)
 * @param window - Number of periods in each rolling window
 * @returns Array of correlation values; length = max(0, n - window + 1)
 * @example
 * rollingCorr([1,2,3,4,5], [1,2,3,4,5], 3); // [1.0, 1.0, 1.0]
 */
export function rollingCorr(a: number[], b: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i <= a.length - window; i++) {
    result.push(pearsonR(a.slice(i, i + window), b.slice(i, i + window)));
  }
  return result;
}
