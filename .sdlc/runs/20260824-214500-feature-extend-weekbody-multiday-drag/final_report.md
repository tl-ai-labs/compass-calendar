# Final Report — Multi-day drag-to-create in the Week all-day row

**Run:** `20260824-214500-feature-extend-weekbody-multiday-drag`
**Intent:** `feature-extend` · **Policy:** `opus-plus-sonnet` · **Auth:** `estimated`
**Branch:** `CMP-101/opus-plus-sonnet`, cut from `main` @ `4189de13`
**Status: complete, verified, NOT committed.** `git_head` unchanged, 0 commits recorded.

---

## 1. What shipped

The Week view's all-day row now supports press → drag horizontally across day columns → release,
creating one all-day event spanning the dragged day range, with a live preview bar that grows and
shrinks during the drag. It was previously click-only with a hardcoded one-day span.

Reverse drags normalize, Escape / window-blur / unmount cancel cleanly, and a click or sub-threshold
drag produces exactly the draft it produced before.

**8 files: 5 modified, 3 new. +658 / −23.**

| File | Change |
|---|---|
| `grid/hooks/useAllDayDraftCreation.ts` | The substantive change: optional `isMultiDayDragEnabled` drag lifecycle |
| `grid/interaction/math/all-day.create.ts` | **new** — pure day-range math |
| `grid/interaction/math/all-day.create.test.ts` | **new** — 14 cases |
| `grid/hooks/useAllDayDraftCreation.test.tsx` | +23 cases (3 originals untouched) |
| `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | one line: `isMultiDayDragEnabled: true` |
| `views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | **new** — 2 Week-surface cases |
| `interaction/interaction.constants.ts` | `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4` + doc |
| `views/Week/components/Grid/MainGrid/MainGrid.test.tsx` | **+2 / −0**, under a bounded Gate 2 exception |

---

## 2. Verification (all re-run at final state)

| Check | Result |
|---|---|
| `bun test:web` | **2337 pass / 0 fail**, 304 files |
| Baseline | 2298 pass / 0 fail → **+39 net new tests** |
| `bun run type-check` | **PASS** |
| Biome, 8 changed files | **0 diagnostics** |
| `views/Day/**` | empty diff |
| `grid/hooks/useTimedDraftCreation.ts` | empty diff — `isSameDayDrag` untouched |
| `package.json` / `bun.lock` / `packages/*/package.json` | empty diff — no new dependencies |
| `biome.json`, `.mcp.json`, `AGENTS.md` | untouched |
| `MainGrid.test.tsx` | `+2 / −0`; assertions `2024-01-14` / `2024-01-15` character-identical |

`.claude/settings.json` differs from `main`, but its mtime is **2026-08-22** — two days before this
run began, and it was already modified in the session's opening `git status`. It is absent from
`provenance.json`. Not attributable to this run.

### The load-bearing invariant

All-day `endDate` is **exclusive**. `resolveAllDayCreateRange` emits `endDate = lastInclusiveDay + 1`,
so today's click behaviour is the **n = 0 case of the general formula** rather than a preserved
special case. There is deliberately no click branch in the range math. This was confirmed twice
independently: `event-nudge.util.ts` documents it, and `getVisibleAllDaySpan`
(`grid/layout/event.position.ts:146-171`) implements it in the layout arithmetic.

Because of this, the live spanning preview required **zero new layout code** — the render path
already handled multi-day all-day drafts.

---

## 3. Gate decisions

| Gate | Outcome |
|---|---|
| 1 — requirements | approved; D-1 = **(c) opt-in per consumer**, D-2 eligibility, D-3 dedicated threshold |
| 2 — change plan | approved; **allowlist extended by one file** (option A) |
| 3 — reviews | approved; dispatch TP-R1 + TP-R2, defer TP-R3 |
| 4 — final report | pending |

### D-1 was the decisive call

"Add a drag" and "change nothing about clicks" genuinely collide: the hook committed **on mousedown**,
and a drag cannot, because the range is unknown at press time. Option (c) — an optional flag, default
off — let the Week row opt in while the Day view keeps today's code path **byte-for-byte**, satisfying
the Day-view constraint *structurally* rather than by arguing two behaviours are equivalent.

This was later vindicated: `DayCalendarGrid.test.tsx:1042` presses the Day all-day region with
`mouseDown` and no `mouseUp`. Under option (a) that test would have broken — inside off-limits
`views/Day/**`, with **no legal way to fix it**. The run would have deadlocked.

The accepted cost: in the Week all-day row only, a press-and-hold without moving now opens the editor
on release rather than press. The draft produced is identical; only timing shifts. Consistent with the
timed grid.

### The Gate 2 allowlist extension — requested and approved, not worked around

The architect flagged that some existing test might press the Week all-day row with `mouseDown`
alone. Checking the whole package found **exactly one**: `MainGrid.test.tsx:518`, which mounts the
real `AllDayRow` and asserts a draft with no `mouseUp`. That file was **not** in the allowlist.

Rather than design around it or silently edit it, the run **halted and re-gated**. The user extended
the allowlist by that one file and **bounded the permission in the contract's `notes`**: add a
`fireEvent.mouseUp` to that single test; the assertions must not change; any other edit requires
re-gating. The final diff is `+2 / −0` — and the zero deletions are what prove no assertion moved.
Leaving those assertions untouched is itself the evidence that AC-3 holds.

---

## 4. What verification caught that code generation did not

Three defects reached disk and were caught downstream. All three are process findings worth keeping.

**4.1 — A generated test broke 72 tests in three unrelated files.**
The first `AllDayRow.test.tsx` used bun's `mock.module`, which is **process-wide, not file-scoped**.
It replaced `@web/events/queries/useWeekEventsQuery` for every subsequent test file and stripped its
other exports, so unrelated suites spread `undefined`. The feature code was never at fault. Fixed by
a debug packet that swapped in a locally-seeded `QueryClientProvider` — the pattern `MainGrid.test.tsx`
already used. **Lesson: `mock.module` is global state; prefer the repo's existing provider fixtures.**

**4.2 — `bun test:web` does not type-check.**
The suite was green while 8 TypeScript errors sat in the extended hook test file (a `kind` widening to
`string`, and a `ReturnType<typeof mock>` annotation that didn't match the harness's real return).
Only `bun run type-check` found them. **Lesson: in this repo a green suite is not evidence of a clean
type-check; both must run.**

**4.3 — The teardown tests were unfalsifiable.**
W7/W8/W9 asserted "no draft" and "callback not called" after Escape / blur / unmount. But `cleanup()`
runs after `isCancelled`/`isFinished` are set, so a **leaked listener is inert anyway** — those
assertions would pass even if every listener leaked or a capture flag were wrong. This mattered
because Gate 2 accepted the net-new Escape design (R-3) *on the condition* that teardown got real
coverage, and that condition was not actually met.

TP-R2 added a `removeEventListener` spy asserting `[type, capture]` pairs across all six teardown
paths. **Proven by mutation:** flipping `mousemove`'s removal capture from `true` to `false` made
R1-R6 fail — while W7/W8/W9 still passed, confirming both the old blind spot and the new coverage.
The mutation was reverted and the suite re-verified green.

---

## 5. Review outcomes

**Senior review:** `approve-with-nits` — 0 blockers, 0 majors, 3 minors. All 6 hard constraints PASS.
**Security review:** `no-blocking-issues` — 3 Low findings, no new dependencies, no data exposure, no
`console.*`, and a max span hard-clamped to 7 days by `getVisibleDateIndexByX` so no unbounded or
`Invalid Date` range can reach the API.

Both reviewers, working independently, converged on the same top finding: `startMultiDayGesture`
omitted the `gestureRef.current?.cancel()` that the template (`useTimedDraftCreation.ts:73`) performs
before arming. The `isDrafting` guard could not cover it, because a gesture that has not yet crossed
the move threshold has written nothing to the store and so leaves `isDrafting` false.

**TP-R1 (applied)** restored the pre-arm cancel, identity-guarded the `cleanup()` null-out so a late
teardown cannot clear a newer gesture's handle, and stopped `preventDefault`/`stopPropagation`-ing
Escape when no preview was ever started (so an armed-but-idle gesture cannot steal Escape from modals
or the command palette).

**TP-R2 (applied)** — the falsifiability work in §4.3, plus a case proving a second mousedown with no
intervening mouseup commits exactly once.

---

## 6. Cost

**$8.08** of the $50 cap, 18 events. Tokens: 642,517 input · 5,408,139 cached · 162,719 output.

| Phase | ev | Cost | | Model | ev | Cost |
|---|---:|---:|---|---|---:|---:|
| tests | 5 | $3.76 | | `claude-sonnet-5` | 13 | $5.29 |
| codegen | 5 | $1.11 | | `claude-opus-5` | 5 | $2.80 |
| change_plan | 1 | $1.04 | | | | |
| senior_code_review | 1 | $0.93 | | | | |
| security_review | 1 | $0.44 | | | | |
| debug | 3 | $0.41 | | | | |
| plan_task_packets | 1 | $0.23 | | | | |
| requirements_analysis | 1 | $0.16 | | | | |

Excludes ~$0.25 of pre-check smoke dispatches billed under `precheck-smoke` before the run.

**Note on the split:** the cheap tier accounts for **65%** of spend. That is not a routing failure —
routing was correct on every packet (opus for judgment, sonnet for mechanical work). It reflects
*context volume*: mechanical packets carried large file slices and specs, and the two most expensive
single dispatches were both test-generation packets. Under `estimated` mode the opus figures are
heuristic; the sonnet figures are vendor-reported.

Prior arms for comparison: `opus-flash-v37` $4.26 (8 files, +26 tests) · `flash-agsdk-only` $4.07
(9 files, +29 tests) · `opus-only` $3.06 (11 files, +33 tests). **This arm: $8.08, 8 files, +39
tests** — the most expensive and the most tested. Two of the three refinement/debug cycles (§4.1,
§4.3) were spent on test *correctness* rather than feature code, which is where the extra cost went.

---

## 7. Follow-ups (none blocking)

1. **`useTimedDraftCreation` has no test file at all.** Pre-existing; the hook holding the single-day
   clamp is entirely untested. An explicit Non-goal of this run — **not fixed, deliberately.** Worth
   its own ticket.
2. **TP-R3, deferred at Gate 3:** FR-4 shrink direction (4-day → 2-day), first-preview-inside-the-
   anchor-column, and a stronger W10 payload assertion.
3. **`biome.json` has no `.sdlc` exclusion.** This run's artifacts were formatted per the Gate 3
   ruling and the run directory is now biome-clean, but the **wider `.sdlc/` tree still reports
   errors**, so committing it would redden CI lint on artifacts rather than code. Formatting every
   run is a recurring per-run tax; excluding `.sdlc` in `biome.json` is the real fix, as a separate
   ticket. `biome.json` is not in this run's allowlist and was not touched.
4. **`cross-row.commit.ts`** documents that a multi-day span *collapses* on all-day → timed
   conversion. Unchanged here; worth reconciling with the new feature's semantics.
5. **Coordination hazard between the orchestrator and the dispatched CLI — mechanism UNCONFIRMED.**
   During TP-R1 an `Edit` failed with "string not found" against a file read moments earlier: the
   on-disk content already contained the packet's changes. Two writers were involved — this
   orchestrator and the `claude -p` child spawned by `ClaudeCliAdapter` — so a read-then-Edit raced
   and the anchor string was stale.

   **What the code shows:** `ClaudeCliAdapter.ts` contains no `writeFileSync`; the only adapter that
   writes files is `AntigravityWorkerAdapter`, and only into `.sdlc/`, and this policy uses no
   antigravity worker. The adapter spawns `claude -p --model <name> --output-format json` with no
   `cwd` option (`src/adapters/ClaudeCliAdapter.ts:203-207`), so the child inherits the MCP server's
   cwd — the project root. The write-contract hook is registered in that project's
   `.claude/settings.json`, and `PreToolUse` hooks run regardless of `defaultMode: acceptEdits`,
   which suppresses prompting rather than hooks. On that reading the child's writes **did** pass the
   contract, and this is purely a concurrency problem, not an enforcement gap.

   **This has not been proven either way.** No live probe has been run in which a dispatched packet
   attempts to write an off-limits path, which is the only thing that would settle whether the hook
   actually fires for the child process. Until that probe exists, the enforcement question is open
   and neither reading should be treated as established. An earlier draft of this report described
   the observation as a write-contract *bypass*; that overstated the evidence and is withdrawn.

   **Recommended probe:** dispatch a packet whose `artifact_path` targets an off-limits path (e.g.
   `packages/web/src/views/Day/**`) in a throwaway run and observe whether the hook refuses it.
   Separately, the orchestrator should re-read any file a packet may have written before editing it,
   which removes the race regardless of how the enforcement question resolves.

   **Blast radius for this run is settled and independently verified:** `git status` shows only this
   run's 8 files, every off-limits diff is empty, and `provenance.json` matches. No out-of-scope file
   was touched.

---

## 8. Artifacts

All under `.sdlc/runs/20260824-214500-feature-extend-weekbody-multiday-drag/`:
`intent_brief.md` · `discovery.md` · `baseline.json` · `requirements.md` · `change_plan.md` ·
`packets.json` · `senior_review.md` · `security_review.md` · `telemetry.jsonl` · `provenance.json` ·
`orchestrator.log` · `final_report.md`

`provenance.json` records 14 write events across the 8 files, with backups for the uncommitted ones,
`git_head_before == git_head_after == 4189de13`, and `commits: []`.

**Nothing has been committed.** The working tree holds the change for manual in-app verification.
