/**
 * Step 4 — Baseline and anomaly window configuration.
 * User defines what "normal" is and which period to inspect for anomalies.
 */

import { useMemo, useState } from 'react';
import type { AppState, RawRow, Schema } from '../../types/index.js';
import { parseDateValue } from '../../utils/parser.js';
import { THRESHOLDS } from '../../constants/index.js';
import styles from './Step4Windows.module.css';

interface Step4WindowsProps {
  rawRows: RawRow[];
  schema: Schema;
  initialWindow: AppState['windowConfig'];
  onConfirm: (window: AppState['windowConfig']) => void;
  onBack: () => void;
}

type BaselineMode = 'all' | 'custom';
type AnomalyMode = '7days' | 'month-to-date' | 'custom';

interface AnomalyModeOption {
  value: AnomalyMode;
  label: string;
}

const ANOMALY_MODES: AnomalyModeOption[] = [
  { value: '7days', label: 'Last 7 days' },
  { value: 'month-to-date', label: 'Month to date' },
  { value: 'custom', label: 'Custom' },
];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Step 4 baseline and anomaly window UI.
 * Defaults baseline to all data and anomaly window to last 1 month.
 * @param props - rawRows, schema, initialWindow, onConfirm callback, onBack callback
 * @returns JSX window configuration form
 */
export function Step4Windows({ rawRows, schema, initialWindow, onConfirm, onBack }: Step4WindowsProps): JSX.Element {
  const { dataMin, dataMax } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rawRows) {
      const d = parseDateValue(row[schema.dateCol]);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { dataMin: min, dataMax: max };
  }, [rawRows, schema.dateCol]);

  const [baselineMode, setBaselineMode] = useState<BaselineMode>(() =>
    initialWindow.baselineStart != null ? 'custom' : 'all'
  );
  const [baselineStart, setBaselineStart] = useState(
    initialWindow.baselineStart ? toDateStr(initialWindow.baselineStart) : ''
  );
  const [baselineEnd, setBaselineEnd] = useState(
    initialWindow.baselineEnd ? toDateStr(initialWindow.baselineEnd) : ''
  );

  const [anomalyMode, setAnomalyMode] = useState<AnomalyMode>(() =>
    initialWindow.anomalyStart != null ? 'custom' : 'month-to-date'
  );
  const [anomalyStart, setAnomalyStart] = useState(
    initialWindow.anomalyStart ? toDateStr(initialWindow.anomalyStart) : ''
  );
  const [anomalyEnd, setAnomalyEnd] = useState(
    initialWindow.anomalyEnd ? toDateStr(initialWindow.anomalyEnd) : ''
  );

  const effectiveBaseline = useMemo(() => {
    if (baselineMode === 'all') return { start: dataMin, end: dataMax };
    return {
      start: baselineStart ? new Date(baselineStart + 'T00:00:00') : null,
      end: baselineEnd ? new Date(baselineEnd + 'T00:00:00') : null,
    };
  }, [baselineMode, baselineStart, baselineEnd, dataMin, dataMax]);

  const effectiveAnomaly = useMemo(() => {
    if (!dataMax) return { start: null, end: dataMax };
    const end = dataMax;
    if (anomalyMode === '7days') {
      const s = new Date(end.getTime() - 7 * 86_400_000);
      return { start: s, end };
    }
    if (anomalyMode === 'month-to-date') {
      const s = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      return { start: s, end };
    }
    return {
      start: anomalyStart ? new Date(anomalyStart + 'T00:00:00') : null,
      end: anomalyEnd ? new Date(anomalyEnd + 'T00:00:00') : null,
    };
  }, [anomalyMode, anomalyStart, anomalyEnd, dataMax]);

  const anomalyExtendsWarning = useMemo(() => {
    if (!effectiveAnomaly.end || !effectiveBaseline.end) return false;
    return effectiveAnomaly.end > effectiveBaseline.end;
  }, [effectiveAnomaly.end, effectiveBaseline.end]);

  const baselineTooShort = useMemo(() => {
    const { start, end } = effectiveBaseline;
    if (!start || !end) return false;
    const uniqueDates = new Set(
      rawRows
        .filter(r => {
          const d = parseDateValue(r[schema.dateCol]);
          return d && d >= start && d <= end;
        })
        .map(r => String(r[schema.dateCol] ?? ''))
    );
    return uniqueDates.size < THRESHOLDS.MIN_BASELINE_POINTS;
  }, [rawRows, schema.dateCol, effectiveBaseline]);

  const dataMinStr = dataMin ? toDateStr(dataMin) : undefined;
  const dataMaxStr = dataMax ? toDateStr(dataMax) : undefined;

  function handleConfirm(): void {
    onConfirm({
      baselineStart: effectiveBaseline.start,
      baselineEnd: effectiveBaseline.end,
      anomalyStart: effectiveAnomaly.start,
      anomalyEnd: effectiveAnomaly.end,
    });
  }

  const summaryText = useMemo(() => {
    const bStart = effectiveBaseline.start ? formatDate(effectiveBaseline.start) : '?';
    const bEnd = effectiveBaseline.end ? formatDate(effectiveBaseline.end) : '?';
    const aStart = effectiveAnomaly.start ? formatDate(effectiveAnomaly.start) : '?';
    const aEnd = effectiveAnomaly.end ? formatDate(effectiveAnomaly.end) : '?';
    return `Baseline ${bStart} – ${bEnd} | Anomalies ${aStart} – ${aEnd}`;
  }, [effectiveBaseline, effectiveAnomaly]);

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.heading}>Set analysis windows</h2>
        {dataMin && dataMax && (
          <p className={styles.subheading}>
            Your data spans:{' '}
            <span className={styles.dataSpan}>{formatDate(dataMin)} – {formatDate(dataMax)}</span>
          </p>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Baseline period (define &ldquo;normal&rdquo;)</span>
        <label className={styles.radioRow}>
          <input
            type="radio"
            name="baselineMode"
            checked={baselineMode === 'all'}
            onChange={() => setBaselineMode('all')}
            aria-label="Use all data as baseline"
          />
          <span>Use all data</span>
        </label>
        <label className={styles.radioRow}>
          <input
            type="radio"
            name="baselineMode"
            checked={baselineMode === 'custom'}
            onChange={() => setBaselineMode('custom')}
            aria-label="Custom baseline date range"
          />
          <span>Custom</span>
        </label>
        {baselineMode === 'custom' && (
          <div className={styles.dateRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={baselineStart}
              min={dataMinStr}
              max={dataMaxStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaselineStart(e.target.value)}
              aria-label="Baseline start date"
            />
            <span>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={baselineEnd}
              min={dataMinStr}
              max={dataMaxStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaselineEnd(e.target.value)}
              aria-label="Baseline end date"
            />
          </div>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Anomaly window (what to check)</span>
        {ANOMALY_MODES.map(({ value, label }) => (
          <label key={value} className={styles.radioRow}>
            <input
              type="radio"
              name="anomalyMode"
              value={value}
              checked={anomalyMode === value}
              onChange={() => setAnomalyMode(value)}
              aria-label={label}
            />
            <span>{label}{value === 'month-to-date' ? ' — default' : ''}</span>
          </label>
        ))}
        {anomalyMode === 'custom' && (
          <div className={styles.dateRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={anomalyStart}
              min={dataMinStr}
              max={dataMaxStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnomalyStart(e.target.value)}
              aria-label="Anomaly window start date"
            />
            <span>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={anomalyEnd}
              min={dataMinStr}
              max={dataMaxStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnomalyEnd(e.target.value)}
              aria-label="Anomaly window end date"
            />
          </div>
        )}
      </div>

      <div className={styles.summary}>{summaryText}</div>

      {anomalyExtendsWarning && (
        <p className={styles.hint}>
          Anomaly window extends beyond baseline — some periods may have limited context.
        </p>
      )}

      {baselineTooShort && (
        <p className={styles.hint}>
          Short baseline — results may be less reliable.
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={handleConfirm}>
          Continue
        </button>
      </div>
    </div>
  );
}
