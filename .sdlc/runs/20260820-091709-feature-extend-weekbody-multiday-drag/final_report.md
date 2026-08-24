# Final Report — Multi-day drag-to-create in the Week all-day row

- **Run:** `20260820-091709-feature-extend-weekbody-multiday-drag`
- **Mode / intent:** brownfield · `feature-extend`
- **Policy / auth:** `opus-only-v5` · `auth_mode=estimated` (every phase on `claude-opus-5`)
- **Baseline:** `4189de1` on `CMP-101/opus-only` — 2298 pass / 0 fail / 302 files
- **Outcome:** complete, all gates approved through Gate 3; **not committed** (working tree only)

---

## 1. What shipped

Pressing on empty space in the Week all-day row and dragging across day columns now creates one
all-day draft spanning every column the pointer crossed, with a live preview while the drag runs.

The gesture is an **opt-in flag** on the shared `useAllDayDraftCreation` hook. Week turns it on
through a new wrapper; the Day view calls the same hook without the flag and is untouched — no
listeners, no behaviour change, and its call site was never edited (it is off-limits).

**11 files, all inside the write contract.** 4 new, 7 edited.

| # | Path | New/Edit | What |
|---|---|---|---|
| 1 | `packages/web/src/interaction/interaction.constants.ts` | edit | `ALL_DAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4` + doc comment |
| 2 | `packages/web/src/grid/interaction/math/all-day.create.ts` | **new** | Pure range normalisation (min/max, exclusive end) |
| 3 | `packages/web/src/grid/interaction/math/all-day.create.test.ts` | **new** | 10 unit tests, no jsdom |
| 4 | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | edit | The gesture, behind `isMultiDayDragEnabled` |
| 5 | `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | edit | 3 original tests kept + 18 new = 21 |
| 6 | `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` | **new** | Week wrapper, opts in |
| 7 | `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` | **new** | 5 tests |
| 8 | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | edit | Swap to the wrapper |
| 9 | `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx` | edit | Gate-3 approved: fire `mouseUp` |
| 10 | `docs/frontend/week-drag-interaction.md` | edit | New section incl. the clientY pin |
| 11 | `.gitignore` | edit | One line: `.sdlc/` |

**The rendering side needed no change at all.** Discovery predicted it and the architecture
confirmed it: `Draft.tsx`, `Grid.tsx`, `all-day-draft.position.ts`, `AllDayGridRow.tsx` and the
draft adapter are already span-agnostic, so eight candidate files dropped out of the write set
before a line was written.

## 2. Quality gates

| Gate | Result |
|---|---|
| `bun test:web` | **2331 pass / 0 fail / 304 files** (baseline 2298/0/302; **+33 net new tests**) |
| `bun type-check` | pass |
| `bun lint` | **0 errors** (10 warnings, all pre-existing elsewhere in the repo) |
| Write contract | all 11 paths in the allowlist — **AC-14 satisfied** |
| `.gitignore` (AC-13) | 1 line added, 0 removed |
| Day view untouched (AC-11) | no file under `packages/web/src/views/Day/` in the diff |

## 3. The one hard invariant

`useGridCoordinates.getDateByXY` resolves the column from x and then adds `getMinuteByY(y)`
minutes to that date. `getMinuteByY` floors at 0 but has **no upper bound**, so a pointer dragged
far below the grid exceeds 1440 minutes and silently rolls the resolved date into the *next day*.

This was **not in the intent brief** — the requirements phase found it by reading the resolver, and
it became FR-3/AC-9. Every pointer→date resolution during the gesture passes the `clientY` captured
at mousedown. The threshold check is pinned the same way, which makes it horizontal-only for free
(`hasExceededInteractionMoveThreshold` ORs `|dx|` with `|dy|`; a pinned y makes `dy` identically 0).
The rollover is guarded twice, and each guard now has a test that fails when it is removed.

## 4. Review outcomes

**Senior review: CHANGES REQUIRED → remediated.** The reviewer ran 9 mutants against the targeted
suites and **4 survived** — four of my tests passed whether or not the code was correct. Most
pointedly, the test named as the clientY pin's guard could not detect the pin's removal at all: it
dragged purely vertically, so the threshold short-circuited before the resolver was ever called.
It also caught that `bun lint` was failing on 3 Biome errors introduced by this run.

All four refinement packets were executed and **all 6 mutants are now killed**, each verified by
applying the mutation, confirming the suite fails, and md5-restoring the source:

| Mutation | Before | After |
|---|---|---|
| clientY pin removed (resolver sees live y) | survived | **killed** |
| threshold fed live y (x-only guard removed) | survived | **killed** |
| `mouseup` removed with wrong capture flag | survived | **killed** |
| dedupe short-circuit removed | survived | **killed** |
| `isPreviewStarted` guard removed from `cancel()` | survived | **killed** |
| re-entrancy `gestureRef.cancel()` removed | survived | **killed** |

The lint fix used `biome check --write` **scoped to this run's files** — deliberately not the
repo-wide `bun lint:fix`, which would have auto-fixed 10 pre-existing warnings elsewhere and
silently blown the write contract.

**Security review: PASS WITH NOTES — no critical, high or medium finding introduced.** It verified
rather than restated the claims: the draft store has no `persist` middleware and no changed source
file touches storage, network, console or telemetry, so nothing is persisted or transmitted before
the user confirms. Zero dependency delta, zero secrets. It drove `NaN`/`±Infinity`/`1e300` through
the column resolver and confirmed all land in `[0,6]` — and noted the stronger reason the input is
safe: the date is *selected* from the visible-dates array, never *computed* from `clientX`.

## 5. Two things the plan got wrong, caught in execution

1. **`AllDayRow.tsx` import pruning.** Decision D3 said to drop the `YEAR_MONTH_DAY_FORMAT` import.
   It is still used at line 131 for a React key; removing it would not have compiled. The packet
   carried an explicit verify-before-prune instruction, which is what caught it.
2. **The change plan's own test-count table** disagreed with itself (§3 said 11, §7.2's table has
   14 rows, §10 said 14). Reconciled at packet planning: 14 table rows + 1 case mandated by §7.2's
   closing prose = 15 new, + 3 pre-existing = 18, later 21 after review hardening.

A third was predicted rather than missed: §8 warned that moving Week's handoff to `mouseup` would
break any test asserting a draft after a bare `mouseDown`, and named the remedy. Exactly one test
did (`MainGrid.test.tsx:519`). That file was **not in the allowlist**, so the run refused the write
and escalated it as a blocking decision at Gate 3 rather than quietly widening its own permissions.

## 6. Cost

**$3.06 total, ESTIMATED.** `auth_mode=estimated`, so token counts are ~3.8 chars/token heuristics
priced against the `opus-only-v5` pricing block (in $5/M, cached $0.50/M, out $25/M). **These are
not metered vendor numbers.** 17 telemetry events, all `provenance: "estimated"`, all on
`claude-opus-5`.

| Phase | Events | In | Out | Cost |
|---|---:|---:|---:|---:|
| requirements_analysis | 1 | 28,500 | 5,200 | $0.2725 |
| architecture_design | 1 | 48,500 | 11,100 | $0.5200 |
| plan_task_packets | 1 | 17,100 | 5,000 | $0.2105 |
| codegen | 5 | 19,650 | 2,800 | $0.1683 |
| tests | 3 | 16,050 | 5,890 | $0.2276 |
| docs | 2 | 6,630 | 1,170 | $0.0625 |
| senior_code_review | 1 | 95,000 | 14,000 | $0.8250 |
| refactor (remediation) | 1 | 22,000 | 3,000 | $0.1850 |
| security_review | 1 | 68,000 | 9,000 | $0.5650 |
| debug | 1 | 3,200 | 260 | $0.0225 |
| **TOTAL** | **17** | **324,630** | **57,420** | **$3.0589** |

The two review phases are 45% of the run's cost and produced its highest-value findings.

## 7. Known gaps

1. **Every cost number is an estimate**, not metered spend. The `architecture_design` event is the
   least precise: the run was interrupted mid-Phase-2 and that event was reconstructed on resume
   from measured artifact byte-counts.
2. **`provenance.json`:** all 11 `sha_before` values are correct, so `/mmo:revert` is sound. Three
   `sha_after` values (both test files, the doc) are stale — the remediation packets landed after
   the helper had already closed those records.
3. **`.hook-logs/` is untracked and unignored.** Plugin hook output, not part of the write set;
   both reviewers flagged it. Delete before committing — FR-17 permits only the one `.sdlc/` line.
4. **Pre-existing dependency debt:** `bun audit` reports 69 vulnerabilities (24 high), all inherited
   from the baseline, none introduced. Worth a separate ticket.
5. **Not committed.** The working tree holds all 11 files; no branch or commit was created.

## 8. Traceability

All 14 acceptance criteria are met. AC-1/2 (span + reverse normalisation) by
`all-day.create.test.ts` and hook tests 1-2; AC-3 by the 3 original tests, unmodified; AC-4/5 by the
wrapper suite; AC-6 by the untouched keyboard suites; AC-7 by blur/unmount tests; AC-8 by
2331/0; AC-9 by the diagonal-drag and vertical-drag pair; AC-10 by the edge-clamp test; AC-11 by the
Day-shaped call test plus an empty `views/Day/` diff; AC-12 by clean type-check and lint; AC-13 by a
1-line `.gitignore` diff; AC-14 by the allowlist check over all 11 paths.
