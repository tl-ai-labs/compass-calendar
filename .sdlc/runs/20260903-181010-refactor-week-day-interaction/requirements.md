# Requirements — refactor — Unify the Week/Day interaction adapter layer

- **Run:** `20260903-181010-refactor-week-day-interaction`
- **Intent:** `refactor` → Phase 1 form is **delta requirements (what to preserve)**
- **Branch:** `CMP-104/opus-plus-flash-v37-sdk` (from `main@2d81253a`)
- **Policy:** `opus-plus-flash-v37`, auth mode `estimated`
- **Source of truth:** `intent_brief.md` + the working tree at HEAD. Every claim below was
  re-derived from the tree during this phase; no prior run's artifacts were read.

A refactor has no new behavior to specify. What it needs specified is the **invariant set** — the
things that must be identical after the change — and the **narrow set of deltas** that are allowed
to differ. This document is organised that way: §3 is the contract, §4 is the permitted work.

---

## 1. Verified baseline (measured this phase, not inherited)

| Measurement | Command | Result |
|---|---|---|
| Full web suite | `bun run test:web` | **2297 pass / 1 fail / 1 error**, 302 files, 5769 expects, **exit 1** |
| In-scope subset (3 allowlisted dirs) | `bun run test:web -- packages/web/src/grid/interaction packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction` | **128 pass / 0 fail**, 21 files, 337 expects, exit 0 |
| Engine subset (off-limits dir) | `bun run test:web -- packages/web/src/interaction` | **31 pass / 0 fail**, 3 files, 160 expects, exit 0 |

The full-suite figure reproduces the stated red baseline exactly. The single known failure is
`RecurrenceSection > keeps the event's own date selectable when the event ends after midnight`
(date rot, unrelated to interaction code, file outside the allowlist).

**Correction to an acceptance criterion.** The brief's AC "the interaction-scoped subset holds at
159 pass / 0 fail (24 files, 497 expects)" does not describe the three allowlisted directories. It
describes those **plus the deliberately off-limits engine directory**: 128 + 31 = 159, 21 + 3 = 24,
337 + 160 = 497. Exact match on all three figures, so the AC is well-formed — but it can only be
evaluated by running four paths, one of which this run must not modify. That is a feature, not a
defect, and §3 turns it into a sharper invariant (P-0).

LOC fingerprint re-confirmed at HEAD: adapters **795 / 607**, types files **149 / 149**.

---

## 2. What is actually duplicated (re-derived)

Reading both adapters end to end, the 795/607 pair splits into three bands:

**Band A — isomorphic, no view-specific content (the prize).** Same logic, differing only in which
registry singleton and which type alias they name:

| Member | Week | Day | Difference |
|---|---|---|---|
| `ownsPointer` | 125–127 | 107–109 | none |
| `connectCancellationEvents` | 129–131 | 111–113 | none |
| `handlePointerMove` | 191–197 | 147–153 | none |
| `handlePointerCancel` | 241–247 | 195–201 | none |
| `cancel` | 249–251 | 203–205 | none |
| `getInteractionTarget` | 483–505 | 434–456 | none (same 4-probe order) |
| `getAllDayDragTarget` | 507–524 | 458–475 | none |
| `getAllDayResizeTarget` | 526–546 | 477–497 | none |
| `getTimedDragTarget` | 548–563 | 499–514 | none |
| `getTimedResizeTarget` | 565–585 | 516–536 | none |
| `resolveAllDayEventTarget` | 587–608 | 538–559 | registry singleton only |
| `resolveTimedEventTarget` | 610–631 | 561–582 | registry singleton only |
| `getRegisteredTarget` | 633–640 | 584–591 | registry singleton only |
| `applySmartScroll` | 659–666 | 425–432 | none |
| `isAllDayTarget` | 755–758 | 604–607 | type alias only |
| adapter `getDraftEventMount` / `getSourceElement` / `getTarget` | 342–350 | 322–330 | none |

**Band B — same skeleton, view-specific hooks.** `handlePointerDown`, `handlePointerUp`, engine
`cancel`, engine `commit`. Identical control flow; Week additionally drives
`setWeekInteractionMotionActive` and the edge-navigation state reset, and the two `commit` bodies
call different commit modules and throw different message strings.

**Band C — genuinely divergent, must not merge.** `createVisual` and `updateVisual`. Week routes
through `adapter/interactions/*` with a cross-row layout cache, smart-scroll suppression over the
all-day row, and edge navigation; Day computes column keys from calendar ids and calls
`grid/interaction/math/*` directly. Plus every `commit/*.commit.ts` on both sides (brief non-goal,
independently re-confirmed: Week's all-day commit applies a column **delta**, Day's applies a
**calendar id** and never rewrites dates).

Two behavioral asymmetries inside Band B are worth naming because they are the kind of thing a
"tidy-up while I'm here" silently changes:

- ~~**`runtime()` call count in `handlePointerUp`.** Week calls `runtime()` inside the click branch
  *and again* after it (lines 208, 219); Day calls it once before the branch (line 163). Any
  hoisted version picks one. That is a real, if small, behavior change for a runtime getter that
  is documented to be re-read per interaction.~~

  > **CORRECTION (post-Gate-1, raised by the architect as F-1, independently verified — pending
  > ratification at Gate 2).** The struck text above is **wrong**. Line 216 is
  > `return isOwnedPointer;` *inside* the `result.type === "click"` block, so lines 208 and 219 sit
  > on **mutually exclusive** branches. Week calls `runtime()` exactly once per non-null result and
  > zero times on the `!result` path — the identical profile to Day's line 163. The only structural
  > difference is that Week reads the runtime *after* evaluating `result.type === "click"` and Day
  > reads it *before*; `result.type` is a plain property read with no getter and no side effect, and
  > no statement sits between the guard and the branch in either view. The two shapes are
  > behaviorally identical on every path, for every possible `runtime` closure, including a
  > call-counting spy. There is therefore **only one** Band-B asymmetry, not two.
- **`setWeekInteractionMotionActive(false)` on click.** Week clears motion in the click branch and
  in `cancel`/`commit`; Day has no motion flag at all. The hoisted skeleton must make this an
  injected no-op for Day, not a shared unconditional call.

---

## 3. Preservation contract (the invariants — these are the acceptance bar)

### P-0 · The engine is untouched, and its test count proves it
`packages/web/src/interaction/**` is off-limits in the frozen write contract. After the change,
`bun run test:web -- packages/web/src/interaction` must still report **exactly 31 pass / 0 fail /
3 files / 160 expects**, and `git status --porcelain packages/web/src/interaction` must be empty.
Widen `grid/interaction/`; never push view logic down into the engine.

### P-1 · Every export consumed from outside the three in-scope directories is frozen
These modules are inside the allowlist but have callers outside it. Callers cannot be edited, so
each symbol must survive with its current name, module path, and signature. Enumerated from a
repo-wide import scan this phase:

| Module (in scope) | Frozen symbols | External callers |
|---|---|---|
| `grid/interaction/view-event-registry` | `calendarEventIdValueSelector`, `readCalendarEventIdFromElement`, `calendarEventIdElementSelector` | `common/utils/event/event.util.ts`, `shortcuts/tips/useIsAnyCalendarEventFocused.ts`, `useShortcutTipTrigger.test.tsx` |
| `grid/interaction/dom` | `EVENT_CONTENT_ATTRIBUTE`, `EVENT_RESIZE_HANDLE_ATTRIBUTE`, `EVENT_TIME_LABEL_ATTRIBUTE` | `grid/components/TimedEventCard.tsx`, `grid/components/AllDayEventCard.tsx` |
| `grid/interaction/math/snap` | `clamp` | `components/ShortcutShowcase/practice.state.ts` |
| `grid/interaction/math/cross-row.drag` | `CROSS_ROW_TIMED_DURATION_MIN` | `views/Week/components/Draft/hooks/actions/draft-drag-schedule.util.ts` (+2 tests) |
| `grid/interaction/types/timed-drag.types` | `DragRow` | `draft-drag-schedule.util.ts` |
| `Week/interaction/registry/week-event.registry` | `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`, `getWeekInteractionTargetAttributes`, `useWeekEventRegistrationRef`, `weekEventRegistry` | `GridDraft.tsx`, `AllDayEvents.tsx`, `MainGridEvents.tsx`, `useCloseEventForm.test.ts`, `contextMenuLayering.test.tsx`, `event.util.test.ts`, `MainGrid.test.tsx`, `MainGridBusyPeriods.test.tsx`, `eventReadOnlyInteraction.test.tsx`, `keyboardEditForm.test.tsx`, `useWeekShortcutOwner.test.tsx` |
| `Day/interaction/registry/day-event.registry` | `DAY_INTERACTION_EVENT_ID_ATTRIBUTE`, `getDayInteractionTargetAttributes`, `useDayEventRegistrationRef` | `DayCalendarEventCards.tsx`, `contextMenuLayering.test.tsx`, `useDayEventNudgeShortcuts.test.tsx` |
| `Week/interaction/state/motion.state` | `isWeekInteractionMotionActive`, `setWeekInteractionMotionActive` | `GridEvent.tsx`, `useGridLayout.ts`, `useVisibleDayCount.ts`, `__tests__/utils/state/reset-stores.ts`, `MainGrid.test.tsx` |
| `Week/interaction/state/edge-navigation.state` | `useWeekInteractionEdgeNavigationState`, `setWeekInteractionEdgeNavigationState`, `resetWeekInteractionEdgeNavigationState` | `EdgeNavigationIndicators.tsx`, `useDragEdgeNavigation.ts` |
| `Week/interaction/adapter/edge-navigation` | `createWeekEdgeNavigationController`, `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`, `WeekEdgeNavigationPoint` | `views/Week/hooks/grid/useDragEdgeNavigation.ts` |
| `Week/interaction/targeting/week-event.targeting` | `focusWeekGridEventTarget`, `getFirstVisibleWeekGridEventTarget`, `getFocusedWeekGridEventTarget`, `listVisibleWeekGridEventTargets` | `useWeekShortcutOwner.ts` |
| `Day/interaction/targeting/day-event.targeting` | `focusDayGridEventTarget`, `getFocusedDayGridEventTarget`, `listVisibleDayGridEventTargets` | `useDayEventNudgeShortcuts.ts` |
| `Day/interaction/day-event.focus` | `focusFirstDayCalendarEvent` | `views/Day/view/DayViewContent.tsx` |
| `Week/interaction/WeekInteractionCoordinator` · `Day/interaction/DayInteractionCoordinator` | the coordinator components | `WeekView.tsx`, `DayCalendarGrid.tsx` |

Re-export shims are an acceptable way to satisfy P-1 if a symbol's implementation moves.

### P-2 · The `data-${view}-interaction-event-*` attribute scheme is unchanged
`viewInteractionAttributeNames(viewName)` must keep producing today's strings for `"week"` and
`"day"`, and `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` must keep listing both, so
`readCalendarEventIdFromElement` resolves ids view-agnostically for context menus and undo
focus-restore. These attributes appear in the DOM and in tests outside the allowlist.

### P-3 · No runtime behavior change in drag, resize, or targeting, for either view
Including the Band-B asymmetry in §2 that survived verification (the Week-only
`setWeekInteractionMotionActive(false)` on the click path). The `runtime()` call-count asymmetry
was found not to exist — see the F-1 correction in §2. Specifically preserved: the 4-probe target resolution
order (all-day resize → timed resize → timed drag → all-day drag); Day's single-column fallback
when the event's calendar is not among the rendered columns; Week's smart-scroll suppression while
the pointer is over the all-day row; Day's all-day commit never rewriting dates.

### P-4 · Test files are evidence, not scratch space
The 21 in-scope test files are the only behavioral proof this refactor has. Tests may be moved or
have imports repointed; **assertions may not be weakened, deleted, or skipped** to make a
restructure pass. Net expect() count across the three in-scope dirs must not fall below 337.

### P-5 · Gates
`bun run type-check` clean; `bun run lint` exit 0 with no new warnings in the delta; full suite
shows **no failure other than the one `RecurrenceSection` case** — target **2297/1/1, exit 1**.
`2298/0` is unreachable and must not be used as the bar.

---

## 4. Permitted deltas (the work)

### R-1 · Close the `dayDate` / `initialDayDate` overload with a compiler-enforceable discriminant — FIRST
`TimedDragVisual.dayDate`, `TimedDragVisual.initialDayDate`, `AllDayDragVisual.dayDate` and
`AllDayDragVisual.initialDayDate` are bare `string`s carrying an untagged union: a local
`YYYY-MM-DD` date in Week, a `CalendarId` in Day. The types file itself warns against
`dayjs`-parsing them blind, and `columnMoveCalendarId`
(`Day/interaction/adapter/commit/timed.commit.ts:77`) performs an unchecked
`visual.dayDate as CalendarId`.

Scope finding that makes this tractable: **every reader of these four fields is inside the
allowlist.** The repo-wide scan found 8 non-test modules and 3 test files, all within
`grid/interaction/**` or the two view `interaction/**` trees. The `dayDate` hits in
`routers/router.routes.tsx`, `routers/loaders.ts`, `components/DocumentTitle/*` are unrelated
symbols (`dayDateRoute`, `dayDateString`) and are not touched.

The discriminant must make Week and Day column keys **mutually unassignable** — i.e. a Day visual
passed where a Week visual is expected is a type error. Today it is not, because both views' types
bottom out in the same shared aliases (see R-4).

### R-2 · Hoist Band A to `grid/interaction/`
Introduce a shared adapter-boundary factory in `grid/interaction/` parameterised by the view's
registry and column-key kind, and have both view adapters instantiate it. Expected outcome: the
16 Band-A members exist once.

### R-3 · Hoist Band B as a skeleton with injected view hooks
`handlePointerDown` / `handlePointerUp` / engine `cancel` / engine `commit` share one skeleton;
Week's motion flag, edge-navigation reset, and each view's commit dispatch + error string are
injected. Both §2 asymmetries must be settled *explicitly and identically to today's behavior*,
not incidentally.

### R-4 · Collapse the two 149-LOC types files
16 structurally identical interfaces become generic equivalents parameterised by the view's
registered-target and column-key types. Note that today
`WeekRegisteredEventTarget` and `DayRegisteredEventTarget` are both plain aliases of
`ViewRegisteredEventTarget`, which is precisely why the compiler cannot currently catch a
cross-view mistake; the collapse must not preserve that property.

### R-5 · Week-only members stay Week-only
`rebuildLayoutAfterNavigation`, `WeekEdgeNavigableVisual`, `updateEdgeNavigation`,
`getLayoutInput`, `rebuildLayoutIfNeeded`, `isPointerOverAllDayRow`, `getDraftEventSize`,
`buildWeekLayoutCacheForTarget`, and the `getVisibleDays` / `onRequestWeekNavigation` runtime
members have no Day counterpart. Day-only: `getColumnKeys`, `getVisibleDate`. Neither set gets
pushed onto the shared type as an optional field — that is exactly the trap the brief names for
`row` / `crossRowSize` / `timedStartMinutes`, where shared fields make Day *look* capable of
cross-row drops while nothing populates them.

---

## 5. Sequencing (hard)

1. **R-1 discriminant lands and the suite is green** — before any Band-A/Band-B hoist.
2. R-4 types collapse.
3. R-2 Band A.
4. R-3 Band B.
5. Full suite + type-check + lint after each step, not only at the end.

Rationale, restated as a run rule: **`type-check` is not a safety net here.** Because both
`*RegisteredEventTarget` aliases resolve to the same shared type and the 16 interfaces are
structurally identical, TypeScript will accept a Week value where a Day value belongs. Until R-1
lands, the only thing standing between a hoisted method and a silent cross-view defect is the test
suite — and Day has 4 interaction test files to Week's 9.

---

## 6. Open question for Gate 1 (needs a human ruling)

**Q-1 — the edge-navigation singleton AC conflicts with the write contract.**

The AC reads: *"Week's edge-navigation module-level singleton state is de-globalised if and only
if a shared factory could be instantiated twice; otherwise it is left alone and the risk is
recorded."*

The antecedent is **already true at HEAD, before this refactor.**
`createWeekEdgeNavigationController()` is instantiated in two places today:

- `Week/interaction/adapter/week-interaction.adapter.ts:111` (saved-event drags), and
- `views/Week/hooks/grid/useDragEdgeNavigation.ts:19` (draft drags)

and **both write into the same module-level store** in `state/edge-navigation.state.ts` (`let
state` + a `listeners` Set), which `EdgeNavigationIndicators.tsx` reads via
`useSyncExternalStore`. It is last-writer-wins. It is safe today only because a saved-event drag
and a draft drag are assumed mutually exclusive — an assumption nothing enforces.

So the AC's condition fires, but honouring it requires editing **two files outside the frozen
allowlist** (`views/Week/hooks/grid/useDragEdgeNavigation.ts` and
`.../EdgeNavigationIndicators/EdgeNavigationIndicators.tsx`) — and `state/edge-navigation.state`'s
exports are frozen by P-1 anyway.

Three options:

- **(a) Record and defer (recommended).** Leave the singleton alone, note that the double
  instantiation predates this run, file it as a follow-up. Keeps the run inside its contract and
  keeps the refactor honest — it is a pre-existing condition, not one this change introduces.
- **(b) Widen the allowlist** by two files and de-globalise properly. Requires re-freezing the
  write contract, and grows a "no behavior change" refactor into state-ownership surgery on the
  less-tested side of the app.
- **(c) Partial.** Keep the shared factory strictly non-instantiating for Day (edge navigation
  stays a Week-injected hook, per R-5) so this refactor provably adds no third writer, and record
  the existing two.

My recommendation is **(a) plus the (c) constraint**: do not add a writer, do not touch the
store, record the pre-existing hazard in the final report as a follow-up ticket.

---

## 7. Explicitly out of scope

Carried unchanged from the brief and re-confirmed against the tree this phase:

- **`registry` and `targeting` layers** — verified pure re-export shims, 24 and 35 LOC each, zero
  logic (both files read in full this phase). Collapsing them touches 16 files outside
  `*/interaction/` for zero duplication removed.
- **Merging `commit/*.commit.ts`** — divergent by design.
- **Adding cross-row drag to Day** — capability gap, separate ticket.
- **Per-view layout-cache wrappers** — different constants (Day all-day uses `edgeThresholdPx: 0`).
- **`RecurrenceSection` date-rot failure** — outside the allowlist, explicit non-goal.
- **`act(...)` warnings in `DayInteractionCoordinator.test.tsx`** — known noise.
- **`packages/backend`, `packages/sync`, `packages/core`, `packages/scripts`, `e2e`.**

---

## 8. Run-mechanics notes

- **Routing.** Under `opus-plus-flash-v37`, the `refactor_extract` and `patch_apply` task types do
  not match the codegen→gemini-flash rule and will route to `default: opus`. Recorded as expected;
  task types will not be relabelled to force cheaper routing.
- **Mechanical-tier verification.** The mechanical tier is the Antigravity SDK worker, which the
  write-contract PreToolUse hook does **not** intercept. Every packet claiming a write or delete
  will be verified against `git status --porcelain` and file mtimes before it is recorded in
  provenance.
- **Formatter interference.** `.cursor/hooks/format-after-edit.ts` may reformat writes; a content
  mismatch will be re-read before being treated as a failed write.
