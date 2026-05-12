/**
 * Step 5 — Analysis grain and display grain selection.
 * Auto-suggests grains based on noise-to-signal ratio and data span.
 */

import { useMemo, useState } from 'react';
import type { AppState, Grain, RawRow, Schema } from '../../types/index.js';
import { parseDateValue } from '../../utils/parser.js';
import { THRESHOLDS, CONFIG } from '../../constants/index.js';
import styles from './Step5Grain.module.css';

interface Step5GrainProps {
  rawRows: RawRow[];
  schema: Schema;
  scopeConfig: AppState['scopeConfig'];
  initialGrain: AppState['grainConfig'];
  onConfirm: (grain: AppState['grainConfig']) => void;
  onBack: () => void;
}

const GRAIN_ORDER: Grain[] = ['daily', 'weekly', 'monthly', 'quarterly'];

const WEEK_START_OPTIONS: Array<{ value: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

function grainKey(d: Date, grain: Grain): string {
  if (grain === 'daily') return d.toISOString().slice(0, 10);
  if (grain === 'weekly') {
    const copy = new Date(d.getTime());
    const day = copy.getDay();
    copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
    return copy.toISOString().slice(0, 10);
  }
  if (grain === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

function computeSuggestedAnalysisGrain(rawRows: RawRow[], schema: Schema): Grain {
  const metricCol = schema.metrics.find(m => m.type === 'summable')?.name;
  if (!metricCol || rawRows.length === 0) return 'weekly';

  const daily = new Map<string, number>();
  for (const row of rawRows) {
    const d = parseDateValue(row[schema.dateCol]);
    const v = Number(row[metricCol]);
    if (!d || isNaN(v)) continue;
    const key = d.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + v);
  }

  const dailyValues = [...daily.values()];
  if (dailyValues.length < 4) return 'weekly';
  const dailyVar = computeVariance(dailyValues);

  const candidates: Grain[] = ['weekly', 'monthly', 'quarterly'];
  let best: Grain = 'weekly';
  let bestRatio = Infinity;

  for (const g of candidates) {
    const map = new Map<string, number>();
    for (const [isoKey, val] of daily) {
      const gKey = grainKey(new Date(isoKey + 'T00:00:00'), g);
      map.set(gKey, (map.get(gKey) ?? 0) + val);
    }
    const gVar = computeVariance([...map.values()]);
    if (gVar === 0) continue;
    const ratio = dailyVar / gVar;
    if (ratio > 1.5 && ratio < bestRatio) {
      bestRatio = ratio;
      best = g;
    }
  }

  return best;
}

function computeDataSpanDays(rawRows: RawRow[], schema: Schema): number {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const row of rawRows) {
    const d = parseDateValue(row[schema.dateCol]);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return !min || !max ? 0 : Math.round((max.getTime() - min.getTime()) / 86_400_000);
}
function computeSuggestedDisplayGrain(spanDays: number, analysisGrain: Grain): Grain {
  let display: Grain;
  if (spanDays < 30) display = analysisGrain;
  else if (spanDays < 90) display = 'weekly';
  else if (spanDays < 365) display = 'monthly';
  else display = 'quarterly';

  const aIdx = GRAIN_ORDER.indexOf(analysisGrain);
  const dIdx = GRAIN_ORDER.indexOf(display);
  return dIdx < aIdx ? analysisGrain : display;
}

/**
 * Step 5 grain selection UI.
 * Auto-suggests analysis grain (noise-to-signal) and display grain (data span).
 * Shows dimension limit warning and advanced time budget slider.
 * @param props - rawRows, schema, scopeConfig, initialGrain, onConfirm callback, onBack callback
 * @returns JSX grain configuration form
 */
export function Step5Grain({ rawRows, schema, scopeConfig, initialGrain, onConfirm, onBack }: Step5GrainProps): JSX.Element {
  const suggestedAnalysis = useMemo(() => computeSuggestedAnalysisGrain(rawRows, schema), [rawRows, schema]);
  const dataSpanDays = useMemo(() => computeDataSpanDays(rawRows, schema), [rawRows, schema]);

  const [analysisGrain, setAnalysisGrain] = useState<Grain>(() => {
    if (initialGrain.analysisGrain !== 'daily') return initialGrain.analysisGrain;
    return computeSuggestedAnalysisGrain(rawRows, schema);
  });

  const [timeBudget, setTimeBudget] = useState(initialGrain.timeBudgetSeconds);
  const [weekStartDay, setWeekStartDay] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(initialGrain.weekStartDay ?? 1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dimWarningAccepted, setDimWarningAccepted] = useState(false);

  const { uniqueDimCombos, uniqueDates } = useMemo(() => {
    const selectedSet = new Set(scopeConfig.selectedDimensions);
    const primaryDimCol = schema.dimensionCols[0] ?? '';
    const filtered = rawRows.filter(row => {
      if (primaryDimCol && selectedSet.size > 0) {
        const val = String(row[primaryDimCol] ?? '').trim();
        if (!selectedSet.has(val)) return false;
      }
      return true;
    });
    const dimCols = schema.dimensionCols;
    const combos = new Set(filtered.map(r => dimCols.map(dc => String(r[dc] ?? '')).join('\x00')));
    const dates = new Set(filtered.map(r => String(r[schema.dateCol] ?? '')));
    return { uniqueDimCombos: combos.size || 1, uniqueDates: dates.size };
  }, [rawRows, schema, scopeConfig.selectedDimensions]);

  const dailyTotalRows = uniqueDimCombos * uniqueDates;
  const dailyDisabled = dailyTotalRows > THRESHOLDS.MAX_ROWS;

  const { maxDimensions, dimensionWarning } = useMemo(() => {
    const pairs = (schema.metrics.length * (schema.metrics.length - 1)) / 2;
    if (pairs === 0 || uniqueDimCombos === 0 || uniqueDates === 0) {
      return { maxDimensions: Infinity, dimensionWarning: false };
    }
    const totalRows = uniqueDimCombos * uniqueDates;
    const maxAnalyses = (timeBudget * CONFIG.OPS_PER_SECOND) / (totalRows * pairs);
    const max = Math.max(1, Math.floor(Math.log2(maxAnalyses + 1)));
    return { maxDimensions: max, dimensionWarning: schema.dimensionCols.length > max };
  }, [schema.metrics.length, schema.dimensionCols.length, uniqueDimCombos, uniqueDates, timeBudget]);

  function handleSetAnalysisGrain(g: Grain): void {
    setAnalysisGrain(g);
  }

  function handleConfirm(): void {
    onConfirm({
      analysisGrain,
      displayGrain: computeSuggestedDisplayGrain(dataSpanDays, analysisGrain),
      timeBudgetSeconds: timeBudget,
      weekStartDay,
    });
  }

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.heading}>Set analysis grain</h2>
        <p className={styles.subheading}>
          Choose how to group your data for analysis.
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Analysis grain</span>
        <div className={styles.grainRow}>
          {GRAIN_ORDER.map(g => {
            const isDisabled = g === 'daily' && dailyDisabled;
            const isActive = analysisGrain === g;
            const isRecommended = g === suggestedAnalysis;
            return (
              <button
                key={g}
                className={`${styles.grainBtn} ${isActive ? styles.grainBtnActive : ''}`}
                disabled={isDisabled}
                onClick={() => handleSetAnalysisGrain(g)}
                aria-pressed={isActive}
                aria-label={`${g} analysis grain${isRecommended ? ' — recommended' : ''}${isDisabled ? ' — disabled' : ''}`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
                {isRecommended && !isDisabled && (
                  <span className={styles.recommendedBadge}>Recommended</span>
                )}
                {isDisabled && (
                  <span className={styles.disabledNote}>Too large</span>
                )}
              </button>
            );
          })}
        </div>
        {dailyDisabled && (
          <p className={styles.hint}>
            Daily not available — dataset exceeds 50,000 rows at daily grain. Use weekly (reduces rows by 7×) or coarser.
          </p>
        )}
        {analysisGrain === 'weekly' && (
          <div className={styles.weekStartRow}>
            <span className={styles.sectionLabel}>Week starts on</span>
            <div className={styles.grainRow}>
              {WEEK_START_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`${styles.grainBtn} ${weekStartDay === value ? styles.grainBtnActive : ''}`}
                  onClick={() => setWeekStartDay(value)}
                  aria-pressed={weekStartDay === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {dimensionWarning && !dimWarningAccepted && (
        <div className={styles.warning} role="alert">
          With {schema.dimensionCols.length} dimension{schema.dimensionCols.length !== 1 ? 's' : ''}, analysis may exceed your time budget.
          Maximum recommended: {maxDimensions} dimension{maxDimensions !== 1 ? 's' : ''} within {timeBudget}s.
          You can increase the time budget below or continue anyway.
          <br />
          <button
            style={{ marginTop: '8px', background: 'none', color: 'var(--amber)', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => setDimWarningAccepted(true)}
          >
            I understand, continue anyway
          </button>
        </div>
      )}

      <div className={styles.section}>
        <button
          className={styles.advancedToggle}
          onClick={() => setAdvancedOpen(prev => !prev)}
          aria-expanded={advancedOpen}
        >
          <span>{advancedOpen ? '▲' : '▼'}</span>
          <span>Advanced options</span>
        </button>
        {advancedOpen && (
          <div className={styles.advancedPanel}>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>Processing time limit:</span>
              <input
                type="range"
                className={styles.slider}
                min={CONFIG.MIN_TIME_BUDGET_SECONDS}
                max={CONFIG.MAX_TIME_BUDGET_SECONDS}
                step={10}
                value={timeBudget}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeBudget(Number(e.target.value))}
                aria-label="Processing time limit in seconds"
              />
              <span className={styles.sliderValue}>{timeBudget}s</span>
            </div>
            <p className={styles.advancedNote}>
              Longer = more dimension combinations analysed. Maximum: {CONFIG.MAX_TIME_BUDGET_SECONDS}s (browser safe limit).
            </p>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button className={styles.btnPrimary} onClick={handleConfirm}>
          Run Analysis
        </button>
      </div>
    </div>
  );
}
