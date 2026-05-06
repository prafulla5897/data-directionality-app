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
export function pearsonR(_a: number[], _b: number[]): number {
  throw new Error('pearsonR: not implemented — Phase 3');
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
export function directionScore(_a: number[], _b: number[]): number {
  throw new Error('directionScore: not implemented — Phase 3');
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
export function elasticityPerPeriod(_a: number[], _b: number[]): number[] {
  throw new Error('elasticityPerPeriod: not implemented — Phase 3');
}

/**
 * Arithmetic mean of an array.
 * @param arr - Numeric array
 * @returns Mean value, or NaN if array is empty
 * @example
 * mean([2,4,4,4,5,5,7,9]); // 5
 */
export function mean(_arr: number[]): number {
  throw new Error('mean: not implemented — Phase 3');
}

/**
 * Population standard deviation of an array.
 * @param arr - Numeric array
 * @returns Standard deviation; returns 0 if single element or all values identical
 * @example
 * stdDev([2,4,4,4,5,5,7,9]); // ~2.0
 */
export function stdDev(_arr: number[]): number {
  throw new Error('stdDev: not implemented — Phase 3');
}

/**
 * Z-score normalisation of an array.
 * @param arr - Numeric array
 * @returns Array of z-scores; returns array of 0s if stdDev = 0
 * @example
 * zScore([2,4,4,4,5,5,7,9]); // sum ≈ 0
 */
export function zScore(_arr: number[]): number[] {
  throw new Error('zScore: not implemented — Phase 3');
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
export function rollingCorr(_a: number[], _b: number[], _window: number): number[] {
  throw new Error('rollingCorr: not implemented — Phase 3');
}
