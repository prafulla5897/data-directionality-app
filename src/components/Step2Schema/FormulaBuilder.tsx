/**
 * Formula builder modal — 3-tier custom metric creation.
 * Tier 1: pre-built presets. Tier 2: component picker. Tier 3: free-form.
 */

import { useState } from 'react';
import type { MetricConfig } from '../../types/index.js';
import styles from './Step2Schema.module.css';

const PREBUILT: MetricConfig[] = [
  { name: 'CTR',  type: 'derived', formula: 'clicks / impressions * 100', components: ['clicks', 'impressions'], aggregation: 'recalculate' },
  { name: 'CPM',  type: 'derived', formula: 'spend / impressions * 1000', components: ['spend', 'impressions'],  aggregation: 'recalculate' },
  { name: 'CPC',  type: 'derived', formula: 'spend / clicks',             components: ['spend', 'clicks'],       aggregation: 'recalculate' },
  { name: 'ROAS', type: 'derived', formula: 'revenue / spend',            components: ['revenue', 'spend'],      aggregation: 'recalculate' },
];

type Tier = 'prebuilt' | 'picker' | 'freeform';

interface FormulaBuilderProps {
  availableCols: string[];
  onAdd: (metric: MetricConfig) => void;
  onClose: () => void;
}

/**
 * Modal for creating a custom formula metric.
 * Supports pre-built presets, component picker, and free-form expression.
 * @param props - Available columns, onAdd callback, onClose callback
 * @returns Modal JSX
 */
export function FormulaBuilder({ availableCols, onAdd, onClose }: FormulaBuilderProps): JSX.Element {
  const [tier, setTier] = useState<Tier>('prebuilt');
  const [selectedPrebuilt, setSelectedPrebuilt] = useState<string>('CTR');
  const [pickerName, setPickerName] = useState('');
  const [numerator, setNumerator] = useState(availableCols[0] ?? '');
  const [denominator, setDenominator] = useState(availableCols[1] ?? availableCols[0] ?? '');
  const [multiplier, setMultiplier] = useState('1');
  const [freeformName, setFreeformName] = useState('');
  const [freeformExpr, setFreeformExpr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function validateFreeform(expr: string): string | null {
    const tokens = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
    const unknown = tokens.filter(t => !availableCols.includes(t));
    if (unknown.length > 0) return `Unknown column(s): ${unknown.join(', ')}`;
    return null;
  }

  function handleAdd(): void {
    setFormError(null);
    if (tier === 'prebuilt') {
      const preset = PREBUILT.find(p => p.name === selectedPrebuilt);
      if (preset) onAdd(preset);
      return;
    }
    if (tier === 'picker') {
      if (!pickerName.trim()) { setFormError('Name is required.'); return; }
      const mult = parseFloat(multiplier);
      const formula = isNaN(mult) || mult === 1
        ? `${numerator} / ${denominator}`
        : `${numerator} / ${denominator} * ${mult}`;
      onAdd({ name: pickerName.trim(), type: 'derived', formula, components: [numerator, denominator], aggregation: 'recalculate' });
      return;
    }
    // freeform
    if (!freeformName.trim()) { setFormError('Name is required.'); return; }
    if (!freeformExpr.trim()) { setFormError('Formula is required.'); return; }
    const err = validateFreeform(freeformExpr);
    if (err) { setFormError(err); return; }
    const tokens = freeformExpr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
    const comps = [...new Set(tokens.filter(t => availableCols.includes(t)))];
    onAdd({ name: freeformName.trim(), type: 'derived', formula: freeformExpr.trim(), components: comps, aggregation: 'recalculate' });
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--bg4)', borderRadius: 'var(--r)',
    color: 'var(--text)', padding: '8px 12px', fontSize: '0.875rem', width: '100%',
  };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--bg4)' : 'none',
    color: active ? 'var(--text)' : 'var(--muted)',
    borderRadius: 'var(--r)', padding: '6px 14px', fontSize: '0.875rem',
    transition: 'background 0.1s, color 0.1s',
  });

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Add custom formula">
      <div className={styles.modalBox}>
        <h3 className={styles.modalHeading}>Add custom metric</h3>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['prebuilt', 'picker', 'freeform'] as Tier[]).map(t => (
            <button key={t} style={tabStyle(tier === t)} onClick={() => { setTier(t); setFormError(null); }}>
              {t === 'prebuilt' ? 'Pre-built' : t === 'picker' ? 'Component picker' : 'Free-form'}
            </button>
          ))}
        </div>

        {tier === 'prebuilt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <select value={selectedPrebuilt} onChange={e => setSelectedPrebuilt(e.target.value)} style={inputStyle} aria-label="Select pre-built metric">
              {PREBUILT.map(p => <option key={p.name} value={p.name}>{p.name} — {p.formula}</option>)}
            </select>
          </div>
        )}

        {tier === 'picker' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input placeholder="Metric name (e.g. Conversion Rate)" value={pickerName} onChange={e => setPickerName(e.target.value)} style={inputStyle} aria-label="Metric name" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <select value={numerator} onChange={e => setNumerator(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1 }} aria-label="Numerator column">
                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ color: 'var(--muted)' }}>÷</span>
              <select value={denominator} onChange={e => setDenominator(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1 }} aria-label="Denominator column">
                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ color: 'var(--muted)' }}>×</span>
              <input type="number" value={multiplier} onChange={e => setMultiplier(e.target.value)} style={{ ...inputStyle, width: '80px' }} aria-label="Multiplier constant" />
            </div>
          </div>
        )}

        {tier === 'freeform' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input placeholder="Metric name" value={freeformName} onChange={e => setFreeformName(e.target.value)} style={inputStyle} aria-label="Metric name" />
            <input placeholder="e.g. conversions / spend * 100" value={freeformExpr} onChange={e => setFreeformExpr(e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} aria-label="Formula expression" />
            <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
              Available columns: {availableCols.join(', ')}
            </p>
          </div>
        )}

        {formError && <div className={styles.error} role="alert">{formError}</div>}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleAdd}>Add metric</button>
        </div>
      </div>
    </div>
  );
}
