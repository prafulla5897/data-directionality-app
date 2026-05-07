/**
 * Formula builder modal — 2-tier custom metric creation.
 * Tier 1: pre-built presets. Tier 2: component picker with ÷ or × operator.
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

type Tier = 'prebuilt' | 'picker';
type Operator = 'divide' | 'multiply';

interface FormulaBuilderProps {
  availableCols: string[];
  onAdd: (metric: MetricConfig) => void;
  onClose: () => void;
  initialMetric?: MetricConfig;
}

/**
 * Modal for creating or editing a custom formula metric.
 * Supports pre-built presets and component picker with ÷ or × operator.
 * @param props - availableCols, onAdd callback, onClose callback, optional initialMetric for editing
 * @returns Modal JSX
 */
export function FormulaBuilder({ availableCols, onAdd, onClose, initialMetric }: FormulaBuilderProps): JSX.Element {
  const isEditingPrebuilt = initialMetric ? PREBUILT.some(p => p.name === initialMetric.name) : false;

  const [tier, setTier] = useState<Tier>(() => {
    if (!initialMetric) return 'prebuilt';
    return isEditingPrebuilt ? 'prebuilt' : 'picker';
  });
  const [selectedPrebuilt, setSelectedPrebuilt] = useState<string>(
    initialMetric && isEditingPrebuilt ? initialMetric.name : 'CTR'
  );
  const [pickerName, setPickerName] = useState(
    initialMetric && !isEditingPrebuilt ? initialMetric.name : ''
  );
  const [numerator, setNumerator] = useState(
    initialMetric?.components?.[0] ?? availableCols[0] ?? ''
  );
  const [denominator, setDenominator] = useState(
    initialMetric?.components?.[1] ?? availableCols[1] ?? availableCols[0] ?? ''
  );
  const [operator, setOperator] = useState<Operator>('divide');
  const [multiplier, setMultiplier] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);

  function handleAdd(): void {
    setFormError(null);
    if (tier === 'prebuilt') {
      const preset = PREBUILT.find(p => p.name === selectedPrebuilt);
      if (preset) onAdd(preset);
      return;
    }
    if (!pickerName.trim()) { setFormError('Name is required.'); return; }
    const mult = parseFloat(multiplier);
    let formula: string;
    if (operator === 'multiply') {
      formula = isNaN(mult) || mult === 1
        ? `${numerator} * ${denominator}`
        : `${numerator} * ${denominator} * ${mult}`;
    } else {
      formula = isNaN(mult) || mult === 1
        ? `${numerator} / ${denominator}`
        : `${numerator} / ${denominator} * ${mult}`;
    }
    onAdd({ name: pickerName.trim(), type: 'derived', formula, components: [numerator, denominator], aggregation: 'recalculate' });
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
        <h3 className={styles.modalHeading}>{initialMetric ? 'Edit metric' : 'Add custom metric'}</h3>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['prebuilt', 'picker'] as Tier[]).map(t => (
            <button key={t} style={tabStyle(tier === t)} onClick={() => { setTier(t); setFormError(null); }}>
              {t === 'prebuilt' ? 'Pre-built' : 'Component picker'}
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
              <select value={numerator} onChange={e => setNumerator(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1 }} aria-label="Left column">
                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={operator} onChange={e => setOperator(e.target.value as Operator)} style={{ ...inputStyle, width: 'auto' }} aria-label="Operator">
                <option value="divide">÷</option>
                <option value="multiply">×</option>
              </select>
              <select value={denominator} onChange={e => setDenominator(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: 1 }} aria-label="Right column">
                {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ color: 'var(--muted)' }}>×</span>
              <input type="number" value={multiplier} onChange={e => setMultiplier(e.target.value)} style={{ ...inputStyle, width: '80px' }} aria-label="Multiplier constant" />
            </div>
          </div>
        )}

        {formError && <div className={styles.error} role="alert">{formError}</div>}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleAdd}>{initialMetric ? 'Update metric' : 'Add metric'}</button>
        </div>
      </div>
    </div>
  );
}
