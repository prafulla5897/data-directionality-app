/**
 * Two-file merge mapping UI.
 * Shows suggested dimension column mappings and lets the user confirm or override.
 */

import { useState } from 'react';
import type { ColumnMapping, Schema } from '../../types/index.js';
import styles from './Step1Upload.module.css';

interface MergeMappingProps {
  schema1: Schema;
  schema2: Schema;
  initialMappings: ColumnMapping[];
  /** Called with confirmed mappings when user clicks Merge */
  onConfirm: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}

/**
 * UI for confirming/editing dimension column mappings between two files.
 * @param props - Schema info, initial suggestions, and callbacks
 * @returns JSX form for mapping columns
 */
export function MergeMapping({
  schema1,
  schema2,
  initialMappings,
  onConfirm,
  onBack,
}: MergeMappingProps): JSX.Element {
  const [mappings, setMappings] = useState<ColumnMapping[]>(initialMappings);

  function updateFile2Col(file1Col: string, file2Col: string): void {
    setMappings(prev =>
      prev.map(m => (m.file1Col === file1Col ? { ...m, file2Col, confidence: 1.0 } : m))
    );
  }

  function removeMapping(file1Col: string): void {
    setMappings(prev => prev.filter(m => m.file1Col !== file1Col));
  }

  function addMapping(): void {
    const unused1 = schema1.dimensionCols.find(c => !mappings.some(m => m.file1Col === c));
    const unused2 = schema2.dimensionCols.find(c => !mappings.some(m => m.file2Col === c));
    if (unused1 && unused2) {
      setMappings(prev => [...prev, { file1Col: unused1, file2Col: unused2, confidence: 0.5 }]);
    }
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    color: 'var(--muted)',
    fontWeight: 500,
    borderBottom: '1px solid var(--bg4)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--bg3)',
    color: 'var(--text)',
  };
  const selectStyle: React.CSSProperties = {
    background: 'var(--bg3)',
    border: '1px solid var(--bg4)',
    borderRadius: 'var(--r)',
    color: 'var(--text)',
    padding: '4px 8px',
    fontSize: '0.875rem',
    width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <h3 style={{ color: 'var(--text)', marginBottom: 'var(--space-2)' }}>
          Map columns between files
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Confirm which dimension columns match between your two files.
          Metrics from both files will be combined on matching rows.
        </p>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>File 1 column</th>
            <th style={thStyle}>File 2 column</th>
            <th style={thStyle}>Confidence</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {mappings.map(m => (
            <tr key={m.file1Col}>
              <td style={tdStyle}>{m.file1Col}</td>
              <td style={tdStyle}>
                <select
                  value={m.file2Col}
                  onChange={e => updateFile2Col(m.file1Col, e.target.value)}
                  style={selectStyle}
                  aria-label={`Map ${m.file1Col} to file 2 column`}
                >
                  {schema2.dimensionCols.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </td>
              <td style={{ ...tdStyle, color: m.confidence > 0.7 ? 'var(--teal)' : 'var(--amber)' }}>
                {Math.round(m.confidence * 100)}%
              </td>
              <td style={tdStyle}>
                <button
                  onClick={() => removeMapping(m.file1Col)}
                  style={{ color: 'var(--coral)', background: 'none', fontSize: '0.875rem' }}
                  aria-label={`Remove mapping for ${m.file1Col}`}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {schema1.dimensionCols.some(c => !mappings.some(m => m.file1Col === c)) && (
        <button
          onClick={addMapping}
          style={{ color: 'var(--amber)', background: 'none', fontSize: '0.875rem', alignSelf: 'flex-start' }}
        >
          + Add mapping
        </button>
      )}

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onBack}>Back</button>
        <button
          className={styles.btnPrimary}
          onClick={() => onConfirm(mappings)}
          disabled={mappings.length === 0}
        >
          Merge files
        </button>
      </div>
    </div>
  );
}
