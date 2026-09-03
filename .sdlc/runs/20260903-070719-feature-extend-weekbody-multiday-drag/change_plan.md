# Change Plan — feature-extend — Multi-day drag-to-select in the all-day row

Run: `20260903-070719-feature-extend-weekbody-multiday-drag`
Intent: `feature-extend` · delta document · Policy `opus-plus-flash-v37`
Input: `.sdlc/runs/20260903-070719-feature-extend-weekbody-multiday-drag/requirements.md`

---

## Summary

`useAllDayDraftCreation` gains a press-drag-release **escalation** layered on top of its existing
press behaviour: mousedown still emits the one-day draft synchronously and unchanged, and a
horizontal drag past a threshold then previews and commits a multi-day span. The day-range
arithmetic moves into a new pure module `grid/interaction/math/all-day.create.ts` so
direction-agnosticism (AC-4) and window clamping (AC-5) are unit-provable without rendering a grid.
Week opts in; Day does not.

**Not changing:** rendering/layout (multi-day spans already draw), the timed gesture and its
same-day clamp, `event.position.ts`, `grid-event-draft.adapter.ts`, `interaction.pointer.ts`, any
Day-view source file, and the three existing tests in `useAllDayDraftCreation.test.tsx`.

**Recommended file set: 7 files** (1, 2, 3, 4, 5, 6, 11 of the allowlist). Files 7, 8, 9 are
skipped; file 10 is conditional-on-red only. Rationale in §4.

---

## 1. Design decisions

### D-A — The pure math module: signature and semantics

**Choice.** New file `packages/web/src/grid/interaction/math/all-day.create.ts`, exporting three
pure functions and one type. Dates are `YYYY-MM-DD` strings end to end, because that is what
`getStartDate` returns (`AllDayRow.tsx:48-54`, `DayCalendarGrid.tsx:249-250`) and what
`allDayGridSchedule(start, end)` consumes (`grid-event-draft.adapter.ts:202-211`).

```ts
export interface AllDayDayRange {
  /** Inclusive first day, YYYY-MM-DD. */
  start: string;
  /** EXCLUSIVE last day, YYYY-MM-DD — feeds allDayGridSchedule directly. */
  end: string;
}

export interface ResolveAllDayDayRangeInput {
  /** The day the press landed on, YYYY-MM-DD. */
  anchorDate: string;
  /** The day under the pointer right now, YYYY-MM-DD. */
  pointerDate: string;
  /**
   * The rendered window, ascending YYYY-MM-DD. When supplied, both anchor and
   * pointer are clamped into [first, last] before normalisation. Omit to skip
   * clamping.
   */
  visibleDates?: readonly string[];
}

export const resolveAllDayDayRange = (
  input: ResolveAllDayDayRangeInput,
): AllDayDayRange;

export const isSameAllDayDayRange = (
  a: AllDayDayRange,
  b: AllDayDayRange,
): boolean;

/** X-axis-only move threshold test. See D-F. */
export const hasExceededAllDayDragThreshold = (
  currentX: number,
  initialX: number,
  thresholdPx: number,
): boolean;
```

Semantics of `resolveAllDayDayRange`:

1. If `visibleDates` is non-empty, clamp `anchorDate` and `pointerDate` into
   `[visibleDates[0], visibleDates[visibleDates.length - 1]]`.
2. Normalise: `first = min(clampedAnchor, clampedPointer)`, `last = max(...)`. Comparison is
   plain **lexicographic string comparison** — `YYYY-MM-DD` is lexicographically ordered, so this is
   exact, allocation-free, and needs no dayjs parse. Direction-agnosticism (AC-4) is then structural,
   not conditional.
3. `end = dayjs(last).add(1, "day").format(YEAR_MONTH_DAY_FORMAT)` — byte-identical arithmetic to
   the line it replaces (`useAllDayDraftCreation.ts:49-51`), so `2026-05-20 → 2026-05-21` is
   reproduced exactly and AC-3's asserted values cannot drift.
4. **The exclusive end is never clamped into the window.** On the last visible column the correct
   end is `lastVisible + 1`, which is legitimately one day past the window; clamping it would
   collapse the span to zero length. `getVisibleAllDaySpan` (`event.position.ts:146-171`) already
   converts exclusive→inclusive and clamps for rendering. This is a named unit test.
5. Degenerate input (empty `visibleDates`, or an unparseable date) falls back to the one-day range
   at `anchorDate`. Never throws — this runs inside a mousemove handler.

**Resolution of the clamp tension (F7).** The module takes an explicit window **and clamps
defensively**, and — under the recommended D-1 option — the hook actually passes a real window
rather than leaving the parameter dead.

*Rationale.* R-5 requires the clamp to be unit-tested against out-of-window pointer positions, which
is only possible if the clamp lives in the pure module. Making the parameter optional-but-never-passed
would leave production code whose only exercise is its own test — the exact shape a Gate 3 reviewer
rejects. Instead the D-1 opt-in (§2) carries the window: Week already has `weekProps.component.weekDays`
in scope at `AllDayRow.tsx:133`, so supplying it costs one `.map`. The result is that AC-5 is enforced
twice — inherited from `getVisibleDateIndexByX`'s clamp (`useGridCoordinates.ts:33`) and re-asserted in
the math — and is directly unit-testable.

*Rejected alternative.* No window parameter; rely purely on F7's inherited clamp. Leaner and honest
about where the clamp really lives, but AC-5 then has no unit-level proof at all — it would be
provable only by rendering a grid with real `colWidths`, which is precisely the expensive integration
surface R-8 exists to avoid. Rejected. (Under D-1 option (a) this alternative is forced back on us;
see the per-option delta in §2.)

### D-B — Control flow of the modified hook

Full walkthrough in §5. The decision recorded here is the **shape**: the press path is untouched and
runs to completion *before* any gesture is armed; the gesture is a strictly additive escalation whose
every exit path is a no-op unless `hasMoved` became true.

*Rejected alternative.* Port `useTimedDraftCreation`'s shape directly — commit only on `mouseup`.
This is what F4/§2-of-requirements forbids: the existing AC-3 test fires `mouseDown` with no
`mouseUp` anywhere in the file and asserts `onCreateGridDraft` was called once. A commit-on-release
design leaves it called zero times. Rejected on hard evidence.

### D-C — Which store action carries the live preview

**Choice.** `draftActions.setGridDraft(...)` **only**. The gesture never calls
`draftActions.startGridDraft`.

*Rationale.* This is the load-bearing difference from the timed template. In
`useTimedDraftCreation.ts:149-156` the gesture owns the whole draft, so the first preview move
*starts* it (`startGridDraft({ activity: "creating" })`) and later moves *set* it. Here the press has
already put a draft in the store through the consumer's `onCreateGridDraft`:

- Week — `AllDayRow.tsx:55-57`: `startGridDraft({ activity: "gridClick", draft })`
- Day — `DayCalendarGrid.tsx:191-194`: `startGridDraft({ activity: "gridClick", draft })` **plus**
  `setFormOpen(true)`

Calling `startGridDraft` again mid-drag would rewrite `activity` to `"creating"` and hard-reset
`isFormOpen: false` (`draft.store.ts:92`), yanking the form shut under the user. `setGridDraft`
(`draft.store.ts:104-127`) deliberately carries `activity` and `isFormOpen` through untouched and
reuses the `status` object when nothing changed — its doc comment says it exists for exactly this
per-mousemove case.

**Resulting sequence for a real Week drag:**

| # | Moment | Call | Store effect |
|---|---|---|---|
| 1 | mousedown | consumer `onCreateGridDraft(pressDraft)` → `startGridDraft({activity:"gridClick"})` | `gridDraft` = one-day, `isDrafting: true` |
| 2 | mousemove past threshold, new day | `setGridDraft(replaceGridDraftSchedule(pressDraft, allDayGridSchedule(...)))` | `gridDraft` schedule swapped; `activity`/`isFormOpen` preserved; same `clientId` |
| 3 | each further move landing on a new day | as #2 | as #2 |
| 4 | mouseup after drag | consumer `onCreateGridDraft(finalDraft)` → `startGridDraft({activity:"gridClick"})` again | `gridDraft` = span; this is the accepted second commit (F5) |

**Consequence, stated plainly.** Because the press already opened the draft, the Week form is live
during the drag and its dates update as the pointer moves. That is a behaviour change visible to the
user and it is accepted: suppressing it would require touching Week's draft effects, which are not
on the allowlist. It is documented in file 11.

**Why the double commit is harmless.** Every preview and the final commit are built with
`replaceGridDraftSchedule(pressDraft, ...)` (`grid-event-draft.adapter.ts:160-169`), so the draft's
`clientId` and `calendarId` are identical to the press draft's. The second `startGridDraft` replaces
the same draft rather than creating a sibling — no duplicate event, no orphan.

*Rejected alternative.* `startGridDraft({ activity: "creating" })` on the first move, mirroring the
timed hook. Rejected: closes the form mid-gesture and reclassifies an activity the press already
owns.

### D-D — Cancel semantics on blur

**Choice.** Blur mid-drag **reverts to the one-day press draft**; it does not discard.
Implementation: `cancel({ revert: true })` calls `draftActions.setGridDraft(pressDraft)` when
`hasMoved` is true, and does nothing at all when `hasMoved` is false. Unmount uses
`cancel({ revert: false })` — listeners removed, store untouched.

*Rationale and the tradeoff, named.* The timed gesture calls `draftActions.discard()` on blur
(`useTimedDraftCreation.ts:178-180`) and that is correct *there* because the gesture created the
draft; cancelling the gesture and deleting the draft are the same act. Here they are not. The press
is an independently meaningful, already-completed user action — in the Day view it has already
opened a form the user may be typing into (`DayCalendarGrid.tsx:193`). Discarding on window blur
would mean an alt-tab mid-gesture silently destroys a draft and any typed input. Reverting rolls
back exactly the state the cancelled gesture authored and nothing else.

The tradeoff: a user who alt-tabs mid-drag returns to a one-day draft that looks like it "forgot"
the drag, and must re-drag. That is a smaller, fully recoverable surprise than losing a draft the
user explicitly created. Data loss loses to a redo.

*Rejected alternative.* `discard()` on blur, matching the timed hook byte-for-byte. Rejected: it
deletes state the gesture did not create. Symmetry with the timed hook is not worth a data-loss path.

Note that the "press while a draft exists" branch (`useAllDayDraftCreation.ts:43-46`) returns before
arming, so `cancel` can only ever see a draft this gesture's own press created. There is no case
where revert clobbers someone else's draft.

### D-E — The move threshold

**Choice.** Add a new constant to `interaction.constants.ts`:

```ts
export const ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8;
```

and extend the file's doc comment with a paragraph explaining why it is a third value.

*Rationale.* The file's existing comment (`interaction.constants.ts:6-8`) says the values "measure
different products of the gesture" and must not be unified. Honouring that reasoning *requires* a
third constant, not a reuse:

- `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4` measures a **vertical duration** drag against a 15-minute
  row. At 4px the produced draft is still visually the default 30 minutes, so a jitter escalation is
  invisible and free.
- `INTERACTION_MOVE_THRESHOLD_PX = 25` gates **moving an existing card** — a different product again,
  and far too coarse here: 25px can already be a third of a narrow day column.
- The all-day threshold measures **horizontal day-column intent** across columns roughly 100–200px
  wide. A jitter escalation is *not* free here: it flips `hasMoved`, which produces a second
  `onCreateGridDraft` commit at release (F5) and a form whose dates visibly re-seed on what the user
  meant as a click.

8px sits above ordinary click jitter and hand tremor while remaining far below half a column, so the
first genuine cross-column movement always registers.

*Rejected alternative.* Reuse `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (zero new surface, cheapest).
Rejected: 4px escalates on tremor, and unlike the timed case the escalation is user-visible.

### D-F — Which axis the threshold measures

**Choice.** **X axis only.** The check is `hasExceededAllDayDragThreshold(currentX, initialX, px)`
from the new math module (D-A), not `hasExceededInteractionMoveThreshold`.

*Rationale.* `hasExceededInteractionMoveThreshold` (`interaction.pointer.ts:27-33`) ORs both axes.
In the all-day row, vertical movement carries **zero** information — the row is a single band and y
is discarded entirely by `YEAR_MONTH_DAY_FORMAT` in `getStartDate`. Using the OR form means a purely
vertical twitch of 9px — extremely common, since the pointer naturally drifts down toward the timed
grid — sets `hasMoved` and triggers a spurious second commit with an unchanged one-day range. That
is a duplicate commit for zero user intent.

**Hard constraint on where the helper lives.** `interaction.pointer.ts` is **not on the allowlist**
for this run, so an x-only variant cannot be added next to `hasExceededInteractionMoveThreshold`. It
goes in `all-day.create.ts` (allowlist #3), which has the side benefit of a unit test. A follow-up
ticket should propose relocating it to `interaction.pointer.ts` as
`hasExceededInteractionMoveThresholdX` once that file is writable.

Related: the resolved pointer date uses the **press `clientY`**, not the live `clientY`
(`getStartDate(mouseEvent.clientX, pointerStart.y)`). In Week `getDateStrByXY` uses y only for the
minute component, which the date format discards, so this is behaviour-neutral today — but pinning y
makes the horizontality explicit and immunises the gesture against a future y-sensitive `getStartDate`.

---

## 2. D-1 — Gate 2 decision: how the Day view is protected

`useAllDayDraftCreation` is shared by Week (`AllDayRow.tsx:58-61`) and Day
(`DayCalendarGrid.tsx:331-334`), and in Day the columns are calendars on one date.

**A finding the requirements did not surface, and it matters for this vote.** F6's structural
immunity protects the **dates**, not the **call count**. Under option (a), a horizontal drag in the
Day view still crosses the 8px threshold, still sets `hasMoved`, and still fires the second commit at
release — into Day's `openGridDraftForm`, which calls `startGridDraft` (resetting `isFormOpen` to
`false`, `draft.store.ts:92`) and then `setFormOpen(true)`. Net effect in Day: a form flicker and
potentially lost keystrokes on a drag that produces no date change at all. F6 does not cover this.

### Option (a) — rely on the structural immunity of F6. No API change.

Cheapest, zero new surface. Both views get the gesture; Day's dates collapse because
`useDayCalendarColumns.ts:34-38` stamps `date: dateInView` on every column.

- **Risks:** the protection is invisible, incidental, and undocumented; the day Day gains real
  multi-date columns the failure is silent and writes wrong user schedules. Plus the form-flicker
  above, which is a regression *today*, not hypothetical.
- **File-plan delta:** file 6 (`AllDayRow.tsx`) is **not touched** — 6 files instead of 7. The math
  module's `visibleDates` stays optional and **no caller ever passes it**, so AC-5 has no runtime
  enforcement and is provable at unit level only (the D-A rejected alternative is forced). The AC-6
  test becomes "constant-date `getStartDate` yields a one-day span" only; the opt-out test does not
  exist because there is nothing to opt out of.

### Option (b) — explicit opt-in on the hook, defaulting to off.

Concrete shape recommended for this repo — an **option object**, not a bare boolean:

```ts
interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  /** Opt in to multi-day drag. Omit for press-only behaviour (Day view). */
  multiDayDrag?: {
    /** Rendered window, ascending YYYY-MM-DD. Clamp domain for the day range. */
    getVisibleDates: () => readonly string[];
  };
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}
```

Presence of `multiDayDrag` *is* the opt-in, and it simultaneously supplies the clamp window D-A
needs — one option instead of a boolean plus a dead parameter. Week passes it from
`weekProps.component.weekDays`; Day passes nothing and is provably unchanged **on every path**, not
just the current one, including the form-flicker path (a) leaves open.

- **File-plan delta:** files 1, 2, 3, 4, 5, 6, 11 — the recommended 7.

### Option (c) — (b) plus a pinning regression test. **← RECOMMENDATION**

Everything in (b), plus two tests added to `useAllDayDraftCreation.test.tsx` that turn F6's incidental
immunity into an enforced contract:

1. **Opt-out pin** — a harness with no `multiDayDrag`: press, 300px move, release ⇒ `onCreateGridDraft`
   called exactly once, store draft still one-day. This is literally the Day-view wiring.
2. **Constant-column pin** — a harness *with* `multiDayDrag` but `getStartDate: () => "2026-05-20"`
   and `getVisibleDates: () => ["2026-05-20"]`, i.e. Day's column model: a 300px drag still yields
   `start 2026-05-20 / end 2026-05-21`, and the store never holds a multi-day span.

- **File-plan delta from (b):** none — same 7 files, two extra `it()` blocks in file 2. The marginal
  cost over (b) is a few dozen lines in a file already being edited, and zero extra packets.
- **Honest limitation to record at Gate 2:** a *true* pin of Day's constant-date property belongs
  next to `useDayCalendarColumns.ts:34-38`, and no Day test file is on this run's allowlist. Test 2
  pins the hook-and-math contract, not Day's column construction. Follow-up ticket: add the pin in
  Day's own test file so a future `date: perColumnDate` change fails there.

**Recommendation: (c)**, carried from the requirements and reinforced by the call-count finding
above. (a)'s safety is real today, undocumented, unenforced, and — as shown — incomplete. The
marginal cost of (b) is one optional option and one early return; (c) adds two test blocks.

---

## 3. Files added

| # | Path | Purpose |
|---|---|---|
| 3 | `packages/web/src/grid/interaction/math/all-day.create.ts` | Pure day-range math: `resolveAllDayDayRange`, `isSameAllDayDayRange`, `hasExceededAllDayDragThreshold`, `AllDayDayRange`. No React, no store, no DOM. |
| 4 | `packages/web/src/grid/interaction/math/all-day.create.test.ts` | Unit proof of AC-4 and AC-5 plus the exclusive-end and threshold guards. |

## 4. Files edited

| # | Path | Tool | Shape of change | ACs served |
|---|---|---|---|---|
| 1 | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | `existing_file_edit` | Add optional `multiDayDrag` option, a `gestureRef` + unmount effect, and the escalation gesture. Press path (lines 36-64) preserved verbatim except that the `+1 day` arithmetic is delegated to `resolveAllDayDayRange`. | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 |
| 2 | `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | `patch_apply` | **Append only.** Add a `renderDragHarness` with an x→date map, then ~8 new `it()` blocks. Existing 3 tests and the existing `renderHarness` are byte-identical. | AC-1..AC-6 |
| 5 | `packages/web/src/interaction/interaction.constants.ts` | `patch_apply` | Add `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8` and a third doc-comment paragraph per D-E. | AC-1 |
| 6 | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | `patch_apply` | Pass `multiDayDrag: { getVisibleDates }` into `useAllDayDraftCreation` at `:58-61`, sourced from `weekProps.component.weekDays.map((d) => d.format(YEAR_MONTH_DAY_FORMAT))` wrapped in `useCallback`/`useMemo`. ~5 lines. | AC-1, AC-5 |
| 11 | `docs/frontend/week-drag-interaction.md` | `patch_apply` | Append an "All-day drag-to-create" section: the press-then-escalate shape, why the press commit stays, the accepted double commit, the blur-reverts rule, the constants table, and the Day opt-out. | — |

## 5. Files removed

None.

## 6. Files skipped from the allowlist, with reasons

The implementation tier pays a ~11.5k-token identity preamble per packet, so file count is a real
cost. These four allowlisted paths are deliberately **not** touched:

- **#7 `AllDayRow.test.tsx` (new) — SKIP.** `AllDayRow.tsx`'s change is a five-line prop addition.
  Testing it end-to-end requires standing up `measurements`, a query client, and full `weekProps`
  just to fire a synthetic drag whose date math is already fully covered at the hook and math levels.
  The only genuinely new assertion would be "Week passes a window", which is a one-line read of the
  source. Poor value per packet. If a Gate 3 reviewer wants it, adding it later is cheap and
  independent.
- **#8 / #9 `useAllDayGridDraftCreation.ts` + test (new) — SKIP.** The wrapper would contain exactly
  one statement: mapping `weekDays` to `string[]` and forwarding to the hook. `AllDayRow.tsx` already
  builds `getAllDayDraftStartDate` inline at `:48-54` and already has `weekProps` in scope, so the
  wrapper adds a file, a test file, an import hop, and two packets of preamble for zero behaviour.
  The symmetry argument with `useTimedGridDraftCreation.ts` is aesthetic — that wrapper exists
  because it carries real adaptation logic; this one would not. **Skip.**
- **#10 `MainGrid.test.tsx` — CONDITIONAL, do not open pre-emptively.** Prior arms needed harness
  touch-ups because they changed *rendered props*. This run does not: the new hook option is optional,
  only `AllDayRow` passes it, no component gains a required prop, and press behaviour is unchanged.
  Open this file **only** if `bun run test:web` shows a failure in it.

### Recommended packet plan

Two packets, dependency-linear:

- **P1 — pure layer:** files 3, 4, 5. No React, no imports from the hook. Independently verifiable.
- **P2 — gesture + wiring + docs:** files 1, 2, 6, 11. Depends on P1's exported signatures.

If the tier prefers a three-way split, `{3,4,5}` / `{1,2}` / `{6,11}` is the only other valid cut —
but it costs a third preamble for no isolation benefit. Two packets is the recommendation.

---

## 7. Data-layer changes

None. No schema, no migration, no persisted-shape change. `GridScheduleDraft` with `kind: "allDay"`
already carries arbitrary `start`/`end` Dates (`grid-event-draft.adapter.ts:202-211`); this run only
puts a wider range into the existing shape.

## 8. API contract changes

No HTTP API changes. The one **internal contract** change:

`UseAllDayDraftCreationOptions` gains an optional `multiDayDrag?: { getVisibleDates: () => readonly string[] }`.
Additive and optional — every existing call site compiles unchanged, and the two call sites in the
repo (`AllDayRow.tsx:58`, `DayCalendarGrid.tsx:331`) keep working with zero edits. Only `AllDayRow.tsx`
is edited, to opt in.

The hook's return value is unchanged: the same
`(event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void`. It stays a fresh
arrow per render (no `useCallback`) exactly as today, so Day's `useCallback([..., onAllDayMouseDown])`
at `DayCalendarGrid.tsx:367-372` behaves identically.

## 9. Framework-owned wiring

None. React hooks, no module registry, no route table, no DI container. The only wiring edit is the
prop pass-through in `AllDayRow.tsx` (file 6), already listed in §4.

## 10. Config schema — env variables added

None. This change reads no environment variable, feature flag, or runtime config. The multi-day
behaviour is gated by a compile-time call-site option (D-1 option b/c), not a flag.

---

## 11. Control-flow walkthrough of the modified hook (D-B)

Precise enough to implement from. Names below are the ones to use.

### Hook body

```
useAllDayDraftCreation({ getStartDate, multiDayDrag, onCreateDraft, onCreateGridDraft })
  isDrafting = useDraftStore(selectIsDrafting)          // unchanged, render-time snapshot
  gestureRef = useRef<{ cancel(opts) => void } | null>(null)
  useEffect(() => () => gestureRef.current?.cancel({ revert: false }), [])
  return (event, calendarId = null) => { ...handler below... }
```

### Handler — mousedown

1. `if (isRightClick(event)) return;` — **unchanged, and still before `preventDefault`**, so the
   right-click test's `onParentMouseDown` still fires once (`useAllDayDraftCreation.test.tsx:84-94`).
2. `gestureRef.current?.cancel({ revert: false });` — a new press supersedes any stale gesture. Placed
   after the right-click guard so a right-click never disturbs a live gesture.
3. `event.preventDefault(); event.stopPropagation();` — unchanged lines, so `fireEvent.mouseDown`
   still returns `false` (`:68`).
4. `if (isDrafting) { draftActions.discard(); return; }` — unchanged (test 3 at `:96-109`).
5. `const anchorDate = getStartDate(event.clientX, event.clientY);`
6. `const visibleDates = multiDayDrag?.getVisibleDates();`
7. `const pressRange = resolveAllDayDayRange({ anchorDate, pointerDate: anchorDate, visibleDates });`
8. `const pressDraft = createGridEventDraft(allDayGridSchedule(pressRange.start, pressRange.end), undefined, calendarId);`
   — the `undefined` second argument is preserved verbatim so `clientId` generation is unchanged.
9. **Emit, synchronously, exactly as today:**
   `if (onCreateGridDraft) { onCreateGridDraft(pressDraft); } else { onCreateDraft?.(gridEventDraftToSchemaEvent(pressDraft)); }`
   Note the restructure: today's code `return`s inside the `if`; now it falls through to step 10, so
   the branch becomes if/else. Observable behaviour identical.
10. `if (!multiDayDrag) return;` — Day's exit. **AC-3's harness passes no `multiDayDrag`, so the
    existing tests exercise today's path plus one early return.**
11. Eligibility for escalation only:
    ```
    if (!isEligibleInteractionPointerDown({
          altKey: event.altKey, button: event.button, ctrlKey: event.ctrlKey,
          isPrimary: true, metaKey: event.metaKey, shiftKey: event.shiftKey })) return;
    ```
    Deliberately applied **after** the press commit, not before it: a modified click (shift/alt/meta)
    keeps today's press-creates-a-draft behaviour and simply gets no multi-day gesture. Gating the
    *press* on eligibility would change existing modified-click behaviour, which is out of scope.
12. Arm: capture `pointerStart = { x: event.clientX, y: event.clientY }`; init gesture-local
    `hasMoved = false`, `isFinished = false`, `isCancelled = false`, `lastRange = pressRange`;
    add `mousemove` (capture), `mouseup` (capture), `blur` listeners on `window`; set
    `gestureRef.current = { cancel }`.

### Gesture-local helpers

```
resolveRangeForPointer(mouseEvent) =>
  resolveAllDayDayRange({
    anchorDate,
    pointerDate: getStartDate(mouseEvent.clientX, pointerStart.y),  // press y — see D-F
    visibleDates,
  })

draftForRange(range) =>
  replaceGridDraftSchedule(pressDraft, allDayGridSchedule(range.start, range.end))

cleanup() =>
  removeEventListener x3 with matching capture flags; gestureRef.current = null
```

### mousemove

1. `if (isFinished || isCancelled) return;`
2. `if (mouseEvent.buttons !== 1) { finish(mouseEvent); return; }` — the button was released outside
   the window; mirrors `useTimedDraftCreation.ts:188-193`. **Implementation trap:** `fireEvent.mouseMove`
   defaults `buttons` to `0`, so every test mousemove must pass `{ buttons: 1 }` or the gesture
   finishes on the first move.
3. `if (!hasMoved && !hasExceededAllDayDragThreshold(mouseEvent.clientX, pointerStart.x, ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX)) return;`
4. `hasMoved = true;`
5. `const nextRange = resolveRangeForPointer(mouseEvent);`
6. `if (isSameAllDayDayRange(nextRange, lastRange)) return;` — dedup: no store write while the pointer
   moves within one column. Keeps the mousemove path allocation-light and avoids re-render churn.
7. `lastRange = nextRange;`
8. `draftActions.setGridDraft(draftForRange(nextRange));` — D-C: `setGridDraft` only, never
   `startGridDraft`.

### mouseup

`handleMouseUp(mouseEvent) => finish(mouseEvent)`

```
finish(mouseEvent):
  if (isFinished || isCancelled) return
  isFinished = true
  cleanup()
  if (!hasMoved) return                    // <-- THE AC-3 GUARD: a plain click emits NOTHING extra
  mouseEvent.preventDefault()
  mouseEvent.stopPropagation()
  const finalRange = resolveRangeForPointer(mouseEvent)
  const finalDraft = draftForRange(finalRange)
  if (onCreateGridDraft) onCreateGridDraft(finalDraft)
  else onCreateDraft?.(gridEventDraftToSchemaEvent(finalDraft))
```

Note that `preventDefault`/`stopPropagation` run **only** when `hasMoved`. A no-drag mouseup is left
completely untouched — today the hook does not listen to `mouseup` at all, and swallowing it could
break unrelated click handling.

### blur

`handleWindowBlur() => cancel({ revert: true })`

### unmount

`cancel({ revert: false })` from the `useEffect` teardown.

```
cancel({ revert }):
  if (isFinished || isCancelled) return
  isCancelled = true
  cleanup()
  if (revert && hasMoved) draftActions.setGridDraft(pressDraft)   // D-D: revert, never discard
```

After `cancel`, a subsequent `mouseup` cannot emit — the listener is already removed, and the
`isCancelled` guard covers a queued event.

---

## 12. Testing surface

### `all-day.create.test.ts` (new, file 4)

| Test | Asserts | AC |
|---|---|---|
| one-day identity | `{anchor:"2026-05-20", pointer:"2026-05-20"}` ⇒ `{start:"2026-05-20", end:"2026-05-21"}` — pins the exact values the untouched AC-3 test asserts | AC-3 |
| left-to-right | `{anchor:"2026-05-20", pointer:"2026-05-22"}` ⇒ `{start:"2026-05-20", end:"2026-05-23"}` | AC-4 |
| right-to-left is identical | `{anchor:"2026-05-22", pointer:"2026-05-20"}` ⇒ the same object as above (`toEqual`) | AC-4 |
| clamp past the right edge | window `2026-05-18..2026-05-24`, pointer `2026-06-02` ⇒ `end "2026-05-25"` | AC-5 |
| clamp past the left edge | same window, pointer `2026-04-01` ⇒ `start "2026-05-18"` | AC-5 |
| out-of-window anchor clamps too | anchor `2026-05-01`, pointer `2026-05-20` ⇒ `start "2026-05-18"` | AC-5 |
| exclusive end is not clamped | window ends `2026-05-24`, anchor = pointer = `2026-05-24` ⇒ `end "2026-05-25"`, **not** `"2026-05-24"` — the zero-length-span guard | AC-5 |
| month boundary | anchor `2026-05-31`, pointer `2026-06-02` ⇒ `{start:"2026-05-31", end:"2026-06-03"}` | AC-4 |
| no window supplied | `visibleDates` omitted / `[]` ⇒ unclamped range, no throw | AC-5 |
| `hasExceededAllDayDragThreshold` | `(120,100,8) → true`, `(104,100,8) → false`, `(92,100,8) → true` (symmetric), `(108,100,8) → false` (strict `>`) | AC-1 |
| `isSameAllDayDayRange` | equal ⇒ true; differing `end` ⇒ false | AC-1 |

### `useAllDayDraftCreation.test.tsx` (modified, file 2 — append only)

New `renderDragHarness({ multiDayDrag = <default>, onCreateGridDraft })` with an x→date map:
`x < 100 → "2026-05-20"`, `100–199 → "2026-05-21"`, `200–299 → "2026-05-22"`, `≥300 → "2026-05-23"`,
and `getVisibleDates: () => ["2026-05-20","2026-05-21","2026-05-22","2026-05-23"]`. Same button DOM
as the existing harness. Add `afterEach(() => draftActions.discard())` **only if** the existing
`afterEach(cleanup)` proves insufficient for store isolation — prefer not to touch the existing line.

| Test | Asserts | AC |
|---|---|---|
| live multi-day preview | press x=50, `mouseMove(window, {clientX:250, buttons:1})` ⇒ store `gridDraft.values.schedule` is `{kind:"allDay", start: 2026-05-20, end: 2026-05-23}` **and** `onCreateGridDraft` still called once (preview does not re-commit) | AC-1 |
| release commits the span | then `mouseUp(window, {clientX:250})` ⇒ `onCreateGridDraft` called **twice**; 2nd arg carries start `2026-05-20` / end `2026-05-23`; 2nd draft's `clientId` **equals** the 1st's (proves replace, not duplicate) | AC-2 |
| direction-agnostic at hook level | press x=250, move to x=50, release ⇒ identical final range to the test above | AC-4 |
| clamp at the window edge | press x=50, move to x=9999, release ⇒ end `2026-05-24` (last visible + 1), never beyond | AC-5 |
| click with no move emits nothing extra | press, `mouseUp` with no `mouseMove` ⇒ `toHaveBeenCalledTimes(1)`; store draft still one-day | AC-3 |
| sub-threshold jitter does not escalate | press x=50, `mouseMove` to x=53 (`buttons:1`), release ⇒ `toHaveBeenCalledTimes(1)` | AC-3 |
| blur reverts, does not discard (D-D) | press x=50, move to x=250, `fireEvent.blur(window)` ⇒ `gridDraft` is **not** null and is back to `2026-05-20 / 2026-05-21`; `onCreateGridDraft` still 1; a following `mouseUp` emits nothing | — |
| unmount mid-gesture is inert | press, then `cleanup()`, then `mouseMove` ⇒ no throw, store unchanged | — |
| **opt-out pin (Day wiring)** | harness with **no** `multiDayDrag`: press x=50, move to x=350, release ⇒ `toHaveBeenCalledTimes(1)`, store draft one-day | AC-6 |
| **constant-column pin (Day model)** | harness with `multiDayDrag` but `getStartDate: () => "2026-05-20"` and `getVisibleDates: () => ["2026-05-20"]`: 300px drag ⇒ any commit still `2026-05-20 / 2026-05-21`; store never holds a multi-day span | AC-6 |

### How AC-3's existing test stays untouched and still passes

Five independent mechanisms, any one of which alone would suffice:

1. The press still emits through `onCreateGridDraft` **synchronously**, at the same point in the
   handler, before any listener is armed. `toHaveBeenCalledTimes(1)` holds at the moment the
   `mouseDown` dispatch returns.
2. `preventDefault()`/`stopPropagation()` remain on the same lines and still precede the emit, so
   `fireEvent.mouseDown(...)` still returns `false` (`:68`) and `onParentMouseDown` is still not
   called (`:69`).
3. The existing `renderHarness` (`:21-55`) passes **no** `multiDayDrag`, so the hook returns at
   step 10 of §11 — the existing tests execute today's code path plus a single early return.
4. The existing file contains **no `mouseUp` anywhere**; and even if one were dispatched, `finish`
   with `hasMoved === false` emits nothing.
5. `afterEach(cleanup)` unmounts the harness, invoking `cancel({ revert: false })`, which touches
   neither the store nor the mock.

The one-day range values are additionally pinned from below by the `all-day.create.test.ts` identity
test, so a refactor of the math cannot silently move `2026-05-21`.

### Existing tests affected

- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — 3 existing tests **must remain
  byte-identical**; only additions below them.
- `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx` — not expected to change
  (see §6); open only if red.
- No other suite touches this hook.

**Gate:** `bun run test:web` — plus the new tests, with **no new failures**.

> **Baseline correction (measured, not assumed).** The stated 2298-pass / 0-fail baseline is wrong.
> The orchestrator ran `bun run test:web` twice on a clean tree with zero source changes, before any
> work in this run, and both runs gave an identical **2297 pass / 1 fail** across 302 files.
>
> The single pre-existing failure is
> `packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/RecurrenceSection.test.tsx`
> › *"keeps the event's own date selectable when the event ends after midnight"* — it times out at
> 5000ms on `Unable to find a label with the text of: /Monday, August 3rd, 2026/`. The date is
> hardcoded (`:176`), the test was written 2026-08-10, and today is 2026-09-03; the datepicker no
> longer renders August. It is **date-rot, entirely unrelated to all-day drag creation**, and its file
> is not on this run's allowlist, so it will not and cannot be fixed here.
>
> **AC-7 is therefore judged against 2297 pass / 1 fail**: success is that same single failure and no
> other, plus the new tests passing.

`bun test` bare is forbidden by `AGENTS.md` (R-11 / AC-7).

---

## 13. Risks and things that could bite

1. **F6's immunity is incidental and stays incidental.** Under option (c) it is pinned at the
   hook/math level, but the actual source of the property — `date: dateInView` at
   `useDayCalendarColumns.ts:34-38` — has no test on this run's allowlist. A future Day change to
   real multi-date columns would pass every test in this run. **Follow-up ticket required.**
2. **F6 does not cover the call count.** See §2: under option (a) a Day drag double-commits into
   `openGridDraftForm`, causing a form flicker via `startGridDraft`'s `isFormOpen: false` reset. This
   is the strongest concrete argument for (b)/(c) and it should be read aloud at Gate 2.
3. **The Week form live-updates its dates during the drag** (D-C consequence). Expected and
   documented, but a reviewer meeting it for the first time will read it as a bug. It is a direct
   consequence of the user-accepted double-commit design (F5), and suppressing it would need Week
   draft-effect changes that are off the allowlist.
4. **`buttons` defaults to 0 in synthetic events.** Every test `mouseMove` needs `{ buttons: 1 }` or
   the gesture finishes on move #1 and the multi-day assertions fail confusingly. Highest-probability
   codegen stumble in this run.
5. **Capture-phase window listeners.** The all-day gesture and the timed gesture both add capture
   `mousemove`/`mouseup` on `window`. They cannot both be live: the all-day press
   `stopPropagation()`s and the two surfaces are disjoint DOM (`ID_GRID_ALLDAY_ROW` section vs the
   main grid). Worth a glance during review, not a redesign.
6. **`interaction.pointer.ts` is not writable**, so the x-only threshold helper lives in the math
   module rather than beside its sibling. Structurally slightly off-home; recorded as a follow-up.
7. **Store isolation across tests.** The existing file relies on `afterEach(cleanup)` only, and the
   new tests write to the draft store on every drag. If leakage appears, add a scoped reset inside
   the new harness rather than modifying the existing `afterEach` line — that line sits in the
   untouchable region for AC-3 hygiene.
8. **Double commit is settled but not free.** Any future telemetry on draft creation will count two
   creates per multi-day drag. No such telemetry exists on this path today; noted so it is not a
   surprise later.

## 14. Off-limits reminders

- `packages/web/src/grid/layout/event.position.ts` and
  `packages/web/src/events/grid-event-draft.adapter.ts` are **read-only** for this run (F2, R-9). The
  plan reads `allDayGridSchedule` and `replaceGridDraftSchedule` and modifies neither.
- `packages/web/src/interaction/interaction.pointer.ts` is **not** on the allowlist — only
  `interaction.constants.ts` is. Do not add the x-only helper there (D-F).
- No file under `views/Day/**` may be written. The Day protection is achieved entirely by *omitting*
  the new option at Day's existing call site — zero edits to `DayCalendarGrid.tsx`.
- `e2e/**`, `packages/backend/**`, `packages/sync/**`, `packages/core/**`, `packages/scripts/**`,
  `package.json`, `bun.lock`, `biome.json` — all off-limits and untouched.
- Eleven allowlisted paths exist; this plan writes seven of them and explains the four it skips.

## 15. Cross-cutting sequencing

1. **P1 first** — `all-day.create.ts` + its test + `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX`. Nothing
   else compiles against a signature that does not exist yet, and this packet is verifiable in
   isolation (`bun run test:web` on the new math file alone).
2. **P2 second** — the hook, its tests, `AllDayRow.tsx`, the doc. Requires P1's exports and the
   final constant name.
3. Within P2, write `useAllDayDraftCreation.ts` **before** `AllDayRow.tsx`: the `multiDayDrag` option
   type must exist before Week can pass it, or TypeScript fails mid-packet.
4. `docs/frontend/week-drag-interaction.md` is written last, after the constant value and option
   name are final, so the doc cannot document a name that changed.

## 16. Explicitly not doing

- No rendering or layout changes; multi-day spans already draw (F2).
- No changes to `useTimedDraftCreation` or its deliberate same-day clamp (R-10).
- No attempt to avoid the double commit — settled by the user (F5).
- No new `WeekBody` component; none exists and none is being created (F1).
- No Day-view source edits; no `DayCalendarGrid.tsx`, no `useDayCalendarColumns.ts`.
- No new helper in `interaction.pointer.ts`; no change to `hasExceededInteractionMoveThreshold`.
- No change to the value or meaning of `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` or
  `INTERACTION_MOVE_THRESHOLD_PX` (D-E).
- No change to press-time behaviour for modified clicks (shift/alt/meta still create a one-day
  draft; they simply get no gesture).
- No `finishWhenPrimaryButtonReleased` option — the all-day gesture always finishes on button release.
- No vertical (multi-row) all-day selection, no keyboard-driven multi-day selection.
- No Playwright/`e2e/**` work.
- No Week wrapper hook (allowlist #8/#9), no `AllDayRow.test.tsx` (#7), no pre-emptive
  `MainGrid.test.tsx` edit (#10).
