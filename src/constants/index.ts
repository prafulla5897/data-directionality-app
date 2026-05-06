/**
 * Application-wide constants for Marketing Signal.
 * No logic here — import these everywhere instead of inlining values.
 */

export const THRESHOLDS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_ROWS: 50_000,
  FILE_SIZE_WARN_MB: 10,
  SIGMA_THRESHOLD: 2.0,
  MIN_PERSISTENCE: 2,
  CRITICAL_PERSISTENCE: 3,
  MIN_BASELINE_POINTS: 14,
  /** Minimum fraction of rows that must parse for a date format to be accepted */
  DATE_PARSE_MIN_SUCCESS: 0.9,
} as const;

export const CONFIG = {
  DEFAULT_TIME_BUDGET_SECONDS: 60,
  MAX_TIME_BUDGET_SECONDS: 300,
  MIN_TIME_BUDGET_SECONDS: 30,
  OPS_PER_SECOND: 10_000_000,
} as const;

export const CHART_COLORS: readonly string[] = [
  '#f5a623',
  '#3dd6c0',
  '#5b8ff9',
  '#ff6b5b',
  '#5fd68a',
  '#a78bfa',
  '#f472b6',
];
