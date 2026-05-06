# PHASES.md — Phase-by-Phase Build Plan
# Project: Marketing Signal
# Version: 2.0
# Read the relevant phase section at the start of each Claude Code session.
# Do not start Phase N+1 until every acceptance criterion in Phase N is green.

---

## Phase 0 — Project Scaffold

**Goal:** Empty repo with correct structure, TypeScript config, dependencies, and fixture data.

### Files to create
```
marketing-signal/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .gitignore
├── src/
│   ├── main.tsx
│   ├── App.tsx                   (shell only, no logic)
│   ├── types/index.ts            (all interfaces from ARCHITECTURE.md §4)
│   ├── constants/index.ts        (THRESHOLDS + CONFIG + CHART_COLORS from ARCHITECTURE.md §7)
│   ├── utils/
│   │   ├── parser.ts             (stub)
│   │   ├── schemaDetector.ts     (stub)
│   │   ├── fileMerger.ts         (stub)
│   │   ├── aggregator.ts         (stub)
│   │   ├── analysis.ts           (stub)
│   │   └── ruleEngine.ts         (stub)
│   ├── components/               (empty folders)
│   └── styles/
│       ├── tokens.css            (all tokens from ARCHITECTURE.md §9)
│       ├── global.css            (resets)
│       └── components.css        (stub)
├── tests/
│   ├── unit/.gitkeep
│   └── e2e/.gitkeep
└── fixtures/
    └── sample_campaigns.csv      (spec in ARCHITECTURE.md §10)
```

### Acceptance criteria
- [ ] `npm install` completes with zero errors
- [ ] `npm run dev` starts Vite dev server, app loads in browser
- [ ] `npm run build` compiles TypeScript with zero errors
- [ ] `tsc --noEmit` passes with zero type errors
- [ ] All interfaces from ARCHITECTURE.md §4 present in `types/index.ts`
- [ ] All constants from ARCHITECTURE.md §7 present in `constants/index.ts`
- [ ] All design tokens from ARCHITECTURE.md §9 in `tokens.css`
- [ ] `fixtures/sample_campaigns.csv` has 180 rows, 5 columns, 3 anomalies injected
- [ ] `.gitignore` excludes `node_modules/`, `dist/`, `.env`

---

## Phase 1 — File Upload & Schema Detection

**Goal:** User uploads one or two files. App parses, detects schema, shows Step 2 confirmation UI.

### Files to implement
```
src/utils/parser.ts
src/utils/schemaDetector.ts
src/utils/fileMerger.ts         (two-file merge)
src/components/Step1Upload/     (UI)
src/components/Step2Schema/     (UI)
src/App.tsx                     (wire steps 1–2)
src/styles/components.css       (upload zone, schema UI styles)
```

### Function specs

**parser.ts**
```typescript
/**
 * Parse an uploaded file into raw row objects.
 * Supports .csv (PapaParse) and .xlsx/.xls (SheetJS).
 * @param file - The uploaded File object
 * @returns Array of plain objects keyed by column header
 * @throws Error if file cannot be parsed
 */
export async function parseFile(file: File): Promise<RawRow[]>

/**
 * Validate file before parsing.
 * @returns { valid: boolean, error?: string }
 */
export function validateFile(file: File): { valid: boolean; error?: string }
```

**schemaDetector.ts**
```typescript
/**
 * Auto-detect schema from column names and sample values.
 * Date detection tries formats in order: ISO 8601, MM/DD/YYYY,
 * DD/MM/YYYY, DD-MMM-YYYY, Excel serial numbers.
 * Picks format where >90% of sample rows parse successfully.
 * @param columns - Array of column header strings
 * @param sampleRows - First 20 rows of data
 * @returns Detected schema with dateCol, dimensionCols, metrics
 */
export function detectSchema(columns: string[], sampleRows: RawRow[]): Schema

/**
 * Classify a single column as 'date' | 'dimension' | 'metric'
 */
export function classifyColumn(
  name: string,
  samples: (string | number | null)[]
): 'date' | 'dimension' | 'metric'
```

**fileMerger.ts**
```typescript
/**
 * Fuzzy-match dimension column names across two files.
 * @returns Array of suggested mappings { file1Col, file2Col, confidence }
 */
export function suggestColumnMappings(
  schema1: Schema,
  schema2: Schema
): ColumnMapping[]

/**
 * Merge two parsed datasets using confirmed column mappings.
 * Groups by common dimensions, combines metrics.
 * @returns Single merged RawRow[] array
 */
export function mergeFiles(
  rows1: RawRow[],
  rows2: RawRow[],
  mappings: ColumnMapping[]
): RawRow[]
```

### Acceptance criteria
- [ ] `.csv` file with 180 rows parses in < 500ms
- [ ] `.xlsx` file parses identically to its CSV equivalent
- [ ] Date column auto-detected for ISO 8601 format
- [ ] Date column auto-detected for MM/DD/YYYY format
- [ ] Numeric columns classified as metrics, string columns as dimensions
- [ ] Known derived metrics (CTR, CPM) auto-detected and formula suggested
- [ ] Upload rejects `.pdf` with error: "Unsupported format"
- [ ] Upload rejects files > 50MB with appropriate error
- [ ] Files 10–50MB show size warning before proceeding
- [ ] Two-file upload: fuzzy mapping suggested and displayed to user
- [ ] Two-file upload: merged output contains columns from both files
- [ ] User can check/uncheck any column in Step 2
- [ ] User can reassign a column from metric to dimension (and vice versa)
- [ ] User can add custom formula (all 3 tiers: pre-built, picker, free-form)
- [ ] [Back] button on Step 2 returns to Step 1
- [ ] No console errors for any of the above

### E2E test (Playwright)
```
Scenario 1: Single CSV upload
  1. Load app at /
  2. Drop fixtures/sample_campaigns.csv onto upload zone
  3. Assert: "180 rows detected" shown
  4. Assert: date dropdown = "date", dimensions include "campaign"
  5. Assert: metrics include "spend", "impressions", "clicks"
  6. Click "Confirm & continue"
  7. Assert: Step 3 or Step 4 shown (depending on row count)

Scenario 2: Unsupported file
  1. Drop a .pdf file onto upload zone
  2. Assert: error message shown "Unsupported format"
  3. Assert: still on Step 1

Scenario 3: Schema override
  1. Upload sample_campaigns.csv
  2. Uncheck "region" dimension
  3. Change "spend" type to "Average"
  4. Assert: changes persist when navigating to next step
```

---

## Phase 2 — Scope, Windows & Grain Configuration

**Goal:** Steps 3, 4, and 5 fully implemented. User configures scope, baseline, anomaly window, and grains.

### Files to implement
```
src/components/Step3Scope/
src/components/Step4Windows/
src/components/Step5Grain/
src/App.tsx                   (wire steps 3–5, step 3 conditional logic)
```

### Step 3 logic
```typescript
// Show Step 3 only if:
const totalRows = uniqueDimCombos * datePeriods;
if (totalRows > THRESHOLDS.MAX_ROWS) { showStep3(); }
else { skipToStep4(); }

// In Step 3 UI:
// Live counter updates as user changes selections
// [Continue] disabled until totalRows ≤ MAX_ROWS
// Campaigns ranked by total spend (highest first)
// "Aggregate unselected as Other" checkbox
```

### Step 5 — dynamic dimension limit
```typescript
// Calculate max dimensions allowed within time budget
const metricPairs = (metrics.length * (metrics.length - 1)) / 2;
const maxAnalyses = (timeBudgetSeconds * CONFIG.OPS_PER_SECOND) / (totalRows * metricPairs);
const maxDimensions = Math.floor(Math.log2(maxAnalyses + 1));

// If user selects more: show warning with estimated runtime
// Allow user to proceed if they accept the warning
```

### Acceptance criteria
- [ ] Step 3 is skipped entirely if total rows ≤ 50,000
- [ ] Step 3 live counter updates as user deselects campaigns / changes date range
- [ ] [Continue] blocked in Step 3 until total rows ≤ 50,000
- [ ] Campaigns in Step 3 ranked by total spend (highest first)
- [ ] "Aggregate unselected as Other" checkbox works
- [ ] Step 4 baseline defaults to "all data"
- [ ] Step 4 anomaly window defaults to "last 1 month"
- [ ] Step 4 custom date pickers work (start + end date)
- [ ] Step 4 warns if anomaly window extends beyond baseline
- [ ] Step 5 auto-suggests analysis grain based on noise-to-signal
- [ ] Step 5 auto-suggests display grain based on data span
- [ ] Step 5 disables Daily grain if total rows at daily > 50,000
- [ ] Step 5 Advanced section collapsed by default
- [ ] Step 5 Advanced time budget slider works (30–300s range)
- [ ] Step 5 dynamic dimension limit warns if exceeded
- [ ] [Back] on all steps returns to previous step without losing state

---

## Phase 3 — Analysis Engine

**Goal:** All pure analysis functions implemented and verified correct.

### Files to implement
```
src/utils/aggregator.ts
src/utils/analysis.ts
src/utils/ruleEngine.ts
tests/unit/analysis.test.ts
tests/unit/ruleEngine.test.ts
```

### Function specs

**aggregator.ts**
```typescript
/**
 * Group rows by dimension combinations and aggregate metrics.
 * Handles summable, derived, and unique metric types.
 * @param rows - Filtered raw rows (within baseline window)
 * @param schema - Confirmed schema
 * @param grain - Analysis grain
 * @param dimensions - Selected dimension columns
 * @returns Array of Series objects
 */
export function buildSeries(
  rows: RawRow[],
  schema: Schema,
  grain: Grain,
  dimensions: string[]
): Series[]

/**
 * Generate all 2^n - 1 subsets of selected dimensions.
 * @param dimensions - e.g. ["campaign", "creative", "account"]
 * @returns Array of dimension subsets e.g. [["campaign"], ["campaign","creative"], ...]
 */
export function generateDimensionSubsets(dimensions: string[]): string[][]
```

**analysis.ts**
```typescript
/** Pearson correlation coefficient. Returns NaN if n<2 or stdDev=0. */
export function pearsonR(a: number[], b: number[]): number

/**
 * Direction score: % of consecutive periods where both metrics
 * moved in the same direction.
 * Returns NaN if n<2.
 */
export function directionScore(a: number[], b: number[]): number

/**
 * Elasticity per period: pctChangeA / pctChangeB.
 * Skips periods where either value is 0.
 */
export function elasticityPerPeriod(a: number[], b: number[]): number[]

/** Mean of an array. Returns NaN if empty. */
export function mean(arr: number[]): number

/** Standard deviation. Returns 0 if single element or all same. */
export function stdDev(arr: number[]): number

/** Z-score for each element. Returns 0s if stdDev=0. */
export function zScore(arr: number[]): number[]

/** Rolling correlation with given window size. */
export function rollingCorr(a: number[], b: number[], window: number): number[]
```

**ruleEngine.ts**
```typescript
/**
 * Generate all anomalies from series list.
 * Runs across all dimension combinations × metric pairs.
 * Detects direction breaks, elasticity deviations, persistence.
 * @param seriesList - Aggregated series from aggregator
 * @param baselineWindow - Date range for baseline stats
 * @param anomalyWindow - Date range to check for anomalies
 * @param timeBudgetSeconds - Max computation time
 * @returns Sorted anomalies (critical first)
 */
export function generateAnomalies(
  seriesList: Series[],
  baselineWindow: { start: Date; end: Date },
  anomalyWindow: { start: Date; end: Date },
  timeBudgetSeconds: number
): Anomaly[]
```

### Unit test cases

**analysis.ts**
```typescript
// pearsonR
expect(pearsonR([1,2,3,4,5], [1,2,3,4,5])).toBeCloseTo(1.0, 3)
expect(pearsonR([1,2,3,4,5], [5,4,3,2,1])).toBeCloseTo(-1.0, 3)
expect(pearsonR([1,1,1], [2,3,4])).toBeNaN()  // zero stdDev

// directionScore
expect(directionScore([1,2,3], [1,2,3])).toBe(1.0)
expect(directionScore([1,2,3], [3,2,1])).toBe(0.0)
expect(directionScore([1,2,1], [1,2,1])).toBe(1.0)

// elasticityPerPeriod
// spend +10%, impressions +8% → ratio 0.8
expect(elasticityPerPeriod([100,110], [200,216])[0]).toBeCloseTo(0.8, 2)

// mean + stdDev
expect(mean([2,4,4,4,5,5,7,9])).toBe(5)
expect(stdDev([2,4,4,4,5,5,7,9])).toBeCloseTo(2.0, 1)

// zScore
const z = zScore([2,4,4,4,5,5,7,9])
expect(z.reduce((s,v) => s+v, 0)).toBeCloseTo(0, 5)  // sum ≈ 0
```

**ruleEngine.ts**
```typescript
// On sample_campaigns.csv with full date range:
const anomalies = generateAnomalies(series, baseline, anomalyWindow, 60)
expect(anomalies.some(a => a.severity === 'critical')).toBe(true)
expect(anomalies[0].severity).toBe('critical')  // sorted critical first
expect(anomalies.every(a => a.title.length <= 80)).toBe(true)
// No jargon in body text
const forbidden = ['elasticity','r-value','sigma','Pearson','coefficient']
anomalies.forEach(a => {
  forbidden.forEach(word => {
    expect(a.body.toLowerCase()).not.toContain(word)
  })
})
```

### Acceptance criteria
- [ ] All unit tests in `tests/unit/analysis.test.ts` pass
- [ ] All unit tests in `tests/unit/ruleEngine.test.ts` pass
- [ ] `buildSeries` on `sample_campaigns.csv` returns 3 Series (one per campaign)
- [ ] Each series has 60 dates and parallel value arrays
- [ ] `generateDimensionSubsets(['a','b','c'])` returns 7 subsets
- [ ] `generateAnomalies` on sample data produces ≥ 1 CRITICAL anomaly
- [ ] Anomalies sorted critical → warning → info
- [ ] No anomaly title exceeds 80 characters
- [ ] No forbidden jargon words in any anomaly body text
- [ ] `tsc --noEmit` still passes after Phase 3

---

## Phase 4 — Results Dashboard

**Goal:** Full results dashboard: health snapshot, anomaly cards, methodology section, drill-down.

### Files to implement
```
src/components/Step6Progress/   (progress bar + time estimate)
src/components/Step7Results/    (dashboard)
src/components/Step8Drilldown/  (scatter + time-series + detail)
src/App.tsx                     (wire steps 6–8)
src/styles/components.css       (all dashboard component styles)
```

### UI requirements

**Step 6 — Progress:**
```
Show: "Analysing... (step 3 of 7 dimension combinations)"
Show: "~12 seconds remaining" (estimate based on time budget)
Cancel button: returns user to Step 5
```

**Step 7 — Results:**
```
Section 1: Metric health snapshot
  - One status row per metric pair (green/yellow/red dot + label)
  - No numbers, no r-values
  - Click row → scroll to relevant anomaly cards

Section 2: Anomaly cards
  - Grouped by display_grain heading
  - Each card at analysis_grain detail level
  - Severity badge (CRITICAL/WARNING/INFO) left border accent
  - Sortable by severity (default) or date
  - Filter by severity: [All] [Critical] [Warning] [Info]

Section 3: How we calculate (collapsed by default)
  - expandable accordion
  - Plain English only, 3 bullet explanations
  - No formulas

Footer:
  [Export insights as .md] [Change window] [New file]
```

**Step 8 — Drill-down:**
```
Plain English summary paragraph
Scatterplot: metricA vs metricB, anomaly weeks in red
Time-series chart: both metrics overlaid, anomaly period shaded
Dimension context panel
Drill options: go up/down dimension hierarchy
[← Back to overview]
```

### Chart requirements
```
All Chart.js charts must:
  - Call chart.destroy() before re-render
  - Have aria-label on canvas element
  - Use CHART_COLORS from constants
  - Show formatted values in tooltips ($1,234 not 1234)
  - Have responsive: true, maintainAspectRatio: false
  - Use grid colour rgba(255,255,255,0.04)
```

### Export format
```markdown
# Marketing Signal — Analysis Report
Generated: YYYY-MM-DD
Baseline: Jan 1 – Dec 31, 2025
Anomaly window: Nov 1 – Nov 30, 2025

## Critical anomalies

### Retargeting · Week of Nov 15–22
Spend increased 18%, impressions dropped 8%.
Historically these move together. This lasted 3 consecutive weeks.
- Dimension level: Campaign
- Metrics: spend ↔ impressions
- Period: Nov 15–22, 2025

## Warnings
...
```

### Acceptance criteria
- [ ] Progress bar shows during Step 6 with dimension count + time estimate
- [ ] Cancel button on Step 6 works
- [ ] Metric health snapshot renders with correct green/yellow/red status
- [ ] Anomaly cards grouped by display grain, shown at analysis grain
- [ ] Anomalies sorted critical-first by default
- [ ] Severity filter buttons work
- [ ] "How we calculate" accordion collapsed by default, expands correctly
- [ ] No forbidden jargon in any visible text
- [ ] Drill-down shows scatterplot and time-series for selected anomaly
- [ ] Anomaly period highlighted on time-series chart
- [ ] Drill navigation (up/down dimension hierarchy) works
- [ ] Export downloads valid `.md` file
- [ ] "Change window" returns to Step 4 without losing file/schema state
- [ ] "New file" resets all state and returns to Step 1
- [ ] All canvas elements have `role="img"` and `aria-label`
- [ ] Dashboard readable at 375px viewport width

### E2E test (Playwright)
```
Scenario: Full happy path
  1. Load app
  2. Upload fixtures/sample_campaigns.csv
  3. Confirm schema (Step 2)
  4. Confirm baseline: all data, anomaly window: last 30 days (Step 4)
  5. Confirm grain: weekly analysis, monthly display (Step 5)
  6. Click "Run Analysis"
  7. Assert: progress bar shown
  8. Assert: results dashboard renders
  9. Assert: ≥ 1 anomaly card shown
  10. Assert: anomaly card has no forbidden jargon
  11. Click first anomaly card's [See detail ▶]
  12. Assert: drill-down view shows scatterplot and time-series
  13. Click [← Back to overview]
  14. Assert: back on results dashboard

Scenario: Export
  1. Complete full happy path above
  2. Click [Export insights as .md]
  3. Assert: file download triggered
  4. Assert: downloaded file starts with "# Marketing Signal"
```

---

## Phase 5 — Polish & Hardening

**Goal:** Production-ready. All error states, performance verified, accessibility pass.

### Scope
- All error states from ARCHITECTURE.md §8 implemented and tested
- Loading states on all async operations
- Performance: analysis of 50k-row file completes within time budget
- Accessibility audit: all interactive elements labelled
- Responsive layout: no breakage at 375px, 768px, 1440px
- Final TypeScript strict-mode pass: zero errors, zero `any`

### Acceptance criteria
- [ ] All 8 error states from ARCHITECTURE.md display correct messages
- [ ] Loading spinner/bar shows on all async operations
- [ ] Analysis of 50k-row file completes within selected time budget
- [ ] `tsc --noEmit` passes with zero errors
- [ ] ESLint passes with zero warnings
- [ ] Lighthouse accessibility score ≥ 85
- [ ] No layout breaks at 375px, 768px, 1440px
- [ ] All acceptance criteria from Phases 1–4 still pass
- [ ] DevTools Network tab shows zero outbound requests during analysis
- [ ] No forbidden words (`eval`, `innerHTML =`, `document.write`) in codebase

---

## Phase Summary

| Phase | Focus | Gate |
|---|---|---|
| 0 | Scaffold + types + constants + fixture | Zero TS errors, fixture correct |
| 1 | Upload + schema + two-file merge | Files parse, schema confirmed |
| 2 | Scope + windows + grain config | Steps 3–5 complete, back nav works |
| 3 | Analysis + rule engine | Unit tests pass, anomalies on sample data |
| 4 | Results dashboard + drill-down | Full E2E happy path passes |
| 5 | Polish + hardening | Lighthouse ≥85, zero TS errors, zero warnings |

---

## Context to load at start of each Claude Code session

```
Reading order:
1. ARCHITECTURE.md  (full system design)
2. CLAUDE.md        (coding standards)
3. PHASES.md        (Phase N section only)
4. Relevant existing source files for current phase

Do NOT include files from phases not yet started.
```

---

*PHASES.md Version: 2.0 — Locked for Claude Code handoff*
