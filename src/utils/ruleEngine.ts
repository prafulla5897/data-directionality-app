/**
 * Anomaly detection rule engine — Series[] → Anomaly[].
 */

import type { Series, Anomaly, Severity } from '../types/index.js';
import { THRESHOLDS } from '../constants/index.js';
import { directionScore, elasticityPerPeriod, mean, stdDev } from './analysis.js';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

// ─── private helpers ──────────────────────────────────────────────────────────

function indicesInWindow(dates: Date[], window: { start: Date; end: Date }): number[] {
  const result: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= window.start && dates[i] <= window.end) result.push(i);
  }
  return result;
}

function filterParallelNonNull(
  aVals: (number | null)[],
  bVals: (number | null)[],
  indices: number[]
): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  for (const i of indices) {
    const av = aVals[i];
    const bv = bVals[i];
    if (av !== null && bv !== null) { a.push(av); b.push(bv); }
  }
  return { a, b };
}

interface Run { start: number; end: number; length: number; }

function findRuns(flags: boolean[]): Run[] {
  const runs: Run[] = [];
  let runStart = -1;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] && runStart === -1) { runStart = i; }
    else if (!flags[i] && runStart !== -1) {
      runs.push({ start: runStart, end: i - 1, length: i - runStart });
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    runs.push({ start: runStart, end: flags.length - 1, length: flags.length - runStart });
  }
  return runs;
}

function fmtPct(ratio: number): string {
  return `${Math.abs(Math.round(ratio * 100))}%`;
}

function buildTitle(
  severity: Severity,
  mA: string,
  mB: string,
  aVals: (number | null)[],
  bVals: (number | null)[],
  runStart: number,
  anomalyIdx: number[]
): string {
  const i0 = anomalyIdx[runStart];
  const i1 = anomalyIdx[runStart + 1] ?? i0;
  const a0 = aVals[i0];
  const a1 = aVals[i1];
  const b0 = bVals[i0];
  const b1 = bVals[i1];

  if (severity === 'critical' && a0 !== null && a1 !== null && a0 !== 0 && b0 !== null && b1 !== null && b0 !== 0) {
    const aDir = a1 >= a0 ? 'increased' : 'decreased';
    const bDir = b1 >= b0 ? 'increased' : 'decreased';
    const t = `${mA} ${aDir} ${fmtPct((a1 - a0) / a0)}, ${mB} ${bDir} ${fmtPct((b1 - b0) / b0)}`;
    if (t.length <= 80) return t;
  }

  if (severity === 'critical') return `${mA} and ${mB} moved in opposite directions`.slice(0, 80);
  if (severity === 'warning') return `Unusual ${mA}–${mB} movement ratio`.slice(0, 80);
  return `Unusual movement between ${mA} and ${mB}`.slice(0, 80);
}

function buildBody(
  severity: Severity,
  mA: string,
  mB: string,
  persistencePeriods: number,
  dScore: number,
  aVals: (number | null)[],
  bVals: (number | null)[],
  runStart: number,
  anomalyIdx: number[],
): string {
  const iCurr = anomalyIdx[runStart];
  const iPrev = iCurr - 1;
  const aCurr = iCurr < aVals.length ? aVals[iCurr] : null;
  const bCurr = iCurr < bVals.length ? bVals[iCurr] : null;
  const aPrev = iPrev >= 0 ? aVals[iPrev] : null;
  const bPrev = iPrev >= 0 ? bVals[iPrev] : null;
  const togetherPct = Math.round(dScore * 100);

  // Sentence 1: what happened
  let s1: string;
  if (aCurr !== null && bCurr !== null && aPrev !== null && bPrev !== null && aPrev !== 0 && bPrev !== 0) {
    const pctA = Math.round((aCurr - aPrev) / Math.abs(aPrev) * 100);
    const pctB = Math.round((bCurr - bPrev) / Math.abs(bPrev) * 100);
    const descA = Math.abs(pctA) < 2 ? `${mA} was roughly flat` : `${mA} ${pctA < 0 ? 'fell' : 'rose'} ${Math.abs(pctA)}%`;
    const descB = Math.abs(pctB) < 2 ? `${mB} barely moved` : `${mB} ${pctB < 0 ? 'fell' : 'rose'} ${Math.abs(pctB)}%`;
    s1 = `${descA} while ${descB}.`;
  } else if (severity === 'critical') {
    s1 = `${mA} and ${mB} moved in opposite directions.`;
  } else if (severity === 'warning') {
    s1 = `${mA} and ${mB} changed by an unusually different amount.`;
  } else {
    s1 = `${mA} and ${mB} moved in an unexpected way.`;
  }

  // Sentence 2: historical context
  const s2 = `Historically these two metrics move together ${togetherPct}% of the time.`;

  // Sentence 3: persistence
  const s3 = persistencePeriods > 1
    ? ` This pattern continued for ${persistencePeriods} consecutive periods.`
    : ' This was a single-period departure from that pattern.';

  return `${s1} ${s2}${s3}`;
}

function makeAnomaly(
  series: Series,
  mA: string,
  mB: string,
  severity: Severity,
  run: Run,
  anomalyIdx: number[],
  dScore: number,
  mElasticity: number,
  actElasticities: number[],
  sigmas: number[],
  tag: string
): Anomaly {
  const periodStart = series.dates[anomalyIdx[run.start]];
  const endIdx = anomalyIdx[run.end + 1] ?? anomalyIdx[run.end];
  const periodEnd = series.dates[endIdx];
  const actE = actElasticities[run.start] ?? 0;
  const sigma = sigmas[run.start] ?? 0;

  return {
    id: `${series.label}__${mA}__${mB}__${tag}__${periodStart.getTime()}`,
    severity,
    dimensionCombo: Object.keys(series.dimensionValues),
    dimensionValues: series.dimensionValues,
    metricPair: [mA, mB],
    periodStart,
    periodEnd,
    persistencePeriods: run.length,
    title: buildTitle(severity, mA, mB, series.values[mA], series.values[mB], run.start, anomalyIdx),
    body: buildBody(severity, mA, mB, run.length, dScore, series.values[mA], series.values[mB], run.start, anomalyIdx),
    stats: {
      directionScore: dScore,
      meanElasticity: mElasticity,
      actualElasticity: isNaN(actE) ? 0 : actE,
      sigmaDeviation: isNaN(sigma) ? 0 : sigma,
    },
  };
}

// ─── exported function ────────────────────────────────────────────────────────

/**
 * Generate all anomalies from a list of aggregated series.
 * Runs across all dimension combinations × metric pairs.
 * Detects direction breaks, elasticity deviations, and persistence.
 * Anomalies are always stored at analysis grain, never rolled up.
 * @param seriesList - Aggregated series from buildSeries
 * @param baselineWindow - Date range used to compute baseline statistics
 * @param anomalyWindow - Date range to scan for anomalies
 * @param timeBudgetSeconds - Maximum allowed wall-clock time for computation
 * @returns Anomalies sorted by severity (critical first), then by date descending
 * @example
 * const anomalies = generateAnomalies(series, baseline, anomalyWindow, 60);
 */
export function generateAnomalies(
  seriesList: Series[],
  baselineWindow: { start: Date; end: Date },
  anomalyWindow: { start: Date; end: Date },
  timeBudgetSeconds: number
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const deadline = Date.now() + timeBudgetSeconds * 1000;

  for (const series of seriesList) {
    if (Date.now() > deadline) break;

    const metrics = Object.keys(series.values);
    const baselineIdx = indicesInWindow(series.dates, baselineWindow);
    const anomalyIdx = indicesInWindow(series.dates, anomalyWindow);
    if (anomalyIdx.length < 2) continue;

    for (let mi = 0; mi < metrics.length; mi++) {
      for (let mj = mi + 1; mj < metrics.length; mj++) {
        const mA = metrics[mi];
        const mB = metrics[mj];
        const aVals = series.values[mA];
        const bVals = series.values[mB];

        const { a: baseA, b: baseB } = filterParallelNonNull(aVals, bVals, baselineIdx);
        if (baseA.length < 2) continue;

        const dScore = directionScore(baseA, baseB);
        const elasticities = elasticityPerPeriod(baseA, baseB);
        const mElasticity = mean(elasticities);
        const sElasticity = stdDev(elasticities);

        const dirFlags: boolean[] = [];
        const elasFlags: boolean[] = [];
        const actEs: number[] = [];
        const sigmaArr: number[] = [];

        for (let k = 0; k < anomalyIdx.length - 1; k++) {
          const i0 = anomalyIdx[k];
          const i1 = anomalyIdx[k + 1];
          const a0 = aVals[i0]; const a1 = aVals[i1];
          const b0 = bVals[i0]; const b1 = bVals[i1];

          if (a0 === null || a1 === null || b0 === null || b1 === null) {
            dirFlags.push(false); elasFlags.push(false);
            actEs.push(NaN); sigmaArr.push(NaN);
            continue;
          }

          dirFlags.push(dScore > 0.5 && Math.sign(a1 - a0) !== Math.sign(b1 - b0));

          let actE = NaN; let sigma = NaN; let eBroke = false;
          if (a0 !== 0 && b0 !== 0) {
            const pA = (a1 - a0) / a0;
            const pB = (b1 - b0) / b0;
            if (pB !== 0) {
              actE = pA / pB;
              if (sElasticity > 0) {
                sigma = Math.abs(actE - mElasticity) / sElasticity;
                eBroke = sigma > THRESHOLDS.SIGMA_THRESHOLD;
              }
            }
          }
          elasFlags.push(eBroke);
          actEs.push(actE);
          sigmaArr.push(sigma);
        }

        const coveredPeriods = new Set<number>();

        for (const run of findRuns(dirFlags)) {
          let severity: Severity;
          if (run.length >= THRESHOLDS.CRITICAL_PERSISTENCE) severity = 'critical';
          else if (run.length >= THRESHOLDS.MIN_PERSISTENCE) severity = 'warning';
          else severity = 'info';
          for (let p = run.start; p <= run.end; p++) coveredPeriods.add(p);
          anomalies.push(makeAnomaly(series, mA, mB, severity, run, anomalyIdx, dScore, mElasticity, actEs, sigmaArr, 'dir'));
        }

        for (const run of findRuns(elasFlags)) {
          // Skip single-period elasticity breaks already covered by a direction run
          if (run.length < THRESHOLDS.MIN_PERSISTENCE && coveredPeriods.has(run.start)) continue;
          const severity: Severity = run.length >= THRESHOLDS.MIN_PERSISTENCE ? 'warning' : 'info';
          anomalies.push(makeAnomaly(series, mA, mB, severity, run, anomalyIdx, dScore, mElasticity, actEs, sigmaArr, 'elas'));
        }
      }
    }
  }

  anomalies.sort((a, b) => {
    const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return diff !== 0 ? diff : b.periodStart.getTime() - a.periodStart.getTime();
  });

  return anomalies;
}
