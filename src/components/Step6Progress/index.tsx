/**
 * Step 6 — Analysis progress display.
 * Shows dimension combination progress and time estimate with cancel button.
 */

import styles from './Step6Progress.module.css';

interface Step6ProgressProps {
  current: number;
  total: number;
  timeBudgetSeconds: number;
  onCancel: () => void;
}

/**
 * Progress display for the background analysis step.
 * @param props - current, total subsets, time budget, cancel callback
 * @returns JSX progress UI
 */
export function Step6Progress({ current, total, timeBudgetSeconds, onCancel }: Step6ProgressProps): JSX.Element {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const timeLeft = total > 0 && current < total
    ? Math.max(1, Math.round(((total - current) / total) * timeBudgetSeconds))
    : null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <h2 className={styles.title}>Analysing…</h2>
      <p className={styles.stepLabel}>
        {current > 0
          ? `Step ${current} of ${total} dimension combination${total !== 1 ? 's' : ''}`
          : 'Preparing analysis…'}
      </p>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Analysis progress"
      >
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      {timeLeft !== null && (
        <p className={styles.timeEstimate}>~{timeLeft}s remaining</p>
      )}
      <button className={styles.btnCancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
