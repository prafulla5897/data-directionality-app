/**
 * Step 3 — Scope management for large datasets.
 * Shown only when total rows exceed 50,000. Provides campaign and date range selectors.
 */

import { useMemo, useState } from 'react';
import type { AppState, RawRow, Schema } from '../../types/index.js';
import { parseDateValue } from '../../utils/parser.js';
import { THRESHOLDS } from '../../constants/index.js';
import styles from './Step3Scope.module.css';

interface Step3ScopeProps {
  rawRows: RawRow[];
  schema: Schema;
  initialScope: AppState['scopeConfig'];
  onConfirm: (scope: AppState['scopeConfig']) => void;
  onBack: () => void;
}

type DateMode = '1year' | '2years' | 'all' | 'custom';

interface DateModeOption {
  value: DateMode;
  label: string;
}

const DATE_MODES: DateModeOption[] = [
  { value: '1year', label: 'Last 1 year' },
  { value: '2years', label: 'Last 2 years — recommended' },
  { value: 'all', label: 'All data' },
  { value: 'custom', label: 'Custom' },
];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatSpend(spend: number): string {
  if (spend >= 1_000_000) return `$${(spend / 1_000_000).toFixed(1)}M`;
  if (spend >= 1_000) return `$${Math.round(spend / 1_000)}K`;
  return `$${Math.round(spend)}`;
}

/**
 * Step 3 scope management UI. Renders campaign selector and date range controls with a live row counter.
 * @param props - rawRows, schema, initialScope, onConfirm callback, onBack callback
 * @returns JSX scope management form
 */
export function Step3Scope({ rawRows, schema, initialScope, onConfirm, onBack }: Step3ScopeProps): JSX.Element {
  const primaryDimCol = schema.dimensionCols[0] ?? '';

  const { allCampaigns, campaignSpend } = useMemo(() => {
    if (!primaryDimCol) return { allCampaigns: [] as string[], campaignSpend: new Map<string, number>() };
    const spendCol =
      schema.metrics.find(m => m.name.toLowerCase().includes('spend') && m.type === 'summable') ??
      schema.metrics.find(m => m.type === 'summable');
    const map = new Map<string, number>();
    for (const row of rawRows) {
      const campaign = String(row[primaryDimCol] ?? '').trim();
      if (!campaign) continue;
      const v = spendCol ? Number(row[spendCol.name]) : 1;
      map.set(campaign, (map.get(campaign) ?? 0) + (isNaN(v) ? 0 : v));
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    return { allCampaigns: sorted, campaignSpend: map };
  }, [rawRows, primaryDimCol, schema.metrics]);

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(() => {
    if (initialScope.selectedDimensions.length > 0) return initialScope.selectedDimensions;
    if (!primaryDimCol) return [];
    return [...new Set(rawRows.map(r => String(r[primaryDimCol] ?? '').trim()).filter(Boolean))];
  });

  const [dateMode, setDateMode] = useState<DateMode>(() =>
    initialScope.dateRangeStart != null ? 'custom' : '2years'
  );
  const [customStart, setCustomStart] = useState(
    initialScope.dateRangeStart ? toDateStr(initialScope.dateRangeStart) : ''
  );
  const [customEnd, setCustomEnd] = useState(
    initialScope.dateRangeEnd ? toDateStr(initialScope.dateRangeEnd) : ''
  );
  const [aggregateOther, setAggregateOther] = useState(initialScope.aggregateOther);

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

  const effectiveStart = useMemo((): Date | null => {
    if (!dataMax) return null;
    if (dateMode === 'all') return dataMin;
    if (dateMode === '1year') {
      const d = new Date(dataMax.getTime());
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    if (dateMode === '2years') {
      const d = new Date(dataMax.getTime());
      d.setFullYear(d.getFullYear() - 2);
      return d;
    }
    return customStart ? new Date(customStart + 'T00:00:00') : null;
  }, [dateMode, dataMin, dataMax, customStart]);

  const effectiveEnd = useMemo((): Date | null => {
    if (!dataMax) return null;
    if (dateMode === 'custom') return customEnd ? new Date(customEnd + 'T00:00:00') : null;
    return dataMax;
  }, [dateMode, dataMax, customEnd]);

  const { uniqueDimCombos, datePeriods } = useMemo(() => {
    const selectedSet = new Set(selectedCampaigns);
    const filtered = rawRows.filter(row => {
      if (primaryDimCol && selectedCampaigns.length < allCampaigns.length) {
        const campaign = String(row[primaryDimCol] ?? '').trim();
        if (!selectedSet.has(campaign)) return false;
      }
      const d = parseDateValue(row[schema.dateCol]);
      if (!d) return false;
      if (effectiveStart && d < effectiveStart) return false;
      if (effectiveEnd && d > effectiveEnd) return false;
      return true;
    });

    const dimCols = schema.dimensionCols;
    const combos = new Set(filtered.map(r => dimCols.map(dc => String(r[dc] ?? '')).join('\x00')));
    const dates = new Set(filtered.map(r => String(r[schema.dateCol] ?? '')));

    let comboCount = combos.size || 1;
    if (aggregateOther && selectedCampaigns.length < allCampaigns.length) comboCount += 1;

    return { uniqueDimCombos: comboCount, datePeriods: dates.size };
  }, [rawRows, selectedCampaigns, allCampaigns.length, effectiveStart, effectiveEnd, schema, primaryDimCol, aggregateOther]);

  const totalRows = uniqueDimCombos * datePeriods;
  const canContinue = totalRows <= THRESHOLDS.MAX_ROWS;

  function toggleCampaign(campaign: string, checked: boolean): void {
    setSelectedCampaigns(prev =>
      checked ? [...prev, campaign] : prev.filter(c => c !== campaign)
    );
  }

  function handleConfirm(): void {
    const allSelected = selectedCampaigns.length >= allCampaigns.length;
    onConfirm({
      selectedDimensions: allSelected ? [] : selectedCampaigns,
      dateRangeStart: effectiveStart,
      dateRangeEnd: effectiveEnd,
      aggregateOther,
    });
  }

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.heading}>Reduce scope</h2>
        <p className={styles.subheading}>
          Your dataset is large. Narrow it to stay within the 50,000-row analysis limit.
        </p>
      </div>

      <div className={styles.counter} role="status" aria-live="polite">
        <span className={styles.counterPart}>{uniqueDimCombos.toLocaleString()} dimension combos</span>
        <span className={styles.counterSep}>×</span>
        <span className={styles.counterPart}>{datePeriods.toLocaleString()} date periods</span>
        <span className={styles.counterSep}>=</span>
        <span className={`${styles.counterTotal} ${canContinue ? styles.counterOk : styles.counterOver}`}>
          {totalRows.toLocaleString()} rows {canContinue ? '✓' : '— over limit'}
        </span>
      </div>

      {primaryDimCol && allCampaigns.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{primaryDimCol} (ranked by spend)</span>
          {allCampaigns.map(campaign => (
            <div key={campaign} className={styles.campaignRow}>
              <input
                type="checkbox"
                id={`camp-${campaign}`}
                checked={selectedCampaigns.includes(campaign)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => toggleCampaign(campaign, e.target.checked)}
                aria-label={`Include ${campaign}`}
              />
              <label htmlFor={`camp-${campaign}`} className={styles.campaignLabel}>{campaign}</label>
              <span className={styles.campaignSpend}>{formatSpend(campaignSpend.get(campaign) ?? 0)}</span>
            </div>
          ))}
          <label className={styles.aggregateRow}>
            <input
              type="checkbox"
              checked={aggregateOther}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAggregateOther(e.target.checked)}
              aria-label="Aggregate unselected as Other"
            />
            <span>Aggregate unselected as &ldquo;Other&rdquo;</span>
          </label>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Date range</span>
        {DATE_MODES.map(({ value, label }) => (
          <label key={value} className={styles.radioRow}>
            <input
              type="radio"
              name="dateMode"
              value={value}
              checked={dateMode === value}
              onChange={() => setDateMode(value)}
              aria-label={label}
            />
            <span>{label}</span>
          </label>
        ))}
        {dateMode === 'custom' && (
          <div className={styles.dateRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={customStart}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStart(e.target.value)}
              aria-label="Custom start date"
            />
            <span>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customEnd}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEnd(e.target.value)}
              aria-label="Custom end date"
            />
          </div>
        )}
      </div>

      {!canContinue && (
        <div className={styles.hint} role="alert">
          Still too large. You can reduce grain in Step 5 (weekly grain cuts rows by 7×).
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} disabled={!canContinue} onClick={handleConfirm}>
          Continue
        </button>
      </div>
    </div>
  );
}
