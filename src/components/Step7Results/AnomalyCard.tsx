/**
 * Single anomaly card for the results dashboard.
 */

import type { Anomaly } from '../../types/index.js';
import styles from './Step7Results.module.css';

interface AnomalyCardProps {
  anomaly: Anomaly;
  onDrilldown: (anomaly: Anomaly) => void;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Returns the inclusive display end: periodEnd is the next-period start, so subtract one day. */
function displayPeriodEnd(start: Date, end: Date): Date {
  return end.getTime() > start.getTime() ? new Date(end.getTime() - 86_400_000) : start;
}

function periodLabel(anomaly: Anomaly): string {
  const s = fmtDate(anomaly.periodStart);
  const e = fmtDate(displayPeriodEnd(anomaly.periodStart, anomaly.periodEnd));
  return s === e ? s : `${s} – ${e}`;
}

function badgeClass(severity: Anomaly['severity']): string {
  if (severity === 'critical') return styles.badgeCritical;
  if (severity === 'warning') return styles.badgeWarning;
  return styles.badgeInfo;
}

/**
 * Renders a single anomaly insight card with severity badge, title, body, and drill-down link.
 * @param props - anomaly data and drill-down callback
 * @returns JSX card element
 */
export function AnomalyCard({ anomaly, onDrilldown }: AnomalyCardProps): JSX.Element {
  const dimStr = Object.values(anomaly.dimensionValues).filter(Boolean).join(' · ');

  return (
    <div className={`${styles.card} ${styles[anomaly.severity]}`} data-severity={anomaly.severity}>
      <div className={styles.cardHeader}>
        <span className={`${styles.badge} ${badgeClass(anomaly.severity)}`}>
          {anomaly.severity.toUpperCase()}
        </span>
        <span className={styles.cardPeriod}>{periodLabel(anomaly)}</span>
      </div>
      {dimStr && <p className={styles.cardDim}>{dimStr}</p>}
      <p className={styles.cardTitle}>{anomaly.title}</p>
      <p className={styles.cardBody}>{anomaly.body}</p>
      <div className={styles.cardFooter}>
        <span className={styles.metricTag}>
          {anomaly.metricPair[0]} ↔ {anomaly.metricPair[1]}
        </span>
        <button
          className={styles.btnDetail}
          onClick={() => onDrilldown(anomaly)}
          aria-label={`See detail for: ${anomaly.title}`}
        >
          See detail ▶
        </button>
      </div>
    </div>
  );
}
