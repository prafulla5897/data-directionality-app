# CLAUDE.md — Marketing Signal
# Layered instruction hierarchy: Org → Team → Project
# Read this fully before writing any code. It does not change during a phase.
# Version: 2.0

---

## Layer 1 — Org Standards

### Model settings
```
model:    claude-sonnet-4-20250514
thinking: enabled (extended)
effort:   max
```

### Language & compiler
- **TypeScript strict mode** always — `"strict": true` in `tsconfig.json`
- This enables: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`,
  `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`
- Zero `any` types — use `unknown` and narrow with type guards
- Zero `// @ts-ignore` comments
- All exported functions documented with JSDoc (`@param`, `@returns`, `@example`)
- Max file length: **300 lines** — split if exceeded

### Naming conventions
```typescript
// Variables and functions: camelCase
const rawRows: RawRow[] = [];
function parseFile(file: File): Promise<RawRow[]> {}

// Types and interfaces: PascalCase
interface MetricConfig {}
type Severity = 'critical' | 'warning' | 'info';

// Constants: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE_MB = 50;

// React components: PascalCase
function Step1Upload(): JSX.Element {}

// CSS modules: camelCase
styles.uploadZone
styles.anomalyCard
```

### Forbidden patterns
```typescript
// ❌ Never
eval(...)
document.write(...)
element.innerHTML = userInput          // XSS — use textContent or sanitise
fetch('any-external-url', data)        // No data leaves the browser
window.location.href = ...             // No redirects
// @ts-ignore
import * as x from '...'              // No wildcard imports
console.log(...)                       // Use: if (DEBUG) console.log(...)
```

### Sub-agent rules (Claude Code context)
- Use sub-agents for **file search** and **test execution** only
- Never use sub-agents for **architecture decisions** — those need human approval
- Max concurrent sub-agents: **3**
- Sub-agents must not write files outside their assigned module directory

---

## Layer 2 — Frontend / Data-Viz Team Standards

### React rules
- Functional components only — no class components
- Custom hooks for all shared stateful logic (e.g. `useAppState`, `useParsedFile`)
- No prop drilling beyond 2 levels — use context for shared state
- Memoize expensive computations with `useMemo`
- All event handlers typed explicitly: `React.ChangeEvent<HTMLInputElement>`

### CSS rules
- All colours, fonts, and spacing via **CSS custom properties** from `tokens.css`
- No inline `style={{}}` except for dynamically computed values (chart colours, widths)
- CSS Modules for all component styles — no global class name collisions
- Mobile-first: base at 375px, breakpoints at 768px and 1200px
- Animations: `transform` and `opacity` only (compositor-safe)

### Chart.js rules
- Always call `chart.destroy()` before creating a new chart on the same canvas
- Every `<canvas>` must have `role="img"` and a descriptive `aria-label`
- Colours from `CHART_COLORS` in `constants/index.ts` — never hardcoded in chart config
- Format tick values with units: `$1,234` not `1234`, `200K` not `200000`
- Tooltips must include metric name and formatted value

### Data processing rules
- All functions in `utils/` are **pure** — no DOM access, no side effects, no global state
- Missing values (`null`, `undefined`, `''`, `NaN`) are **skipped**, never imputed
- Numeric precision: 4 decimal places internally, 2 decimal places for display
- All series sorted ascending by date before any analysis
- Skip elasticity calculation if either metric value is 0 (avoid division by zero)

---

## Layer 3 — Project Rules (Marketing Signal)

### Module responsibilities (strict — do not mix)
| File | Responsibility | May import |
|---|---|---|
| `constants/index.ts` | THRESHOLDS, CONFIG, CHART_COLORS — no logic | nothing |
| `types/index.ts` | TypeScript interfaces only — no logic | nothing |
| `utils/parser.ts` | File → RawRow[] only | constants, types |
| `utils/schemaDetector.ts` | Schema auto-detection only | constants, types |
| `utils/fileMerger.ts` | Two-file fuzzy merge | constants, types, parser |
| `utils/aggregator.ts` | RawRow[] → Series[] | constants, types |
| `utils/analysis.ts` | Pure math functions only | constants, types |
| `utils/ruleEngine.ts` | Anomaly[] generation | constants, types, analysis |
| `components/` | UI only — no analysis logic | utils, types, constants |
| `App.tsx` | Step routing + AppState | components, types |

### Key project constants (always use — never inline)
```typescript
import { THRESHOLDS, CONFIG } from '../constants';

// File limits
THRESHOLDS.MAX_FILE_SIZE_MB      // 50
THRESHOLDS.MAX_ROWS              // 50_000
THRESHOLDS.FILE_SIZE_WARN_MB     // 10

// Analysis
THRESHOLDS.SIGMA_THRESHOLD       // 2.0
THRESHOLDS.MIN_PERSISTENCE       // 2
THRESHOLDS.CRITICAL_PERSISTENCE  // 3
THRESHOLDS.MIN_BASELINE_POINTS   // 14

// Time budget
CONFIG.DEFAULT_TIME_BUDGET_SECONDS  // 60
CONFIG.MAX_TIME_BUDGET_SECONDS      // 300
CONFIG.MIN_TIME_BUDGET_SECONDS      // 30
CONFIG.OPS_PER_SECOND               // 10_000_000
```

### Insight / anomaly card rules
```
- title: plain English, ≤ 80 chars, no statistical jargon
- body: 2–3 sentences, no jargon, explains what happened and why it matters
- FORBIDDEN words in card text: elasticity, correlation, r-value, sigma,
  Pearson, standard deviation, coefficient, variance
- ALLOWED: "moved together", "moved in opposite directions", "unusual",
  "historically", "typically", "pattern", "out of the ordinary"
```

### Aggregation rules by metric type
```typescript
// summable (spend, clicks, conversions, impressions)
aggregated = sum(values)

// derived (CTR, CPM, CPC, ROAS)
// NEVER average the daily rates — recalculate from summed components
CTR  = sum(clicks) / sum(impressions) * 100
CPM  = sum(spend) / sum(impressions) * 1000
CPC  = sum(spend) / sum(clicks)
ROAS = sum(revenue) / sum(spend)

// unique (reach, unique_users)
// No aggregation — use raw value as provided, mark as non-comparable across periods
```

### Anomaly display rules
```
- Anomalies are NEVER aggregated into display grain
- They are detected at analysis grain and stay at analysis grain
- They are only GROUPED UNDER display grain headings for visual organisation
- Example: "November 2025" is a group heading
            "Week of Nov 15–22: CRITICAL" is the actual anomaly card
```

### Step 3 (Scope) trigger rule
```typescript
const totalRows = uniqueDimCombos * datePeriods;
const showStep3 = totalRows > THRESHOLDS.MAX_ROWS;
// If false: skip Step 3, proceed directly to Step 4
// User can still adjust scope if they want — just not forced to
```

### Back navigation
Every step (2–8) must have a [Back] button that returns to the previous step
without losing any state. Step 1 has no Back button (entry point).

### What "done" means for any task
A task is complete when:
1. All TypeScript compiles with zero errors (`tsc --noEmit`)
2. Zero ESLint warnings
3. No forbidden patterns used
4. File stays under 300 lines
5. JSDoc on every exported function
6. All acceptance criteria in `PHASES.md` for this phase are green

---

*CLAUDE.md Version: 2.0 — Locked for Claude Code handoff*
