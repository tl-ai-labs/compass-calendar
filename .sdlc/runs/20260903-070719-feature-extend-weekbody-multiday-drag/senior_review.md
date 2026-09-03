# Senior code review — 20260903-070719-feature-extend-weekbody-multiday-drag

Scope: brownfield, the 7 files in `provenance.json`. Nothing outside that set was reviewed.

## Verdict: **request-changes**

One blocker (F-1: the draft form closes on release of a multi-day drag — AC-2 is not met in the
running app, only in the mocked hook tests). Two majors in the test suite: the AC-5 clamp test and
the clientId test do not exercise what their names claim. The gesture state machine itself is
sound — I traced every interlock and found no leak, no listener asymmetry, and no real TDZ hazard.

The craft level here is high. The math module's threshold test even *corrects* the change plan
(§12 specified `(92,100,8) → true`, which is wrong — `|92-100| = 8` is not `> 8`; the implementer
used `91` at `all-day.create.test.ts:132`). That is the kind of thing that usually gets copied
blindly. Credit where due.

---

## Findings

| ID | Sev | File:line | What | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| F-1 | **blocker** | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx:56-58` (mechanism in `useAllDayDraftCreation.ts:130-141`) | On release of a multi-day drag the Week draft form **closes** instead of opening for the span. Full chain traced below. | Directly violates AC-2. User drags 3 days, the form is open and live-updating, then vanishes on mouse-up, leaving `isDrafting: true` + a 3-day `gridDraft` in the store with no visible UI. Also fires for *any* >8px drag inside a single column (F-10). | Mirror the established convention: `startGridDraft(...)` then `draftActions.setFormOpen(true)`, exactly as `DayCalendarGrid.tsx:191-194` does. `setFormOpen` is a no-op when already `true`, so the press path is unaffected. |
| F-2 | major | `useAllDayDraftCreation.test.tsx:223-238` | "clamps at the window edge" never reaches the clamp. `defaultXToDate(9999)` returns `"2026-05-23"` (`:116`, the `>= 300` branch), which **is** `defaultVisibleDates[3]`. `resolveAllDayDayRange`'s clamp is a no-op on this input. | The test would pass identically with the entire `visibleDates` clamp deleted from `all-day.create.ts:32-40`. AC-5 has no hook-level proof. | Add a harness with an out-of-window mapper, e.g. `getStartDate: (x) => (x > 1000 ? "2026-06-15" : defaultXToDate(x))`, then assert `end === 2026-05-24`. Do not mutate the shared `defaultXToDate`. |
| F-3 | major | `useAllDayDraftCreation.test.tsx:183-204` | "…and preserves clientId" asserts `expect(secondDraft.clientId).toBe(firstDraft.clientId)` where **both are `undefined`** — `useAllDayDraftCreation.ts:76-80` calls `createGridEventDraft(schedule, undefined, calendarId)`, and `grid-event-draft.adapter.ts:55` stores that `undefined` verbatim. | This is the one assertion guarding the "replace, not duplicate" property the orchestrator explicitly asked about. It is `expect(undefined).toBe(undefined)` — it would pass if `finish()` built a brand-new draft with `createGridEventDraft` instead of `replaceGridDraftSchedule`. Compounded by the `if (firstDraft.kind === "create" && …)` guard at `:201`, which lets the assertion be **skipped entirely** without failing. | Replace with a structural identity check that cannot be vacuous: `expect(secondDraft).toEqual({ ...firstDraft, values: { ...firstDraft.values, schedule: expectedSpan } })`. Drop the `if` guard (use a non-null assertion or `expect(...).toMatchObject`). Rename the test. |
| F-4 | major | `packages/web/src/grid/interaction/math/all-day.create.ts:26-77` | A pure string/dayjs function is wrapped in a try/catch with a nested try/catch fallback. `dayjs("2026-05-20").add(1,"day")` cannot throw; nothing in the body can. | Swallowed errors. Worse, the fallbacks produce **exactly the corrupt state §12 of the plan calls out as the thing to prevent**: `{ start: anchorDate, end: anchorDate }` (`:51-55`) and `{ start: "", end: "" }` (`:71-74`) are zero-length all-day ranges; the latter feeds `allDayGridSchedule("","")` → `dayjs("").toDate()` → `Invalid Date` into the store, silently. `input?.anchorDate` (`:64,68,72,73`) optional-chains a **non-optional** parameter, weakening the declared type contract for no reason. No test covers any fallback branch — it is untested, unreachable code that can only hide a future bug. | Delete both try/catch blocks and the `?.` on `input`. If defensiveness is wanted, validate once at the top and throw. |
| F-5 | minor | `docs/frontend/week-drag-interaction.md` (all-day section) | Two inaccuracies. (a) "so `clientId` and `calendarId` match and the second commit replaces rather than duplicates" — `clientId` is `undefined` on both drafts (F-3); nothing is being matched. What actually prevents duplication is the single-slot `gridDraft` in the store. (b) The doc warns that `startGridDraft` "hard-resets `isFormOpen: false` and would yank the form shut mid-gesture" — and then the **release commit routes through `startGridDraft`** and does exactly that (F-1). | The doc states the correct hazard and the code walks into it one step later. A future reader will trust the doc. | Correct (a) to name the real mechanism. Update (b) once F-1 is fixed, to say the release commit re-opens the form explicitly. |
| F-6 | minor | `useAllDayDraftCreation.ts:121-126` vs `:152, :177, :181` | `cleanup()` closes over `onMouseMove` / `onMouseUp` / `onBlur`, all declared as `const` **below** it. | **Not a live TDZ bug** — I traced every call site: `cleanup` is only reachable from `finish`/`cancel`, which are only reachable from the three listeners (added at `:184-186`) or `gestureRef.current.cancel` (assigned at `:188`), all after the consts initialise. But it is a trap: any future early-exit that calls `cleanup()` inside the synchronous handler body throws `ReferenceError`. The sibling `useTimedDraftCreation.ts:157-211` deliberately uses hoisted `function` declarations for `finish`/`cancel`/`handleMouseMove`/`handleMouseUp`/`handleWindowBlur` — this file diverges from that convention without saying why. | Convert the five handlers to `function` declarations to match the sibling, or move `cleanup` below them. |
| F-7 | minor | `all-day.create.ts:84-88` vs `interaction/interaction.pointer.ts:26-34` | `hasExceededAllDayDragThreshold` is the x-axis half of `hasExceededInteractionMoveThreshold`, but lives in a different module tree (`grid/interaction/math/`) rather than beside its sibling. | DRY / discoverability. The next person needing an axis-scoped threshold will not find it. The *value* split (8 vs 4 vs 25) is well justified in the constants comment; the *helper* split is not. | Move it to `interaction.pointer.ts` as `hasExceededInteractionMoveThresholdX`, or leave it and add a cross-reference comment. Low urgency. |
| F-8 | nit | `AllDayRow.tsx:59-65` | `useCallback` on `getVisibleDates` is defeated by the fresh `{ getVisibleDates }` object literal at `:68`, and the hook never memoises on `multiDayDrag` anyway (it reads it at mousedown time, `useAllDayDraftCreation.ts:69`). | The `useCallback` and its dep array buy nothing. Harmless, but misleading about where the perf boundary is. | Either drop the `useCallback`, or `useMemo` the whole `multiDayDrag` object if the memo is wanted. |
| F-9 | minor | `useAllDayDraftCreation.ts:155-158` | The `buttons !== 1` early-finish path (button released outside the window) has **no test**. | It is the only path that can commit a span without a `mouseup`. Silent regression risk. | Add: press x=50, `mouseMove(window, { clientX: 250, buttons: 1 })`, then `mouseMove(window, { clientX: 250, buttons: 0 })` ⇒ `onCreateGridDraft` called twice, listeners gone (a following `mouseUp` emits nothing). |
| F-10 | minor | `useAllDayDraftCreation.ts:130-141` | `finish()` does not dedup: `isSameAllDayDayRange` guards the *preview* writes (`:170`) but the *final* commit is unconditional once `hasMoved`. A 9px drag inside one column emits a second, byte-identical commit. | Pointless store churn today; with F-1 unfixed it means **any** >8px wobble on the all-day row closes the form. `useAllDayDraftCreation.test.tsx:319-349` ("pins constant-column Day model") actually exercises this path and never asserts the call count, so it passes silently. | In `finish`, `if (isSameAllDayDayRange(finalRange, pressRange)) return;` after computing `finalRange`. Add the missing `toHaveBeenCalledTimes` assertion to the constant-column test. |

### F-1 in full — the evidence chain

This is the finding I would not merge without. Five files, all read:

1. `AllDayRow.tsx:56-58` — `openAllDayDraft` calls **only** `draftActions.startGridDraft({ activity: "gridClick", draft })`. It never calls `setFormOpen`.
2. `draft.store.ts:80-95` — `startGridDraft` unconditionally sets `isFormOpen: false`.
3. Who sets it back to `true` in Week? Exhaustive `grep` of `setFormOpen` callers leaves exactly two candidates on this path:
   - **`useDraftEffects.ts:62-64`** — `useEffect(() => { handleChange(); }, [handleChange])`, where `handleChange` (`useDraftActions.ts:369-383`) calls `setIsFormOpen(true)` when `activity === "gridClick"`. Its `useCallback` deps are `[isDrafting, activity, setIsFormOpen]` (`:383`). On the **release** commit `isDrafting` is already `true`, `activity` is already `"gridClick"`, and `setIsFormOpen` is the module-level `draftActions.setFormOpen` (`useDraftState.ts:101`). **All three deps are unchanged ⇒ `handleChange` keeps its identity ⇒ the effect does not re-run ⇒ `setFormOpen(true)` is never called.**
   - **`useGridMouseUp.ts:52-66`** — the safety net that opens the form for a plain click (`shouldOpenForm = isNew` ⇒ `true`). It is a **bubble-phase** listener on the `#root` element (`useEventListener.ts:33-35`). The new `finish()` calls `mouseEvent.stopPropagation()` from a **window capture-phase** listener (`useAllDayDraftCreation.ts:135`, registered at `:185` with `capture: true`). Capture on `window` runs before the event ever descends to `#root`, so **`onGridMouseUp` never fires** for a drag-release mouse-up.
4. Net: after release, `isFormOpen === false` and nothing will set it true.

Why the timed gesture does not hit this, despite the identical `stopPropagation`: `useTimedDraftCreation` previews with `activity: "creating"` (`:154`) and commits with `activity: "gridClick"`. That **activity transition** changes `handleChange`'s deps and re-fires the effect. The new press-then-escalate shape commits `"gridClick"` on both the press and the release, so there is no transition to ride.

Why no test caught it: every hook test mocks `onCreateGridDraft` with a bare `startGridDraft` (`useAllDayDraftCreation.test.tsx:144-146`) and never asserts `status.isFormOpen`. The form-open logic lives in `useDraftActions`/`useDraftEffects`, which no test in this run renders. There is **no `AllDayRow.test.tsx` in the repo at all** (`ls packages/web/src/views/Week/components/Grid/AllDayRow/` → three `.tsx` files, no tests).

The fix is a two-line change on an allowlisted file and it makes Week match Day, which already does the right thing. Confidence: high on the mechanism; it is a static trace across four files, so I would still want the one-minute browser check in the acceptance criteria below.

---

## Per-AC verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 press+drag across N columns → one N-day draft, previewed live | **pass** | `useAllDayDraftCreation.ts:160-175` writes the running range via `setGridDraft`; test `:168-181` asserts the store holds `2026-05-20 → 2026-05-23` after a press at x=50 and one move to x=250, with `onCreateGridDraft` still at 1 call. Ran it: green. |
| AC-2 release opens the form for the span, post-release behaviour preserved | **FAIL** | F-1. The *commit* is correct (`:191` asserts 2 calls, 2nd carrying the span) but the *form* does not open. "Preserving existing post-release behaviour" is precisely what breaks: `useGridMouseUp` is severed by the capture-phase `stopPropagation`. |
| AC-3 plain click still one-day; existing test passes **unmodified** | **pass** | Independently verified, not taken on trust: `git diff -U0` on the test file yields a single hunk `@@ -110,0 +111,240 @@` with **zero** removed lines. Mechanism: `finish()` returns at `:133` before touching `preventDefault`/`stopPropagation` when `!hasMoved`, and the legacy harness (`:21-55`) passes no `multiDayDrag`, so the hook exits at `:88`. Ran the file: 24/24 green. |
| AC-4 right-to-left == left-to-right | **pass** | `all-day.create.ts:41-45` min/max normalisation; math tests `:32-54`; hook-level test `:206-221` (press x=250 → move x=50 → release yields the same `05-20 → 05-23`). |
| AC-5 range clamped to the visible week window | **pass, on different evidence than claimed** | The runtime clamp is genuinely enforced, twice: (1) `AllDayRow.tsx:59-65` passes a **real** window — `weekProps.component.weekDays.map(d => d.format(YEAR_MONTH_DAY_FORMAT))`, ascending, which is what `resolveAllDayDayRange` clamps against; (2) upstream, `getStartDate` can never even return an out-of-window date, because `useGridCoordinates.ts:33` already returns `Math.max(0, Math.min(dateIndex, visibleDates.length - 1))`. The math clamp is unit-tested properly at `all-day.create.test.ts:56-91`. **But** the hook-level clamp test is vacuous (F-2), so the wiring between the two is unproven at the hook boundary. |
| AC-6 Day view not regressed | **pass** | `DayCalendarGrid.tsx:331-334` is unchanged and omits `multiDayDrag`, so the hook returns at `:88` before arming anything. Belt-and-braces: `useDayCalendarColumns.ts:35-39` still stamps `date: dateInView` on every column. Both are pinned by tests `:301-317` and `:319-349`. Note `:319-349` tolerates the redundant double commit (F-10), but Day cannot reach that path. |
| AC-7 suite green, new behaviour covered | **pass** | I re-ran the two changed test files: **24 pass / 0 fail / 52 expect() calls**, = 3 pre-existing + 21 new, matching the orchestrator's +21. I did not re-run the full suite; the baseline correction (2297/1, `RecurrenceSection` date-rot from a hardcoded `/Monday, August 3rd, 2026/` at `:176`) is documented in `change_plan.md` §12 and is plainly unrelated. Coverage is real but has the three holes in F-2, F-3, F-9. |

---

## Tests that cannot fail

I checked all 10 new hook tests and all 11 math tests. **I found two.** I also checked the specific
trap you flagged and it is clean.

**`{ buttons: 1 }` — clean.** All nine `fireEvent.mouseMove` calls pass it: `:173, :188, :211, :228,
:260, :271, :296, :308, :327`. No test is silently short-circuited by jsdom's `buttons: 0` default.
This was the highest-risk failure mode and it was handled.

**Genuinely vacuous:**

1. **`:202` `expect(secondDraft.clientId).toBe(firstDraft.clientId)`** — `undefined === undefined`
   (F-3). Cannot fail, and cannot fail for a *behavioural* reason: no code path could make it fail.
   Additionally skippable via the `if` guard at `:201`.
2. **`:223-238` "clamps at the window edge"** — cannot fail *for its stated purpose* (F-2). It still
   fails if the whole feature is reverted (call count drops to 1), so it is not dead weight; it just
   does not test the clamp.

**Pass in the reverted world by design — not defects, these are the D-1 pins:**
`:240-253` ("emits nothing extra"), `:301-317` ("opts out when `multiDayDrag` is omitted"),
`:319-349` ("pins constant-column Day model"). Passing before and after is exactly the job of a
non-regression pin. Called out only so nobody "fixes" them later.

**Weak but discriminating — I would keep them as-is:**
- `:255-264` (sub-threshold jitter) passes on revert, but fails if the threshold is removed or set
  to 0. Real coverage of `:159-168`.
- `:266-284` (blur reverts) passes on revert, but distinguishes the three plausible bugs: `discard()`
  → `gridDraft` null → fails; blur no-op → store stays multi-day → fails; missing `isCancelled`
  interlock → the trailing `mouseUp` at `:282` emits → fails. Good test.
- `:286-299` (unmount inert) — `toEqual(storeBefore)` against the same object reference is trivially
  true, but only if the store is untouched; a leaked `mousemove` listener writes the store and fails
  it. Correctly targets the `useEffect` teardown at `useAllDayDraftCreation.ts:44-49`.

---

## Memory / leak safety — reviewed, no defects

Traced by hand, all clean:

- **Listener symmetry.** Added `:184-186` — `mousemove` capture `true`, `mouseup` capture `true`,
  `blur` bubble. Removed `:122-124` with **identical** flags. Symmetric; the `blur`
  add/remove-without-options pair matches `useTimedDraftCreation.ts:126-128` / `:186-188`.
- **Unmount mid-gesture.** `:44-49` teardown → `cancel({ revert: false })` → `cleanup()`. Covered by
  test `:286-299`.
- **Blur mid-gesture.** `:181-183` → `cancel({ revert: true })` → reverts to `pressDraft` only when
  `hasMoved` (`:147-149`), so a blur before the threshold leaves the press draft untouched. Correct.
- **Second press superseding a live gesture.** `:59` `gestureRef.current?.cancel({ revert: false })`
  sits after the right-click guard (so a right-click cannot disturb a live gesture) and before
  `preventDefault`. Matches plan §11 step 2.
- **Double-finish / finish-after-cancel.** `isFinished`/`isCancelled` are checked at the top of
  `finish` (`:131`), `cancel` (`:144`) and `onMouseMove` (`:153`). A queued event after `cleanup`
  cannot re-enter. `gestureRef.current = null` in `cleanup` prevents a stale `cancel`.
- **`buttons !== 1` early finish** (`:155-158`) is implemented correctly; it is just untested (F-9).
- **TDZ** — not a live hazard, see F-6.

One deliberate behaviour worth recording rather than fixing: unmount uses `revert: false`, so
navigating weeks mid-drag leaves the un-confirmed span in the store. `useDraftEffects.ts:37-47`
discards on `weekProps.component.week` change, so it self-heals. Fine as-is.

---

## Refinement TaskPackets

### TP-R1 — **blocker** — open the form on the release commit
- **task_type**: `bugfix`
- **instruction**: In `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`, change
  `openAllDayDraft` (`:56-58`) to call `draftActions.setFormOpen(true)` immediately after
  `draftActions.startGridDraft({ activity: "gridClick", draft })`, matching
  `DayCalendarGrid.tsx:191-194`. Add a short comment naming the reason: the release commit re-enters
  `startGridDraft` with an unchanged `activity`/`isDrafting`, so `useDraftActions.handleChange`
  (deps `[isDrafting, activity, setIsFormOpen]`) will not re-fire, and the capture-phase
  `stopPropagation` in `useAllDayDraftCreation.finish` prevents `useGridMouseUp` from opening it.
  Do **not** remove the `stopPropagation` — it is what stops the release mouse-up from being
  re-interpreted downstream.
- **inputs**: `AllDayRow.tsx:56-58`, `DayCalendarGrid.tsx:191-194`, `draft.store.ts:80-145`,
  `useDraftActions.ts:369-383`, `useDraftEffects.ts:62-64`, `useGridMouseUp.ts:52-66`,
  `useEventListener.ts:33-35`, this report's F-1 chain.
- **acceptance**:
  - `setFormOpen(true)` follows `startGridDraft` in `openAllDayDraft`.
  - Existing 24 tests still green (`setFormOpen` is a documented no-op when already `true`, so the
    press path is unchanged).
  - **Manual browser check, recorded in the run manifest**: in Week, press on empty all-day space and
    drag across 3 columns → the form is open and live-updating during the drag, and **remains open**
    on release showing the 3-day range. Then repeat with a plain click → one-day draft, form open.
    Static reasoning is not sufficient acceptance for this one.

### TP-R2 — major — make the clamp test actually clamp
- **task_type**: `test`
- **instruction**: In `useAllDayDraftCreation.test.tsx`, add a test using a harness whose
  `getStartDate` returns a date **outside** `defaultVisibleDates` at extreme x (e.g.
  `(x) => (x > 1000 ? "2026-06-15" : defaultXToDate(x))`). Press x=50, move to x=9999 with
  `{ buttons: 1 }`, release; assert the committed span is `start 2026-05-20 / end 2026-05-24`.
  Leave the existing `:223-238` test in place (it still pins the exclusive-end arithmetic) but
  rename it to say what it tests. Do not mutate `defaultXToDate`.
- **inputs**: `useAllDayDraftCreation.test.tsx:112-165, :223-238`, `all-day.create.ts:32-40`.
- **acceptance**: the new test **fails** if the `visibleDates` clamp block in `all-day.create.ts` is
  commented out (verify this by temporarily doing so), and passes with it restored.

### TP-R3 — major — make the replace-not-duplicate assertion non-vacuous
- **task_type**: `test`
- **instruction**: In `useAllDayDraftCreation.test.tsx:183-204`, remove the `if (firstDraft.kind ===
  "create" && …)` guard and replace the `clientId` assertion with a structural one proving the second
  draft is the first with only `schedule` swapped — e.g.
  `expect(secondDraft).toEqual({ ...firstDraft, values: { ...firstDraft.values, schedule: <span> } })`.
  Rename the test away from "preserves clientId" (it is `undefined` on both).
- **inputs**: `useAllDayDraftCreation.test.tsx:183-204`, `useAllDayDraftCreation.ts:76-80, :117-121`,
  `grid-event-draft.adapter.ts:47-66, :160-169`.
- **acceptance**: the assertion fails if `draftForRange` is changed to build a fresh draft via
  `createGridEventDraft` instead of `replaceGridDraftSchedule(pressDraft, …)`.

### TP-R4 — major — delete the swallowing try/catch
- **task_type**: `refactor`
- **instruction**: Remove both try/catch blocks and the `input?.` optional chaining from
  `resolveAllDayDayRange` in `packages/web/src/grid/interaction/math/all-day.create.ts:26-77`. The
  body is pure string comparison plus `dayjs(...).add(1,"day")` on `YYYY-MM-DD` input and cannot
  throw. Keep the function's observable behaviour on all valid inputs byte-identical.
- **inputs**: `all-day.create.ts:26-77`, `all-day.create.test.ts` (all 11 tests must stay green
  unmodified), change plan §12 ("the zero-length-span guard").
- **acceptance**: no `try`/`catch` in the file; no `?.` on the non-optional `input`; all 11 math
  tests pass unmodified; `biome check` clean.

### TP-R5 — minor — suppress the no-op release commit
- **task_type**: `bugfix`
- **instruction**: In `useAllDayDraftCreation.ts` `finish` (`:130-141`), after computing `finalRange`,
  return early when `isSameAllDayDayRange(finalRange, pressRange)` — a >8px drag that stays inside one
  column should not re-commit an identical draft. Then add the missing
  `expect(onCreateGridDraft).toHaveBeenCalledTimes(1)` to the constant-column pin at `:319-349`,
  which exercises exactly this path.
- **inputs**: `useAllDayDraftCreation.ts:130-141`, `useAllDayDraftCreation.test.tsx:319-349`.
- **acceptance**: a press + 300px move + release with a constant-date `getStartDate` yields exactly
  **one** `onCreateGridDraft` call; the multi-day tests still assert two.

### TP-R6 — minor — cover the `buttons !== 1` early finish
- **task_type**: `test`
- **instruction**: Add a test per F-9 to `useAllDayDraftCreation.test.tsx`.
- **inputs**: `useAllDayDraftCreation.ts:155-158`.
- **acceptance**: the test fails if the `buttons !== 1` branch is deleted.

### TP-R7 — minor — doc corrections + convention alignment
- **task_type**: `docs` (+ tiny refactor)
- **instruction**: (a) In `docs/frontend/week-drag-interaction.md`, correct the clientId claim per F-5
  and, once TP-R1 lands, state that the release commit re-opens the form explicitly because the
  activity does not transition. (b) In `useAllDayDraftCreation.ts`, convert `cleanup`, `finish`,
  `cancel`, `onMouseMove`, `onMouseUp`, `onBlur` to hoisted `function` declarations to match
  `useTimedDraftCreation.ts:157-211` and remove the latent forward-reference trap (F-6).
- **inputs**: F-5, F-6, `useTimedDraftCreation.ts:124-215`.
- **acceptance**: docs no longer claim a meaningful shared `clientId`; all 24 tests green; `biome
  check` clean.

---

## Follow-up tickets (outside this run's 11-path allowlist)

- **FU-1** — `AllDayRow` has **no test file whatsoever**. The Week wiring this run added
  (`getVisibleDates` from `weekProps.component.weekDays`, and the form-open contract in F-1) is
  untested at the component level. Add `AllDayRow.test.tsx`. This is the test that would have caught
  the blocker.
- **FU-2** — `useDraftEffects.ts:62-64`'s `useEffect(() => handleChange(), [handleChange])` silently
  no-ops on a **re-entrant same-activity** `startGridDraft`. That is a general trap for any future
  press-then-escalate gesture, not just this one. Either key the effect on a draft revision counter,
  or document the constraint at `draft.store.ts:66`.
- **FU-3** — `startGridDraft({ activity: "gridClick" })` + `setFormOpen(true)` is duplicated in four
  places (`DayCalendarGrid.tsx:191-194`, `useGridEventDraftHandlers.ts:46-47`,
  `useDuplicateEvent.ts:42-43`, `useGridEventEditShortcuts.ts:245-246`) while `AllDayRow.tsx:56-58`
  omits the second half. Extract one `openGridDraftForm(draft)` helper so the pair cannot drift apart
  again.
- **FU-4** — `RecurrenceSection.test.tsx:176` hardcodes `/Monday, August 3rd, 2026/`; the sole
  pre-existing suite failure is pure date-rot. Off-allowlist here; file it.
- **FU-5** — repo-wide hygiene debt confirmed by the orchestrator and untouched by this run:
  `bun run lint` 6 errors, `tsc --noEmit` 97 errors, all in files this run never opened.
- **FU-6** — consider relocating `hasExceededAllDayDragThreshold` beside
  `hasExceededInteractionMoveThreshold` in `interaction/interaction.pointer.ts` (F-7).

---

## Things I checked and am satisfied with — no action

- **Double commit**: as briefed, not reported as a defect. I did check the two commits for
  consistency and they **are** consistent — `replaceGridDraftSchedule` (`grid-event-draft.adapter.ts:160-169`)
  spreads the press draft, so `kind`, `source`, `clientId`, `calendarId` and every form field carry
  over; only `schedule` changes. No duplicate-event risk. (The *test* proving it is vacuous — F-3 —
  but the *behaviour* is right.)
- **`setGridDraft` vs `startGridDraft` for preview** (D-C): correct and load-bearing.
  `draft.store.ts:104-126` preserves `activity` and `isFormOpen` and even reuses the `status` object
  when unchanged, so the per-mousemove writes do not churn `selectDraftStatus` subscribers. The
  `isSameAllDayDayRange` dedup at `:170` keeps it allocation-light. Well done.
- **Eligibility placed after the press commit** (`:90-102`): deliberate and right — a shift/alt/meta
  click keeps today's press-creates-a-draft behaviour and simply gets no gesture. `isPrimary: true`
  is hardcoded, which is correct for a `MouseEvent` (`interaction.pointer.ts:11-25` treats
  `isPrimary !== false`).
- **`pointerStart.y` reused for every `pointerDate` lookup** (`:110-115`, D-F): correct. `anchorDate`
  uses `event.clientY` and `pointerStart.y === event.clientY`, so anchor and pointer resolve through
  an identical y and cannot disagree via `getMinuteByY`'s day-rollover.
- **Type safety**: no `any`, no assertions, no non-null bangs in the six code files. `multiDayDrag?:
  { getVisibleDates: () => readonly string[] }` is a narrow optional that makes the Day opt-out a
  type-level fact. `readonly string[]` is the right variance. The `AllDayDayRange` JSDoc correctly
  documents the exclusive end and the ascending-window precondition.
- **Constant + comment** (`interaction.constants.ts:10-19, :31`): the 8-vs-4-vs-25 justification is
  the clearest thing in the diff and explains *why* jitter is not free here. Keep it.
- **AC-3 byte-identity**: independently re-verified, not relayed.
