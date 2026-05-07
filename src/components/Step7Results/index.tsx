/**
 * Step 7 — Results dashboard: health snapshot, anomaly cards, methodology, export.
 */

import { useState, useCallback } from 'react';
import type { Anomaly, Schema, AppState, Grain } from '../../types/index.js';
import { AnomalyCard } from './AnomalyCard.js';
import { HealthSnapshot } from './HealthSnapshot.js';
import styles from './Step7Results.module.css';

interface Step7ResultsProps {
  anomalies: Anomaly[];
  schema: Schema;
  grainConfig: AppState['grainConfig'];
  windowConfig: AppState['windowConfig'];
  onDrilldown: (anomaly: Anomaly) => void;
  onChangeWindow: () => void;
  onNewFile: () => void;
  onBack: () => void;
}

type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';

function fmtDate(d: Date | null): string {
  if (!d) return '?';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGroupKey(date: Date, grain: Grain): string {
  switch (grain) {
    case 'daily': return date.toISOString().slice(0, 10);
    case 'weekly': {
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
      return d.toISOString().slice(0, 10);
    }
    case 'monthly':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'quarterly':
      return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  }
}

function getGroupHeading(key: string, grain: Grain): string {
  switch (grain) {
    case 'daily':
    case 'weekly':
      return new Date(key + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    case 'monthly': {
      const [y, m] = key.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    case 'quarterly':
      return `Q${key.split('-Q')[1]} ${key.split('-')[0]}`;
  }
}

function buildMarkdown(anomalies: Anomaly[], windowConfig: AppState['windowConfig']): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    '# Marketing Signal — Analysis Report',
    `Generated: ${today}`,
    `Baseline: ${fmtDate(windowConfig.baselineStart)} – ${fmtDate(windowConfig.baselineEnd)}`,
    `Anomaly window: ${fmtDate(windowConfig.anomalyStart)} – ${fmtDate(windowConfig.anomalyEnd)}`,
    '',
  ];
  const groups: Record<string, Anomaly[]> = { critical: [], warning: [], info: [] };
  for (const a of anomalies) groups[a.severity].push(a);
  const sections: [string, Anomaly[]][] = [
    ['## Critical anomalies', groups.critical],
    ['## Warnings', groups.warning],
    ['## Info', groups.info],
  ];
  for (const [header, items] of sections) {
    if (items.length === 0) continue;
    lines.push(header, '');
    for (const a of items) {
      const dimStr = Object.entries(a.dimensionValues).map(([k, v]) => `${k}: ${v}`).join(', ');
      lines.push(
        `### ${a.title}`,
        a.body,
        `- Dimension: ${dimStr || 'All'}`,
        `- Metrics: ${a.metricPair[0]} ↔ ${a.metricPair[1]}`,
        `- Period: ${fmtDate(a.periodStart)} – ${fmtDate(a.periodEnd)}`,
        '',
      );
    }
  }
  return lines.join('\n');
}

/**
 * Results dashboard with health snapshot, anomaly cards grouped by display grain,
 * methodology accordion, and export/navigation footer.
 * @param props - anomalies, schema, grain/window config, navigation callbacks
 * @returns JSX dashboard
 */
export function Step7Results({
  anomalies, schema, grainConfig, windowConfig,
  onDrilldown, onChangeWindow, onNewFile, onBack,
}: Step7ResultsProps): JSX.Element {
  const [filter, setFilter] = useState<FilterSeverity>('all');
  const [accordionOpen, setAccordionOpen] = useState(false);

  const filtered = filter === 'all' ? anomalies : anomalies.filter(a => a.severity === filter);

  const grouped = new Map<string, Anomaly[]>();
  for (const a of filtered) {
    const key = getGroupKey(a.periodStart, grainConfig.displayGrain);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }
  const sortedKeys = [...grouped.keys()].sort().reverse();

  const scrollToPair = useCallback((pair: [string, string]): void => {
    const el = document.querySelector(`[data-severity]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFilter(prev => {
      const hasCrit = anomalies.some(a => a.metricPair[0] === pair[0] && a.metricPair[1] === pair[1] && a.severity === 'critical');
      if (hasCrit) return 'critical';
      const hasWarn = anomalies.some(a => a.metricPair[0] === pair[0] && a.metricPair[1] === pair[1] && a.severity === 'warning');
      return hasWarn ? 'warning' : prev;
    });
  }, [anomalies]);

  function handleExport(): void {
    const md = buildMarkdown(anomalies, windowConfig);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-signal-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <h2 className={styles.heading}>Results</h2>
        <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          {fmtDate(windowConfig.anomalyStart)} – {fmtDate(windowConfig.anomalyEnd)}
        </span>
      </div>

      <section aria-labelledby="snapshot-heading">
        <p id="snapshot-heading" className={styles.sectionHeading}>Metric health</p>
        <HealthSnapshot metrics={schema.metrics} anomalies={anomalies} onRowClick={scrollToPair} />
      </section>

      <section aria-labelledby="cards-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <p id="cards-heading" className={styles.sectionHeading} style={{ margin: 0 }}>Anomalies</p>
          <div className={styles.filterBar} role="group" aria-label="Filter by severity">
            {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className={styles.emptyState}>No anomalies found for the selected filter.</p>
        ) : (
          sortedKeys.map(key => (
            <div key={key}>
              <p className={styles.groupHeading}>{getGroupHeading(key, grainConfig.displayGrain)}</p>
              <div className={styles.cardGrid}>
                {grouped.get(key)!.map(a => (
                  <AnomalyCard key={a.id} anomaly={a} onDrilldown={onDrilldown} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <div className={styles.accordion}>
        <button
          className={styles.accordionTrigger}
          onClick={() => setAccordionOpen(v => !v)}
          aria-expanded={accordionOpen}
        >
          <span>{accordionOpen ? '▲' : '▼'}</span>
          How we detect anomalies
        </button>
        {accordionOpen && (
          <div className={styles.accordionBody}>
            <div className={styles.accordionItem}>
              <p className={styles.accordionLabel}>1. Direction — do these metrics usually move together?</p>
              <p className={styles.accordionText}>We track how often two metrics move in the same direction over time. If they historically move together but suddenly move in opposite directions, that pattern is flagged.</p>
            </div>
            <div className={styles.accordionItem}>
              <p className={styles.accordionLabel}>2. Proportionality — when they change, is the size similar?</p>
              <p className={styles.accordionText}>We measure how much one metric changes relative to another. If the ratio is unusually different from the historical pattern, we flag it as out of the ordinary.</p>
            </div>
            <div className={styles.accordionItem}>
              <p className={styles.accordionLabel}>3. Persistence — has the pattern lasted multiple periods?</p>
              <p className={styles.accordionText}>We only flag patterns that persist for 2 or more periods. A one-off data point is treated as noise; a repeated pattern is a signal worth reviewing.</p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnSecondary} onClick={onChangeWindow}>Change window</button>
        <button className={styles.btnSecondary} onClick={onNewFile}>New file</button>
        <button className={styles.btnPrimary} onClick={handleExport}>Export insights as .md</button>
      </div>
    </div>
  );
}
