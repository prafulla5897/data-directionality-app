/**
 * Comparison chart — baseline average vs anomaly period average for each metric.
 * Grouped bar chart with % change labels above anomaly bars.
 */

import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import type { Anomaly, Series } from '../../types/index.js';
import { CHART_COLORS } from '../../constants/index.js';

interface ComparisonChartProps {
  anomaly: Anomaly;
  series: Series;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

interface MetricStats {
  baselineAvg: number | null;
  anomalyAvg: number | null;
  pctChange: number | null;
}

function computeStats(series: Series, metric: string, anomaly: Anomaly): MetricStats {
  const vals = series.values[metric] ?? [];
  const baselineVals: number[] = [];
  const anomalyVals: number[] = [];

  for (let i = 0; i < series.dates.length; i++) {
    const d = series.dates[i];
    const v = vals[i];
    if (v === null || v === undefined) continue;
    if (d < anomaly.periodStart) {
      baselineVals.push(v as number);
    } else if (d >= anomaly.periodStart && d < anomaly.periodEnd) {
      anomalyVals.push(v as number);
    }
  }

  const baselineAvg = baselineVals.length > 0 ? mean(baselineVals) : null;
  const anomalyAvg = anomalyVals.length > 0 ? mean(anomalyVals) : null;

  let pctChange: number | null = null;
  if (baselineAvg !== null && anomalyAvg !== null && baselineAvg !== 0) {
    pctChange = ((anomalyAvg - baselineAvg) / Math.abs(baselineAvg)) * 100;
  }

  return { baselineAvg, anomalyAvg, pctChange };
}

/**
 * Renders a grouped bar chart comparing baseline average vs anomaly period average.
 * Draws % change labels above each anomaly bar using a custom inline plugin.
 * @param props - anomaly and matching series
 * @returns canvas element wrapped in a div
 */
export function ComparisonChart({ anomaly, series }: ComparisonChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mA, mB] = anomaly.metricPair;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const statsA = computeStats(series, mA, anomaly);
    const statsB = computeStats(series, mB, anomaly);

    const pctChanges = [statsA.pctChange, statsB.pctChange];

    const changeLabelPlugin = {
      id: 'changeLabels',
      afterDatasetsDraw(chart: Chart): void {
        if (chart.data.datasets[1] === undefined) return;
        const meta = chart.getDatasetMeta(1);
        const { ctx } = chart;
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        meta.data.forEach((bar, i) => {
          const pct = pctChanges[i];
          if (pct === null) return;
          const label = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
          ctx.fillStyle = pct > 0 ? '#4caf50' : pct < -1 ? '#ff6b5b' : 'rgba(232,230,225,0.5)';
          ctx.fillText(label, bar.x, bar.y - 6);
        });
        ctx.restore();
      },
    };

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      plugins: [changeLabelPlugin],
      data: {
        labels: [mA, mB],
        datasets: [
          {
            label: 'Baseline avg',
            data: [statsA.baselineAvg ?? 0, statsB.baselineAvg ?? 0],
            backgroundColor: `${CHART_COLORS[0]}99`,
          },
          {
            label: 'Anomaly period',
            data: [statsA.anomalyAvg ?? 0, statsB.anomalyAvg ?? 0],
            backgroundColor: '#ff6b5b',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 24 } },
        plugins: {
          legend: { labels: { color: 'rgba(232,230,225,0.7)', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const dsLabel = ctx.dataset.label ?? '';
                const val = fmtNum(Number(ctx.raw));
                const idx = ctx.dataIndex;
                const pct = pctChanges[idx];
                if (dsLabel === 'Anomaly period' && pct !== null) {
                  return `${dsLabel}: ${val} (${pct >= 0 ? '+' : ''}${Math.round(pct)}% vs baseline)`;
                }
                return `${dsLabel}: ${val}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: 'rgba(232,230,225,0.7)' },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: { color: 'rgba(232,230,225,0.5)', callback: v => fmtNum(Number(v)) },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [anomaly, series, mA, mB]);

  return (
    <div style={{ position: 'relative', height: '240px' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Bar chart comparing baseline average vs anomaly average for ${mA} and ${mB}.`}
      />
    </div>
  );
}
