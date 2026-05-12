/**
 * Time-series chart — both metrics overlaid with anomaly period shading.
 * Uses dual Y-axes so metrics with different magnitudes are both readable.
 */

import { useEffect, useRef } from 'react';
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

const GRID_COLOR = 'rgba(255,255,255,0.04)';
const TICK_COLOR = 'rgba(232,230,225,0.5)';

/**
 * Renders a time-series line chart for two metrics with dual Y-axes and anomaly period shaded.
 * Left axis = metricA, right axis = metricB. Anomaly period shaded with a custom plugin.
 * @param props - anomaly and matching series
 * @returns canvas element wrapped in a div
 */
export function TimeSeriesChart({ anomaly, series }: TimeSeriesChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mA, mB] = anomaly.metricPair;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = series.dates.map(fmtLabel);
    const dataA = series.values[mA].map(v => (v === null ? NaN : v));
    const dataB = series.values[mB].map(v => (v === null ? NaN : v));
    const startIdx = series.dates.findIndex(d => d >= anomaly.periodStart);
    const endIdx = lastIndexWhere(series.dates, d => d <= anomaly.periodEnd);

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
            pointRadius: 2,
            borderWidth: 2,
            tension: 0.2,
            spanGaps: true,
            yAxisID: 'y',
          },
          {
            label: mB,
            data: dataB,
            borderColor: CHART_COLORS[1],
            backgroundColor: 'transparent',
            pointRadius: 2,
            borderWidth: 2,
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
              label: ctx => `${ctx.dataset.label}: ${fmtNum(Number(ctx.raw))}`,
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
            position: 'left',
            title: { display: true, text: mA, color: CHART_COLORS[0], font: { size: 10 } },
            ticks: { color: TICK_COLOR, callback: v => fmtNum(Number(v)) },
            grid: { color: GRID_COLOR },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: mB, color: CHART_COLORS[1], font: { size: 10 } },
            ticks: { color: TICK_COLOR, callback: v => fmtNum(Number(v)) },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [anomaly, series, mA, mB]);

  return (
    <div style={{ position: 'relative', height: '280px' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Time-series chart for ${mA} (left axis) and ${mB} (right axis). Anomaly period shaded in red.`}
      />
    </div>
  );
}
