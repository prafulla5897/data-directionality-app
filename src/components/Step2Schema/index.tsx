/**
 * Step 2 — Schema confirmation UI.
 * Lets users confirm date column, toggle dimensions, change metric types, and add custom formulas.
 */

import { useState } from 'react';
import type { Schema, MetricConfig, MetricType } from '../../types/index.js';
import { FormulaBuilder } from './FormulaBuilder.js';
import styles from './Step2Schema.module.css';

interface Step2SchemaProps {
  rawSchema: Schema;
  rowCount: number;
  onConfirm: (schema: Schema) => void;
  onBack: () => void;
}

type AggregationType = MetricConfig['aggregation'];

function aggregationForType(type: MetricType): AggregationType {
  if (type === 'derived') return 'recalculate';
  if (type === 'unique') return 'raw';
  return 'sum';
}

/**
 * Schema confirmation step.
 * Users can reassign columns, change metric types, and add custom formulas.
 * @param props - rawSchema from parser, rowCount, confirm/back callbacks
 * @returns JSX schema editor
 */
export function Step2Schema({ rawSchema, rowCount, onConfirm, onBack }: Step2SchemaProps): JSX.Element {
  const [dateCol, setDateCol] = useState(rawSchema.dateCol);
  const [dimensions, setDimensions] = useState<string[]>(rawSchema.dimensionCols);
  const [metrics, setMetrics] = useState<MetricConfig[]>(rawSchema.metrics);
  const [showFormula, setShowFormula] = useState(false);

  // All non-date columns for reassignment
  const allCols = [...rawSchema.dimensionCols, ...rawSchema.metrics.map(m => m.name)];

  function toggleDimension(col: string, checked: boolean): void {
    if (checked) {
      setDimensions(prev => [...prev, col]);
    } else {
      setDimensions(prev => prev.filter(d => d !== col));
    }
  }

  function moveDimToMetric(col: string): void {
    setDimensions(prev => prev.filter(d => d !== col));
    setMetrics(prev => [...prev, { name: col, type: 'summable', aggregation: 'sum' }]);
  }

  function moveMetricToDim(name: string): void {
    setMetrics(prev => prev.filter(m => m.name !== name));
    setDimensions(prev => [...prev, name]);
  }

  function updateMetricType(name: string, type: MetricType): void {
    setMetrics(prev =>
      prev.map(m =>
        m.name === name ? { ...m, type, aggregation: aggregationForType(type), formula: type === 'derived' ? m.formula : undefined, components: type === 'derived' ? m.components : undefined } : m
      )
    );
  }

  function addCustomMetric(metric: MetricConfig): void {
    setMetrics(prev => [...prev, metric]);
    setShowFormula(false);
  }

  function handleConfirm(): void {
    onConfirm({
      dateCol,
      dateFormat: rawSchema.dateFormat,
      dimensionCols: dimensions,
      metrics,
    });
  }

  const typeBadgeClass = (type: MetricType): string => {
    if (type === 'derived') return `${styles.badge} ${styles.badgeDerived}`;
    if (type === 'unique') return `${styles.badge} ${styles.badgeUnique}`;
    return `${styles.badge} ${styles.badgeSummable}`;
  };

  const allColsForFormula = allCols.filter(c => c !== dateCol && !dimensions.includes(c));

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.heading}>Confirm data schema</h2>
        <p className={styles.subheading}>{rowCount.toLocaleString()} rows detected — check and adjust column roles</p>
      </div>

      {/* Date column */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Date column</span>
        <div className={styles.dateRow}>
          <span className={styles.dateLabel}>Date</span>
          <select
            className={styles.select}
            value={dateCol}
            onChange={e => setDateCol(e.target.value)}
            aria-label="Select date column"
          >
            {allCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className={styles.columnMeta}>Format: {rawSchema.dateFormat}</span>
        </div>
      </div>

      {/* Dimensions */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Dimensions (segment by)</span>
        {dimensions.filter(d => d !== dateCol).map(col => (
          <div key={col} className={styles.columnRow}>
            <input
              type="checkbox"
              checked
              onChange={e => toggleDimension(col, e.target.checked)}
              id={`dim-${col}`}
              aria-label={`Include dimension ${col}`}
            />
            <label htmlFor={`dim-${col}`} className={styles.columnName}>{col}</label>
            <button className={styles.moveBtn} onClick={() => moveDimToMetric(col)} aria-label={`Move ${col} to metrics`}>
              → metric
            </button>
          </div>
        ))}
        {/* Unchecked dims are those in rawSchema.dimensionCols not in current dimensions */}
        {rawSchema.dimensionCols.filter(c => c !== dateCol && !dimensions.includes(c)).map(col => (
          <div key={col} className={styles.columnRow}>
            <input
              type="checkbox"
              checked={false}
              onChange={e => toggleDimension(col, e.target.checked)}
              id={`dim-${col}`}
              aria-label={`Include dimension ${col}`}
            />
            <label htmlFor={`dim-${col}`} className={styles.columnName} style={{ color: 'var(--dim)' }}>{col}</label>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Metrics (analyse)</span>
        {metrics.map(m => (
          <div key={m.name} className={styles.columnRow}>
            <span className={styles.columnName}>{m.name}</span>
            <span className={typeBadgeClass(m.type)}>
              {m.type === 'summable' ? 'Sum' : m.type === 'derived' ? 'Derived' : 'Unique'}
            </span>
            <select
              className={styles.select}
              value={m.type}
              onChange={e => updateMetricType(m.name, e.target.value as MetricType)}
              aria-label={`Aggregation type for ${m.name}`}
            >
              <option value="summable">Sum</option>
              <option value="derived">Derived</option>
              <option value="unique">Unique</option>
            </select>
            {m.formula && <span className={styles.formulaHint}>{m.formula}</span>}
            <button className={styles.moveBtn} onClick={() => moveMetricToDim(m.name)} aria-label={`Move ${m.name} to dimensions`}>
              → dim
            </button>
          </div>
        ))}
        <button className={styles.addFormulaBtn} onClick={() => setShowFormula(true)}>
          + Add custom formula
        </button>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button
          className={styles.btnPrimary}
          onClick={handleConfirm}
          disabled={metrics.length === 0}
        >
          Confirm &amp; continue
        </button>
      </div>

      {showFormula && (
        <FormulaBuilder
          availableCols={allColsForFormula}
          onAdd={addCustomMetric}
          onClose={() => setShowFormula(false)}
        />
      )}
    </div>
  );
}
