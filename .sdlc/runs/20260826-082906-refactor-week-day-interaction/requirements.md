# Requirements — refactor — Unify Week/Day interaction layers

**Run:** `20260826-082906-refactor-week-day-interaction`
**Intent:** `refactor` — Phase 1 form is a **delta spec**: what behavior must be preserved, not a
general requirements document.
**Base:** branch `CMP-104/opus-plus-sonnet`, HEAD `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
**Policy:** `opus-plus-sonnet` · **auth_mode:** `estimated`

---

## 0. Ground truth established in this phase

Every line count and every claim below was re-derived from the tree at HEAD, not carried over from
`discovery.md`. Where this phase disagrees with `discovery.md` or `intent_brief.md`, the
disagreement is called out explicitly in §5 — three of them are **blocking** and need a Gate 1
decision.

Verified line counts (`find … | xargs wc -l`):

| Tree | Brief says | Measured | Verdict |
|---|---|---|---|
| `views/Week/interaction/**` | 5428 | **5428** | matches |
| `views/Day/interaction/**` | 2375 | **2375** | matches |
| `grid/interaction/**` | 2625 | **2625** | matches |
| `interaction/**` | 1527 | **2208** (1219 excl. tests) | brief is wrong; immaterial, tree is context only |

---

## 1. In scope

1. **Registry** (`week-event.registry.ts` 24 · `day-event.registry.ts` 24) — collapse to one shared
   parameterized factory. Verified a pure name-substitution clone: both call
   `createViewInteractionRegistry(<viewId>)` and re-export the same eight members under
   `WEEK_`/`DAY_` prefixes. No view-specific logic in either.
2. **Targeting** (`week-event.targeting.ts` 35 · `day-event.targeting.ts` 35) — collapse to one
   shared parameterized factory. Verified a pure clone; the only non-rename difference is a Biome
   reformat of the `createGridEventTargeting<T>()` generic argument.
3. **Targeting tests** (92 · 92) — collapse to one table-driven test covering both views.
4. **Adapter types** (149 · 149) — hoist the structurally identical members into one generic
   contract; keep genuine per-view members as extension points (§3).
5. **Commit** — unify the parts that are genuinely identical (the envelope shape and the four
   public function names) and converge the two directory layouts. **The per-view visual→GridEvent
   mappers are NOT unifiable** — see §5.1, this is the largest correction to the brief.
6. **Geometry (opportunistic)** — reduce the `WeekLayoutCache*` / `DayLayoutCache*` alias families
   to direct use of the shared `GridLayoutCache*` types where the alias adds nothing.

## 2. Out of scope

1. Any new user-facing capability in either view. Consolidation only.
2. `packages/core`, `packages/backend`, `packages/sync`, `packages/scripts`, `e2e/**` — off-limits
   in the frozen write contract.
3. Redesigning `createInteractionEngine` — it is the substrate to unify *onto*.
4. Reconciling `WeekInteractionCoordinator.tsx` (217) with `DayInteractionCoordinator.tsx` (133).
   **Caveat:** the brief's own escape hatch ("unless the four in-scope layers force a change
   there") is triggered — the coordinators are the *actual* consumers of the commit envelope
   (§5.2), so a unified commit result type requires editing their type annotations. Requesting
   permission for **type-annotation-only** edits to both coordinators at Gate 1 (§5.2).
5. Adopting or reconciling with the two prior CMP-104 runs' output.
6. Adding `.sdlc/` to `.gitignore`.

---

## 3. Preserved-behavior spec (the core of a refactor delta)

This is the invariant list. Every item is behavior that exists at HEAD and **must be bit-identical
after the refactor**. Ordered by regression risk.

### PB-1 — Week and Day all-day drag mean different things. Do not converge them.

| | Week (`Week/…/commit/all-day.commit.ts`) | Day (`Day/…/commit/all-day.commit.ts`) |
|---|---|---|
| What a column means | a **date** | a **calendar** |
| On move | shifts `startDate`/`endDate` by a **day delta** | leaves dates untouched; rewrites **`calendarId`** |
| Rationale in code | delta semantics absorb window-clamping + mid-drag week nav | "rewriting them to the visible date would truncate a multi-day all-day event" |

Preserve both. A "unification" that gave Day the Week mapper would silently truncate multi-day
all-day events; the reverse would break cross-calendar moves.

### PB-2 — Week and Day all-day resize mean different things.

- **Week:** applies independent `startDayDelta` / `endDayDelta`, with an exclusive-end-date
  baseline (`getExclusiveEndDateBaseline` — a same-day event's end baseline becomes `start + 1 day`).
- **Day:** collapses the event to a single day at `visibleDate` (`startDate = visibleDate`,
  `endDate = visibleDate + 1 day`) and forces `isAllDay: true`.

Preserve both, including the exclusive-end-date baseline rule and Day's `isAllDay: true` forcing.

### PB-3 — Week and Day timed drag mean different things.

- **Week:** `visual.dayDate` is the **target day** (absolute assignment); time-of-day rides on the
  visual's minutes.
- **Day:** `visual.dayDate` is a **calendarId** (`columnMoveCalendarId`); the day comes from
  `visibleDate`. Sets `isAllDay: false`.

The single-column Day fallback ("whose one key is a date string that never changes") must keep
resolving to the event's own `calendarId`.

### PB-4 — Week-only: cross-row drag (all-day ↔ timed). Day has none.

`Week/…/interactions/all-day.drag.ts` and `timed.drag.ts` branch on `visual.row` and route through
`grid/interaction/commit/cross-row.commit.ts`. Two rules to preserve exactly:

- A drop in the timed grid is **always** `hasMoved: true`, even onto the same day ("the event gains
  a time of day it never had").
- A drop in the all-day row is **always** `hasMoved: true`, even onto the same day ("the event
  loses its time of day").

Also preserve the mid-drag **ghost preview nulling**: all-day ghost is `null` unless `row ===
"timed"`; timed ghost is `null` when `row === "allDay"`.

### PB-5 — Week-only: edge navigation. Day has none.

`WeekInteractionAdapter.rebuildLayoutAfterNavigation()`, `edge-navigation.ts` (146),
`state/edge-navigation.state.ts` (60), `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`,
`onRequestWeekNavigation(direction)`, and the `onMotionActivation` retention of
`activeInteractionEventRef` so a destination-week commit can still build its mutation input.
Day's layout cache uses `INTERACTION_EDGE_THRESHOLD_PX` and `edgeThresholdPx: 0` for the all-day
row — different constants, preserve as-is.

### PB-6 — Commit envelope shape is already identical. Preserve it verbatim.

All eight commit results across both views produce exactly:
`{ event, eventId, hadFormOpenBeforeInteraction, hasMoved, type }`
with `type` ∈ `allDayDragEnd` · `allDayResizeEnd` · `timedDragEnd` · `timedResizeEnd`.
`eventId` is `target.event._id!` in every case. This is the one genuinely unifiable piece of the
commit layer.

### PB-7 — Coordinator commit routing differs between views.

`WeekInteractionCoordinator.commitSavedMutation` has **three** branches:
`!hasMoved` → reopen the clicked event; `hadFormOpenBeforeInteraction` → rebuild the draft and
reopen the form; otherwise → `updateEvent(…)`.

> **CORRECTED during S6 (2026-08-26).** This originally said Day's
> `commitSavedMutation` goes "straight to `updateEvent`". That is **wrong** — it was inferred from
> a grep rather than read. Day has **two** branches: `!hasMoved` →
> `openDayCalendarEvent(result.event)`; otherwise → `updateEvent`. The real asymmetry is that
> **Week has a third branch Day lacks** — the `hadFormOpenBeforeInteraction` draft-reopen path —
> not that Day has no branching at all. Verified by reading both files during S6.

Preserve this asymmetry (three branches vs two). It is behavior, not drift. Both shapes survived
S6 verbatim; only the parameter's type annotation changed.

### PB-8 — `useUpdateEvent` contract unchanged.

Its cross-calendar guards (recurring events refused with "Repeating events can't move to another
calendar."; read-only target calendar refused by name) and the `fastDeepEqual` no-op short-circuit
must be untouched. See §5.2 — this file needs no edit at all.

### PB-9 — Layout-cache construction differs and must be preserved.

Week threads `visibleDays` through a `WeekLayoutCacheInput` **object field**; Day passes
`visibleDates` as a **second positional argument**. Week builds a combined both-rows cache
(`buildDragWeekLayoutCache`) for cross-row drags; Day has no such builder. Week reads its edge
threshold from `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`, Day from `INTERACTION_EDGE_THRESHOLD_PX`.

### PB-10 — Public DOM attribute values must not change.

`WEEK_INTERACTION_EVENT_ID_ATTRIBUTE` / `_TYPE_ATTRIBUTE` and the `DAY_` pair derive from
`createViewInteractionRegistry("week"|"day")`. The rendered attribute strings are asserted by
existing tests and used in `TARGET_SELECTOR`. Renaming the *constants* is allowed; changing their
*values* is not.

---

## 4. Acceptance criteria (executable)

| # | Criterion | How verified |
|---|---|---|
| AC-1 | **PASS. Restated as a durable invariant — the literal counts are retired.** The criterion is: **zero failures, and no pre-existing test removed or weakened.** Both hold. Measured final: `bun test:web` → **2305 pass / 0 fail / 303 files**, exit 0. *Why the counts are retired:* the literal figure has now been invalidated **twice** — the original `2298 / 302` by the S2 collapse, and the Gate-2 amendment `2298 / 301` by the Gate-2 characterization directive that followed it. A count that changes every time the run is legitimately directed to add a test is not a useful invariant; the failure count and the no-test-lost rule are. Arithmetic for the record: 302 − 2 (targeting tests collapsed) + 1 (table-driven replacement) + 2 (SC) = 303; 2298 + 7 (SC) = 2305. | Phase 7, full suite, exit code read |
| AC-2 | `bun type-check` passes | Phase 7, exit code read |
| AC-3 | PB-1 … PB-10 all hold | Phase 6 senior review, file-by-file |
| AC-4 | Registry, targeting, and adapter-types each have **one** implementation; commit has one envelope builder + one directory layout, with per-view mappers as the declared extension point (§5.1 ruling) | `find` + import graph |
| AC-5 | **(restated at Gate 2, F1 — assertion level, not file level)** No *assertion* weakened, skipped, deleted, or re-asserted. Edits to existing tests limited to moved imports / renamed types. File-level consolidation is permitted **only** where every assertion survives as a table case with identical expectations. Adding new tests is permitted. | `git diff` on all `*.test.*` reviewed at Gate 3; S2 case-count checked before/after |
| AC-5a | **(load-bearing, from the Gate 2 F1 ruling)** The S2 collapse preserves exactly **8 `it()` cases** — 4 per view before, 8 table cases after — with byte-identical expectations. If the collapse would drop or alter any assertion, **STOP and bubble up**; do not proceed. | Count `it()`/`describe.each` cases before and after S2 |
| AC-5b | **(directed at Gate 2)** Characterization tests for R1 and R10 exist, and **passed against unmodified HEAD behavior before S5 ran**. | See §6; evidence recorded in the Phase 7 report |
| AC-6 | **(restated at Gate 1)** A single unified `InteractionCommitResult` type lands in the shared interaction layer and is adopted by its two real consumers, `WeekInteractionCoordinator.tsx` and `DayInteractionCoordinator.tsx`, via **type-annotation-and-import edits only**. `useUpdateEvent.ts` is not edited. | `git diff` on both coordinators shows zero logic change; PB-7 re-verified |
| AC-7 | **FAILS — final, after the Gate-3-directed shim deletion.** The criterion says "across the four in-scope trees". On that measure: **12 636 → 12 985, +349.** It fails. Excluding the 322 lines of Gate-2-directed characterization tests it is **12 663, +27** — break-even, still not a reduction. It passes *only* on the two-tree sub-measure quoted in its own parenthetical (**7803 → 7712, −91**), and that reading is not the one the criterion's text asks for. **Recorded as FAILED.** Shim deletion did move it materially in the right direction (all-four 13 072 → 12 985, two-tree 7816 → 7712) but not far enough to make the four-tree claim true. | `wc -l` before/after |
| AC-7b | **The criterion was internally inconsistent from the start and was never coherently evaluable.** Its text says "across the four in-scope trees" while the baseline in its own parentheses (`Week 5428 + Day 2375 = 7803`) counts only **two**. Those two readings give opposite verdicts on identical code — two-tree −91 (pass) vs four-tree +349 (fail). This is a defect in the acceptance criterion, not a measurement error, and it is recorded as such at the user's direction. Any future line-count criterion must name one tree set and one baseline. | — |
| AC-7a | **Correction to the change plan's baseline, and to my own first reading of it.** `change_plan.md` §8 quoted an all-four-trees baseline of 10 336 — wrong, it reused discovery's incorrect 1527 for the shared `interaction/` tree (real size 2208). Correct baseline **12 636**; measured after **13 072**, i.e. **+436 across all four trees**, with `grid/interaction/**` up **+423** and the two view trees netting **+13**. My earlier figures (13 074 / +438 / 7817) were taken before the final Biome pass and were off by 1–2 lines; the senior reviewer's numbers are the correct ones and are reproduced here. **I also under-stated the finding:** I wrote "roughly half the reduction is relocation". It is not half — it is **essentially all of it**. Per-concern, verified by `wc -l`: registry went **48 → 136 (+88)** to deduplicate 48 lines; adapter types **298 → 297 (−1)**; commit **+216**. The single unambiguous win is the targeting-test collapse. | `wc -l` |

---

## 5. Gate 1 questions and rulings

**Gate 1 resolved `approved` on 2026-08-26.** The user independently reproduced all three findings
against the tree before ruling. Rulings are recorded inline below.

### 5.1 — RESOLVED: APPROVED (reduced commit scope). The commit layer is not "drift", it is genuine divergence.

`intent_brief.md` line 25 and `discovery.md` finding 5 both describe the commit layer as
*"one concern, two directory layouts, two naming conventions"* and rate it the **highest-value
target**. Reading the four files shows that is **not correct**:

- **The function names are already identical.** Both views export
  `commitAllDayDragInteraction`, `commitAllDayResizeInteraction`, `commitTimedDragInteraction`,
  `commitTimedResizeInteraction`. There are not "two naming conventions" — there is one.
  The only difference is directory (`adapter/interactions/` vs `adapter/commit/`).
- **The bodies are semantically different on purpose**, per PB-1/PB-2/PB-3: a Week column is a
  date, a Day column is a calendar. These are not near-identical implementations that drifted;
  they are two correct implementations of two different domain rules.
- Week's `interactions/` directory additionally holds `create*Visual` and `update*Visual`, which
  Day inlines into its adapter. So the two directories are not even the same concern.

**Consequence for acceptance criterion 4** ("each of the four concerns has *one* implementation").
Achievable for registry, targeting, and adapter types. For commit it is achievable only as:
one shared generic **envelope builder** (PB-6) + one shared directory layout + **retained per-view
mappers** as the extension point.

> **RULING (Gate 1): APPROVED.** Reduced commit-layer scope adopted — one shared envelope builder
> plus one directory layout, **per-view mappers retained as the extension point**. The user
> confirmed Week's `allDayDragVisualToGridEvent` shifts `startDate`/`endDate` by `dayDelta` while
> Day's rewrites `calendarId`. **Do not unify the mappers.**

### 5.2 — RESOLVED: APPROVED, option A. `useUpdateEvent.ts` does not consume the commit envelope.

`intent_brief.md` lines 32–33 and acceptance criterion 6 both state the two envelopes "converge on
one shared consumer, `useUpdateEvent.ts`", making it "the natural landing spot for a unified result
type". Verified false:

```
grep -rn "CommitResult" packages/web/src → 13 files, none of them events/mutations/useUpdateEvent.ts
```

`useUpdateEvent` takes `{ event: GridEvent; shouldRemove?; applyTo? }`. It never sees `eventId`,
`hasMoved`, `hadFormOpenBeforeInteraction`, or `type`. The **coordinators** unwrap the envelope and
call `updateEvent({ event: result.event }, …)`.

The real consumers of `*InteractionCommitResult` are `WeekInteractionCoordinator.tsx` (8 refs) and
`DayInteractionCoordinator.tsx` (8 refs) — both listed as **non-goals** in the brief.

> **RULING (Gate 1): APPROVED, option A.** Land the unified `InteractionCommitResult` in the shared
> interaction layer and adopt it in both coordinators via **type-annotation-and-import edits only**.
> No logic change. Week's three-branch and Day's one-branch commit routing (PB-7) preserved
> verbatim. `useUpdateEvent.ts` needs no edit.
>
> The brief's coordinator non-goal is **formally relaxed to exactly this extent and no further**.
> If the implementation wants to change coordinator *logic*, stop and bubble it up as a Gate
> revision rather than proceeding.
>
> The user also recorded that the original AC-6 wording (naming `useUpdateEvent.ts` as the shared
> consumer) was their error, carried over from an unverified discovery claim.

### 5.3 — RESOLVED: proceed at Opus, change nothing. Codegen-phase tier fall-through.

`opus-plus-sonnet` sends `phase: codegen` to Sonnet **only for an enumerated `task_type` list**
(`controller_handler`, `service_method`, `dto`, `react_component`, …). The brownfield refactor task
types — `refactor_extract`, `existing_file_edit`, `patch_apply` — are **not** in that list, so they
fall through to the terminal `default: opus` rule ("Unrecognized task — fail safe to premium").

> **RULING (Gate 1): proceed at Opus, change nothing.** Do not edit the policy YAML. Do not
> relabel packets to chase the cheaper Sonnet rule. Use the honest `task_type` per packet and let
> it route to `default: opus` as designed. `hard_cost_cap_usd: 50` remains the ceiling and still
> aborts the run if exceeded.

**Correction to the Gate 1 framing — the blast radius is one phase, not the run.** The Gate 1
message said "most of this run will bill at Opus". That was an overstatement. Reading the full
rules block:

| Phase | Tier | Why |
|---|---|---|
| `requirements_analysis`, `architecture_design`, `plan_task_packets`, `change_plan`, `senior_code_review`, `security_review`, `discovery` | **Opus** | explicit rule — always was, unaffected by the fall-through |
| `tests` | **Sonnet** | explicit rule (`phase: tests`) — no task_type gate |
| `docs` | **Sonnet** | explicit rule (`phase: docs`) — no task_type gate |
| `debug` (`retry_count < 2`) | **Sonnet** | explicit rule; escalates to Opus at `retry_count >= 2` |
| **`codegen`** | **Opus (fall-through)** | ← **the only phase the gap moves** |

The final cost breakdown must characterize this as a **codegen-phase-only** effect, not a
whole-run effect.

**Not specific to this policy.** All five shipped policies enumerate greenfield-only task types on
their codegen rule, so every one of them falls brownfield refactor work through to its terminal
default. `flash-agsdk-only` is the only shipped policy whose default is not `opus`.

### 5.4 — NON-BLOCKING. Two smaller discovery inaccuracies, already corrected above.

- Shared `interaction/` is 2208 lines, not 1527.
- "Day already imports the shared `GridLayoutCacheSources`, Week keeps a local alias family" is
  only half right — `day-layout.cache.ts` also defines `DayLayoutCache` / `DayLayoutCacheSources`
  aliases. Both views have an alias family; Week's is larger by one member
  (`WeekLayoutCacheInput`, which carries real structure per PB-9).

---

## 6. Characterization tests — DIRECTED at Gate 2

`change_plan.md` §6 rates R1 and R10 the two highest-risk items, and both describe behavior that
**no existing test asserts**. R1 is potential user-visible data loss. Standard refactoring
discipline is *characterize before you move*, so these are required, not optional.

### CT-1 — Week cross-row same-day drop forces `hasMoved: true` (guards R1)

Pins `commitAllDayDragInteraction`'s `isCrossRow || hasAllDayDragVisualMoved(visual)` and
`commitTimedDragInteraction`'s `isCrossRow || hasTimedDragVisualMoved(visual)`: a drop that changes
row but **not** day must still report `hasMoved: true`. Without this, a shared `hasMoved` predicate
silently flips it to `false`, the coordinator takes its `!hasMoved` branch, and the row change is
**reopened instead of saved**.

### CT-2 — Week timed resize maps unconditionally; Day's is gated (guards R10)

Pins that on a **no-op** resize Week's `commitTimedResizeInteraction` returns a *re-formatted*
event (`timedResizeVisualToGridEvent` called with no `hasMoved` gate), while Day's
`commitTimedResizeInteraction` returns `target.event` **untouched by identity**. Asserting Day's
side by reference identity (`toBe`) is what makes the asymmetry impossible to "tidy away".

### Rules governing both

1. **They are additions.** Permitted under AC-5 in either reading.
2. **They MUST pass against unmodified HEAD before S5 runs.** A characterization test that only
   goes green *after* the refactor documents the change instead of guarding against it, which
   inverts its purpose. Order is: write → run green on HEAD → then S5 → keep green through S6.
3. **Scope guard.** If either test cannot be written without touching a file outside the frozen
   allowlist, **STOP and bubble up**. Do not widen scope unilaterally.
4. Evidence — the pre-S5 green run — is recorded in the Phase 7 report and re-checked at Gate 3.
