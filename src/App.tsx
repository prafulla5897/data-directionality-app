/**
 * Root component and step router for Marketing Signal.
 * Manages AppState and routes between steps 1–8.
 */

import { useState } from 'react';
import type { AppState, RawRow, Schema } from './types/index.js';
import { Step1Upload } from './components/Step1Upload/index.js';
import { Step2Schema } from './components/Step2Schema/index.js';
import { CONFIG } from './constants/index.js';

const INITIAL_STATE: AppState = {
  step: 1,
  rawRows: [],
  schema: null,
  mergedFromTwoFiles: false,
  scopeConfig: { selectedDimensions: [], dateRangeStart: null, dateRangeEnd: null },
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
 * App root — routes between steps based on AppState.step.
 * Steps 1 and 2 are implemented in Phase 1; remaining steps are stubs.
 * @returns Root JSX element
 */
export function App(): JSX.Element {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

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
    setState(prev => ({ ...prev, schema, step: 3 }));
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

  // Steps 3–8: placeholder until Phase 2+
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--teal)', marginBottom: '1rem' }}>
        Step {state.step} — coming in Phase {state.step <= 5 ? 2 : state.step <= 6 ? 3 : 4}
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        {state.schema ? `Schema confirmed: ${state.schema.metrics.length} metrics, ${state.schema.dimensionCols.length} dimensions` : ''}
      </p>
      <button
        onClick={() => goTo(2)}
        style={{
          background: 'var(--bg4)', color: 'var(--text)', borderRadius: 'var(--r)',
          padding: '10px 20px', fontSize: '0.9rem',
        }}
      >
        ← Back to schema
      </button>
    </main>
  );
}
