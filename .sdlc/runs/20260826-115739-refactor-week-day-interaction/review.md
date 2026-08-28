# Senior review — refactor/week-day-interaction

**Run:** `20260826-115739-refactor-week-day-interaction`
**Mode:** brownfield · **Intent:** refactor · scoped to the 28 files this run wrote/edited
**Verdict:** `request-changes`

Two CI jobs that this run's verification did not cover (`lint`, `knip`) are red, and both are
red *only* because of files this run created. Separately, the one new suite whose whole purpose
is to guard FR-6/AC-8 does not reach the state it claims to guard.

I found **no behaviour drift** in either rewritten adapter. That is the good news and it is the
result of a line-by-line comparison against `git show HEAD:` for both files — see
*What I verified and how*.

---

## Blockers

### B-1 — `bun run knip` fails; both unused exports are new in this run

CI job `knip` (`.github/workflows/test-unit.yml:55`, runs `bun run knip`). Current output:

```
Unused exports (2)
readElementRect  packages/web/src/grid/interaction/adapter/view-interaction.engine-members.ts:43:10
isDayDragTarget  packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts:71:14
```

**`packages/web/src/grid/interaction/adapter/view-interaction.engine-members.ts:43`**

```ts
export { readElementRect };
```

This is the candidate flagged in the brief, and it is confirmed dead. Both adapters import the
symbol from its real home instead — `week-interaction.adapter.ts:12` and
`day-interaction.adapter.ts:2` both do `import { readElementRect } from
"@web/grid/interaction/adapter.helpers"`. The re-export has zero importers, and the `import` at
`view-interaction.engine-members.ts:1-4` pulls `readElementRect` in for no other reason.

*Why it matters:* it breaks a required CI job, and it advertises a second import path for a
helper that already has one — the exact duplication this refactor exists to remove.

*Fix:* delete line 43 and drop `readElementRect` from the import block at lines 1-4.

**`packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts:67-71`**

```ts
/**
 * Kept as a named re-export rather than deleted: it is Day's existing import
 * surface, and the predicate itself is now shared.
 */
export const isDayDragTarget = isViewDragTarget;
```

The justifying comment is factually wrong. `grep -rn isDayDragTarget packages/web/src` returns
exactly one hit — this declaration. The pre-refactor importer
(`day-interaction.adapter.ts`, old lines 68-71 and 254/329) was rewritten in this same run to
call `isViewDragTarget` via `resolveDayColumns` and `getViewInteractionDraftEventMode`. Nothing
imports `isDayDragTarget`. A comment asserting a call site that does not exist is worse than no
comment, because it will survive the next reviewer's grep-free reading.

*Fix:* delete lines 67-71. `isViewDragTarget` stays imported for use at line 63's sibling
predicate call — verify `isViewDragTarget` is still referenced after deletion; if not, drop it
from the import block at lines 18-21 too.

---

### B-2 — `bun run lint` fails with 6 errors, all in files this run wrote

CI job `lint` (`.github/workflows/test-unit.yml:21`, runs `bun run lint` →
`check-semantic-colors.ts && biome check .`).

I checked every biome diagnostic in the repo individually. **Every pre-existing diagnostic is a
warning** (`GridEvent.tsx:66`, `ShortcutKeys.tsx:58`, `DescriptionEditor.tsx:95`,
`shortcuts.data.test.ts:3`, `recurrence-scope-opportunity.store.test.ts:97,156`, the two
`packages/sync` db tests, `self-host/docker-compose.test.ts:469`). The *errors* are all this
run's:

| File | Rule |
|---|---|
| `packages/web/src/grid/interaction/adapter/view-interaction.divergence.test.ts:1` | `assist/source/organizeImports` |
| `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts:1` | `assist/source/organizeImports` |
| `packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts:1` | `assist/source/organizeImports` |
| `packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts:1` | `assist/source/organizeImports` |
| `packages/web/src/views/Week/interaction/adapter/week-interaction.idempotence.test.ts:1` | `assist/source/organizeImports` |
| `packages/web/src/grid/interaction/adapter/view-interaction.targets.test.ts` | `format` (4 hunks) |

Concrete examples:

- `day-layout.cache.ts:18-21` inserts the `view-interaction.targets` import *after*
  `@web/interaction/interaction.constants` (line 17).
- `week-interaction.idempotence.test.ts:5-6` puts `@web/common/types/web.event.types` before
  `@core/util/date/dayjs`.
- `view-interaction.divergence.test.ts:6-7` orders `.../interactions/all-day.drag` before
  `.../commit/timed.commit`.
- `view-interaction.targets.test.ts:76-78`, `116-118`, `170-172`, `187-192` are hand-wrapped
  where the formatter would print one line.

Note the irony in `view-interaction.engine-members.ts:13-20`, which explicitly justifies its
API shape by "the repo's format-after-edit hooks have nothing to rewrite" — while six sibling
files in the same change set are unformatted or unsorted.

*Why it matters:* required CI job, and it is a 10-second `biome check --write` away from green.
The run's verification (`type-check`, `bun test:web`, seam probe) simply never invoked it.

*Fix:* `bunx biome check --write` on the six paths. Do **not** run it repo-wide — that would
also rewrite untouched files and the three `.sdlc/*.json` artifacts.

---

## Major

### M-1 — `week-interaction.idempotence.test.ts` never reaches the state it exists to guard

`packages/web/src/views/Week/interaction/adapter/week-interaction.idempotence.test.ts:250-269`

```ts
it("keeps the time of day stable across repeated identical moves", () => {
  // The vertical axis is where a scroll-delta accumulation bug would show:
  // each repeat would push the event further down the grid.
  ...
  moveTo(320, 1120);
```

**The comment is false for this harness.** Worked through against source:

- `createHarness` sets `setRect(mainGrid, { height: 1300, left: 50, top: 100, width: 750 })`
  (line 114), so the main-grid rect is `top=100, bottom=1400`.
- `layout.cache.ts:105-115` builds `smartScroll` as `top: rect.top` → `100`,
  `bottom: rect.bottom - bottomInsetPx` → `1400 - 100 = 1300`,
  `edgeThresholdPx` → `INTERACTION_EDGE_THRESHOLD_PX` = `50`
  (`interaction.constants.ts:19`, via `week-layout.cache.ts`).
- `smart-scroll.ts:60-73`: the scroll zones are therefore `pointerY < 150` (top) and
  `pointerY > 1250` (bottom).
- Every pointer y in the suite is `1020` or `1120`. Both sit in the dead band, so
  `getSmartScrollFrame` returns `zone: null, velocityPx: 0`, and
  `adapter.helpers.ts:97` computes `scrollDeltaPx = nextScrollTop - initialScrollTop = 0 - 0 = 0`.

`scrollTop` never leaves `initialScrollTop` and `scrollDeltaPx` is identically `0` for all three
tests. `view-interaction.layout-state.ts:5-21` names `scrollTop` as *the* accumulating value
that can break the engine contract — and an implementation rewritten to
`scrollTop = scrollTop + result.scrollDeltaPx` would pass all three tests unchanged, because
accumulating zero is zero.

What the suite *does* prove is real and worth keeping: `updateTimedDragVisual` recomputes the
column and minutes from `pointerStart` rather than from the previous visual. That is genuine
FR-6 coverage for the visual math. It is just not coverage of the state the design document
says is the risk.

A naive fix (move the pointer into the scroll band and assert two identical results) would fail
against *correct* code: `applySmartScroll` mutates `element.scrollTop` by `speedPx` on every
invocation while in the band, which is intended auto-scroll behaviour, not accumulation. The
discriminating assertion has to be at the `createViewInteractionLayoutState` level — see
refinement packet 3.

*Severity:* major, not blocker — the suite is additive and green, and the underlying code is
correct today. But AC-8 is currently claimed on evidence that does not support it, and that
false confidence is what would let a future edit through.

---

## Refinement packets

### 1. Remove the two dead exports (unblocks CI `knip`)

- `artifact_path`: `packages/web/src/grid/interaction/adapter/view-interaction.engine-members.ts`,
  `packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts`
- `task_type`: `patch_apply`
- **Instruction:**
  1. In `view-interaction.engine-members.ts`, delete line 43 (`export { readElementRect };`) and
     remove `readElementRect` from the import at lines 1-4, leaving
     `import { getSavedEventInteractionCursor } from "@web/grid/interaction/adapter.helpers";`.
  2. In `day-layout.cache.ts`, delete lines 67-71 (the doc block and
     `export const isDayDragTarget = isViewDragTarget;`). Then check whether `isViewDragTarget`
     is still referenced in the file; at time of review it is not, so also remove it from the
     import block at lines 18-21, leaving only `isViewAllDayTarget`.
  3. Do not touch `day-interaction.adapter.ts` or any other file — both symbols have zero
     importers, confirmed by `grep -rn` and by `knip`.
- **Acceptance:**
  - `bun run knip` exits 0.
  - `bunx typescript@7.0.2 -p packages/web/tsconfig.app.json --noEmit` exits 0.
  - `cd packages/web && bun test src/views/Day/interaction src/views/Week/interaction src/grid/interaction`
    → 98 pass / 0 fail.

### 2. Apply biome fixes to the six files (unblocks CI `lint`)

- `artifact_path`: the six paths listed in B-2
- `task_type`: `patch_apply`
- **Instruction:** run
  `bunx biome check --write packages/web/src/grid/interaction/adapter/view-interaction.divergence.test.ts packages/web/src/grid/interaction/adapter/view-interaction.targets.test.ts packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts packages/web/src/views/Week/interaction/adapter/week-interaction.idempotence.test.ts`.
  Do not pass `.` — a repo-wide write would also rewrite untouched files and the `.sdlc/*.json`
  artifacts. Apply after packet 1 so the import blocks are sorted post-deletion.
- **Acceptance:**
  - `bunx biome check packages/web/src/grid/interaction packages/web/src/views/Day/interaction packages/web/src/views/Week/interaction`
    reports 0 errors (warnings from `useExportType` may remain if packet 4 is deferred).
  - `bunx biome check . --max-diagnostics=200` reports 0 errors under `packages/`.
  - No change to any file's exported symbols (`git diff` should be imports/whitespace only).

### 3. Add a discriminating `scrollTop` non-accumulation test

- `artifact_path`: `packages/web/src/grid/interaction/adapter/view-interaction.layout-state.test.ts` (new)
- `task_type`: `test_add`
- **Instruction:** add a unit suite over `createViewInteractionLayoutState` that fails if
  `applySmartScroll` is rewritten to accumulate. Build a fake layout
  `{ smartScroll: { bottom, edgeThresholdPx: 50, element, initialScrollTop: 0, maxScrollTop: 1000, speedPx: 10, top } }`
  where `element` is a plain `document.createElement("div")` with a writable `scrollTop`, then:
  1. **Delta is absolute, not cumulative.** Set `element.scrollTop = 40` (simulating a wheel
     scroll the adapter did not cause). Call `applySmartScroll({ x: 0, y: <mid-band> })` twice
     with an identical pointer. Assert `scrollDeltaPx === 40` on **both** calls. An accumulating
     implementation returns `40` then `80`.
  2. **Delta follows the container back down.** After step 1, set `element.scrollTop = 0` and
     call again with the same pointer. Assert `scrollDeltaPx === 0`. An accumulating
     implementation cannot go back.
  3. **`setLayout` reseeds from the new cache, `clear` nulls both.** Assert
     `getScrollTop()` equals the new `initialScrollTop` after `setLayout`, and `null` after
     `clear()`.
  Use `INTERACTION_EDGE_THRESHOLD_PX` and pick `top`/`bottom` so the pointer y is in the dead
  band for steps 1-2, so the assertions isolate the delta arithmetic from the auto-scroll
  stepping.
  Then correct the misleading comment at
  `week-interaction.idempotence.test.ts:251-252` — it currently claims the vertical axis exercises
  scroll-delta accumulation; the harness's pointer ys (1020, 1120) sit in the dead band
  (`y < 150` / `y > 1250` are the zones). Restate it as what the test actually proves: the timed
  drag visual recomputes minutes from `pointerStart` rather than from the previous visual.
- **Acceptance:**
  - New suite passes.
  - Manually verified to fail if `view-interaction.layout-state.ts:28-29` is temporarily changed
    to `scrollTop = (scrollTop ?? 0) + result.scrollDeltaPx;` (revert after checking).
  - `week-interaction.idempotence.test.ts` still passes and its six adapter siblings remain
    byte-identical (`git diff --stat` empty for them).

### 4. Drop the dead type re-exports

- `artifact_path`: `packages/web/src/grid/interaction/adapter/view-interaction.types.ts`,
  `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts`
- `task_type`: `patch_apply`
- **Instruction:**
  1. `view-interaction.types.ts:157` — delete `export { type InteractionEngineSchedulerOptions };`.
     Nothing imports it from here: both `week-interaction.adapter.types.ts:21` and
     `day-interaction.adapter.types.ts:20` import it directly from
     `@web/interaction/interaction.engine`. Then remove
     `type InteractionEngineSchedulerOptions` from the import at lines 13-16 (only
     `InteractionCancellationTargets` is used, at line 148).
  2. `week-interaction.adapter.types.ts:72` — delete `export { type GridEvent };` and the now-orphan
     `import { type GridEvent } from "@web/common/types/web.event.types";` at line 1. `GridEvent`
     has no other use in the file after the refactor, and no module imports `GridEvent` from this
     path. This re-export appears to exist only to keep an otherwise-unused import alive.
  3. Optional, same pass: `WeekResolvedEventTarget` (`week-interaction.adapter.types.ts:66`) and
     `DayResolvedEventTarget` (`day-interaction.adapter.types.ts:68`) lost their only consumers
     when target resolution moved into `view-interaction.targets.ts`. Likewise
     `ViewInteractionModule` (`view-interaction.module.ts:71`) and `ViewGridEventTarget`
     (`view-interaction.module.ts:10`) and `ViewInteractionLayoutState`
     (`view-interaction.layout-state.ts:48`) are new and unimported. `knip` does not flag these
     because `knip.json` runs `--include files,exports,nsExports` without `types`. Keep them only
     if they are deliberate public surface; otherwise delete.
- **Acceptance:**
  - Both `useExportType` warnings gone from `bunx biome check packages/web/src`.
  - `bun run type-check` exits 0.

### 5. Close the shared-registry teardown gap in the module suite

- `artifact_path`: `packages/web/src/grid/interaction/view-interaction.module.test.ts`
- `task_type`: `test_add`
- **Instruction:**
  1. `afterEach` (lines 4-6) clears `document.body.innerHTML` but never clears the registries,
     while the suite registers into the **process-wide shared** instances at lines 30-34 and
     83-87. Add `VIEW_INTERACTION_MODULES.week.registry.clear();` and the `day` equivalent to
     `afterEach`. This is the convention the sibling suites already follow —
     `week-event.targeting.test.ts:10-13` and `week-interaction.idempotence.test.ts:199-203` both
     clear — and `.cursor/rules/web-testing.mdc` requires restoring replaced globals in teardown.
     (`event.registry.ts:48-51` prunes detached elements lazily, so today's leak is benign; it is
     still a latent cross-file flake and a retained DOM reference.)
  2. Replace the tautological assertion at lines 13-18. `expect(X.week.registry).toBe(X.week.registry)`
     reads the same data property of the same frozen object twice and cannot fail; the comment's
     hypothesised "module that minted a fresh registry per access" would require a getter, which
     `buildViewInteractionModule` does not and cannot produce via object spread. Replace it with
     the assertion that actually encodes FR-2's invariant:
     `expect(weekEventRegistry).toBe(VIEW_INTERACTION_MODULES.week.registry)` and the `day`
     equivalent, importing the aliases from
     `@web/views/Week/interaction/registry/week-event.registry` and the Day counterpart. That is
     the identity that would break if either registry module reverted to
     `createViewInteractionRegistry(...)`.
- **Acceptance:**
  - Suite passes; assertion 2 manually verified to fail if `week-event.registry.ts:8` is
    temporarily changed back to `createViewInteractionRegistry("week")` (revert after checking).
  - `cd packages/web && bun test src/grid/interaction src/views/Week/interaction/targeting src/views/Day/interaction/targeting`
    still green.

### 6. Cover the FR-7 all-day *resize* asymmetry in the divergence suite

- `artifact_path`: `packages/web/src/grid/interaction/adapter/view-interaction.divergence.test.ts`
- `task_type`: `test_add`
- **Instruction:** the suite asserts two of the four FR-7 divergences side by side (all-day drag,
  timed drag). The third — Day's all-day **resize** rewriting the event to `visibleDate` while
  Day's all-day **drag** deliberately keeps the event's own dates — is the most surprising of the
  set, is called out at length in `commit/all-day.commit.ts:16-22`, and is currently asserted only
  unilaterally at `day-interaction.interactions.test.ts:185-202` with no Week counterpart beside
  it. Add a `describe("Week vs Day — all-day resize semantics")` block pairing
  `commitAllDayResizeInteraction` from
  `@web/views/Day/interaction/adapter/interactions/all-day.resize` against Week's
  `@web/views/Week/interaction/adapter/interactions/all-day.resize`, using the same three-day
  `allDayEvent` fixture already declared at lines 28-35, and assert the truncation explicitly
  (Day collapses the span to the visible date; Week does not). Follow the file's existing
  convention of hard-coded expected dates rather than values derived from the units under test.
- **Acceptance:**
  - New block passes and fails if Day's resize path is "tidied" to preserve the event's own dates.
  - No change to the existing four tests in the file.

---

## Non-blocking observations

1. **`ViewInteractionOwnershipReasons` widens two string literals to `string`.**
   `view-interaction.core.ts:41-44` types the reasons as `string`. Week's four literals are
   asserted (`week-interaction.adapter.test.ts:16`,
   `week-interaction.timed-drag.test.ts:314,327,340`,
   `week-interaction.all-day-drag.test.ts:281,294,307`), but Day's `"ineligible-day-pointer"` and
   `"no-day-interaction-target"` (`day-interaction.adapter.ts:74-77`) are asserted **nowhere** in
   `packages/web`. A copy-paste of Week's strings into Day's config would compile and pass the
   full suite. Impact is diagnostic-only: `reason` is never read in production —
   `PointerCaptureBoundary.tsx:72-80` reads only `ownership.shouldOwn`. Consider a union type,
   or an assertion in Day's adapter suite.

2. **`getVisibleDate()` moved earlier within Day's `updateVisual`, benignly.**
   Original `day.orig.ts:374-384` and `401-411`: `applySmartScroll` → `updateTimedResizeVisual` →
   `getVisibleDate()`. New `day-interaction.adapter.ts:224-232` and `249-257`: `applySmartScroll`
   → `getVisibleDate()` (evaluated while building the argument object) → the visual math inside
   `updateTimedResizeInteractionVisual`. Call **count** is unchanged (once per `updateVisual`), and
   the intervening `updateTimedResizeVisual` / `updateTimedDragVisual` are pure math over the
   layout cache with no path to the visible-date store, so the reordering is unobservable. Flagged
   only because it is exactly the class of change the brief asked me to look for; I checked it and
   it is clean.

3. **`Object.freeze` at `view-interaction.module.ts:66` is shallow.**
   `VIEW_INTERACTION_MODULES.week` itself is a mutable object, so
   `VIEW_INTERACTION_MODULES.week.registry = somethingElse` would succeed at runtime (TS blocks it
   at compile time). The doc block at lines 44-52 leans on the freeze as a structural guarantee.
   It is a real guarantee against rebinding the two top-level keys, which is the likelier mistake,
   so this is a comment-precision nit rather than a defect.

4. **Import-time side effect broadened.** Importing any one of the four view registry/targeting
   modules now instantiates **both** view registries, where previously each file created only its
   own. Both are empty `Map`s (`event.registry.ts:27`) so the cost is nil, but it is a change in
   module-init behaviour that no test observes.

5. **`view-interaction.targets.test.ts` is not over-mocked** — contrary to the brief's suspicion.
   It drives the real `createEventRegistry` against real DOM nodes
   (`view-interaction.targets.test.ts:33-39, 64-68`); the only stub is
   `{ target } as unknown as PointerEvent` at line 54, and `event.target` is the only property the
   resolver reads. The one gap: the doc at `view-interaction.targets.ts:31-34` calls the four-step
   resolution order a behavioural contract, but the suite only proves *resize-before-drag*
   (lines 82-87, 179-181), never *all-day-resize before timed-resize*. Low value to add, since a
   card is registered as exactly one `eventType`.

---

## What I verified and how

**Checked against source, line by line:**

- **Behaviour drift, Week.** Extracted `git show HEAD:.../week-interaction.adapter.ts` (795 LOC)
  and read it against the new 469-LOC file in full. All seven pointer methods, `createVisual`,
  `commit`, `cancel`, `updateVisual`'s four branches, `updateEdgeNavigation`,
  `rebuildLayoutIfNeeded`, `isPointerOverAllDayRow`, `getDraftEventSize` and
  `buildWeekLayoutCacheForTarget` are behaviourally identical, including the order of
  `clearInteractionState` / `resetWeekInteractionEdgeNavigationState` /
  `setWeekInteractionMotionActive(false)` in both `cancel` and `commit`.
  **No drift found.**
- **The `getScrollTop() === null` guard (brief item 2).** Equivalent. `layoutState`'s `scrollTop`
  (`view-interaction.layout-state.ts:24, 28-29, 43`) is written at exactly the two points the old
  local was (`setLayout` seeds from `smartScroll?.initialScrollTop ?? null`; `applySmartScroll`
  overwrites from the frame result) and cleared at the one point (`clear`). The Week
  `updateVisual` snapshot at line 232 is taken after `rebuildLayoutIfNeeded` and before every
  branch; the only intervening call, `updateEdgeNavigation`, never calls `setLayout`, so the
  snapshot cannot go stale mid-invocation.
- **`runtime()` call frequency (brief item 1).** Old Week called `runtime()` once inside the click
  branch (`week.orig.ts:208`) and once after it (`:219`); the new core hoists a single call to
  `view-interaction.core.ts:149`. One call per path, before and after. Old Day already had it
  hoisted (`day.orig.ts:163`).
- **Behaviour drift, Day.** Same treatment against the 607-LOC original. `createVisual`'s
  column resolution moved verbatim into `resolveDayColumns` (`geometry/day-columns.ts:21-38` vs
  `day.orig.ts:245-263`), including the `Math.max(0, eventColumnIndex)` clamp and the
  `eventColumnIndex >= 0` fallback; argument-evaluation order preserves
  `getVisibleDate()`-before-`getColumnKeys()`. `updateVisual`'s guard is still the
  `!layout`-only check (no `scrollTop === null`), correctly diverging from Week.
  **No drift found**, modulo observation 2.
- **AC-6, Day has gained nothing Week-only.** `day-interaction.adapter.ts:69-80` passes neither
  `onPointerDownAccepted` nor `onPointerClickSettled`; the core guards both with `?.` at
  `view-interaction.core.ts:125` and `:158`. `DayInteractionAdapter = ViewInteractionAdapterBase`
  (`day-interaction.adapter.types.ts:75`) and the base
  (`view-interaction.types.ts:145-155`) has no `rebuildLayoutAfterNavigation`. Day imports nothing
  from `state/motion.state`, `state/edge-navigation.state`, `edge-navigation.ts`, or
  `math/cross-row.drag` — grepped. Nothing in the shared core imports Week's state modules.
  **Holds.**
- **FR-7 divergences.** Week columns→dates (`week-layout.cache.ts` `visibleDays`) vs Day
  columns→`calendarId` (`day-columns.ts:30-33`) confirmed; Day's all-day drag own-dates semantics
  at `interactions/all-day.drag.ts:71-82`; Day's all-day resize visibleDate rewrite at
  `interactions/all-day.resize.ts:64-65`; the `"dayDate" in visual` guard preserved verbatim at
  `commit/all-day.commit.ts:9-12`. Day pins both all-day resize day indices to `0`
  (`all-day.resize.ts:33-40`) where Week resolves a visible range. **All intact.**
- **FR-2 registry singleton.** `buildViewInteractionModule` is module-private and called exactly
  twice (`view-interaction.module.ts:66-69`). `createRegistry` returns a bare `ViewEventRegistry`
  (`view-event-registry.ts:78-83`) with no targeting attached, so it cannot mint a second module.
  Both view shells alias the same instance (`week-event.registry.ts:8,22`,
  `day-event.registry.ts:8`). **Holds.** The invariant is genuinely covered end to end — not by
  the new module suite, but by the pre-existing `week-event.targeting.test.ts:1-13,82` and
  `day-event.targeting.test.ts:1-12`, which register through the exported `*EventRegistry` alias
  and resolve through the targeting helpers now bound to `VIEW_INTERACTION_MODULES`. That is
  worth stating because it is *not* what packet 5's assertion 2 duplicates — packet 5 makes the
  identity explicit and fast-failing rather than incidental.
- **No type widening from the target-type merge.** `DayInteractionTarget` and
  `WeekInteractionTarget` are now the same type. I checked this is not a regression: both views'
  `*RegisteredEventTarget` were already `ViewRegisteredEventTarget` aliases before this run
  (`week-event.registry.ts:14`, `day-event.registry.ts` equivalent), so the two target unions were
  already structurally identical and mutually assignable.
- **Dead code.** `bun run knip` (2 hits, both new — B-1) plus `grep -rn` for every export
  introduced in the eight new non-test files.
- **Lint/format.** `bunx biome check` per-file across the changed set and repo-wide with
  `--max-diagnostics=200`, and per-file severity confirmation on every pre-existing diagnostic to
  establish that the six errors are attributable to this run and not to `main`.
- **Tests are green.** Ran
  `cd packages/web && bun test src/grid/interaction/adapter src/grid/interaction/view-interaction.module.test.ts src/views/Day/interaction/adapter src/views/Week/interaction/adapter`
  → 98 pass / 0 fail / 272 expect calls / 12 files.
- **Byte-identical claim.** Confirmed indirectly: `git status --porcelain` lists none of Week's six
  adapter suites nor `day-interaction.adapter.test.ts` as modified. Likewise **0 call-site edits** —
  neither coordinator, nor any file outside `**/interaction/**`, appears in the working tree.
- **The smart-scroll dead-band arithmetic in M-1** — derived from
  `layout.cache.ts:88,105-115`, `smart-scroll.ts:60-73`, `interaction.constants.ts:19`,
  `adapter.helpers.ts:11,78-99` and the harness's own `setRect` at
  `week-interaction.idempotence.test.ts:114`. Not measured by instrumenting a run — I was
  instructed not to modify source, and the arithmetic is closed-form.

**Taken on trust, not re-verified:**

- `bun run type-check` exit 0 across all three tsconfigs. I did not run it; the reported blockers
  are lint/knip/test-design and none of the suggested fixes should affect typing, but packets 1
  and 4 delete imports and their acceptance criteria re-run it.
- The full `bun test:web` figures (2334/307) and the seam-probe figures (195/29). I ran only the
  12-file targeted subset above, per the instruction not to re-run the 80s suite.
- The e2e attribute contract asserted at `view-interaction.module.test.ts:44-62`. I confirmed the
  four literal strings match `viewInteractionAttributeNames` (`view-event-registry.ts:26-29`), but
  I did not open the two Playwright specs the comment names, and `bun test:web` does not run them.
- `.cursor/rules/web-styles.mdc` — I read `web-testing.mdc` (which grounds packet 5's teardown
  point) but not `web-styles.mdc`; nothing in the changed set touches styling or components.
