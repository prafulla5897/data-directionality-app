/**
 * Step 8 — Drill-down view: plain-English summary, time-series, metric stat block, drill navigation.
 */

import type { Anomaly, Series, Schema, AppState } from '../../types/index.js';
import { TimeSeriesChart } from './TimeSeriesChart.js';
import styles from './Step8Drilldown.module.css';

interface Step8DrilldownProps {
  anomaly: Anomaly;
  allAnomalies: Anomaly[];
  seriesList: Series[];
  schema: Schema;
  grainConfig: AppState['grainConfig'];
  onBack: () => void;
  onSelectAnomaly: (anomaly: Anomaly) => void;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function findSeries(seriesList: Series[], anomaly: Anomaly): Series | undefined {
  return seriesList.find(s => {
    const sDimKeys = Object.keys(s.dimensionValues);
    const aDims = anomaly.dimensionCombo;
    if (sDimKeys.length !== aDims.length) return false;
    return aDims.every(d => s.dimensionValues[d] === anomaly.dimensionValues[d]);
  });
}

function displayPeriodEnd(start: Date, end: Date): Date {
  if (end.getTime() <= start.getTime()) return start;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 8 * 86_400_000) return new Date(start.getTime() + 6 * 86_400_000);
  return new Date(end.getTime() - 86_400_000);
}

function buildSummary(anomaly: Anomaly): string {
  const endDisplay = displayPeriodEnd(anomaly.periodStart, anomaly.periodEnd);
  const period = `${fmtDate(anomaly.periodStart)} – ${fmtDate(endDisplay)}`;
  return `${period}: ${anomaly.body}`;
}

interface MetricStat { baselineAvg: number | null; anomalyAvg: number | null; pctChange: number | null; }

function computeStat(series: Series, metric: string, anomaly: Anomaly): MetricStat {
  const vals = series.values[metric] ?? [];
  const baseVals: number[] = [];
  const aVals: number[] = [];
  for (let i = 0; i < series.dates.length; i++) {
    const d = series.dates[i];
    const v = vals[i];
    if (v === null || v === undefined) continue;
    if (d < anomaly.periodStart) {
      baseVals.push(v as number);
    } else if (d >= anomaly.periodStart &&
      (anomaly.periodEnd > anomaly.periodStart ? d < anomaly.periodEnd : d.getTime() === anomaly.periodStart.getTime())) {
      aVals.push(v as number);
    }
  }
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const bAvg = avg(baseVals);
  const aAvg = avg(aVals);
  const pct = bAvg !== null && aAvg !== null && bAvg !== 0 ? ((aAvg - bAvg) / Math.abs(bAvg)) * 100 : null;
  return { baselineAvg: bAvg, anomalyAvg: aAvg, pctChange: pct };
}

function badgeClass(severity: Anomaly['severity'], s: Record<string, string>): string {
  if (severity === 'critical') return s.badgeCritical;
  if (severity === 'warning') return s.badgeWarning;
  return s.badgeInfo;
}

/**
 * Drill-down detail view for a selected anomaly.
 * Shows plain-English summary, time-series chart, metric stat table, and drill navigation.
 * @param props - anomaly, all anomalies for drill nav, series list, schema, grain config, callbacks
 * @returns JSX drill-down view
 */
export function Step8Drilldown({
  anomaly, allAnomalies, seriesList, schema, grainConfig, onBack, onSelectAnomaly,
}: Step8DrilldownProps): JSX.Element {
  const series = findSeries(seriesList, anomaly);
  const [mA, mB] = anomaly.metricPair;

  const stA = series ? computeStat(series, mA, anomaly) : null;
  const stB = series ? computeStat(series, mB, anomaly) : null;

  const drillUp = allAnomalies.filter(a => {
    if (a.id === anomaly.id) return false;
    const aD = a.dimensionCombo;
    const cD = anomaly.dimensionCombo;
    if (aD.length >= cD.length) return false;
    return aD.every(d => a.dimensionValues[d] === anomaly.dimensionValues[d]);
  }).slice(0, 2);

  const drillDown = allAnomalies.filter(a => {
    if (a.id === anomaly.id) return false;
    const aD = a.dimensionCombo;
    const cD = anomaly.dimensionCombo;
    if (aD.length <= cD.length) return false;
    return cD.every(d => a.dimensionValues[d] === anomaly.dimensionValues[d]);
  }).slice(0, 2);

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={onBack}>← Back to overview</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className={`${styles.badge} ${badgeClass(anomaly.severity, styles)}`}>
          {anomaly.severity.toUpperCase()}
        </span>
        <h2 className={styles.heading}>{anomaly.title}</h2>
      </div>
      {Object.values(anomaly.dimensionValues).filter(Boolean).length > 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
          {Object.values(anomaly.dimensionValues).filter(Boolean).join(' · ')}
        </p>
      )}

      <div className={styles.summary} aria-label="Plain-English summary">
        {buildSummary(anomaly)}
      </div>

      {series ? (
        <>
          <div className={styles.chartCard}>
            <p className={styles.sectionLabel}>How they moved over time</p>
            <TimeSeriesChart anomaly={anomaly} series={series} />
          </div>
          <div className={styles.chartCard}>
            <p className={styles.sectionLabel}>How each metric changed</p>
            <table className={styles.statTable}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Baseline avg</th>
                  <th>Anomaly period avg</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {([{ label: mA, st: stA }, { label: mB, st: stB }] as const).map(({ label, st }) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{st?.baselineAvg !== null && st?.baselineAvg !== undefined ? fmtNum(st.baselineAvg) : '—'}</td>
                    <td>{st?.anomalyAvg !== null && st?.anomalyAvg !== undefined ? fmtNum(st.anomalyAvg) : '—'}</td>
                    <td style={{ color: st?.pctChange == null ? 'inherit' : st.pctChange > 0 ? '#4caf50' : '#ff6b5b', fontFamily: 'var(--font-mono)' }}>
                      {st?.pctChange != null ? `${st.pctChange >= 0 ? '+' : ''}${Math.round(st.pctChange)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Chart data unavailable — series not found for this dimension combination.
        </p>
      )}

      <div className={styles.contextCard}>
        <p className={styles.sectionLabel}>Dimension context</p>
        <div className={styles.contextRow}>
          <span className={styles.contextKey}>Analysis level</span>
          <span className={styles.contextVal}>{anomaly.dimensionCombo.join(' + ') || 'All data'}</span>
        </div>
        {Object.entries(anomaly.dimensionValues).map(([k, v]) => (
          <div key={k} className={styles.contextRow}>
            <span className={styles.contextKey}>{k}</span>
            <span className={styles.contextVal}>{v || '—'}</span>
          </div>
        ))}
        <div className={styles.contextRow}>
          <span className={styles.contextKey}>Analysis grain</span>
          <span className={styles.contextVal}>{grainConfig.analysisGrain}</span>
        </div>
        <div className={styles.contextRow}>
          <span className={styles.contextKey}>Metrics compared</span>
          <span className={styles.contextVal}>{mA} ↔ {mB}</span>
        </div>
      </div>

      {(drillUp.length > 0 || drillDown.length > 0) && (
        <div className={styles.drillSection}>
          <p className={styles.drillLabel}>Drill options</p>
          {drillUp.map(a => (
            <button key={a.id} className={styles.drillBtn} onClick={() => onSelectAnomaly(a)}>
              ↑ See {a.dimensionCombo.join(' + ') || 'all data'} level
            </button>
          ))}
          {drillDown.map(a => (
            <button key={a.id} className={styles.drillBtn} onClick={() => onSelectAnomaly(a)}>
              ↓ See {Object.entries(a.dimensionValues).filter(([k]) => !anomaly.dimensionCombo.includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </button>
          ))}
        </div>
      )}

      {schema && <p style={{ color: 'var(--dim)', fontSize: '0.75rem' }}>Schema: {schema.metrics.length} metrics analysed</p>}
    </div>
  );
}
