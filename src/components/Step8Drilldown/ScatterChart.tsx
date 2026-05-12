/**
 * Scatter chart — metricA vs metricB with anomaly periods highlighted.
 * Includes a linear trend line through the historical baseline.
 */

import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';
import type { Anomaly, Series } from '../../types/index.js';
import { CHART_COLORS } from '../../constants/index.js';

interface ScatterChartProps {
  anomaly: Anomaly;
  series: Series;
}

interface Point { x: number; y: number; dateLabel: string; pctA: number | null; pctB: number | null; }

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Computes simple linear regression through a set of points.
 * @param pts - Array of {x, y} points
 * @returns slope and intercept, or null if fewer than 2 points or degenerate
 */
function linearRegression(pts: Point[]): { slope: number; intercept: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; }
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

/**
 * Renders a scatter chart of metricA vs metricB using Chart.js.
 * Baseline points in muted amber; anomaly-window points in coral.
 * Includes a linear trend line through baseline and % change in anomaly tooltips.
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

    const aVals = series.values[mA] ?? [];
    const bVals = series.values[mB] ?? [];
    const baseline: Point[] = [];
    const anomalyPts: Point[] = [];

    // periodEnd is stored as next-period start (exclusive upper bound)
    const anomalyEndExclusive = anomaly.periodEnd > anomaly.periodStart
      ? anomaly.periodEnd
      : null; // single-point edge case

    // Find the last non-null values before the anomaly window for % change computation
    let prevA: number | null = null;
    let prevB: number | null = null;
    for (let i = 0; i < series.dates.length; i++) {
      if (series.dates[i] >= anomaly.periodStart) break;
      const av = aVals[i]; const bv = bVals[i];
      if (av !== null && av !== undefined) prevA = av as number;
      if (bv !== null && bv !== undefined) prevB = bv as number;
    }

    for (let i = 0; i < series.dates.length; i++) {
      const av = aVals[i]; const bv = bVals[i];
      if (av === null || av === undefined || bv === null || bv === undefined) continue;
      const d = series.dates[i];
      const dateLabel = fmtDate(d);
      const inAnomalyWindow = anomalyEndExclusive
        ? d >= anomaly.periodStart && d < anomalyEndExclusive
        : d.getTime() === anomaly.periodStart.getTime();
      if (inAnomalyWindow) {
        const pctA = prevA !== null && prevA !== 0 ? Math.round((av - prevA) / Math.abs(prevA) * 100) : null;
        const pctB = prevB !== null && prevB !== 0 ? Math.round((bv - prevB) / Math.abs(prevB) * 100) : null;
        anomalyPts.push({ x: av, y: bv, dateLabel, pctA, pctB });
      } else {
        baseline.push({ x: av, y: bv, dateLabel, pctA: null, pctB: null });
      }
    }

    // Compute linear trend from baseline
    const lr = linearRegression(baseline);
    const trendData: { x: number; y: number }[] = [];
    if (lr && baseline.length >= 2) {
      const xs = baseline.map(p => p.x);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      trendData.push({ x: xMin, y: lr.slope * xMin + lr.intercept });
      trendData.push({ x: xMax, y: lr.slope * xMax + lr.intercept });
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Historical',
            data: baseline,
            backgroundColor: `${CHART_COLORS[0]}99`,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          {
            type: 'line' as const,
            label: 'Trend',
            data: trendData,
            borderColor: 'rgba(232,230,225,0.25)',
            borderWidth: 1,
            borderDash: [4, 4],
            backgroundColor: 'transparent',
            pointRadius: 0,
            tension: 0,
            order: 3,
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
                if (ctx.dataset.label === 'Anomaly period' && p.pctA !== null && p.pctB !== null) {
                  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
                  return `${p.dateLabel}: ${mA} ${fmtPct(p.pctA)}, ${mB} ${fmtPct(p.pctB)}`;
                }
                return `${p.dateLabel}: ${mA} ${fmtNum(p.x)}, ${mB} ${fmtNum(p.y)}`;
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
