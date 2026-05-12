# ARCHITECTURE.md
# Project: Marketing Signal — Time-Series Correlation Analyser
# Status: LOCKED — read this before writing any code
# Version: 2.0

---

## 1. Problem Statement

### What we are building
A browser-only, single-page web application that lets performance marketers and media planners upload CSV or Excel files containing time-series campaign data, then automatically analyses how key metrics move together, identifies inefficiencies, and surfaces plain-English anomaly insights — with zero AI/ML, zero server, and zero external data transmission.

### Primary user
Senior marketing executive or media planner. Understands marketing metrics but is not a data scientist. Needs actionable plain-English findings, not statistical jargon. This app replaces a manual first-pass review they would otherwise do themselves.

### Goals (measurable)
| Goal | Success metric |
|---|---|
| Fast time-to-insight | Upload → insights in < 2s for files ≤ 10k rows |
| Correct anomaly detection | Matches manual review on sample dataset |
| Exec-friendly output | Zero statistical jargon in insight cards |
| Full client-side privacy | Zero network requests during analysis (DevTools verified) |
| Accessible | All charts have aria-label; colour never the sole indicator |

### Non-Goals
- No ML, embeddings, or LLM inference
- No server-side processing, authentication, or persistent storage
- No real-time data streams or external API integrations
- No multi-session persistence
- No user accounts

---

## 2. Tech Stack

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Language | TypeScript | 5.x strict mode | Type safety, JSDoc auto-complete |
| Framework | React | 18.x | Component model, state management |
| Build | Vite | 5.x | Fast HMR, zero-config TS support |
| Styling | CSS Modules + custom properties | — | Scoped styles, design tokens |
| CSV parsing | PapaParse | 5.4.x | Robust RFC 4180, handles edge cases |
| Excel parsing | SheetJS (xlsx) | 0.18.x | Native .xlsx/.xls support |
| Charting | Chart.js | 4.4.x | Lightweight, accessible |
| Testing | Vitest + Playwright | latest | Unit + E2E |

### Architecture: Client-only SPA
Zero backend. All processing in the browser. No data leaves the user's machine.

---

## 3. File Structure

```
marketing-signal/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── ARCHITECTURE.md
├── CLAUDE.md
├── PHASES.md
├── HANDOFF.md
├── src/
│   ├── main.tsx                  ← app entry point
│   ├── App.tsx                   ← root component + step router
│   ├── types/
│   │   └── index.ts              ← all shared TypeScript interfaces
│   ├── constants/
│   │   └── index.ts              ← THRESHOLDS, CONFIG, CHART_COLORS
│   ├── utils/
│   │   ├── parser.ts             ← File → RawRow[] (PapaParse + SheetJS)
│   │   ├── schemaDetector.ts     ← auto-classify columns
│   │   ├── fileMerger.ts         ← two-file fuzzy merge
│   │   ├── aggregator.ts         ← RawRow[] → Series[] at chosen grain
│   │   ├── analysis.ts           ← pure math: pearsonR, directionScore, elasticity, zScore
│   │   └── ruleEngine.ts         ← Series[] → Anomaly[]
│   ├── components/
│   │   ├── Step1Upload/          ← file upload zone
│   │   ├── Step2Schema/          ← column config UI
│   │   ├── Step3Scope/           ← dimension + date range (only if >50k rows)
│   │   ├── Step4Windows/         ← baseline + anomaly window pickers
│   │   ├── Step5Grain/           ← analysis grain selection; display grain auto-computed
│   │   ├── Step6Progress/        ← analysis running UI
│   │   ├── Step7Results/         ← dashboard: health snapshot + anomaly cards
│   │   └── Step8Drilldown/       ← scatter + time-series + plain English detail
│   └── styles/
│       ├── tokens.css            ← design tokens
│       ├── global.css            ← resets + base styles
│       └── components.css        ← shared component styles
├── tests/
│   ├── unit/                     ← Vitest unit tests (pure functions)
│   └── e2e/                      ← Playwright E2E scenarios
└── fixtures/
    └── sample_campaigns.csv      ← 3 campaigns × 60 days with injected anomalies
```

---

## 4. TypeScript Interfaces (source of truth)

```typescript
// src/types/index.ts

export interface RawRow {
  [column: string]: string | number | null;
}

export type MetricType = 'summable' | 'derived' | 'unique';

export interface MetricConfig {
  name: string;
  type: MetricType;
  formula?: string;            // e.g. "clicks / impressions * 100"
  components?: string[];       // e.g. ["clicks", "impressions"]
  aggregation: 'sum' | 'recalculate' | 'raw';
}

export interface Schema {
  dateCol: string;
  dateFormat: string;          // detected format string
  dimensionCols: string[];
  metrics: MetricConfig[];
}

export type Grain = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface Series {
  label: string;               // dimension combination label e.g. "Retargeting"
  dimensionValues: Record<string, string>;
  dates: Date[];
  values: Record<string, (number | null)[]>;
}

export interface BaselineStats {
  dimensionCombo: string[];
  metricPairKey: string;       // e.g. "spend__impressions"
  directionScore: number;      // 0–1
  meanElasticity: number;
  stdElasticity: number;
  sampleSize: number;
}

export type Severity = 'critical' | 'warning' | 'info';

export interface Anomaly {
  id: string;
  severity: Severity;
  dimensionCombo: string[];    // e.g. ["campaign", "creative"]
  dimensionValues: Record<string, string>;
  metricPair: [string, string];
  periodStart: Date;
  periodEnd: Date;
  persistencePeriods: number;
  title: string;               // plain English, ≤ 80 chars
  body: string;                // 2–3 sentences, no jargon
  stats: {
    directionScore: number;
    meanElasticity: number;
    actualElasticity: number;
    sigmaDeviation: number;
  };
}

export interface AppState {
  step: number;                // 1–8
  rawRows: RawRow[];
  schema: Schema | null;
  mergedFromTwoFiles: boolean;
  scopeConfig: {
    selectedDimensions: string[];
    dateRangeStart: Date | null;
    dateRangeEnd: Date | null;
    aggregateOther: boolean;     // whether unselected campaigns roll up as "Other"
  };
  windowConfig: {
    baselineStart: Date | null;
    baselineEnd: Date | null;
    anomalyStart: Date | null;
    anomalyEnd: Date | null;
  };
  grainConfig: {
    analysisGrain: Grain;
    displayGrain: Grain;
    timeBudgetSeconds: number;
    weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon…6=Sat
  };
  seriesList: Series[];
  baselineStats: BaselineStats[];
  anomalies: Anomaly[];
}
```

---

## 5. Complete 8-Step Application Flow

### Step 1 — Upload & File Processing

**User action:** Drag-drop or select one file (required) and optionally a second file.

**File validation:**
```
Size:
  < 10MB   → proceed silently
  10–50MB  → warn "Large file, processing may take ~30 seconds"
  > 50MB   → reject "File too large. Please reduce file size."

Type:
  .csv / .xlsx / .xls → proceed
  anything else       → reject "Unsupported format"
```

**Single file backend:**
```
1. Parse with PapaParse (.csv) or SheetJS (.xlsx/.xls)
2. Extract rows as RawRow[]
3. Detect date column:
   - Check column name hints: date, day, week, month, period
   - Try formats in order: ISO 8601, MM/DD/YYYY, DD/MM/YYYY,
     DD-MMM-YYYY, Excel serial numbers
   - Pick format where >90% of rows parse successfully
   - If none: reject "No date column found"
4. After parsing: stay on Step 1 — show filename, row count, and a
   "Continue to schema →" button. Do NOT auto-advance.
5. Output: rows[], detected schema candidate
```

**Step 1 UI after a file is loaded:**
```
[  filename.csv             ]
   12,345 rows detected
   [Remove]                  ← clears file state, stays on Step 1

[Continue to schema →]       ← appears when file 1 is parsed, phase is idle,
                                and NO second file is loaded (two-file flow
                                uses the merge mapping screen instead)

Second file (optional — for merging two data sources):
[  drop second file here   ]
   or [filename2.csv / Remove] if loaded
```

**Remove buttons:** Both file slots show a "Remove" button once a file is
loaded. Clicking Remove calls `clearFile1()` / `clearFile2()`, resets that
slot's state to `{ file: null, rows: [], schema: null }`, and clears any
error — without advancing or re-triggering parse.

**Two-file merge backend:**
```
1. Parse both files independently → rows1[], rows2[]
2. Detect schema for each
3. Fuzzy-match dimension column names across files:
   e.g. "campaign_name" (file 1) ≈ "campaign" (file 2)
4. Show user suggested field mapping with override dropdowns
5. Identify common dimension set (present in BOTH files)
6. For each (date × common dimensions) combination:
   - Aggregate file 1 metrics
   - Aggregate file 2 metrics
   - Combine into single row
7. If same metric name in both files:
   → prompt user: rename to metric_f1 / metric_f2, or keep one
8. Output: merged rows[] — treated as single file for all further steps
```

---

### Step 2 — Schema & Column Configuration

**User action:** Confirm which columns are dimensions vs metrics and set metric types.

**Auto-classification:**
```
Numeric columns → metric (default aggregation: sum)
String / low-cardinality columns → dimension
Known metric names (CTR, CPM, CPC, ROAS) → derived, formula auto-suggested
Known unique metrics (reach, unique_users, unique_visitors) → type: unique
```

**UI:**
```
Date column:    [date ▼]        ← includes the detected date col as an option

Dimensions (segment by):
  ☑ campaign      3 unique values
  ☑ region        4 unique values
  ☐ creative_id   48 unique values  ← unchecked (high cardinality)
  User can check/uncheck any field
  User can move a metric to dimension or vice versa

Metrics (analyse):
  ☑ spend         [Sum ▼]
  ☑ impressions   [Sum ▼]
  ☑ clicks        [Sum ▼]
  ☑ CTR           [Derived: clicks ÷ impressions × 100]  [Edit]
  ☐ reach         [Unique — used as-is, no aggregation]
  + Add custom formula

  Edit button appears on every derived metric row and reopens the
  FormulaBuilder pre-filled with that metric's name and components.
  Saving replaces the metric in-place rather than appending a new one.
```

**Custom formula tiers (2 tiers only — free-form removed):**
```
Tier 1 — pre-built: CTR, CPM, CPC, ROAS (select from dropdown)
Tier 2 — component picker:
  [metric name input]
  [col ▼]  [÷ or × ▼]  [col ▼]  × [constant]
  Operator dropdown lets user choose ÷ (divide) or × (multiply).
  Formula generated:
    divide: numerator / denominator [* constant if ≠ 1]
    multiply: left * right [* constant if ≠ 1]
```

**Sparsity:** Handled silently. Missing campaign-date combos skipped in analysis.
Only surfaced if an entire campaign is missing from the selected anomaly window:
`"Retargeting has no data for November. Excluded from results."`

---

### Step 3 — Scope Management (conditional)

**Trigger condition:**
```
total_rows = unique_dim_combos × date_periods

If total_rows ≤ 50,000 → skip Step 3 entirely, proceed to Step 4
If total_rows > 50,000 → show Step 3, block Continue until resolved
```

**UI (only shown if >50k rows):**
```
Live counter (updates as user makes changes):
  Dimension combos × Date periods = Total rows
  [50] × [730] = [36,500 rows] — under limit ✓

Two levers:
  1. Campaign selector (auto-ranked by spend, highest first)
     ☑ Brand Awareness   $245K
     ☑ Retargeting       $189K
     ☑ Prospecting       $156K
     ☐ Campaign D        $45K
     ☑ Aggregate unselected as "Other"

  2. Date range
     ○ Last 1 year
     ● Last 2 years — recommended
     ○ All data
     ○ Custom: [start] → [end]

If still >50k after both levers:
  "Still too large. You can reduce grain in Step 5
   (weekly grain cuts rows by 7×)."
```

**Note:** Analysis grain is NOT shown here. It lives entirely in Step 5.

---

### Step 4 — Baseline & Anomaly Window

**User action:** Define what "normal" is and which period to inspect for anomalies.

**UI:**
```
Your data spans: Jan 1, 2025 – Dec 31, 2025

Baseline period (define "normal"):
  ● Use all data  (Jan 1 – Dec 31, 2025)
  ○ Custom: [Jan 1, 2025] → [Nov 30, 2025]
            ↑ date pickers are constrained to dataset min/max

Anomaly window (what to check):
  ○ Last 7 days
  ● Month to date  ← default
  ○ Custom: [start] → [end]
            ↑ date pickers are constrained to dataset min/max

Summary: Baseline Jan 1–Dec 31 | Anomalies Dec 1–Dec 31

[soft hint if applicable]
[Back]  [Continue]           ← Continue is never disabled
```

**Validation (soft hints only — never block Continue):**
```
If anomaly_window extends beyond baseline_window:
  → soft note below summary: "Anomaly window extends beyond baseline
    — some periods may have limited context."
  → Continue remains enabled

If baseline has < 14 data points at chosen grain:
  → soft note below summary: "Short baseline — results may be less reliable."
  → Continue remains enabled
```

---

### Step 5 — Analysis Grain (display grain is internal)

**Auto-detect analysis grain:**
```
For each grain (daily, weekly, monthly, quarterly):
  1. Aggregate metrics to that grain
  2. Calculate variance
  3. noise_to_signal = daily_variance / grain_variance
  4. Pick grain with lowest ratio but > 1.5 (avoid over-smoothing)

Example:
  Daily:    variance 12,500
  Weekly:   variance  4,200 → ratio 2.98 ✓ recommended
  Monthly:  variance  1,800 → ratio 6.94 (over-smoothed)
```

**Auto-detect display grain (internal — not user-configurable):**
```
Display grain is computed automatically when the user clicks "Run Analysis"
and is never shown in the UI. Formula (same as before):

data_span < 30 days     → display = analysis grain
data_span 30–90 days    → display = weekly
data_span 90–365 days   → display = monthly
data_span > 365 days    → display = quarterly
Rule: display grain never finer than analysis grain
```

**Dynamic dimension limit:**
```
DEFAULT_TIME_BUDGET_SECONDS = 60
OPS_PER_SECOND = 10_000_000

max_analyses    = (time_budget × OPS_PER_SECOND) / (total_rows × metric_pairs)
max_dimensions  = floor(log2(max_analyses + 1))

If user selects more dimensions than max_dimensions:
  → warn with estimated runtime
  → allow user to proceed if they accept
```

**Daily grain blocking:**
```
If total_rows at daily grain > 50,000:
  → disable Daily option
  → message: "Daily not available for this dataset.
    Use weekly (reduces rows by 7×) or coarser."
```

**UI:**
```
Analysis grain:
  [Daily — disabled if >50k*] [Weekly ✓] [Monthly] [Quarterly]
  ℹ Recommended: weekly

  When Weekly is selected, a second row appears:
  Week starts on:
    [Monday ✓] [Tuesday] [Wednesday] [Thursday] [Friday] [Saturday] [Sunday]
  Default: Monday

  (Display grain is NOT shown — it is auto-computed from analysis grain
   and data span when the user clicks "Run Analysis".)

▼ Advanced options (collapsed by default)
  Processing time limit: [slider 30s–300s, default 60s]
  ℹ Longer = more dimension combinations analysed
    Maximum: 300 seconds (browser safe limit)
```

---

### Step 6 — Backend Analysis (invisible to user)

**Progress shown to user:** "Analysing... (step 3 of 7 dimension combinations) ~12 seconds remaining"

**Step 6a — Filter & aggregate:**
```
1. Filter rows to baseline_window
2. Aggregate to analysis_grain:
   - summable (spend, clicks)     → SUM per period
   - derived (CTR, CPM)           → SUM(numerator) / SUM(denominator)
   - unique (reach)               → raw value as-is, no aggregation
3. Output: aggregated_baseline[]
```

**Step 6b — Generate all dimension combinations:**
```
Generate all 2^n - 1 subsets of selected dimensions
Example (campaign, creative, account → 7 subsets):
  {campaign}, {creative}, {account},
  {campaign+creative}, {campaign+account},
  {creative+account}, {campaign+creative+account}

For each subset:
  Group by (subset dimensions + date)
  Re-aggregate metrics across non-subset dimensions
```

**Step 6c — Calculate baseline statistics:**
```
For each (dimension combo × metric pair):
  direction_score = % of consecutive periods where
                    both metrics moved in same direction

  elasticity_per_period[] = % change metricA / % change metricB
  mean_elasticity          = mean(elasticity_per_period)
  std_elasticity           = stdDev(elasticity_per_period)

Store as BaselineStats{}
```

**Step 6d — Detect anomalies in anomaly window:**
```
Filter aggregated data to anomaly_window

For each (period × dimension combo × metric pair):
  check_direction:
    did they move opposite to baseline direction_score norm?

  check_elasticity:
    actual_elasticity = % change metricA / % change metricB
    sigma_deviation   = |actual - mean_elasticity| / std_elasticity
    is sigma_deviation > 2.0?

  check_persistence:
    has this condition lasted ≥ 2 consecutive periods?

Severity assignment:
  CRITICAL → direction reversed + persisted ≥ 3 periods
  WARNING  → elasticity > 2σ + persisted ≥ 2 periods
  INFO     → single period deviation

IMPORTANT: Anomalies are NEVER rolled up into display grain.
They are always stored and displayed at analysis grain.
They are only GROUPED UNDER display grain headings for visual organisation.
```

---

### Step 7 — Results Dashboard

**Section 1 — Metric health snapshot:**
```
Quick status per metric pair (green/yellow/red):
  Spend ↔ Impressions    🔴 Misaligned
  Impressions ↔ Clicks   🟡 Weak link
  CPM trend              🟢 Stable

No numbers. No r-values. Just status.
Purpose: exec scans in 5 seconds. Red = keep reading.
```

**Section 2 — Anomaly cards:**
```
Sorted by severity (critical first)
Grouped by display_grain heading (e.g. "November 2025")
Each card shows analysis_grain detail (e.g. "Week of Nov 15–22")

Card format:
  🔴 CRITICAL
  Retargeting · Week of Nov 15–21
  "Spend fell 44% while impressions barely moved."
  "Historically these two metrics move together 89% of the time."
  "This was a single-period departure from that pattern."
  [Campaign] [spend ↔ impressions]
  [See detail ▶]

  Severity badge has a hover tooltip explaining the level:
    INFO     → "Single-period departure from the usual pattern between these two metrics."
    WARNING  → "Unusual pattern that persisted across 2 or more consecutive periods."
    CRITICAL → "Metrics moved in opposite directions across 3 or more consecutive periods."

Rules:
  - No "elasticity", "r-value", "sigma", "correlation" in card text
  - Plain English only
  - Title ≤ 80 characters
  - Body: exactly 3 sentences:
    S1: actual % change (e.g. "Spend fell 44% while impressions barely moved.")
    S2: historical context — varies by anomaly type:
        Direction anomaly: "Historically these two metrics move together N% of the time."
        Elasticity anomaly: "Historically, a 1% change in [mA] is associated with about a
          [ratio]% change in [mB]." (shows the typical proportional relationship)
    S3: persistence (e.g. "This was a single-period departure from that pattern." or
        "This continued for N consecutive periods.")
```

**Section 3 — How we calculate (collapsed by default):**
```
▼ How we detect anomalies

1. Direction: do these metrics usually move together?
   "Spend and impressions move the same way 89% of the time"

2. Proportionality: when they change, is the change similar in size?
   "A 1% increase in spend typically yields 0.84% more impressions"
   "We track how much this ratio varies week to week"

3. Persistence: has this broken pattern lasted multiple periods?
   "We only flag anomalies that persist for 2 or more periods"

No formulas. No Greek letters. No jargon.
```

**Footer:**
```
[Export as PDF]  [Change window]  [New file]
[Back] available on every step throughout the app
```

---

### Step 8 — Drill-Down View

**Triggered by:** clicking [See detail ▶] on any anomaly card.

**Content:**
```
1. Plain English summary — period prefix + anomaly.body (identical to card)
   Direction example: "Feb 12–18, 2024: spend fell 44% while impressions
    barely moved. Historically these two metrics move together 89% of
    the time. This was a single-period departure from that pattern."
   Elasticity example: "Feb 12–18, 2024: spend rose 2% while impressions
    rose 15%. Based on past patterns, a 2% rise in spend typically leads
    to about 3% in impressions — the actual change was 15%. This was a
    single-period departure from that pattern."

2. "How they moved over time" — dual-axis line chart (shown first)
   MetricA: solid amber line (left Y-axis, actual values)
   MetricB: dashed cyan line (right Y-axis, actual values)
   Anomaly period shaded in pink
   Toggle: [Actual values] | [Relative view]
     Relative view: both metrics indexed (baseline avg = 100) on a
     single Y-axis so divergence is visually obvious; tooltip still
     shows actual values; explanation below chart includes a worked
     example and the formula: (value ÷ baseline average) × 100

3. "How each metric changed" — stat table (shown second)
   Columns: Metric | Baseline avg | Anomaly period avg | Change
   Baseline avg = arithmetic mean of all data points before anomaly.periodStart
   Change is colour-coded green (positive) / red (negative)
   Replaces the former grouped bar chart (which had a fatal single-axis
   scale problem when metrics have very different magnitudes)

4. Dimension context
   "Analysed at: Campaign + Creative level"
   "Campaign: Retargeting | Creative: Video_Q4_v2"

5. Drill options
   [See campaign level only ▶]
   [See all creatives within this campaign ▶]
   [← Back to overview]
```

---

## 6. Analysis Algorithm (formal definition)

### Direction score
```
directionScore(a[], b[]) → number [0, 1]

For each consecutive pair (i, i+1):
  Δa = a[i+1] - a[i]
  Δb = b[i+1] - b[i]
  match = (sign(Δa) === sign(Δb)) ? 1 : 0

directionScore = sum(matches) / (n - 1)
```

### Elasticity
```
elasticity(a[], b[]) → number[]

For each consecutive pair (i, i+1):
  pctA = (a[i+1] - a[i]) / a[i]  (skip if a[i] === 0)
  pctB = (b[i+1] - b[i]) / b[i]  (skip if b[i] === 0)
  ratio = pctA / pctB             (skip if pctB === 0)

Returns array of ratio values
meanElasticity = mean(ratios)
stdElasticity  = stdDev(ratios)
```

### Anomaly detection
```
For each period p in anomaly_window:
  actual_elasticity = elasticity at period p
  sigma = |actual_elasticity - meanElasticity| / stdElasticity

  direction_broke = sign changed vs baseline direction_score norm
  elasticity_broke = sigma > THRESHOLDS.SIGMA_THRESHOLD (2.0)
                     AND (|pctA| >= MIN_ANOMALY_PCT_CHANGE OR |pctB| >= MIN_ANOMALY_PCT_CHANGE)
                     ← skip if both metrics changed by < 5% (noise suppression)
  persisted = condition true for ≥ THRESHOLDS.MIN_PERSISTENCE (2) consecutive periods

  if direction_broke AND persisted ≥ 3 → CRITICAL
  if elasticity_broke AND persisted ≥ 2 → WARNING
  if (direction_broke OR elasticity_broke) AND persisted = 1 → INFO
```

---

## 7. Constants (define in src/constants/index.ts)

```typescript
export const THRESHOLDS = {
  MAX_FILE_SIZE_MB:          50,
  MAX_ROWS:                  50_000,
  FILE_SIZE_WARN_MB:         10,
  SIGMA_THRESHOLD:           2.0,
  MIN_PERSISTENCE:           2,
  CRITICAL_PERSISTENCE:      3,
  MIN_BASELINE_POINTS:       14,
  DATE_PARSE_MIN_SUCCESS:    0.9,    // 90% of rows must parse
  MIN_ANOMALY_PCT_CHANGE:    0.05,   // 5% min change for elasticity anomaly
};

export const CONFIG = {
  DEFAULT_TIME_BUDGET_SECONDS: 60,
  MAX_TIME_BUDGET_SECONDS:     300,
  MIN_TIME_BUDGET_SECONDS:     30,
  OPS_PER_SECOND:              10_000_000,
};

export const CHART_COLORS = [
  '#f5a623', '#3dd6c0', '#5b8ff9',
  '#ff6b5b', '#5fd68a', '#a78bfa', '#f472b6',
];
```

---

## 8. Error States

| Condition | User-facing message |
|---|---|
| Unsupported file type | "Unsupported format. Please upload .csv, .xlsx, or .xls." |
| File > 50MB | "File too large. Please reduce file size." |
| No date column | "No date column found. Ensure one column contains dates." |
| No numeric columns | "No numeric columns detected. Ensure your file has metric data." |
| < 14 baseline points | Soft hint: "Short baseline — results may be less reliable." (does not block Continue) |
| Campaign missing from anomaly window | "Retargeting has no data for the selected period. Excluded from results." |
| Two-file merge: zero matching rows | "No matching rows found between the two files. Check dimension column mapping." |
| Single metric only | Correlation section shows: "Need ≥ 2 metrics for comparison analysis." |

---

## 9. Design Tokens

```css
/* Backgrounds */
--bg:   #0e0f11;   --bg2: #161719;
--bg3:  #1e2022;   --bg4: #252729;

/* Text */
--text: #e8e6e1;  --muted: #8a8882;  --dim: #5a5854;

/* Accents */
--amber: #f5a623;  --teal: #3dd6c0;
--coral: #ff6b5b;  --blue: #5b8ff9;  --green: #5fd68a;

/* Severity */
--critical: var(--coral);
--warning:  var(--amber);
--info:     var(--blue);
--success:  var(--green);

/* Typography */
--font-display: 'Fraunces', Georgia, serif;
--font-ui:      'DM Sans', sans-serif;
--font-mono:    'DM Mono', monospace;

/* Shape */
--r: 8px;  --r2: 12px;
```

---

## 10. Fixture Data

`fixtures/sample_campaigns.csv` — 3 campaigns × 60 days (Jan 1 – Feb 29, 2024).

Injected anomalies:
- **Retargeting, days 40–50:** spend increases ~5%/day, impressions decrease ~3%/day → triggers EFFICIENCY_DROP
- **Prospecting, days 45–60:** impressions grow >5%, clicks flat within 1% → triggers CTR_DECAY  
- **Brand Awareness, day 52:** spend = μ + 2.5σ → triggers SPEND_SPIKE

---

*Architecture Version: 2.0 — Locked for Claude Code handoff*
