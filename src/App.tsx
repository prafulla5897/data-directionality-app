/**
 * Root component and step router for Marketing Signal.
 * Manages AppState and routes between steps 1–8.
 */

import { useState } from 'react';
import type { AppState, RawRow, Schema } from './types/index.js';
import { Step1Upload } from './components/Step1Upload/index.js';
import { Step2Schema } from './components/Step2Schema/index.js';
import { Step3Scope } from './components/Step3Scope/index.js';
import { Step4Windows } from './components/Step4Windows/index.js';
import { Step5Grain } from './components/Step5Grain/index.js';
import { THRESHOLDS, CONFIG } from './constants/index.js';

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
  },
  seriesList: [],
  baselineStats: [],
  anomalies: [],
};

/**
 * Compute estimated total rows for the scope check that gates Step 3.
 * total_rows = unique_dimension_combos × unique_date_periods
 * @param rows - All raw rows from the uploaded file(s)
 * @param schema - Confirmed schema with dateCol and dimensionCols
 * @returns Estimated total rows for analysis
 */
function computeTotalRows(rows: RawRow[], schema: Schema): number {
  const dimCols = schema.dimensionCols;
  const combos = new Set(rows.map(r => dimCols.map(d => String(r[d] ?? '')).join('\x00')));
  const dates = new Set(rows.map(r => String(r[schema.dateCol] ?? '')));
  return (combos.size || 1) * dates.size;
}

/**
 * App root — routes between steps based on AppState.step.
 * Step 3 is shown conditionally only when total rows exceed 50,000.
 * @returns Root JSX element
 */
export function App(): JSX.Element {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [step3WasShown, setStep3WasShown] = useState(false);

  function goTo(step: number): void {
    setState(prev => ({ ...prev, step }));
  }

  function onUploadComplete(rows: RawRow[], schema: Schema, merged: boolean): void {
    setState(prev => ({
      ...prev,
      rawRows: rows,
      schema,
      mergedFromTwoFiles: merged,
      step: 2,
    }));
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

  if (state.step === 1) {
    return <Step1Upload onComplete={onUploadComplete} />;
  }

  if (state.step === 2 && state.schema) {
    return (
      <Step2Schema
        rawSchema={state.schema}
        rowCount={state.rawRows.length}
        onConfirm={onSchemaConfirm}
        onBack={() => goTo(1)}
      />
    );
  }

  if (state.step === 3 && state.schema) {
    return (
      <Step3Scope
        rawRows={state.rawRows}
        schema={state.schema}
        initialScope={state.scopeConfig}
        onConfirm={onScopeConfirm}
        onBack={() => goTo(2)}
      />
    );
  }

  if (state.step === 4 && state.schema) {
    return (
      <Step4Windows
        rawRows={state.rawRows}
        schema={state.schema}
        initialWindow={state.windowConfig}
        onConfirm={onWindowConfirm}
        onBack={() => goTo(step3WasShown ? 3 : 2)}
      />
    );
  }

  if (state.step === 5 && state.schema) {
    return (
      <Step5Grain
        rawRows={state.rawRows}
        schema={state.schema}
        scopeConfig={state.scopeConfig}
        initialGrain={state.grainConfig}
        onConfirm={onGrainConfirm}
        onBack={() => goTo(4)}
      />
    );
  }

  // Steps 6–8: placeholder until Phase 3+
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--teal)', marginBottom: '1rem' }}>
        Step {state.step} — coming in Phase {state.step <= 6 ? 3 : 4}
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
        {state.schema
          ? `Schema: ${state.schema.metrics.length} metrics, ${state.schema.dimensionCols.length} dimensions`
          : ''}
      </p>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Analysis grain: {state.grainConfig.analysisGrain} | Display: {state.grainConfig.displayGrain}
      </p>
      <button
        onClick={() => goTo(5)}
        style={{
          background: 'var(--bg4)',
          color: 'var(--text)',
          borderRadius: 'var(--r)',
          padding: '10px 20px',
          fontSize: '0.9rem',
        }}
      >
        ← Back to grain config
      </button>
    </main>
  );
}
