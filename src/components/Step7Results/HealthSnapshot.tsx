/**
 * Metric health snapshot — one status row per metric pair.
 * Red = critical, Yellow = warning, Green = stable.
 */

import type { Anomaly, MetricConfig } from '../../types/index.js';
import styles from './Step7Results.module.css';

interface HealthSnapshotProps {
  metrics: MetricConfig[];
  anomalies: Anomaly[];
  onRowClick: (pair: [string, string]) => void;
}

type Status = 'red' | 'yellow' | 'green';

function getPairStatus(pair: [string, string], anomalies: Anomaly[]): Status {
  const rel = anomalies.filter(
    a =>
      (a.metricPair[0] === pair[0] && a.metricPair[1] === pair[1]) ||
      (a.metricPair[0] === pair[1] && a.metricPair[1] === pair[0]),
  );
  if (rel.some(a => a.severity === 'critical')) return 'red';
  if (rel.some(a => a.severity === 'warning')) return 'yellow';
  return 'green';
}

const STATUS_LABEL: Record<Status, string> = {
  red: 'Misaligned',
  yellow: 'Weak link',
  green: 'Stable',
};

const DOT_CLASS: Record<Status, string> = {
  red: styles.dotRed,
  yellow: styles.dotYellow,
  green: styles.dotGreen,
};

/**
 * Health snapshot grid — one row per unique metric pair showing status.
 * Clicking a row scrolls to related anomaly cards.
 * @param props - metrics list, anomalies, click handler
 * @returns JSX snapshot grid
 */
export function HealthSnapshot({ metrics, anomalies, onRowClick }: HealthSnapshotProps): JSX.Element {
  const pairs: [string, string][] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      pairs.push([metrics[i].name, metrics[j].name]);
    }
  }

  if (pairs.length === 0) {
    return (
      <p className={styles.emptyState}>
        Need ≥ 2 metrics for comparison analysis.
      </p>
    );
  }

  return (
    <div className={styles.snapshotGrid}>
      {pairs.map(pair => {
        const status = getPairStatus(pair, anomalies);
        return (
          <button
            key={pair.join('__')}
            className={styles.snapshotRow}
            onClick={() => onRowClick(pair)}
            aria-label={`${pair[0]} vs ${pair[1]}: ${STATUS_LABEL[status]}`}
          >
            <span className={`${styles.dot} ${DOT_CLASS[status]}`} aria-hidden="true" />
            <span className={styles.pairLabel}>
              {pair[0]} ↔ {pair[1]}
            </span>
            <span className={styles.statusLabel}>{STATUS_LABEL[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
