/**
 * Anomaly detection rule engine — Series[] → Anomaly[].
 */

import type { Series, Anomaly } from '../types/index.js';

/**
 * Generate all anomalies from a list of aggregated series.
 * Runs across all dimension combinations × metric pairs.
 * Detects direction breaks, elasticity deviations, and persistence.
 * Anomalies are always stored at analysis grain, never rolled up.
 * @param seriesList - Aggregated series from buildSeries
 * @param baselineWindow - Date range used to compute baseline statistics
 * @param anomalyWindow - Date range to scan for anomalies
 * @param timeBudgetSeconds - Maximum allowed wall-clock time for computation
 * @returns Anomalies sorted by severity (critical first), then by date descending
 * @example
 * const anomalies = generateAnomalies(series, baseline, anomalyWindow, 60);
 */
export function generateAnomalies(
  _seriesList: Series[],
  _baselineWindow: { start: Date; end: Date },
  _anomalyWindow: { start: Date; end: Date },
  _timeBudgetSeconds: number
): Anomaly[] {
  throw new Error('generateAnomalies: not implemented — Phase 3');
}
