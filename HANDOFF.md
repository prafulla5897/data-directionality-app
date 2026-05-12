# HANDOFF.md — Claude Code Session Guide
# Project: Marketing Signal
# Version: 2.0
# Updated by Claude Code at the end of each phase.

---

## How to start a Claude Code session

Paste this block at the top of every new conversation:

```
Project: Marketing Signal — Time-Series Correlation Analyser
You are building a browser-only marketing analytics app with zero AI/ML.

Read these files in this order before writing any code:
1. ARCHITECTURE.md  — what we are building (full system design)
2. CLAUDE.md        — how to code it (TypeScript standards, rules, constants)
3. PHASES.md        — Phase [N] section only (current phase scope + criteria)

Current phase: Phase 5 — Polish & Hardening
Files relevant to this phase: all source files
```

---

## Files to load per phase

| Phase | Load in addition to the 3 core docs |
|---|---|
| 0 — Scaffold | nothing extra |
| 1 — Upload + Schema | `src/utils/parser.ts`, `src/utils/schemaDetector.ts`, `src/components/Step1Upload/`, `src/components/Step2Schema/` |
| 2 — Scope + Windows + Grain | all Phase 1 files + `src/components/Step3Scope/`, `Step4Windows/`, `Step5Grain/` |
| 3 — Analysis Engine | `src/utils/aggregator.ts`, `src/utils/analysis.ts`, `src/utils/ruleEngine.ts`, `src/types/index.ts`, `src/constants/index.ts` |
| 4 — Dashboard | all utils + `src/components/Step6Progress/`, `Step7Results/`, `Step8Drilldown/`, `src/App.tsx` |
| 5 — Polish | all source files |

Do NOT paste full file contents — reference by path and let Claude Code read them.

---

## Phase outcome log
*(Claude Code updates this table at the end of each phase)*

| Phase | Status | Date | Notes |
|---|---|---|---|
| 0 — Scaffold | ✅ Complete | 2026-05-06 | tsc clean, build passes, lint clean, 180-row fixture with 3 injected anomalies |
| 1 — Upload + Schema | ✅ Complete | 2026-05-06 | tsc clean, build passes, lint clean; parser/schemaDetector/fileMerger implemented; Step1Upload (drag-drop, size warning, two-file merge) and Step2Schema (reassignment, 3-tier formula builder) complete |
| 2 — Scope + Windows + Grain | ✅ Complete | 2026-05-07 | tsc clean, build passes, lint clean; Step3Scope (campaign selector, date range, live counter), Step4Windows (baseline + anomaly window with soft notes), Step5Grain (noise-to-signal auto-detect, display grain auto-computed, advanced time budget slider, dimension limit warning) all implemented; App.tsx wires steps 3–5 with conditional Step 3 logic. 12 post-phase bugs fixed: date column dropdown (Step2), dimensions section (Step2), FormulaBuilder free-form removed, × operator added to picker, edit button for derived metrics, file clear buttons (Step1), large-file warning stays on Step1 until user continues, date picker min/max constraints (Step4), anomaly summary null-safe (Step4), baseline-too-short and anomaly-extends warnings converted to soft hints, display grain UI removed from Step5 (auto-computed from analysis grain + data span) |
| 3 — Analysis Engine | ✅ Complete | 2026-05-07 | tsc clean, build passes, lint clean; analysis.ts (pearsonR, directionScore, elasticityPerPeriod, mean, stdDev, zScore, rollingCorr), aggregator.ts (buildSeries + generateDimensionSubsets), ruleEngine.ts (generateAnomalies with direction + elasticity anomaly detection, plain-English titles/bodies) all implemented; 47 unit tests pass (analysis.test.ts + ruleEngine.test.ts); all Phase 3 acceptance criteria met |
| 4 — Dashboard | ✅ Complete | 2026-05-07 | tsc clean, build passes, lint clean, 47 unit tests pass; Step6Progress (progress bar + cancel), Step7Results (health snapshot, anomaly cards grouped by display grain, severity filter, methodology accordion, markdown export), Step8Drilldown (scatter + time-series Chart.js charts with anomaly shading, dimension context, drill navigation) all implemented; App.tsx wires chunked async analysis execution with progress tracking. Post-phase fixes: B1 week label, B2 scatter dots, B3 dual Y-axis, B4 insight direction, C1 preset changes, C2 week start day, C3 campaign header, N1 PDF export. Additional fixes 2026-05-12: Step5 subtitle corrected; weekStartDay widened to all 7 days (0–6) in types + aggregator + Step5Grain UI; ScatterChart dataset split fixed (historical = non-anomaly-window only, anomaly = anomaly-window only, no overlap); scatter tooltip shows date per point via title callback |
| 5 — Polish | ⬜ Not started | — | — |

---

## Pre-phase gate checklist
*(Run before marking any phase complete)*

- [ ] `npm run build` succeeds with zero errors
- [ ] `tsc --noEmit` passes with zero type errors
- [ ] `npm run lint` passes with zero warnings
- [ ] All acceptance criteria in PHASES.md for this phase are ✓
- [ ] All prior phase acceptance criteria still pass
- [ ] No file exceeds 300 lines (`wc -l src/**/*.ts src/**/*.tsx`)
- [ ] No forbidden patterns (`grep -r "eval\|innerHTML =\|document\.write\|@ts-ignore" src/`)
- [ ] DevTools Network tab shows zero outbound requests during analysis

---

## Pre-deploy checklist
*(Run before shipping to production)*

- [ ] All phases complete with documented outcomes above
- [ ] `tsc --noEmit` passes
- [ ] `eslint . --max-warnings 0` passes
- [ ] All unit and E2E tests pass
- [ ] Lighthouse accessibility score ≥ 85
- [ ] No hardcoded secrets or API keys
- [ ] Build succeeds: `npm run build`
- [ ] Analysis of 50k-row file completes within 60s time budget
- [ ] Verified: zero network requests during analysis (DevTools)

---

## FAQ
*(Questions that come up during builds)*

**Q: Can I combine two JS/TS modules to save lines?**
A: No. Module boundaries are fixed — see CLAUDE.md Layer 3. Each file has a single responsibility.

**Q: Can I add a new threshold value?**
A: Yes — add it to `src/constants/index.ts` AND update the relevant section in ARCHITECTURE.md §7. Both must stay in sync.

**Q: Step 3 isn't showing — is that a bug?**
A: No. Step 3 is intentionally skipped if `total_rows ≤ 50,000`. See ARCHITECTURE.md Step 3.

**Q: Should anomalies be aggregated into display grain?**
A: Never. Anomalies are detected at analysis grain and stay there. They are only GROUPED under display grain headings for visual organisation. See ARCHITECTURE.md Step 6d and Step 7.

**Q: Where do I add a new insight / anomaly rule?**
A: In `src/utils/ruleEngine.ts`. Also add the threshold to `src/constants/index.ts` and document it in ARCHITECTURE.md §6.

**Q: A metric has zero values — what to do?**
A: Skip elasticity calculation for that period (division by zero). Mark those periods as null in the elasticity array. See CLAUDE.md Layer 2 data processing rules.

**Q: The user selected more dimensions than max_dimensions allows. Block or warn?**
A: Warn with estimated runtime and allow user to proceed if they accept. Never silently truncate their selection. See ARCHITECTURE.md Step 5.

**Q: Should TypeScript strict mode break existing working code?**
A: Yes, intentionally. Fix all type errors — do not use `// @ts-ignore` or cast to `any`. The errors exist for good reason.

**Q: Where is the time budget slider in the UI?**
A: In Step 5, inside the "Advanced options" section which is collapsed by default. It should not be prominent — see ARCHITECTURE.md Step 5 and CLAUDE.md Layer 3.

**Q: How should unique metrics (reach, unique_users) be aggregated?**
A: They cannot be aggregated. Use the raw value as-is at whatever grain it was provided. Do not sum or average them. See CLAUDE.md Layer 3 aggregation rules.

**Q: Can I use any words like "elasticity" or "sigma" in the UI?**
A: Never in user-facing text (cards, labels, tooltips). Only allowed in code comments and internal variable names. See CLAUDE.md Layer 3 insight rules.

---

*HANDOFF.md Version: 2.0 — Updated by Claude Code after each phase*
