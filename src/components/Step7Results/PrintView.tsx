/**
 * Print-only view — renders the full anomaly report for window.print() / PDF export.
 * Hidden in normal browser view via .printOnly CSS class.
 */

import type { Anomaly, AppState } from '../../types/index.js';

interface PrintViewProps {
  anomalies: Anomaly[];
  windowConfig: AppState['windowConfig'];
}

function fmtDate(d: Date | null): string {
  if (!d) return '?';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayPeriodEnd(start: Date, end: Date): Date {
  return end.getTime() > start.getTime() ? new Date(end.getTime() - 86_400_000) : start;
}

interface PrintCardProps { anomaly: Anomaly; }

function PrintCard({ anomaly }: PrintCardProps): JSX.Element {
  const dimStr = Object.values(anomaly.dimensionValues).filter(Boolean).join(' · ');
  const endDisplay = displayPeriodEnd(anomaly.periodStart, anomaly.periodEnd);
  const period = `${fmtDate(anomaly.periodStart)} – ${fmtDate(endDisplay)}`;
  const cardClass = `printCard printCard${anomaly.severity.charAt(0).toUpperCase() + anomaly.severity.slice(1)}`;
  return (
    <div className={cardClass}>
      <div className="printCardMeta">
        {anomaly.severity.toUpperCase()}
        {dimStr ? ` · ${dimStr}` : ''}
        {' · '}{period}
        {' · '}{anomaly.metricPair[0]} ↔ {anomaly.metricPair[1]}
      </div>
      <div className="printCardTitle">{anomaly.title}</div>
      <div className="printCardBody">{anomaly.body}</div>
    </div>
  );
}

/**
 * Renders the print-only anomaly report, hidden in browser view.
 * Displays metadata header then anomaly cards grouped by severity.
 * @param props - anomalies and window configuration for metadata
 * @returns JSX print-only layout
 */
export function PrintView({ anomalies, windowConfig }: PrintViewProps): JSX.Element {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const critical = anomalies.filter(a => a.severity === 'critical');
  const warnings = anomalies.filter(a => a.severity === 'warning');
  const infos    = anomalies.filter(a => a.severity === 'info');

  return (
    <div className="printOnly" aria-hidden="true">
      <div className="printHeader">
        <h1>Marketing Signal — Analysis Report</h1>
        <p>Generated: {today}</p>
        <p>Baseline: {fmtDate(windowConfig.baselineStart)} – {fmtDate(windowConfig.baselineEnd)}</p>
        <p>Anomaly window: {fmtDate(windowConfig.anomalyStart)} – {fmtDate(windowConfig.anomalyEnd)}</p>
      </div>

      {critical.length > 0 && (
        <div>
          <div className="printSectionHeading">Critical</div>
          {critical.map(a => <PrintCard key={a.id} anomaly={a} />)}
        </div>
      )}

      {warnings.length > 0 && (
        <div className={critical.length > 0 ? 'printPageBreak' : ''}>
          <div className="printSectionHeading">Warnings</div>
          {warnings.map(a => <PrintCard key={a.id} anomaly={a} />)}
        </div>
      )}

      {infos.length > 0 && (
        <div className={(critical.length > 0 || warnings.length > 0) ? 'printPageBreak' : ''}>
          <div className="printSectionHeading">Info</div>
          {infos.map(a => <PrintCard key={a.id} anomaly={a} />)}
        </div>
      )}

      {anomalies.length === 0 && (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No anomalies detected in the selected window.</p>
      )}
    </div>
  );
}
