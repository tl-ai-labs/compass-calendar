# Senior Review — Multi-day drag-to-create in the Week all-day row

- **Run:** `20260820-091709-feature-extend-weekbody-multiday-drag`
- **Mode:** brownfield · `feature-extend` · scoped to this run's 10-file write set
- **Baseline:** `4189de1` on `CMP-101/opus-only`
- **Reviewer method:** artifact read → full read of all 10 files → **mutation testing** of the 9
  load-bearing invariants against the 3 targeted suites (each mutant applied to a backed-up copy
  and restored; final `md5sum` re-verified against the pre-review hash — the tree is byte-identical
  to how I found it).

---

## Verdict: **CHANGES REQUIRED**

The design is sound and the implementation is faithful to it. The **clientY pin is correct** — no
code path leaks a live `clientY`, and I proved by mutation that the pin is load-bearing and caught.
**Day-view safety is genuinely airtight.** The range math is correct.

Two things block:

1. **`bun lint` fails with 3 errors, all three in files this run wrote.** AC-12 / NFR-2 are stated
   acceptance criteria and they are objectively not met. CI will go red.
2. **Mutation testing found 5 of the new tests to be vacuous** with respect to the invariant they
   are documented as guarding — including the #1 risk in the change plan. The plan's §6 and §8
   claims that the clientY rollover is *"guarded twice over, and both guards are covered by tests"*
   is **false**: one guard is covered by exactly one test in a different suite, and the other guard
   is covered by nothing at all.

Nothing here is a design flaw. All of it is a fix-the-tests-and-run-the-formatter job.

---

## Mutation-test results (the evidence behind the findings)

Each mutant was applied to `useAllDayDraftCreation.ts` alone and run against
`useAllDayDraftCreation.test.tsx` + `useAllDayGridDraftCreation.test.tsx` (23 tests).
Baseline across all three targeted suites: **33 pass** (10 + 18 + 5), matching the orchestrator.

| # | Mutation | Invariant | Result |
|---|---|---|---|
| A | `:118` `pointerStart.y` → live `mouseEvent.clientY` | FR-3 clientY pin | **caught** — but by only 1 test, and it is in the *wrapper* suite |
| B | `:188` threshold gets live `clientY` | D5 x-only threshold (AC-9's 2nd guard) | **SURVIVES** |
| C | `:132` dedupe short-circuit removed | NFR-4 store-churn dedupe | **SURVIVES** |
| D | `:125` `blur` removal deleted | NFR-5 listener leak | caught |
| E | `:124` `mouseup` removed with capture `false` | NFR-5 / FR-7 matching capture flags | **SURVIVES** |
| F | `:98` `gestureRef.current?.cancel()` removed | FR-7 re-entrancy | **SURVIVES** |
| G | `:126` `gestureRef.current = null` removed | FR-7 | **SURVIVES** |
| H | `:170` `if (isPreviewStarted)` guard removed | FR-10 below-threshold no-op | **SURVIVES** |
| I | `:51-55` unmount effect emptied | AC-7 unmount | caught (2 tests) |

---

## Findings

### BLOCKER

#### B1 — `bun lint` fails; all 3 errors are in this run's write set (AC-12, NFR-2)

Verified by running `bun lint` at HEAD. `Found 3 errors. Found 10 warnings.` The 10 warnings are
pre-existing and out of scope. All 3 **errors** are new:

- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — *format*. Two hunks, both inside
  code this run added:
  - line ~310, in `"dismisses an in-flight draft without starting a gesture"`:
    `await waitFor(() => expect(useDraftStore.getState().gridDraft).toBeNull());` exceeds the print
    width and must be wrapped across three lines.
  - lines 471-472 — a doubled trailing blank line at EOF.
- `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx:1:1` —
  *assist/source/organizeImports*. `import { type DateCalcs } from "./useDateCalcs";` must sort
  **after** `import { useAllDayGridDraftCreation } from "./useAllDayGridDraftCreation";`.
- `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx:91-92` — *format*.
  `const surface = () => screen.getByRole("button", { name: "Week all-day row" });` fits on one line.

NFR-8 anticipated exactly this (*"Re-run `bun lint` after the hook fires"*); that step did not happen.

**Fix — and this detail matters:** run Biome **scoped to the two files**, not `bun lint:fix`:

```
bunx biome check --write \
  packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx \
  packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx
```

`bun lint:fix` is `biome check --write .` — repo-wide. It would auto-fix the 10 pre-existing
FIXABLE warnings in `packages/sync/**`, `DescriptionEditor.tsx`, `GridEvent.tsx` and others,
silently expanding the write set and breaking **AC-14 / NFR-6**.

---

### MAJOR

#### M2 — The hook suite's clientY-pin test does not guard the clientY pin (FR-3, AC-9)

`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:381`
`"keeps a purely vertical drag on the pressed column"`

Mutation A (`useAllDayDraftCreation.ts:118`, `pointerStart.y` → `mouseEvent.clientY`) **does not
fail this test.** Reason: the test drags *purely* vertically (`pressAt(50, 5)` → `moveTo(50, 2000)`),
so the *threshold* — which is pinned separately at `:188` — keeps `hasMoved === false`, and
`resolveRangeForPointer` short-circuits at `:112` without ever calling `getStartDate`. The resolver
pin is never exercised. The test's own comment (*"if the live y reached the resolver…"*) describes
something that cannot happen on this input.

change_plan §7.2 case #12 and the §8 risk table both assert this test is the pin's guard
(*"the assertion fails if the pin is dropped"*). It is not.

The pin **is** caught — by exactly one test, `useAllDayGridDraftCreation.test.tsx:170`
`"pins clientY to the press for every resolution during the gesture"`, which does a genuine
*diagonal* drag (`pressAt(50, 7)` → `moveTo(350, 2000)`) and asserts every recorded stub `y === 7`.
That test is excellent. But the highest-risk invariant in the change is single-covered, and the
coverage sits in the Week wrapper suite rather than in the hook that owns the invariant — so
deleting or rewriting the wrapper test silently unguards it.

**Fix:** add a diagonal case to the hook suite. Press `(50, 5)`, `moveTo(250, 2000)` with
`buttons: 1`, release `(250, 2000)`; assert `{ start: "2026-05-18", end: "2026-05-21" }`. Under
mutation A the fixture resolves column 2 + 2000 minutes = `2026-05-21`, yielding `end: "2026-05-22"`
— so the test fails. Correct the misleading comment at `:384-385` at the same time.

#### M3 — The NFR-5 leak test counts calls, not listener identity, so it passes a capture-flag mismatch

`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:358`
`"removes every listener it added once the drag completes"`

`listenerCountFor` (`:128`) filters `spy.mock.calls` on `call[0] === type` only — it compares
*how many times* `removeEventListener` was called per event type against how many times
`addEventListener` was. It never inspects `call[1]` (the handler) or `call[2]` (the capture flag).

Mutation E — `useAllDayDraftCreation.ts:124` changed to
`window.removeEventListener("mouseup", handleMouseUp, false)` — **passes all 23 tests.** In DOM
semantics the capture flag is part of the listener's identity, so that removal matches nothing: the
capture-phase `mouseup` listener stays attached to `window` forever, one per completed gesture,
retaining the whole gesture closure. That is precisely the leak NFR-5 exists to prevent, and the
test written to prove NFR-5 cannot see it.

**Fix:** compare the `(handler, capture)` pairs, not the counts:

```ts
const listenerArgsFor = (spy: ListenerSpy, type: string) =>
  spy.mock.calls
    .filter((call) => call[0] === type)
    .map((call) => [call[1], call[2] ?? false] as const);
```

then assert, for each of `mousemove` / `mouseup` / `blur`, that every added `(handler, capture)`
pair has a matching removed pair.

#### M4 — D5's x-only threshold — AC-9's advertised "second line of defence" — has zero coverage

Mutation B (`useAllDayDraftCreation.ts:188`, `y: pointerStart.y` → `y: mouseEvent.clientY`)
**passes all 23 tests.**

With that mutation, a purely vertical drag exceeds the threshold on `|Δy|`, sets `hasMoved = true`,
and fires `draftActions.startGridDraft({ activity: "creating", … })` — a store write during a
gesture the plan guarantees leaves the store untouched (§4 *"Below the threshold, restated: no
`startGridDraft`, no `setGridDraft`, no `discard`"*). The final draft is still one day, so every
existing assertion holds.

The plan's §6 closes with *"AC-9 is satisfied twice"* and D5 with *"Both are tested."* Only one is.

**Fix:** extend the vertical-drag test at `:381` to assert the *store* stays untouched through the
move, before the release:

```ts
pressAt(50, PRESS_Y);
moveTo(50, 2000);
expect(useDraftStore.getState().gridDraft).toBeNull();
expect(useDraftStore.getState().status?.activity ?? null).toBeNull();
releaseAt(50, 2000);
```

That is exactly what the pinned threshold buys, and it kills mutant B.

---

### MINOR

#### m5 — NFR-4 dedupe wiring untested (mutant C survives)

`isSameAllDayCreateRange` is well unit-tested as a pure function
(`all-day.create.test.ts:72-93`), but its *use* at `useAllDayDraftCreation.ts:132` is not. Replacing
that condition with `if (false)` passes all 23 tests, because no test drives two moves that land in
the same column. NFR-4 ("writes the store only when the resolved span actually changes") is
therefore unverified.

**Fix:** in the preview test at `:264`, `spyOn(draftActions, "setGridDraft")`, then
`moveTo(250); moveTo(280);` (both column 2) and assert `setGridDraft` was called at most once;
`mockRestore()` in `finally`.

#### m6 — FR-10's below-threshold guard is asserted vacuously (mutant H survives)

`useAllDayDraftCreation.test.tsx:334` `"leaves the store untouched when a blur arrives below the
threshold"` asserts `gridDraft === null` and `status?.activity ?? null === null`. Both are already
true *before* the blur, so the assertions cannot distinguish `cancel()` calling `discard()` from
`cancel()` skipping it. Removing the `if (isPreviewStarted)` guard at `:170` passes all 23 tests.

**Fix:** `spyOn(draftActions, "discard")` and assert `not.toHaveBeenCalled()` (restore in `finally`;
note the file-level `afterEach` also calls `discard`, so restore before teardown).

#### m7 — FR-7 re-entrancy protection untested (mutant F survives)

Removing `gestureRef.current?.cancel()` at `:98` passes all 23 tests. The concrete scenario it
protects is reachable: press (below threshold, so the store is untouched and `isDrafting` stays
`false`, so the `:68` guard does not short-circuit the second press), then press again without
releasing. Without `:98`, gesture 1's listeners stay registered alongside gesture 2's and the next
`mouseup` calls `onCreateGridDraft` **twice**.

**Fix:** `pressAt(50); pressAt(50); releaseAt(50);` → `expect(drafts).toHaveLength(1)`.

#### m8 — Dead harness machinery and a leaked store subscription in the wrapper test

`packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx:68,82-88`

`renderHarness` builds a `drafts: GridEventDraft[]` array and a `useDraftStore.subscribe(...)` that
pushes into it. **No test reads `drafts`** — all five assert through `storedDates()` /
`useDraftStore.getState()`. The subscription is only torn down by a manual `unsubscribe()` at the
end of each test body, so any assertion that throws leaves it live for the rest of the file.

**Fix:** delete `drafts`, the `subscribe` call, and the `unsubscribe` return + its five call sites.

---

### NIT

#### n9 — `.hook-logs/` is untracked and not ignored

`.hook-logs/hook.jsonl` (706 B) was produced by the format-after-edit hooks and appears in
`git status` as untracked. FR-17 restricts `.gitignore` to the single `.sdlc/` line, so this is not
a code change — the operator should `rm -rf .hook-logs` before committing, or land the ignore entry
in a separate change. Flagging so it is not committed by accident.

#### n10 — Opt-out start date now round-trips through dayjs (FR-1 "byte-identical", for the record)

Baseline passed the caller's `getStartDate` return straight through as `startDate`.
`resolveAllDayCreateRange` (`all-day.create.ts:35`) now re-formats it with `YEAR_MONTH_DAY_FORMAT`.
Both real callers already return exactly that format (Week via the new wrapper, Day via
`getDateStrByXY(..., YEAR_MONTH_DAY_FORMAT)`), so this is a no-op today. Noting only because FR-1's
"byte-identical" claim is one dayjs round-trip weaker than it reads. **No action.**

#### n11 — `handOffDraft` silently no-ops when neither callback is supplied

`useAllDayDraftCreation.ts:82-89`. On the *opt-in* path this now leaves an orphan
`activity: "creating"` draft in the store after `finish()`, where before this change the same
omission merely produced nothing. Not reachable today (Week always passes `onCreateGridDraft`), and
the optionality is pre-existing. Worth a discriminated union on
`UseAllDayDraftCreationOptions` eventually. **No action this run.**

---

## Verified correct — explicitly cleared

These were the review's priority items and they hold up.

**1. The clientY pin (FR-3, AC-9, §6) — CORRECT.** `getStartDate` is invoked at exactly two sites in
the whole hook: `:73` (mousedown, where `event.clientY` *is* the press y and is therefore correct)
and `:118` (inside `resolveRangeForPointer`, passing `pointerStart.y`). `pointerStart` is a `const`
object literal created at `:100` and never reassigned or mutated. `resolveRangeForPointer` takes
only `clientX` as a parameter, so there is no live y in scope to leak. `finish()` and
`handleMouseMove` both call it with `mouseEvent.clientX` only. Mutation A confirms the pin changes
observable behaviour and is caught (see M2 for *where* it is caught).

**2. Day-view safety (FR-1, FR-15, AC-11) — CORRECT.** The opt-out returns at `:91-96`, before
`gestureRef.current?.cancel()` and before any `addEventListener`. The new `useRef`/`useEffect` are
inert with the flag off: `gestureRef.current` is never assigned, so the unmount cleanup at `:53`
dereferences `null` through `?.` and does nothing. The return value is still a bare arrow
`(event: ReactMouseEvent<HTMLElement>, calendarId: CalendarId | null = null) => void` — FR-2 held.
`packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx:331` is untouched (absent from
both `git diff --name-only 4189de1` and the untracked set) and compiles because
`isMultiDayDragEnabled` is optional. The test at `:442` proves zero `mousemove`/`mouseup`/`blur`
registrations and that a subsequent window move+up changes nothing.

**3. Listener lifecycle (FR-7, FR-10, NFR-5, AC-7) — CORRECT in the source.** All three terminal
paths (`finish`, `cancel`, unmount) funnel through the single `cleanup()` at `:122-127`, which
removes all three listeners with flags matching the registrations at `:208-210` (`true`, `true`,
default). The `isFinished || isCancelled` guard is the **first** statement in both `finish` and
`cancel`, so an already-terminated gesture returns before touching `gestureRef` — meaning a stale
gesture cannot null out a successor's ref. The `buttons !== 1` path at `:180-183` routes through
`finish()`, so it cleans up; the test at `:424` confirms no second draft on the later `mouseup`.
The *testing* of this is where M3 applies.

**4. Range math (FR-4, FR-5, NFR-7) — CORRECT.** `resolveAllDayCreateRange` normalises with a single
`isBefore(…, "day")` comparison, applies `add(1, "day")` to the max side only, and formats both ends
with `YEAR_MONTH_DAY_FORMAT`. Pure — no closure state, no branching on its own output. All 10 unit
tests in `all-day.create.test.ts` are real assertions with literal expected values; I found no
vacuity there. Month-boundary and N-day cases both check out.

**5. The D8 form-opening chain — INDEPENDENTLY VERIFIED.** This was the change's most load-bearing
unverified claim, since the new capture-phase `stopPropagation()` at `:156` prevents
`useGridMouseUp.ts:88`'s `#root` listener from ever seeing the release — and that listener's
`commitOnMouseUp` → `setFormOpen(true)` was one of the paths that opened the form before. I traced
the replacement: `useDraftActions.ts:369-383` `handleChange` calls `setIsFormOpen(true)` when
`activity === "gridClick"`, its `useCallback` deps include `activity`, and
`useDraftEffects.ts:62-64` is a bare `useEffect(() => { handleChange(); }, [handleChange])`. The
`"creating"` → `"gridClick"` transition therefore changes `handleChange`'s identity and re-fires the
effect. Week's click- and drag-to-create both still open the form. D8 is sound.

**6. The `YEAR_MONTH_DAY_FORMAT` plan deviation — the orchestrator's call was CORRECT.** D3 told
codegen to drop the import from `AllDayRow.tsx`; it is still used at `AllDayRow.tsx:131`
(`key: date.format(YEAR_MONTH_DAY_FORMAT)` in the `visibleDates` map). Removing it would not
compile. The two imports that *did* become dead — `GridEventDraft` and `draftActions` — were both
correctly removed. I checked every remaining import in the file: `MouseEvent` (`:30, :77, :106`),
`useMemo` (`:141`), `RefCallback` (`:21-22`), `DateCalcs` (`:20`), `FC`, `ReactNode`,
`Measurements_Grid`, `WeekProps`, `GRID_Y_START`, `AllDayEvents`, `AllDayGridRow`,
`useWeekEventViewModel` are all live. **No dead import remains.**

**7. Repo conventions (NFR-3) — CLEAN.** No `any`, no `@ts-expect-error`, no `@ts-ignore` anywhere
in the write set. No barrel files added. No `data-*`, `querySelector`, `container.` or `.className`
locators in either new test file — every query is `getByRole("button", { name: … })`. Path aliases
correct; the one relative import (`./useDateCalcs` in `useAllDayGridDraftCreation.ts:6`) is
same-directory and mirrors the sibling `useTimedGridDraftCreation.ts:5` exactly. One component per
file. The new constant is separately named per FR-6 and the file's doc comment was extended as D4
required.

**8. The 3 original hook tests are UNMODIFIED.** `git diff 4189de1` on
`useAllDayDraftCreation.test.tsx` touches only the import block, the `renderHarness` signature, and
appends after the original EOF (hunk `@@ -108,3 +191,281 @@`). The three original `it(...)` bodies
at `:143-192` are byte-identical to baseline. Final count is 18 = 3 original + 15 new, matching
change_plan §7.2's 14-case table plus the 1 mandated by its closing prose (`:424`, the
`buttons`-omitted release-outside-the-window case). Confirmed by running the suites: 33 pass across
the three files.

**9. `.gitignore` (FR-17, AC-13) — CORRECT.** Exactly one line added (`.sdlc/`), inserted into the
sorted `# DIRS #` block. No pre-existing line reordered, rewritten or removed.

**10. PII and authz — no surface touched.** This is a client-side pointer gesture. No network call,
no persistence, no logging, no new field, no route, no role check. Requirements §6 and §7 are
accurate as written; nothing to encrypt, mask or guard. The exclusive-end convention is preserved,
so no date is silently shifted.

**11. Docs (`docs/frontend/week-drag-interaction.md`) — good.** The new section documents the pin,
the rollover trap, the x-only threshold rationale, and the mouseup-completion change with a "do not
'fix' it by moving the handoff back to mousedown" warning. This is the kind of doc that survives.
One consequence of M4: the sentence *"The rollover is guarded twice over, and both guards are
covered by tests"* is currently untrue and becomes true once RP-002 lands.

---

## Note (informational, out of scope)

`bun test <file>` is not self-contained: `packages/web/src/common/constants/env.constants.ts:10`
throws `PORT is required when API_BASEURL is not configured` unless `PORT` or `API_BASEURL` is in
the ambient environment, and jsdom requires `--preload ./packages/web/src/__tests__/web.preload.ts`.
`packages/scripts/src/testing/test-parallel.ts:108` forwards `process.env` rather than loading a
committed fixture, so there is no `.env.test` in the repo. This is **pre-existing**, affects the
whole web suite equally, and this run introduces no new required env var — so it is not a finding
against this change. Recorded only because it cost me a cycle to reproduce the suites and will cost
the next reviewer the same. Working invocation:

```
TZ=Etc/UTC NODE_ENV=test PORT=3000 bun test \
  --preload ./packages/web/src/__tests__/web.preload.ts <files>
```

---

## Refinement packets

```json
[
  {
    "id": "RP-001",
    "phase": "refine",
    "task_type": "lint_fix",
    "module": "web/grid+views/Week",
    "artifact_path": [
      "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx",
      "packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx"
    ],
    "instruction": "Resolve the 3 Biome errors introduced by this run. Run Biome SCOPED TO THESE TWO FILES ONLY: `bunx biome check --write packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx`. DO NOT run `bun lint:fix` — it is `biome check --write .` (repo-wide) and would auto-fix 10 pre-existing FIXABLE warnings in packages/sync/**, DescriptionEditor.tsx, GridEvent.tsx and others, expanding the write set and breaking AC-14/NFR-6. The three errors are: (a) useAllDayDraftCreation.test.tsx ~line 310, the `await waitFor(() => expect(useDraftStore.getState().gridDraft).toBeNull());` call must wrap across three lines; (b) useAllDayDraftCreation.test.tsx lines 471-472, doubled trailing blank line at EOF; (c) useAllDayGridDraftCreation.test.tsx, `import { type DateCalcs } from './useDateCalcs'` must sort after `import { useAllDayGridDraftCreation } from './useAllDayGridDraftCreation'`, and `const surface = () => screen.getByRole(...)` at lines 91-92 collapses to one line. Change no test logic and no assertion.",
    "acceptance": [
      "`bun lint` reports 0 errors (10 pre-existing warnings may remain).",
      "`git diff --name-only 4189de1` plus the untracked set still lists exactly the 10 declared write-set paths — no file outside the write set is modified.",
      "All 33 targeted tests still pass: TZ=Etc/UTC NODE_ENV=test PORT=3000 bun test --preload ./packages/web/src/__tests__/web.preload.ts packages/web/src/grid/interaction/math/all-day.create.test.ts packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx"
    ]
  },
  {
    "id": "RP-002",
    "phase": "refine",
    "task_type": "test_hardening",
    "module": "web/grid/hooks",
    "artifact_path": ["packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx"],
    "instruction": "Close 5 mutation-proven coverage gaps in the multi-day drag describe block. Do NOT touch the 3 original tests in the first describe block, do not touch any source file, and keep every existing test. (1) FR-3 diagonal pin: add a test that presses at (50, 5), fires `fireEvent.mouseMove(window, { buttons: 1, clientX: 250, clientY: 2000 })`, releases at (250, 2000), and asserts the draft is { start: '2026-05-18', end: '2026-05-21' }. This must fail if useAllDayDraftCreation.ts:118 passes mouseEvent.clientY instead of pointerStart.y. Also correct the now-misleading comment at lines 384-385 of the existing vertical-drag test, which claims that test guards the resolver — it does not; the threshold short-circuits first. (2) D5 x-only threshold: in the existing 'keeps a purely vertical drag on the pressed column' test, add assertions BETWEEN the move and the release that `useDraftStore.getState().gridDraft` is null and `useDraftStore.getState().status?.activity ?? null` is null, proving the pinned threshold prevented any store write. (3) NFR-5 listener identity: replace `listenerCountFor` with a helper that maps each matching spy call to its `(handler, capture ?? false)` pair, and in 'removes every listener it added once the drag completes' assert every added pair has a matching removed pair for each of mousemove/mouseup/blur. This must fail if a removeEventListener capture flag is changed from true to false. (4) NFR-4 dedupe: in the preview test, spyOn(draftActions, 'setGridDraft'), drive two moves that resolve to the SAME column (e.g. moveTo(250) then moveTo(280)), assert setGridDraft was called at most once, and mockRestore in a finally block. (5) FR-10 below-threshold: in 'leaves the store untouched when a blur arrives below the threshold', spyOn(draftActions, 'discard') and assert it was not called (restore the spy before the file-level afterEach teardown runs). (6) FR-7 re-entrancy: add a test that presses at 50, presses at 50 again without releasing, then releases at 50, and asserts exactly one draft was handed off. Follow the file's existing conventions: semantic getByRole queries only, no data-* or CSS locators, no `any`, no @ts-expect-error, every spy restored in a finally block.",
    "acceptance": [
      "The 3 original tests in the first `describe(\"useAllDayDraftCreation\")` block are byte-identical to 4189de1.",
      "The suite passes: TZ=Etc/UTC NODE_ENV=test PORT=3000 bun test --preload ./packages/web/src/__tests__/web.preload.ts packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx",
      "Mutation-verified: with useAllDayDraftCreation.ts:118 changed to pass a live mouseEvent.clientY, this suite FAILS.",
      "Mutation-verified: with useAllDayDraftCreation.ts:188 changed to `y: mouseEvent.clientY`, this suite FAILS.",
      "Mutation-verified: with useAllDayDraftCreation.ts:124 changed to `removeEventListener(\"mouseup\", handleMouseUp, false)`, this suite FAILS.",
      "Mutation-verified: with the isSameAllDayCreateRange short-circuit at useAllDayDraftCreation.ts:132 removed, this suite FAILS.",
      "Mutation-verified: with the `if (isPreviewStarted)` guard at useAllDayDraftCreation.ts:170 removed, this suite FAILS.",
      "Mutation-verified: with `gestureRef.current?.cancel()` at useAllDayDraftCreation.ts:98 removed, this suite FAILS.",
      "No source file under packages/web/src/grid/hooks/ or packages/web/src/views/ is modified — tests only.",
      "`bun lint` reports 0 errors and `bun type-check` passes."
    ]
  },
  {
    "id": "RP-003",
    "phase": "refine",
    "task_type": "test_cleanup",
    "module": "web/views/Week/hooks/grid",
    "artifact_path": ["packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx"],
    "instruction": "Remove dead harness machinery. The `drafts: GridEventDraft[]` array (line 68) and the `useDraftStore.subscribe(...)` block that fills it (lines 82-86) are never read by any of the 5 tests — all of them assert through `storedDates()` or `useDraftStore.getState()` directly. Worse, the subscription is only torn down by a manual `unsubscribe()` at the end of each test body, so it leaks across tests if any assertion throws. Delete the `drafts` array, the `subscribe` call, and the `unsubscribe` entry in the returned object, then remove the now-dead `unsubscribe` destructuring and the trailing `unsubscribe();` call from all 5 tests. Drop the `GridEventDraft` import if it becomes unused. Change no assertion. Preserve the excellent 'pins clientY to the press for every resolution during the gesture' test exactly as-is — it is currently the only test in the repo that catches removal of the clientY pin.",
    "acceptance": [
      "All 5 tests still pass: TZ=Etc/UTC NODE_ENV=test PORT=3000 bun test --preload ./packages/web/src/__tests__/web.preload.ts packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx",
      "No `useDraftStore.subscribe` call remains in the file.",
      "The 'pins clientY to the press for every resolution during the gesture' test still fails when useAllDayDraftCreation.ts:118 passes a live mouseEvent.clientY.",
      "`bun lint` reports 0 errors and `bun type-check` passes."
    ]
  },
  {
    "id": "RP-004",
    "phase": "refine",
    "task_type": "docs_edit",
    "module": "docs/frontend",
    "artifact_path": ["docs/frontend/week-drag-interaction.md"],
    "instruction": "Only after RP-002 lands. The 'The clientY pin' section currently ends with 'The rollover is guarded twice over, and both guards are covered by tests.' That was false at the time of review — the x-only threshold guard had no test, and the resolver pin was covered by exactly one test in the Week wrapper suite. Once RP-002 adds the diagonal-drag case and the store-untouched assertions, the sentence becomes true; leave it. If RP-002 is descoped, change the sentence to name precisely which guard each test covers rather than claiming both are covered. Add one sentence naming the two tests by title so a future reader can find them.",
    "acceptance": [
      "Every claim in the 'The clientY pin' section maps to a test that exists and fails when the corresponding guard is removed.",
      "No source or test file is modified by this packet.",
      "`bun lint` reports 0 errors."
    ]
  }
]
```

### Operator action, no packet

- `rm -rf .hook-logs` before committing (n9). It is untracked, unignored, and not part of the
  declared write set; FR-17 forbids adding a second `.gitignore` entry in this run.
