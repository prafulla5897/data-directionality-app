/**
 * Scatter chart — metricA vs metricB with anomaly periods highlighted.
 */

import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import type { Anomaly, Series } from '../../types/index.js';
import { CHART_COLORS } from '../../constants/index.js';

interface ScatterChartProps {
  anomaly: Anomaly;
  series: Series;
}

interface Point { x: number; y: number; }

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

/**
 * Renders a scatter chart of metricA vs metricB using Chart.js.
 * Baseline points in muted amber; anomaly-window points in coral.
 * @param props - anomaly and matching series
 * @returns canvas element wrapped in a div
 */
export function ScatterChart({ anomaly, series }: ScatterChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mA, mB] = anomaly.metricPair;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const aVals = series.values[mA];
    const bVals = series.values[mB];
    const baseline: Point[] = [];
    const anomalyPts: Point[] = [];

    for (let i = 0; i < series.dates.length; i++) {
      const av = aVals[i]; const bv = bVals[i];
      if (av === null || bv === null) continue;
      // All points shown as baseline; anomaly window also overlaid in red on top
      baseline.push({ x: av, y: bv });
      const d = series.dates[i];
      if (d >= anomaly.periodStart && d <= anomaly.periodEnd) {
        anomalyPts.push({ x: av, y: bv });
      }
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Baseline',
            data: baseline,
            backgroundColor: `${CHART_COLORS[0]}99`,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          {
            label: 'Anomaly period',
            data: anomalyPts,
            backgroundColor: '#ff6b5b',
            pointRadius: 7,
            pointHoverRadius: 9,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'rgba(232,230,225,0.7)', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const p = ctx.raw as Point;
                return `${mA}: ${fmtNum(p.x)}, ${mB}: ${fmtNum(p.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: mA, color: 'rgba(232,230,225,0.5)' },
            ticks: { color: 'rgba(232,230,225,0.5)', callback: v => fmtNum(Number(v)) },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            title: { display: true, text: mB, color: 'rgba(232,230,225,0.5)' },
            ticks: { color: 'rgba(232,230,225,0.5)', callback: v => fmtNum(Number(v)) },
            grid: { color: 'rgba(255,255,255,0.04)' },
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
        aria-label={`Scatter chart of ${mA} vs ${mB}. Anomaly periods shown in red.`}
      />
    </div>
  );
}
