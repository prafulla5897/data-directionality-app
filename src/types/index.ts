/**
 * Shared TypeScript interfaces for Marketing Signal.
 * Source of truth — do not add logic here.
 */

/** A single row from a parsed file, keyed by column header. */
export interface RawRow {
  [column: string]: string | number | null;
}

/** How a metric value should be interpreted across time periods. */
export type MetricType = 'summable' | 'derived' | 'unique';

/** Configuration for a single metric column. */
export interface MetricConfig {
  name: string;
  type: MetricType;
  /** e.g. "clicks / impressions * 100" */
  formula?: string;
  /** e.g. ["clicks", "impressions"] */
  components?: string[];
  aggregation: 'sum' | 'recalculate' | 'raw';
}

/** Detected and confirmed column schema for a dataset. */
export interface Schema {
  dateCol: string;
  /** Detected format string */
  dateFormat: string;
  dimensionCols: string[];
  metrics: MetricConfig[];
}

/** Time granularity for aggregation or display. */
export type Grain = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/** Aggregated time-series data for a single dimension combination. */
export interface Series {
  /** Dimension combination label e.g. "Retargeting" */
  label: string;
  dimensionValues: Record<string, string>;
  dates: Date[];
  values: Record<string, (number | null)[]>;
}

/** Statistical baseline for a (dimension combo × metric pair). */
export interface BaselineStats {
  dimensionCombo: string[];
  /** e.g. "spend__impressions" */
  metricPairKey: string;
  /** 0–1 */
  directionScore: number;
  meanElasticity: number;
  stdElasticity: number;
  sampleSize: number;
}

/** Anomaly severity level. */
export type Severity = 'critical' | 'warning' | 'info';

/** A detected anomaly with plain-English descriptions. */
export interface Anomaly {
  id: string;
  severity: Severity;
  /** e.g. ["campaign", "creative"] */
  dimensionCombo: string[];
  dimensionValues: Record<string, string>;
  metricPair: [string, string];
  periodStart: Date;
  periodEnd: Date;
  persistencePeriods: number;
  /** Plain English, ≤ 80 chars */
  title: string;
  /** 2–3 sentences, no jargon */
  body: string;
  stats: {
    directionScore: number;
    meanElasticity: number;
    actualElasticity: number;
    sigmaDeviation: number;
  };
}

/** Root application state passed through steps 1–8. */
export interface AppState {
  /** 1–8 */
  step: number;
  rawRows: RawRow[];
  schema: Schema | null;
  mergedFromTwoFiles: boolean;
  scopeConfig: {
    selectedDimensions: string[];
    dateRangeStart: Date | null;
    dateRangeEnd: Date | null;
    aggregateOther: boolean;
  };
  windowConfig: {
    baselineStart: Date | null;
    baselineEnd: Date | null;
    anomalyStart: Date | null;
    anomalyEnd: Date | null;
  };
  grainConfig: {
    analysisGrain: Grain;
    displayGrain: Grain;
    timeBudgetSeconds: number;
    /** 0=Sun 1=Mon(default) 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat */
    weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  };
  seriesList: Series[];
  baselineStats: BaselineStats[];
  anomalies: Anomaly[];
}

/** A suggested column mapping between two files for fuzzy merge. */
export interface ColumnMapping {
  file1Col: string;
  file2Col: string;
  /** 0–1 confidence score */
  confidence: number;
}
