# Senior Code Review — refactor — Unify Week/Day interaction layers

**Run:** `20260826-082906-refactor-week-day-interaction`
**Mode:** brownfield · **Intent:** `refactor` · scope = files touched by this run only
**Reviewed against:** `requirements.md` §3 (PB-1…PB-10), `change_plan.md` §4/§6/§7 (R1–R11, coordinator boundary)
**Reviewer:** senior-reviewer (Opus 5, 1M) · 2026-08-26

---

## Verdict

# APPROVE WITH FIXES

**No invariant is violated. No blocker.** All ten PB invariants and all eleven R risks hold, verified
by reading the code rather than by trusting the run's own reporting. The four fixes below are
**comment-only**, affect no behavior, and none of them gates a merge.

### Independent verification (I did not take the run's word for it)

I re-ran both toolchain claims because `orchestrator.log` line 30 shows the `test_run` phase opening
at `10:02:21.967Z` and closing at `10:02:22.028Z` — **61 milliseconds**, with no telemetry record and
no captured output. That phase did not run a test suite. AC-1's "2305 pass / 303 files" was therefore
**not** evidenced by the run.

I ran them myself, from the working tree as it stands:

| Check | Command | Result |
|---|---|---|
| AC-1 | `bun test:web` | **2305 pass / 0 fail / 5789 expect() / 303 files**, 73.12s — matches the claim exactly |
| AC-2 | `bun type-check` | **exit 0** (all three tsconfig passes) |

Both claims are true. The reporting that produced them was not.

---

## Invariant table

### PB-1 … PB-10

| # | Invariant | Status | Evidence checked |
|---|---|---|---|
| **PB-1** | Week all-day drag shifts dates by a day delta; Day rewrites `calendarId` and leaves dates alone | **HELD** | `Week/…/adapter/commit/all-day.commit.ts:18-40` — `dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day")` then `startDate`/`endDate` `.add(dayDelta,"day")`, byte-identical to `HEAD:…/interactions/all-day.drag.ts` via `commit/all-day.commit.ts`. `Day/…/adapter/commit/all-day.commit.ts:24-33` — `toEvent` returns `{...t.event, calendarId: columnMoveCalendarId(v, t.event)}`; no date is written. Neither file can reach the other's mapper: no shared import, different trees. Day-side pinned by `Day/…/commit-characterization.test.ts:145-147` (`calendarId` rewritten, `startDate`/`endDate` `toBe` the originals) |
| **PB-2** | Week all-day resize = independent start/end day deltas over an exclusive-end baseline; Day collapses to one day at `visibleDate` and forces `isAllDay: true` | **HELD** | Week `commit/all-day.commit.ts:46-64` (`startDayDelta`/`endDayDelta` + `getExclusiveEndDateBaseline(event)`) and `:73-80` (baseline: `endDate.diff(startDate,"day") <= 0 ? startDate.add(1,"day") : endDate`). Day `commit/all-day.commit.ts:58-66` — `allDayVisualToDayGridEvent` still `isAllDay: true`, `endDate: visibleDate.add(1,"day")`, `startDate: visibleDate`. Day's `isAllDay: true` asserted by the **unmodified** `day-interaction.adapter.test.ts:579` |
| **PB-3** | Week timed drag assigns the target day absolutely; Day treats `dayDate` as a calendarId, day from `visibleDate`, `isAllDay: false`; single-column fallback resolves to the event's own `calendarId` | **HELD** | Week `commit/timed.commit.ts:20-33` — `dayjs(visual.dayDate).startOf("day")` + visual minutes. Day `commit/timed.commit.ts:57,92` — both mappers still set `isAllDay: false`; `columnMoveCalendarId` at `:75+` unchanged. `day-interaction.adapter.ts` (which holds the `columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]` fallback) is **untouched** — `git status --porcelain` returns empty for it. Fallback behavior asserted by unmodified `day-interaction.adapter.test.ts:430,461-470` |
| **PB-4** | Week-only cross-row drag: both directions force `hasMoved: true`; ghost nulling preserved | **HELD** | See R1 and R8 below |
| **PB-5** | Week-only edge navigation; `rebuildLayoutAfterNavigation` on Week's adapter only | **HELD** | `grid/interaction/view-adapter.types.ts:131-141` — `ViewInteractionAdapter` declares seven pointer members and **no** `rebuildLayoutAfterNavigation`, optional or otherwise. Added by extension at `Week/…/week-interaction.adapter.types.ts:79-81` (`interface WeekInteractionAdapter extends ViewInteractionAdapter { rebuildLayoutAfterNavigation(): void; }`). `Day/…/day-interaction.adapter.types.ts:75` is a bare alias `= ViewInteractionAdapter`, so it cannot satisfy `RebuildableAdapter` (`useWeekInteractionLayoutSync.ts:5-7`). `onRequestWeekNavigation?` retained on Week's **runtime** at `week-interaction.adapter.types.ts:44`; `getVisibleDays()` still **required** at `:42`. `edge-navigation.ts` and `state/edge-navigation.state.ts` are not in the change set |
| **PB-6** | Envelope is exactly `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}`, `eventId = target.event._id!` | **HELD** | `grid/interaction/commit/commit-result.ts:27-35` declares exactly those five; `:69-75` builds exactly those five keys, `eventId: target.event._id!` at `:71`. Four `type` literals at `:21-25` |
| **PB-7** | Week `commitSavedMutation` = three branches; Day = two (`!hasMoved` → open, else `updateEvent`) | **HELD** | `git diff` on both coordinators is **import lines + one type annotation, nothing else**. Week: import block loses four `type Week*CommitResult` and gains `InteractionCommitResult` + `GridLayoutCacheSources`; `Props.getLayoutSources` retyped; `commitSavedMutation(result: InteractionCommitResult)`. The `if (!result.hasMoved) { if (result.event.isAllDay) …` body is untouched — the diff hunk terminates inside it. Day: identical shape, `openDayCalendarEvent(result.event); return;` untouched. **Zero control-flow change in either file.** AC-6 satisfied exactly |
| **PB-8** | `useUpdateEvent.ts` untouched | **HELD** | `git status --porcelain packages/web/src/events/mutations/useUpdateEvent.ts` → empty |
| **PB-9** | Layout-cache construction differs; builders not merged | **HELD** | `week-layout.cache.ts:47-59` — one `weekLayoutCacheOptions` object feeding all three builders, `edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX` at `:51` and a `smartScroll` block at `:53`, so the all-day row inherits both. `buildTimedWeekLayoutCache` / `buildAllDayWeekLayoutCache` / `buildDragWeekLayoutCache` all present at `:63,68,75`. `WeekLayoutCacheInput.visibleDays` kept at `:45`. `day-layout.cache.ts:44` timed `edgeThresholdPx: INTERACTION_EDGE_THRESHOLD_PX`, `:63` all-day **hard-coded `0`**, no `smartScroll`, `visibleDates` still positional. Nothing merged. Only four zero-structure type aliases were deleted |
| **PB-10** | Rendered DOM attribute values unchanged | **HELD** | `grid/interaction/view-event-registry.ts` — `git status` empty, unmodified. `createViewInteractionBindings` called **exactly twice repo-wide**, with `"week"` (`week-interaction.bindings.ts:11`) and `"day"` (`day-interaction.bindings.ts:7`). Values flow through the untouched `viewInteractionAttributeNames` template. `TARGET_SELECTOR` moved into the factory (`view-interaction.bindings.ts:37`) but is built from the same two `idAttribute`/`typeAttribute` values in the same order, so the string is character-identical. `MainGrid.test.tsx` / `eventReadOnlyInteraction.test.tsx` unmodified and green |

### R1 … R11

| # | Risk | Status | Evidence checked |
|---|---|---|---|
| **R1** | Cross-row `hasMoved` forcing lost → data loss | **HELD** | `Week/…/commit/all-day.commit.ts:95` → `hasMoved: (v) => v.row === "timed" \|\| hasAllDayDragVisualMoved(v)`. `Week/…/commit/timed.commit.ts:59` → `hasMoved: (v) => v.row === "allDay" \|\| hasTimedDragVisualMoved(v)`. Both are the HEAD `isCrossRow \|\| …` expression, term for term. `InteractionCommitMapper.hasMoved` at `commit-result.ts:97` is **required, no `?`, no default parameter, no fallback in `commitWithMapper`** (`:116` calls `mapper.hasMoved(visual)` directly). Repo-wide `grep -rn "hasMoved?"` over `packages/web/src` returns exactly one hit — `Week/components/Draft/hooks/state/useDraftState.ts:18`, an unrelated pre-existing draft-state field, not this contract. Pinned by `Week/…/commit-characterization.test.ts:78-79,139-140` |
| **R2** | Envelope spreads the mapped event → drops `isAllDay` | **HELD** | `commit-result.ts:69-75` — `event,` shorthand assignment, by reference. No spread anywhere in the file |
| **R3** | `getExclusiveEndDateBaseline` hoisted | **HELD** | `Week/…/commit/all-day.commit.ts:73` — `const getExclusiveEndDateBaseline` with **no `export`**, still in Week's tree. `grep` finds no other occurrence in the repo |
| **R4** | `columnMoveCalendarId` moved to the shared commit layer | **HELD** | Still exported from `Day/…/adapter/commit/timed.commit.ts:75`. `grid/interaction/commit/` contains only `commit-result.ts`, `cross-row.commit.ts`, `cross-row.commit.test.ts`, `timed-moved.ts`. No calendarId rewrite is reachable from Week's drags |
| **R5** | Attribute values changed | **HELD** | See PB-10 |
| **R6** | Two registry instances per view | **HELD** | `grep -rn "createViewInteractionBindings(" packages/` → exactly two call sites (plus two doc-comment mentions). `createViewInteractionRegistry(` appears only inside the factory (`view-interaction.bindings.ts:35`) and in `view-event-registry.test.ts`. **Caveat on the guard — see Fix 1** |
| **R7** | Import cycle between the shims | **HELD** | `registry/week-event.registry.ts:6` and `targeting/week-event.targeting.ts:3` both import `week-interaction.bindings` and **not each other**; same for Day (`:6` / `:3`). Both shims are leaves off one root |
| **R8** | Asymmetric ghost ternaries merged or inverted | **HELD** | `visuals/all-day.drag.ts:63` → `nextVisual.row === "timed" ? allDayDragVisualToTimedGridEvent(...) : null`. `visuals/timed.drag.ts:79` → `nextVisual.row === "allDay" ? null : timedDragVisualToGridEvent(...)`. Both asymmetric, neither inverted. I diffed all five moved files against `HEAD:…/interactions/*.ts`: **every change is an import line, a `WeekLayoutCache` → `GridLayoutCache` annotation swap, or the removal of the extracted `commit*Interaction` function. Zero diff inside any retained function body.** `grep -rn "GhostEvent\|crossRowGhost"` → no results; no shared helper was extracted |
| **R9** | Orphaned alias importers | **HELD** | `SmartScrollCache` now imported only from `grid/interaction/layout.cache` and `math/smart-scroll`; `WeekLayoutCache*` / `DayLayoutCache*` have no remaining importers outside the two doc comments that mention their deletion. `bun type-check` exit 0 confirms |
| **R10** | Resize asymmetry converged | **HELD** | Week timed: `commit/timed.commit.ts:80` → `toEvent: (t, v) => timedResizeVisualToGridEvent(t.event, v)` — arity 2, the `hasMoved` third argument is not even named. Week all-day: `commit/all-day.commit.ts:113` → same, arity 2. Day timed: `Day/…/commit/timed.commit.ts:44-47` → `toEvent: (t, v, hasMoved) => hasMoved ? … : t.event`. Day all-day resize: `Day/…/commit/all-day.commit.ts:53-54` → `(t, _v, hasMoved) => hasMoved ? … : t.event`. Pinned both directions: Week `commit-characterization.test.ts:171` `expect(result.event).not.toBe(target.event)`; Day `:79,113` `expect(result.event).toBe(target.event)` |
| **R11** | Suite file count fails AC-1 | **HELD** | Measured 303 files, matching the twice-amended AC-1 in `requirements.md:170` |

**Note on R10, for the record.** Week's all-day resize is *syntactically* unconditional but
*behaviorally* equivalent to Day's gate, because `allDayResizeVisualToGridEvent` short-circuits with
`if (!hasAllDayResizeVisualChanged(visual)) return event;` at `all-day.commit.ts:50-52` and so returns
`target.event` by identity on a no-op anyway. The gate merely lives inside the mapper instead of
inside the commit. The comment at `:102-106` says this correctly. The genuinely asymmetric one is the
**timed** resize, and that is the one the characterization tests pin. No action needed; recording it
so a future reader doesn't "discover" the equivalence and decide the comment is wrong.

### Env fixtures

**N/A.** `packages/web` is a Vite/React package with no validating `ConfigModule`, Joi, Zod, envalid
or class-validator config schema, and this is a `refactor` intent that introduces no new required env
vars. The env-fixture blocker does not apply.

---

## Blockers

**None.**

---

## Fixes requested (all comment-only, none gating)

### Fix 1 — `view-interaction.bindings.test.ts:14-17` overclaims. It is not an R6 guard.

```ts
 * These run against the real per-view bindings rather than a fresh factory
 * call, so they also serve as the guard that each view has exactly ONE
 * registry instance: if registration and resolution ever split across two
 * instances, "falls back to the first visible registered event" fails.
```

This is false. The test registers into `bindings.registry` and resolves through
`bindings.getFirstVisibleGridEventTarget` — **the same object**, whose two members are wired to each
other inside `createViewInteractionBindings` by construction (`view-interaction.bindings.ts:35-48`).
It cannot fail. The R6 failure mode is a *shim* rebinding to a second
`createViewInteractionBindings(...)` call, and this test never touches a shim.

The R6 guard that actually exists is the pair of pre-existing hook tests, which register into the
**registry shim** and resolve through the **targeting shim**:
`views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.test.tsx:120` (`dayEventRegistry.register`) and
`views/Week/hooks/shortcuts/useWeekShortcutOwner.test.tsx:192` (`weekEventRegistry.register`). Those
do cross the two shims and would fail on a split. That is worth stating, because after this refactor
**no test imports either targeting shim module directly any more** — the two files that did were the
ones deleted.

**Fix:** replace the claim with a pointer to the tests that really cover it. Suggested wording:

```ts
 * These run against the real per-view bindings, not a fresh factory call.
 * NOTE: this does NOT guard R6 (a shim rebinding to a second
 * createViewInteractionBindings call) — registry and targeting here come from
 * the same object and agree by construction. The cross-shim guard is
 * useWeekShortcutOwner.test.tsx / useDayEventNudgeShortcuts.test.tsx, which
 * register through the registry shim and resolve through the targeting shim.
```

### Fix 2 — `registry/week-event.registry.ts:11` states a wrong number.

> "four call sites and four test files import from here"

Measured: **17** importers — four non-test source files (`AllDayEvents.tsx`, `MainGridEvents.tsx`,
`week-interaction.adapter.ts`, `GridDraft.tsx`) and **13** test files, including
`common/utils/event/event.util.test.ts`, `components/ContextMenu/contextMenuLayering.test.tsx`,
`views/Forms/hooks/useCloseEventForm.test.ts` and the five `week-interaction.*.test.ts` adapter
suites. The source count is right by coincidence — two of the four are not the two the comment means.

This traces back to `change_plan.md` §5, whose "blast radius — the 14 individual allowlist files"
table lists only five test files. The *conclusion* ("net: 0 of 14 need an edit") survives — nothing
did need an edit, and the suite proves it — but the blast radius was materially understated, and the
comment now bakes the understatement into the code where it will be read as fact.

**Fix:** drop the count, or state it as "every existing importer, source and test, was unaffected —
this file's path and export names are unchanged."

### Fix 3 — `targeting/day-event.targeting.ts:5-8` omits an importer.

> "`useDayEventNudgeShortcuts.ts` imports three of these and needed no edit"

`views/Day/interaction/day-event.focus.ts:1-4` also imports two of them
(`focusDayGridEventTarget`, `getFirstVisibleDayGridEventTarget`). The "three" is right for the named
file; the implication that it is the only consumer is not.

**Fix:** "`useDayEventNudgeShortcuts.ts` and `day-event.focus.ts` import from here and needed no edit."

### Fix 4 — `createViewInteractionBindings(viewName: string)` should narrow its parameter.

`view-interaction.bindings.ts:34`. This is the single funnel through which every rendered DOM
attribute value is produced, and R5 is entirely a "don't pass anything but `"week"`/`"day"`" rule —
currently enforced only by a comment at `:27-32`. A one-line union turns the R5 violation into a
compile error:

```ts
export type CalendarViewName = "day" | "week";
export const createViewInteractionBindings = (viewName: CalendarViewName) => {
```

Both existing call sites already pass string literals, so this is non-breaking and `bun type-check`
stays green. (`viewInteractionAttributeNames(viewName: string)` in `view-event-registry.ts:26` has
the same looseness, but that file is **pre-existing and untouched by this run** — out of scope, do
not widen the change to it.)

---

## Non-blocking observations

### O-1 — Layering: a grid-layer test importing the view layer. Acceptable, but the filename lies.

`grid/interaction/view-interaction.bindings.test.ts:1-2` imports
`@web/views/Day/interaction/day-interaction.bindings` and
`@web/views/Week/interaction/week-interaction.bindings`. `grid/interaction/**` is the substrate that
`views/**` builds on, so this inverts the dependency: the substrate's test suite can no longer run
without both views compiling.

**My call: keep it, but rename it.** The assertion under test is inherently cross-view — it asserts
that Week's and Day's *real singleton instances* behave identically, which cannot be expressed
without importing both. Testing the factory in isolation would be a strictly weaker test and would
lose the "same instance the app uses" property that makes it worth keeping.

Two things temper the concern: there is precedent (`grid/shortcuts/useGridEventEditShortcuts.ts:64`
imports `@web/views/Forms/hooks/useDeleteEvent` — in *production* code, which is worse), and there is
no import-boundary lint rule in `biome.json` to violate.

But the file is named after the grid factory and lives in the grid tree while testing neither. If it
moves, `packages/web/src/views/__tests__/view-interaction-bindings.test.ts` is the honest home. If it
stays, rename to something like `view-interaction.bindings.integration.test.ts` and say in the
docstring that it deliberately reaches into both views. Low stakes either way; I would not hold the
merge for it.

### O-2 — Comment volume: mostly earned, one duplication pattern that will rot.

Measured comment-to-code ratios in the new and rewritten modules:

| File | Total | Comment | Blank | Code |
|---|---|---|---|---|
| `grid/interaction/commit/commit-result.ts` | 124 | **45** | 10 | 69 |
| `grid/interaction/view-adapter.types.ts` | 141 | 31 | 12 | 98 |
| `grid/interaction/view-interaction.bindings.ts` | 53 | 14 | 7 | 32 |
| `Week/…/commit/all-day.commit.ts` | 114 | 24 | 11 | 79 |
| `Week/…/commit/timed.commit.ts` | 81 | 16 | 7 | 58 |

**Earned, keep as-is:**
- `commit-result.ts:77-91` — the R1 data-loss explanation on `InteractionCommitMapper`. This is the
  single highest-value comment in the change set: it sits directly above the `hasMoved` declaration
  and explains why the obvious "cleanup" is a bug. Exactly where a future refactorer will look.
- `commit-result.ts:56-61` — the R2 "assign by reference, never spread" note above the builder.
- `view-adapter.types.ts:25-43` — the extension-point rule. Non-obvious, structural, and its
  violation (an optional `rebuildLayoutAfterNavigation?`) type-checks cleanly, which is precisely
  when a comment earns its keep.
- `Week/…/commit/all-day.commit.ts:66-72` — why `getExclusiveEndDateBaseline` stays un-exported.
- `Week/…/commit/all-day.commit.ts:22-25` — the delta-vs-absolute rationale. Pre-existing, correctly
  carried across the move.

**Redundant.** The R1 warning is now stated in full **four** times: `commit-result.ts:80-86`,
`Week/…/commit/all-day.commit.ts:82-88`, `Week/…/commit/timed.commit.ts:48-53`, and
`Week/…/commit-characterization.test.ts:26-29`. R10 is stated **five** times. Three of the four R1
copies are load-bearing because they sit at the sites a refactorer would edit; the copy in the test
docstring is the one to trim. This is defensible over-documentation of a genuine landmine, not a
problem — I flag it only so it isn't multiplied further on the next pass.

**Will rot.** `week-layout.cache.ts:38-44` and `day-layout.cache.ts:24-35` each describe the *other*
view's constants — Week's comment asserts "Day's all-day builder hard-codes `edgeThresholdPx: 0`",
Day's asserts "Week's all-day row inherits `edgeThresholdPx: 50`". Both are true today (I verified:
`WEEK_EDGE_NAVIGATION_THRESHOLD_PX = INTERACTION_EDGE_THRESHOLD_PX = 50`, `interaction.constants.ts:19`).
But a cross-file factual claim with no test behind it is the classic rot shape: change Day's `0` and
Week's comment silently becomes a lie. Prefer "do not merge these builder families — the two views'
all-day edge thresholds differ deliberately" without quoting the other side's number.

**Also worth recording:** `requirements.md` PB-5 and `change_plan.md` PB-9 both describe Week and Day
as using "different constants" for the edge threshold. They use two *names* for the **same value, 50**
— `WEEK_EDGE_NAVIGATION_THRESHOLD_PX` is a straight re-export of `INTERACTION_EDGE_THRESHOLD_PX`
(`edge-navigation.ts:35`). The only real numeric difference is Week's all-day row at 50 vs Day's
all-day row at 0. The invariant is correctly preserved in code; the framing in the artifacts is
imprecise.

### O-3 — Two dead exports in the new shared modules.

`ViewInteractionBindings` (`view-interaction.bindings.ts:51-53`) and `ViewGridEventTarget` (`:18`)
have no importers anywhere in `packages/web/src`. Speculative API on a module whose docstring warns
against extra call sites. Delete or leave; trivial.

### O-4 — AC-5 / AC-5a: fully satisfied, and better than the criterion required.

`git status --porcelain packages/ | grep test` returns exactly five entries: two deletions, three
additions. **No pre-existing test file was modified at all** — not even for moved imports. AC-5's
"edits limited to moved imports" was not merely respected, it was unused.

The 8-case invariant holds. I diffed the two deleted files against each other
(`HEAD:week-event.targeting.test.ts` vs `HEAD:day-event.targeting.test.ts`): a pure week/day name
substitution, no semantic difference. All 8 `it()` cases reappear as 4 × `describe.each` over two
views in `view-interaction.bindings.test.ts:20-105`, with byte-identical titles and byte-identical
assertion bodies — `toMatchObject` shapes at `:66,78`, the `toBe(button)` at `:92`, the
`toEqual([expect.objectContaining…])` at `:100-103`. Nothing weakened, reworded or dropped.

### O-5 — AC-5b (characterization tests green on HEAD *before* S5): credible, but never recorded.

The backup at
`.sdlc/runs/…/backups/packages__web__src__views__Week__interaction__adapter__commit-characterization.test.ts`
imports from `./interactions/all-day.drag`, `./interactions/timed.drag`, `./interactions/timed.resize`
— the **HEAD** paths, which only existed before S5. Diffing it against the current file shows the
change was **import lines only**; every assertion is identical. Timeline agrees: `tp_sc_001` and
`tp_sc_002` completed 09:20 and 09:25, the S5 execute_packets phase started 09:41.

I could not find a recorded green run against HEAD in `telemetry.jsonl` or `orchestrator.log`, so
AC-5b's evidence requirement ("recorded in the Phase 7 report and re-checked at Gate 3") is not
actually met by any artifact. I verified the equivalent by reading the HEAD bodies: all four Week
assertions pass against `HEAD:…/interactions/all-day.drag.ts:83-94` (`isCrossRow` → `hasMoved: true`,
mapper yields `isAllDay: false`), `HEAD:…/timed.drag.ts:99-110`, and `HEAD:…/timed.resize.ts:69-77`
(spread mapper ⇒ a fresh object ⇒ `not.toBe(target.event)`). Day's three assertions pass against its
unchanged HEAD gates. The tests genuinely characterize prior behavior; only the paperwork is missing.

### O-6 — No coverage regression, verified rather than assumed.

I checked whether the Day characterization test's narrow scope (no-op resizes + one cross-column
drag) leaves PB-2/PB-3 exposed. It does not: `day-interaction.adapter.test.ts` — **unmodified** —
covers `isAllDay: false` on timed drag (`:409,477`), `isAllDay: true` on all-day resize (`:579`), and
the full `columnMoveCalendarId` matrix including the single-column fallback (`:419,430,439,452,470`).
Week's five `week-interaction.*.test.ts` adapter suites are likewise unmodified and green.

---

## Honest verdict on the refactor's value

**The execution is excellent. The refactor is not.**

Separate those two judgments, because they point opposite ways.

**The execution.** Ten invariants, eleven risks, a frozen write contract, two gated rulings, a
coordinator boundary specified down to the line range — and I could not find a single violation.
The five moved visual files diff clean to the byte inside every retained function body. The
coordinators changed by exactly one type annotation each. `useUpdateEvent.ts` was never opened. The
mappers did not converge; the asymmetries the plan predicted someone would "tidy away" are all still
asymmetric, and now have characterization tests holding them there. That is genuinely disciplined
refactoring, and the R1/R10 tests are a real asset the codebase did not have this morning.

**The refactor.** Here are the numbers I measured, not the ones reported:

| Tree | HEAD | Now | Δ |
|---|---|---|---|
| `interaction/**` | 2208 | 2208 | 0 |
| `grid/interaction/**` | 2625 | 3048 | **+423** |
| `views/Week/interaction/**` | 5428 | 5453 | +25 |
| `views/Day/interaction/**` | 2375 | 2363 | −12 |
| **Total** | **12 636** | **13 072** | **+436** |

(The run reported 13 074 / +438 and a two-tree 7817; I measure 13 072 / +436 and 7816. A two-line
discrepancy from files lacking a trailing newline. Immaterial, but it is a third instance of a
reported number not being independently reproducible — after the 61 ms test phase and the "four test
files" comment. The pattern is worth naming.)

Now the per-concern breakdown, which is where the story is:

| Concern | Removed from views | Added to shared | Net |
|---|---|---|---|
| Adapter types | −142 (149→81, 149→75) | +141 | **−1** |
| Registry | **+17** (24→35, 24→30) | +53 (bindings) +18 (two bindings files) | **+88** |
| Targeting | −14 (35→30, 35→26) | (shares the +53 above) | **−14** |
| Targeting tests | −184 | +105 | **−79** |
| Commit | +92 Week, ~0 Day | +124 | **+216** |

Read that table honestly:

- **Adapter types — the flagship consolidation — netted *one line*.** 298 lines of duplicated
  interfaces became a 141-line shared file plus 81 and 75 lines of pure per-view aliasing. Every
  structural declaration is now written once, which is a real correctness gain: `ViewAllDayDragTarget`
  can no longer drift between views. But it did not *shrink* anything. The duplication was **moved**,
  and a 156-line alias layer was added to preserve every old export name.
- **Registry got 88 lines worse** to deduplicate 48 lines. Two 24-line files became two shims
  (35 and 30), plus two bindings files (11 and 7), plus a 53-line factory. Five files where there
  were two, to delete one `createViewInteractionRegistry` call.
- **Commit got 216 lines worse.** The 124-line `commit-result.ts` replaced ~40 lines of genuinely
  duplicated envelope literal across eight sites; Week's two commit files grew by 92 because the
  extracted functions arrived with 40 lines of new comments. The *envelope* was unified — real, and
  PB-6 was the honest reading. But `commitWithMapper` is a four-argument indirection wrapping a
  three-line object literal, and it did not make any commit function shorter.
- **The one unambiguous win is the targeting-test collapse: −79 lines, zero assertions lost.**

**So: was the duplication removed or moved?** Predominantly **moved**. `grid/interaction/**` grew
+423 while the two view trees netted +13. Not "roughly half" relocation, as AC-7a puts it — by my
measurement it is **essentially all** of it, and then some. AC-7 fails on any reading, not just the
literal one; excluding the 322 lines of directed characterization tests gets the two-tree number
under baseline, but that accounting silently ignores the +423 that landed one directory over. The
project's stated goal was consolidation; the tree got **436 lines bigger**.

**Is that bad?** Not entirely, and this is the part worth being precise about. Two things were bought
that line counts don't show:

1. **Single points of truth where drift was possible.** The eight target/commit-result interfaces are
   declared once. That is a durable correctness property, worth paying alias lines for.
2. **The R1/R10 characterization tests.** A user-visible data-loss path that no test covered now has
   one, in both views, asserting by reference identity. That alone might justify the run.

But three things were also bought that are liabilities:

1. **A shim layer with no expiry date.** `week-event.registry.ts`, `day-event.registry.ts`,
   `week-event.targeting.ts`, `day-event.targeting.ts` now exist *solely* to re-export the shared
   bindings under prefixed names. They were kept to avoid touching 17 + 2 importers. That was the
   right call for this run's risk budget, but it means the consolidation is **half-done by design**:
   the duplication is gone from the implementations and preserved in the *names*. Someone must
   eventually delete the shims and rewrite the importers, or this layer is permanent overhead — five
   files and two indirections between a component and a registry.
2. **156 lines of pure type aliasing** (`WeekAllDayDragTarget = ViewAllDayDragTarget`, ×20) whose only
   function is to keep old names alive. Same debt, same unfinished shape.
3. **A new abstraction seam at the highest-risk point in the module.** `commitWithMapper` sits exactly
   where PB-1/PB-2/PB-3 say the two views must *not* converge, and the plan's own defense is that
   `hasMoved` is required so the mistake becomes a type error. That defense is real and correctly
   implemented — but the safest design for "these two things must never merge" is not a shared
   function that both call with different strategy objects.

**Bottom line.** The refactor is a **net-positive correctness change and a net-negative size change**,
and it is roughly half-finished by construction. Merge it — it is careful, it is well-tested, and it
removes real drift risk from the type layer. Then file the follow-up: **delete the four shims and the
20 name aliases, and rewrite the ~19 importers.** Until that lands, this run has paid the cost of
consolidation without collecting the benefit. The 436-line growth is the receipt for work that stops
one step short.

One process note. The 61 ms `test_run` phase, the two-line count discrepancy, and the wrong importer
count in a comment are the same failure in three places: **numbers reported without being run.** The
underlying work here is strong enough that it did not need embellishing — the suite really is 2305/0,
and I confirmed it. But a reviewer who trusted the artifacts would have signed off on a test run that
never happened.
