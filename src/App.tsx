/**
 * Root component and step router for Marketing Signal.
 * Manages AppState and routes between steps 1–8.
 * Executes analysis in Step 6 via chunked async processing.
 */

import { useState, useEffect, useRef } from 'react';
import type { AppState, RawRow, Schema, Series, Anomaly } from './types/index.js';
import { Step1Upload } from './components/Step1Upload/index.js';
import { Step2Schema } from './components/Step2Schema/index.js';
import { Step3Scope } from './components/Step3Scope/index.js';
import { Step4Windows } from './components/Step4Windows/index.js';
import { Step5Grain } from './components/Step5Grain/index.js';
import { Step6Progress } from './components/Step6Progress/index.js';
import { Step7Results } from './components/Step7Results/index.js';
import { Step8Drilldown } from './components/Step8Drilldown/index.js';
import { THRESHOLDS, CONFIG } from './constants/index.js';
import { parseDateValue } from './utils/parser.js';
import { buildSeries, generateDimensionSubsets } from './utils/aggregator.js';
import { generateAnomalies } from './utils/ruleEngine.js';

const INITIAL_STATE: AppState = {
  step: 1,
  rawRows: [],
  schema: null,
  mergedFromTwoFiles: false,
  scopeConfig: {
    selectedDimensions: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    aggregateOther: false,
  },
  windowConfig: { baselineStart: null, baselineEnd: null, anomalyStart: null, anomalyEnd: null },
  grainConfig: {
    analysisGrain: 'daily',
    displayGrain: 'weekly',
    timeBudgetSeconds: CONFIG.DEFAULT_TIME_BUDGET_SECONDS,
    weekStartDay: 1,
  },
  seriesList: [],
  baselineStats: [],
  anomalies: [],
};

function computeTotalRows(rows: RawRow[], schema: Schema): number {
  const dimCols = schema.dimensionCols;
  const combos = new Set(rows.map(r => dimCols.map(d => String(r[d] ?? '')).join('\x00')));
  const dates = new Set(rows.map(r => String(r[schema.dateCol] ?? '')));
  return (combos.size || 1) * dates.size;
}

function getDataRange(rows: RawRow[], schema: Schema): { min: Date; max: Date } | null {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const row of rows) {
    const d = parseDateValue(row[schema.dateCol]);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return min && max ? { min, max } : null;
}

function resolveWindows(
  cfg: AppState['windowConfig'],
  range: { min: Date; max: Date } | null,
): { baselineStart: Date; baselineEnd: Date; anomalyStart: Date; anomalyEnd: Date } {
  const fallbackMin = range?.min ?? new Date(0);
  const fallbackMax = range?.max ?? new Date();
  const baselineStart = cfg.baselineStart ?? fallbackMin;
  const baselineEnd = cfg.baselineEnd ?? fallbackMax;
  const anomalyEnd = cfg.anomalyEnd ?? fallbackMax;
  const anomalyStart = cfg.anomalyStart ?? new Date(anomalyEnd.getTime() - 30 * 86_400_000);
  return { baselineStart, baselineEnd, anomalyStart, anomalyEnd };
}

function filterRowsByScope(rows: RawRow[], schema: Schema, scope: AppState['scopeConfig']): RawRow[] {
  return rows.filter(row => {
    if (scope.dateRangeStart || scope.dateRangeEnd) {
      const d = parseDateValue(row[schema.dateCol]);
      if (d) {
        if (scope.dateRangeStart && d < scope.dateRangeStart) return false;
        if (scope.dateRangeEnd && d > scope.dateRangeEnd) return false;
      }
    }
    if (scope.selectedDimensions.length > 0 && schema.dimensionCols.length > 0) {
      const primary = schema.dimensionCols[0];
      const val = String(row[primary] ?? '');
      if (!scope.selectedDimensions.includes(val)) return false;
    }
    return true;
  });
}

/**
 * App root — routes between steps based on AppState.step.
 * Step 3 is shown conditionally only when total rows exceed 50,000.
 * @returns Root JSX element
 */
export function App(): JSX.Element {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [step3WasShown, setStep3WasShown] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  function goTo(step: number): void {
    setState(prev => ({ ...prev, step }));
  }

  function onUploadComplete(rows: RawRow[], schema: Schema, merged: boolean): void {
    setState(prev => ({ ...prev, rawRows: rows, schema, mergedFromTwoFiles: merged, step: 2 }));
  }

  function onSchemaConfirm(schema: Schema): void {
    const totalRows = computeTotalRows(state.rawRows, schema);
    if (totalRows > THRESHOLDS.MAX_ROWS) {
      setStep3WasShown(true);
      setState(prev => ({ ...prev, schema, step: 3 }));
    } else {
      setState(prev => ({ ...prev, schema, step: 4 }));
    }
  }

  function onScopeConfirm(scopeConfig: AppState['scopeConfig']): void {
    setState(prev => ({ ...prev, scopeConfig, step: 4 }));
  }

  function onWindowConfirm(windowConfig: AppState['windowConfig']): void {
    setState(prev => ({ ...prev, windowConfig, step: 5 }));
  }

  function onGrainConfirm(grainConfig: AppState['grainConfig']): void {
    setState(prev => ({ ...prev, grainConfig, step: 6 }));
  }

  // Capture a stable snapshot of analysis inputs when we enter step 6
  const analysisSnapshotRef = useRef<{
    rows: RawRow[]; schema: Schema; grainConfig: AppState['grainConfig'];
    windowConfig: AppState['windowConfig']; scopeConfig: AppState['scopeConfig'];
  } | null>(null);

  useEffect(() => {
    if (state.step === 6 && state.schema) {
      analysisSnapshotRef.current = {
        rows: state.rawRows,
        schema: state.schema,
        grainConfig: state.grainConfig,
        windowConfig: state.windowConfig,
        scopeConfig: state.scopeConfig,
      };
    }
  }, [state.step, state.schema, state.rawRows, state.grainConfig, state.windowConfig, state.scopeConfig]);

  useEffect(() => {
    if (state.step !== 6) return;
    const snap = analysisSnapshotRef.current;
    if (!snap) return;

    let cancelled = false;
    const { rows, schema, grainConfig, windowConfig, scopeConfig } = snap;
    const range = getDataRange(rows, schema);
    const { baselineStart, baselineEnd, anomalyStart, anomalyEnd } = resolveWindows(windowConfig, range);
    const filteredRows = filterRowsByScope(rows, schema, scopeConfig);
    const rawSubsets = generateDimensionSubsets(schema.dimensionCols);
    const subsets = rawSubsets.length === 0 ? [[]] as string[][] : rawSubsets;

    setProgressCurrent(0);
    setProgressTotal(subsets.length);

    let allSeries: Series[] = [];
    let idx = 0;

    function processNext(): void {
      if (cancelled) return;
      if (idx >= subsets.length) {
        const anomalies = generateAnomalies(
          allSeries,
          { start: baselineStart, end: baselineEnd },
          { start: anomalyStart, end: anomalyEnd },
          grainConfig.timeBudgetSeconds,
        );
        setState(prev => ({ ...prev, seriesList: allSeries, anomalies, step: 7 }));
        return;
      }
      const chunk = buildSeries(filteredRows, schema, grainConfig.analysisGrain, subsets[idx], grainConfig.weekStartDay);
      allSeries = allSeries.concat(chunk);
      idx++;
      setProgressCurrent(idx);
      setTimeout(processNext, 0);
    }

    setTimeout(processNext, 30);
    return () => { cancelled = true; };
  }, [state.step]);

  if (state.step === 1) return <Step1Upload onComplete={onUploadComplete} />;

  if (state.step === 2 && state.schema) {
    return (
      <Step2Schema rawSchema={state.schema} rowCount={state.rawRows.length}
        onConfirm={onSchemaConfirm} onBack={() => goTo(1)} />
    );
  }

  if (state.step === 3 && state.schema) {
    return (
      <Step3Scope rawRows={state.rawRows} schema={state.schema}
        initialScope={state.scopeConfig} onConfirm={onScopeConfirm} onBack={() => goTo(2)} />
    );
  }

  if (state.step === 4 && state.schema) {
    return (
      <Step4Windows rawRows={state.rawRows} schema={state.schema}
        initialWindow={state.windowConfig} onConfirm={onWindowConfirm}
        onBack={() => goTo(step3WasShown ? 3 : 2)} />
    );
  }

  if (state.step === 5 && state.schema) {
    return (
      <Step5Grain rawRows={state.rawRows} schema={state.schema}
        scopeConfig={state.scopeConfig} initialGrain={state.grainConfig}
        onConfirm={onGrainConfirm} onBack={() => goTo(4)} />
    );
  }

  if (state.step === 6) {
    return (
      <Step6Progress
        current={progressCurrent}
        total={progressTotal}
        timeBudgetSeconds={state.grainConfig.timeBudgetSeconds}
        onCancel={() => goTo(5)}
      />
    );
  }

  if (state.step === 7 && state.schema) {
    return (
      <Step7Results
        anomalies={state.anomalies}
        schema={state.schema}
        grainConfig={state.grainConfig}
        windowConfig={state.windowConfig}
        onDrilldown={anomaly => { setSelectedAnomaly(anomaly); goTo(8); }}
        onChangeWindow={() => goTo(4)}
        onNewFile={() => { setState(INITIAL_STATE); setSelectedAnomaly(null); }}
        onBack={() => goTo(5)}
      />
    );
  }

  if (state.step === 8 && state.schema && selectedAnomaly) {
    return (
      <Step8Drilldown
        anomaly={selectedAnomaly}
        allAnomalies={state.anomalies}
        seriesList={state.seriesList}
        schema={state.schema}
        grainConfig={state.grainConfig}
        onBack={() => { setSelectedAnomaly(null); goTo(7); }}
        onSelectAnomaly={a => setSelectedAnomaly(a)}
      />
    );
  }

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>Loading…</p>
    </main>
  );
}
