/**
 * Time-series chart — both metrics overlaid with anomaly period shading.
 * Default: dual Y-axes showing actual values (solid amber + dashed cyan).
 * Relative view: single indexed axis (baseline avg = 100) to reveal divergence.
 */

import { useEffect, useRef, useState } from 'react';
import { Chart } from 'chart.js';
import type { Anomaly, Series } from '../../types/index.js';
import { CHART_COLORS } from '../../constants/index.js';

interface TimeSeriesChartProps {
  anomaly: Anomaly;
  series: Series;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function fmtLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function lastIndexWhere(arr: Date[], pred: (d: Date) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

function baselineMean(vals: (number | null | undefined)[], dates: Date[], cutoff: Date): number {
  let sum = 0; let count = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v !== null && v !== undefined && dates[i] < cutoff) { sum += v; count++; }
  }
  return count > 0 ? sum / count : 0;
}

const GRID_COLOR = 'rgba(255,255,255,0.04)';
const TICK_COLOR = 'rgba(232,230,225,0.5)';
const CYAN = '#4dd0e1';

/**
 * Renders a time-series line chart for two metrics with anomaly period shaded.
 * Default: dual Y-axes with actual values (solid amber line + dashed cyan line).
 * Relative view toggle: single indexed axis where baseline average = 100.
 * @param props - anomaly and matching series
 * @returns chart with Actual values / Relative view toggle
 */
export function TimeSeriesChart({ anomaly, series }: TimeSeriesChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [relative, setRelative] = useState(false);
  const [mA, mB] = anomaly.metricPair;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = series.dates.map(fmtLabel);
    const rawA = series.values[mA] ?? [];
    const rawB = series.values[mB] ?? [];
    const startIdx = series.dates.findIndex(d => d >= anomaly.periodStart);
    const endIdx = lastIndexWhere(series.dates, d => d < anomaly.periodEnd);

    const shadePlugin = {
      id: 'anomalyShade',
      beforeDraw(chart: Chart): void {
        if (startIdx < 0 || endIdx < 0) return;
        const { ctx, chartArea, scales } = chart;
        const xScale = scales['x'];
        if (!xScale || !chartArea) return;
        const x0 = xScale.getPixelForValue(startIdx);
        const x1 = xScale.getPixelForValue(endIdx);
        ctx.save();
        ctx.fillStyle = 'rgba(255,107,91,0.12)';
        ctx.fillRect(x0, chartArea.top, x1 - x0 + 20, chartArea.height);
        ctx.restore();
      },
    };

    if (relative) {
      const avgA = baselineMean(rawA, series.dates, anomaly.periodStart);
      const avgB = baselineMean(rawB, series.dates, anomaly.periodStart);
      const idxA = rawA.map(v => (v === null || v === undefined || avgA === 0) ? NaN : (v / avgA) * 100);
      const idxB = rawB.map(v => (v === null || v === undefined || avgB === 0) ? NaN : (v / avgB) * 100);
      const refLine = series.dates.map(() => 100);

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        plugins: [shadePlugin],
        data: {
          labels,
          datasets: [
            {
              label: mA,
              data: idxA,
              borderColor: CHART_COLORS[0],
              backgroundColor: 'transparent',
              pointRadius: 3,
              borderWidth: 2.5,
              tension: 0.2,
              spanGaps: true,
              yAxisID: 'y',
            },
            {
              label: mB,
              data: idxB,
              borderColor: CYAN,
              backgroundColor: 'transparent',
              pointRadius: 3,
              borderWidth: 2.5,
              borderDash: [6, 3],
              tension: 0.2,
              spanGaps: true,
              yAxisID: 'y',
            },
            {
              label: 'Baseline (100)',
              data: refLine,
              borderColor: 'rgba(232,230,225,0.2)',
              backgroundColor: 'transparent',
              pointRadius: 0,
              borderWidth: 1,
              borderDash: [2, 4],
              tension: 0,
              spanGaps: true,
              yAxisID: 'y',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: {
                color: 'rgba(232,230,225,0.7)',
                font: { size: 11 },
                filter: item => item.text !== 'Baseline (100)',
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.dataset.label === 'Baseline (100)') return '';
                  const i = ctx.dataIndex;
                  const isA = ctx.dataset.label === mA;
                  const raw = isA ? rawA[i] : rawB[i];
                  const idxVal = Number(ctx.raw);
                  if (raw === null || raw === undefined || isNaN(idxVal)) return '';
                  return `${ctx.dataset.label as string}: ${fmtNum(raw)} (index ${Math.round(idxVal)})`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: TICK_COLOR, maxTicksLimit: 8, font: { size: 10 } },
              grid: { color: GRID_COLOR },
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: 'Index (100 = baseline avg)', color: TICK_COLOR, font: { size: 10 } },
              ticks: { color: TICK_COLOR, callback: v => `${v}` },
              grid: { color: GRID_COLOR },
            },
          },
        },
      });
    } else {
      const dataA = rawA.map(v => (v === null || v === undefined) ? NaN : v);
      const dataB = rawB.map(v => (v === null || v === undefined) ? NaN : v);

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        plugins: [shadePlugin],
        data: {
          labels,
          datasets: [
            {
              label: mA,
              data: dataA,
              borderColor: CHART_COLORS[0],
              backgroundColor: 'transparent',
              pointRadius: 3,
              borderWidth: 2.5,
              tension: 0.2,
              spanGaps: true,
              yAxisID: 'y',
            },
            {
              label: mB,
              data: dataB,
              borderColor: CYAN,
              backgroundColor: 'transparent',
              pointRadius: 3,
              borderWidth: 2.5,
              borderDash: [6, 3],
              tension: 0.2,
              spanGaps: true,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: 'rgba(232,230,225,0.7)', font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label as string}: ${fmtNum(Number(ctx.raw))}`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: TICK_COLOR, maxTicksLimit: 8, font: { size: 10 } },
              grid: { color: GRID_COLOR },
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: mA, color: CHART_COLORS[0], font: { size: 10 } },
              ticks: { color: TICK_COLOR, callback: v => fmtNum(Number(v)) },
              grid: { color: GRID_COLOR },
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: { display: true, text: mB, color: CYAN, font: { size: 10 } },
              ticks: { color: TICK_COLOR, callback: v => fmtNum(Number(v)) },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    }

    return () => { chartRef.current?.destroy(); };
  }, [anomaly, series, mA, mB, relative]);

  const btnBase: React.CSSProperties = {
    fontSize: '0.75rem',
    padding: '2px 10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          onClick={() => setRelative(false)}
          style={{ ...btnBase, background: !relative ? 'var(--amber, #f5a623)' : 'rgba(232,230,225,0.12)', color: !relative ? '#1a1a1a' : 'rgba(232,230,225,0.7)', fontWeight: !relative ? 700 : 400 }}
          aria-pressed={!relative}
        >
          Actual values
        </button>
        <button
          onClick={() => setRelative(true)}
          style={{ ...btnBase, background: relative ? 'var(--amber, #f5a623)' : 'rgba(232,230,225,0.12)', color: relative ? '#1a1a1a' : 'rgba(232,230,225,0.7)', fontWeight: relative ? 700 : 400 }}
          aria-pressed={relative}
        >
          Relative view
        </button>
      </div>
      <div style={{ position: 'relative', height: '280px' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            relative
              ? `Indexed time-series for ${mA} and ${mB}. Baseline average = 100. Anomaly period shaded.`
              : `Time-series for ${mA} (left axis) and ${mB} (right axis). Anomaly period shaded.`
          }
        />
      </div>
      {relative && (
        <p style={{ fontSize: '0.75rem', color: 'rgba(232,230,225,0.45)', margin: '0.4rem 0 0', lineHeight: 1.4 }}>
          Each metric scaled so its baseline average = 100. When lines diverge, the metrics are decoupling — that is the anomaly.
        </p>
      )}
    </div>
  );
}
