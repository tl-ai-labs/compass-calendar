# Senior code review — Week all-day multi-day drag-to-create

**Run:** `20260824-214500-feature-extend-weekbody-multiday-drag`
**Mode:** brownfield · **Intent:** `feature-extend`
**Baseline:** `main` @ `4189de13` (working tree HEAD is the same commit, so `git diff main` == `git diff HEAD`)
**Reviewer verification:** `bun run test:web` → **2330 pass / 0 fail** (99.3s, exit 0, re-run by me, not taken on trust).
`bun run type-check` → **exit 0** (root, `tsconfig.app.json`, and `tsconfig.test.json`).
`bun run lint` (repo-pinned biome 2.4.12) → **0 diagnostics on all five changed/new `packages/` files**.

---

## 1. Verdict

### `approve-with-nits`

The feature is correctly implemented against `requirements.md` and `change_plan.md`. All six hard
constraints hold and were verified with git, not by reading prose. The exclusive-end convention is
implemented with no click special-case; the click path is genuinely the `n = 0` case of the same
function. All four listeners are removed with matching capture flags on every teardown path. The
`isDrafting`-closure reasoning in §8.3 is sound against the actual code. Type-check is clean, no
`any`, no swallowed errors, no debug remnants, no `mock.module`.

There are **no blockers and no majors**. Three minor findings (one defensive-parity gap in the hook,
two test-coverage gaps) and five nits. None of them justify holding the change; all of them are cheap
and land in allowlist files, so I have specced packets for the minors and left the call to the
orchestrator.

Not applicable to this change and explicitly checked: **authz** (no routes, no role checks — this is
a pure client-side pointer gesture), **PII** (no personal data enters or leaves the changed code;
draft titles are never touched), **env fixtures** (the web package has no validating `ConfigModule`
/ Joi / Zod config schema in the changed path; the per-line-19 blocker rule does not apply).

---

## 2. Constraint verification table

| # | Constraint | Result | Evidence |
|---|---|---|---|
| 1 | `useTimedDraftCreation.ts` UNCHANGED, `isSameDayDrag` byte-identical | **PASS** | `git diff main --stat -- packages/web/src/grid/hooks/useTimedDraftCreation.ts` → empty. `git status --short <path>` → empty. The file does not appear in `provenance.json:files_touched`. Read it anyway: `isSameDayDrag` is still at line 104 (`pointerDate.isSame(start, "day")`) and the same-day-only branch structure at 110-117 is intact. It is also on the write-contract `off_limits` list. |
| 2 | `packages/web/src/views/Day/**` UNCHANGED | **PASS** | `git diff main --stat -- packages/web/src/views/Day/` → empty; `git status --short packages/web/src/views/Day/` → empty. No Day path in `provenance.json`. `DayCalendarGrid.tsx:331-334` still passes exactly `{ getStartDate, onCreateGridDraft }` — no opt-in flag — and still consumes the return value as a bare 2-arg function at line 363. |
| 3 | No new dependencies | **PASS** | `git status --short -- package.json bun.lock packages/*/package.json` → empty, re-checked *after* running `bun run type-check` (the `bunx` "Saved lockfile" lines write to bun's own cache, not the repo lockfile). No new imports outside `@web/*` / `@core/*` in any changed file. |
| 4 | Click / sub-threshold non-regressed: single-day draft, `endDate = start + 1 day`, same callback, same `gridClick` activity | **PASS** | Same-callback is structural, not duplicated: both the click branch (`useAllDayDraftCreation.ts:254-257`) and `finish()` (`:149`) call the single `commitAllDayDraft` (`:61-77`), whose body is the verbatim move of `main`'s lines 53-64. Range: `resolveAllDayCreateRange(anchor)` with pointer omitted → `pointer = anchorDate` → `endDate = anchor + 1 day` (`all-day.create.ts:25,36`), identical expression to `main`'s `dayjs(startDate).add(1,"day").format(YEAR_MONTH_DAY_FORMAT)`. Activity: Week maps `onCreateGridDraft` → `startGridDraft({activity:"gridClick"})` (`AllDayRow.tsx:55-57`, unchanged). Asserted by `useAllDayDraftCreation.test.tsx` W5/W6, `AllDayRow.test.tsx:152-173` (asserts `activity === "gridClick"` and the `05-20 → 05-21` span), and by the untouched assertions in `MainGrid.test.tsx:530-536`. |
| 5 | Day view takes today's code path exactly: commit on mousedown, **no** window listeners registered | **PASS** | `isMultiDayDragEnabled = false` default (`:46`) short-circuits **before** `isEligibleInteractionPointerDown` is even evaluated (`:239-249`, `&&` order). `gestureRef.current` is assigned only inside `startMultiDayGesture` (`:216`), which is unreachable when the flag is off, so the new `gestureRef.current?.cancel()` at `:234` is provably `undefined?.cancel()` — no side effect. The unmount effect (`:53-57`) cancels `null`. Proven by test, not only by reading: **D2** (`test.tsx:189-200`) spies `window.addEventListener` and asserts the mousemove/mouseup/blur/keydown set is `[]`; **D1** (`:173-187`) asserts the commit happens *synchronously during* `fireEvent.mouseDown` and that a later move+up adds nothing. |
| 6 | `MainGrid.test.tsx` edit is the single `fireEvent.mouseUp` line, assertions character-identical | **PASS (with a cosmetic note)** | `git diff main -- .../MainGrid.test.tsx` is a single hunk, `+2` lines: `+    fireEvent.mouseUp(window, { clientX: 100, clientY: 0 });` and one blank separator line. Nothing else in the 750-line file changed. The assertion block (`end: new Date("2024-01-15")` / `start: new Date("2024-01-14")`, lines 530-536) is untouched — it is not even inside the diff hunk, which is the strongest possible evidence for AC-3. The blank line is a formatting separator, not a second edit; I read this as inside the narrow human-approved exception, but flagging it so the record is exact. |

**Additional contract check (not requested, verified anyway):** every path in
`provenance.json:files_touched` matches the write-contract `allowlist`; nothing on `off_limits` was
written. `.claude/settings.json` shows as modified in `git status`, but its mtime is `2026-08-22
22:51` — two days before this run — and it is absent from `provenance.json`. Pre-existing, not this
run.

---

## 3. Findings

### Blockers — none

I looked specifically for: a commit that can outlive cancellation, a listener removed with a
mismatched capture flag, an off-by-one in the exclusive end, suppression of the first preview, and a
Day-view behaviour change. None of them are present. Details in §3.4 (verification notes).

### Majors — none

### Minors

**MIN-1 — `startMultiDayGesture` does not cancel a still-armed previous gesture, diverging from the
mirrored template.**
`packages/web/src/grid/hooks/useAllDayDraftCreation.ts:239-252` (arming) and `:212-216` (registration).

`useTimedDraftCreation.ts:73` calls `gestureRef.current?.cancel();` immediately before building a new
gesture. The all-day hook only has that call inside the `if (isDrafting)` branch (`:234`). Those two
are not equivalent: `isDrafting` is store state that is **false for an armed-but-not-yet-previewing
gesture** (nothing is written to the store until the move threshold is crossed — `:128-129`). So a
second eligible mousedown arriving while gesture A is armed-without-preview walks straight past the
guard at `:230` into `startMultiDayGesture`, which registers a **second** set of four listeners and
overwrites `gestureRef.current` (`:216`) — orphaning A's handle.

Consequences once orphaned: (a) the next `mouseup` runs both gestures' `finish`, committing two
drafts (the second replaces the first, so the user sees a silently wrong span); (b) whichever gesture
finishes first runs `cleanup()`, which nulls `gestureRef.current` unconditionally (`:96`) — including
when the ref belongs to the *other*, still-live gesture, after which unmount can no longer cancel it
and a commit can land after the component is gone.

Reachability is low but not zero: it needs a `mouseup` that never reached the window (release outside
the browser frame / over browser chrome) followed by a fresh press that arrives before any
`mousemove` — plus it is trivially reachable from any synthetic event source. It matters because the
one-line defence already exists in the file this hook was mirrored from, and dropping it is the kind
of divergence that is invisible until it produces a "draft appeared after I closed the view" bug
report.

Fix: add `gestureRef.current?.cancel();` as the first statement of `startMultiDayGesture` (`:79-82`),
matching `useTimedDraftCreation.ts:73`. It is a no-op in every normal flow.

**MIN-2 — The teardown tests cannot fail if a listener is *not* removed, so capture-flag correctness
is untested.**
`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:287` (W7), `:304` (W8), `:318` (W9).

W7/W8/W9 prove the *behaviour* after teardown (no commit, no store draft), but they cannot detect a
removal failure, because `cleanup()` runs after `isCancelled = true` / `isFinished = true`: a leaked
listener re-entering `handleMouseMove` (`:167`), `handleMouseUp` → `finish` (`:133`), or
`handleKeyDown` → `cancel` (`:153`) returns immediately at the guard. A `removeEventListener` call
with the wrong `capture` flag would therefore leave four permanently-registered closures on `window`
per gesture and **every existing test would still pass**.

I verified the flags by inspection and they are correct — `mousemove`/`mouseup`/`keydown` added and
removed with `true` (`:212-215` vs `:92-95`), `blur` added and removed with the default `false`
(`:214` vs `:94`) — so this is a test-quality gap, not a live defect. It matters because Gate 2 (R-3)
accepted the net-new Escape ownership *on the condition that teardown paths get real coverage*, and
the coverage that exists does not discriminate the failure mode the design itself flagged as
"silently fails to remove a listener".

Fix: spy `window.removeEventListener` and assert the four `(type, capture)` pairs after each of
mouseup, `buttons !== 1`, Escape, blur, unmount, and re-press. The `armedGestureListeners` helper at
`:38-43` already establishes the pattern for the `addEventListener` side.

**MIN-3 — Two behaviours named in the requirements have no test: the preview *shrinking*, and the
first preview inside the anchor column.**
`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:344` (W11) is the only suppression test.

- FR-4 says the bar "grows **and shrinks** with the pointer". Every drag test (W2/W3/W4) moves
  outward once and stops. Nothing exercises out-then-back — i.e. that a second `previewDraft` with a
  *narrower* range passes `isSameAllDayCreateRange` (`all-day.create.ts:41-48`) and rewrites the
  store via `setGridDraft` (`:124`). The code is correct by inspection, but the shrink direction is
  currently protected only by the suppression test's negative assertion.
- §8.3 calls out explicitly that the write-suppression is bypassed for the first preview "so the bar
  always appears the instant the threshold is crossed, **even inside the anchor column**". That exact
  case — press at x=50, move to x=60 (past the 4px threshold, same column) → `startGridDraft` with
  the one-day range — is untested. W5 covers sub-threshold (no preview) and W2 covers cross-column;
  the in-column-but-past-threshold case falls between them.

Both are cheap additions to an allowlist file and would pin the two properties the design document
argues for in prose.

### Nits

**NIT-1 — The draft-construction expression is duplicated.**
`useAllDayDraftCreation.ts:65-69` (`commitAllDayDraft`) and `:117-121` (`previewDraft`) contain the
identical `createGridEventDraft(allDayGridSchedule(range.startDate, range.endDate), undefined,
calendarId)`. Extracting a `buildAllDayDraft(range, calendarId)` would make it structurally
impossible for the preview and the commit to build differently-shaped drafts — which is precisely the
invariant the feature depends on. Five duplicated lines; not worth blocking, worth doing if MIN-1 is
dispatched anyway.

**NIT-2 — W10's assertion is weaker than its name.**
`test.tsx:335-341` is titled "a move reporting no held button commits, covering release outside the
window" but asserts only `toHaveBeenCalledTimes(1)`. It does not assert *what* was committed, so it
would still pass if `hasMoved`-vs-`!hasMoved` branch selection in `finish` (`:142-147`) inverted and
the commit silently became a 4-day span. Add `expectCommitted(onCreateGridDraft, oneDaySchedule)`.

**NIT-3 — Commit recomputes the range from the mouseup coordinates rather than reusing `lastRange`.**
`useAllDayDraftCreation.ts:142-147`. In principle the committed span can differ from the last
previewed span if the final pointer position is not reflected in a delivered `mousemove`. This
mirrors `useTimedDraftCreation` exactly and recomputing is arguably the more correct of the two
choices; I am recording it as an observation, **not** asking for a change.

**NIT-4 — A stranded armed gesture swallows Escape app-wide until the next pointer event.**
`useAllDayDraftCreation.ts:202-210`. The capture-phase `stopPropagation()` is correctly scoped —
the listener exists only between arming and teardown, so Escape outside a gesture is never touched
(this answers the review question directly: it *cannot* swallow Escape outside a gesture). The one
residual window is a gesture stranded by a lost mouseup (same scenario as MIN-1), during which Escape
is consumed until the next `mousemove` finishes the gesture. Sub-second in practice; MIN-1's fix does
not address it and I do not think anything should.

**NIT-5 — Not code, but it will turn CI red: this run's own `.sdlc` artifacts fail `bun run lint`.**
`biome.json:146-159` includes `**` with no `.sdlc` exclusion, and `.sdlc` is not in `.gitignore`.
`bunx --bun biome check .sdlc/runs/20260824-214500-feature-extend-weekbody-multiday-drag/` → **4
errors** (formatter diffs in the JSON/JSONL artifacts and in the `backups/*.ts` copy). A prior run
(`c3504265`) established the practice of committing run directories; doing that here without running
`bun run format` on them first will fail the `lint` job in `.github/workflows/test-unit.yml:51-53`.
`packages/` itself is clean for this run (8 pre-existing biome errors elsewhere in `packages/` and
`self-host/` predate it and are out of scope). `.sdlc/**` and `biome.json` are outside the write
allowlist, so this is a process step for the orchestrator, not a code packet.

### Verification notes on the specific items the invocation asked me to scrutinise

- **Exclusive end, no click branch.** `all-day.create.ts:21-38` has exactly one branch — reverse
  normalisation — and no click/`n = 0` special case. Forward `D₀…Dₙ` → `start = D₀`,
  `inclusiveEnd = Dₙ`, `endDate = Dₙ + 1 day`. Reverse swaps the two before the same `+1 day`. The
  click reaches it via `pointerDate` omitted → `pointer = anchorDate` (`:25`) → `endDate = anchor + 1
  day`. No double-count, no off-by-one. Independently corroborated by the layout side:
  `event.position.ts:158-161` reads `endDate` as exclusive (`exclusiveEnd.subtract(1,"day")`), so a
  4-day draft (`05-20 → 05-24`) sizes to 4 columns. `allDayGridSchedule`
  (`grid-event-draft.adapter.ts:202-212`) parses with dayjs (local), so no UTC-midnight day-shift is
  introduced by the string pass-through.
- **Listener lifecycle, all six teardown paths.** mouseup → `handleMouseUp` → `finish` → `cleanup`
  (`:191-193`, `:132-138`); mousemove with `buttons !== 1` → `finish` → `cleanup` (`:171-174`);
  Escape → `cancel` → `cleanup` (`:202-210`, `:152-158`); blur → `cancel` → `cleanup` (`:195-197`);
  unmount → `useEffect` cleanup → `gestureRef.current?.cancel()` → `cleanup` (`:53-57`); re-press →
  `gestureRef.current?.cancel()` in the `isDrafting` branch → `cleanup` (`:234`). Every one funnels
  through the single `cleanup()` (`:91-97`), and its four `removeEventListener` calls match their
  `addEventListener` counterparts on both function identity and capture flag. **PASS** — with MIN-2's
  caveat that the tests would not catch a regression here.
- **Leak safety.** A commit cannot follow a cancellation: `finish` guards on `isFinished ||
  isCancelled` (`:133`) and `cancel` sets `isCancelled` synchronously before any await-free work
  (`:157`). A preview cannot land after cancellation: `previewDraft` re-checks *after* the
  consumer-supplied `getStartDate` call (`:107-110`), which is the correct place — that is the only
  re-entrancy window. `cancel()` discards only when `isPreviewStarted` (`:161`), so it can never blow
  away a draft the gesture did not create. The one way a gesture can outlive its component is the
  double-arm path in MIN-1.
- **The `isDrafting` closure argument.** Holds. The returned callable (`:219-258`) is the only reader
  of `isDrafting`; none of `handleMouseMove`, `handleMouseUp`, `handleWindowBlur`, `handleKeyDown`,
  `finish`, `cancel`, `previewDraft` or `commitAllDayDraft` references it. When `previewDraft` writes
  the store the component re-renders and produces a *new* callable, but the four live listeners are
  the previous invocation's function objects and are never re-created. So the guard can only be
  evaluated on a subsequent mousedown — exactly as §8.3 claims.
- **Store writes.** First preview → `startGridDraft({activity:"creating", draft})` (`:128-129`);
  subsequent → `setGridDraft` (`:124`); commit → `onCreateGridDraft` → Week's
  `startGridDraft({activity:"gridClick"})` (`AllDayRow.tsx:56`). Suppression **cannot** hit the first
  preview: the condition is `isPreviewStarted && isSameAllDayCreateRange(...)` (`:112`) and
  `isPreviewStarted` is false until the first write completes; `lastRange` is likewise only assigned
  on a write (`:116`), and `isSameAllDayCreateRange(null, …)` returns `false` anyway
  (`all-day.create.ts:45`). Store semantics re-read and confirmed: `startGridDraft`
  (`draft.store.ts:66-96`) replaces `gridDraft` outright and overwrites all four status fields, so
  the `"creating"` preview leaves no residue at commit and no pre-discard flash is needed. The
  `"creating" → "gridClick"` form-open link is real: `useDraftActions.ts:369-383` opens the form for
  `keyboardEdit | createShortcut | gridClick` only, with `"creating"` deliberately excluded, and
  `handleChange`'s `useCallback` deps `[isDrafting, activity, setIsFormOpen]` guarantee the effect
  re-fires on the activity transition. `useGridMouseUp.ts:88` listens on `#root`, which the
  window-capture `stopPropagation()` in `finish` (`:140`) pre-empts — and it would early-return
  anyway (`:74`).
- **Escape.** Net-new, capture-phase, scoped to a live gesture (registered `:215`, removed `:95`).
  Cannot swallow Escape outside a gesture. See NIT-4 for the only residual window.
- **Test quality / global-state leakage.** The 32 new assertions-bearing tests (16 hook + 14 math +
  2 row) exactly account for the 2298 → 2330 delta. No tautological cases found: every negative
  assertion has a positive counterpart that would fail if the branch inverted (W1/W3, W5/W2,
  W12/W2). `mock.module` appears nowhere in the new tests — the only hit is the explanatory comment
  at `AllDayRow.test.tsx:22-24`; `AllDayRow.test.tsx:25-36` seeds a per-test `QueryClient` through
  `useState` inside a local provider, which is process-local. All `spyOn` usages
  (`test.tsx:189/257/344/363`) restore in `finally`. Store state is reset in `afterEach`
  (`test.tsx:115-117`, `AllDayRow.test.tsx:122-125`). Full-suite green at 2330 with zero cross-file
  fallout confirms the `mock.module` leak that broke 72 tests is gone.

---

## 4. Refinement TaskPackets

No blocker or major findings, so **no packet is required to approve this change**. The three packets
below correspond to MIN-1/2/3 (plus the two cheap nits) and are safe to dispatch cost-efficiently.
Every target is on the write-contract allowlist — **no HALT is needed for any of them**.

### TP-R1 — Restore the pre-arm gesture cancel (MIN-1)
- **task_type:** `code-fix`
- **file:** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` (allowlisted)
- **instruction:** Add `gestureRef.current?.cancel();` as the first statement inside
  `startMultiDayGesture` (before `const pointerStart = …` at line 83), mirroring
  `useTimedDraftCreation.ts:73`. Do not touch any other line, do not change the `isDrafting` branch
  at `:230-237`, and do not remove the existing `gestureRef.current?.cancel()` at `:234`.
- **acceptance:**
  1. `bun run test:web` → 2330 pass / 0 fail (or higher if TP-R2/R3 landed first), 0 fail.
  2. `bun run type-check` exits 0.
  3. A new test proves it: arm a gesture (mousedown, no move), fire a second eligible mousedown
     without an intervening mouseup, then a single mouseup — `onCreateGridDraft` is called exactly
     **once**.
  4. `git diff main -- packages/web/src/grid/hooks/useTimedDraftCreation.ts` and
     `-- packages/web/src/views/Day/` both remain empty.

### TP-R2 — Assert listener removal, not just post-teardown inertness (MIN-2)
- **task_type:** `test-extend`
- **file:** `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` (allowlisted)
- **instruction:** Add a `removeEventListener` spy helper alongside the existing
  `armedGestureListeners` (`:35-43`) that captures `[type, capture]` pairs. Assert that after **each**
  teardown path — mouseup, `mousemove` with `buttons: 0`, Escape, blur, unmount, and re-press over a
  live preview — the gesture removed exactly `("mousemove", true)`, `("mouseup", true)`,
  `("keydown", true)` and `("blur", undefined|false)`. Deliberately assert the capture flag: a
  mismatched flag is the specific silent failure this covers. Restore the spy in a `finally`, as the
  existing spies do.
- **acceptance:**
  1. The new assertions **fail** if any `capture` argument in `cleanup()`
     (`useAllDayDraftCreation.ts:92-95`) is flipped or dropped — state in the packet result how this
     was demonstrated.
  2. `bun run test:web` → 0 fail; the file's existing 19 cases are unmodified.
  3. No `mock.module`; no listener spy left installed across tests.

### TP-R3 — Cover the shrink direction, the in-anchor-column first preview, and W10's payload (MIN-3, NIT-2)
- **task_type:** `test-extend`
- **file:** `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` (allowlisted)
- **instruction:** Add two cases and strengthen one.
  (a) **W15 shrink:** press at `clientX: 50`, move to `350` (4-day preview), move back to `150`, and
  assert the store draft is now the 2-day span `05-20 → 05-22` — i.e. `setGridDraft` was called again
  with the narrower range.
  (b) **W16 first preview inside the anchor column:** press at `clientX: 50`, move to `clientX: 60`
  (past `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4`, same column) and assert
  `startGridDraft({activity:"creating"})` fired with the one-day span — proving the write-suppression
  never blocks the first preview.
  (c) **W10** (`:335`): add `expectCommitted(onCreateGridDraft, oneDaySchedule);` after the existing
  call-count assertion.
- **acceptance:**
  1. `bun run test:web` → 0 fail, count increases by 2.
  2. (b) fails if `isPreviewStarted &&` is removed from the suppression condition
     (`useAllDayDraftCreation.ts:112`) — that mutation must break at least one assertion.
  3. No changes outside this file.

### Optional — TP-R4 — Extract the shared draft builder (NIT-1)
Only worth dispatching if TP-R1 is already touching the hook. Extract
`buildAllDayDraft(range, calendarId)` and call it from both `commitAllDayDraft`
(`useAllDayDraftCreation.ts:65-69`) and `previewDraft` (`:117-121`). Acceptance: `bun run test:web`
0 fail, `bun run type-check` 0, and the preview and commit demonstrably construct drafts through one
expression.

### Pre-commit process step (NIT-5, not a code packet)
Before committing the run directory, run `bun run format` over
`.sdlc/runs/20260824-214500-feature-extend-weekbody-multiday-drag/` (or exclude the `backups/`
subtree), then confirm `bunx --bun biome check .sdlc/runs/20260824-214500-*/` reports 0 errors.
Otherwise the `lint` job in `.github/workflows/test-unit.yml` fails on artifacts rather than on code.

---

## 5. Follow-up ticket candidates (out of scope for this run)

1. **`useTimedDraftCreation.ts` has no test file at all.** Pre-existing gap, explicit Non-goal here,
   confirmed still true (`ls packages/web/src/grid/hooks/` shows no `useTimedDraftCreation.test.*`).
   The timed hook now carries the *only* untested copy of a gesture lifecycle that the all-day hook
   duplicates — file it before the next change to either.
2. **Extract a shared gesture-lifecycle module** from `useTimedDraftCreation` and
   `useAllDayDraftCreation`. The two now share ~90 lines of near-identical `hasMoved` /
   `isCancelled` / `isFinished` / `isPreviewStarted` / `cleanup` machinery, and MIN-1 is exactly the
   class of bug that duplication produces (a defence present in one copy and absent in the other).
   Blocked in this run only because the timed hook is off-limits; do it behind (1).
3. **Reconcile `cross-row.commit.ts`'s "multi-day span collapses on all-day → timed conversion"**
   with the fact that multi-day all-day spans are now user-creatable in one gesture. Flagged by
   discovery, unchanged here; the interaction is now much easier to hit.
4. **Exclude `.sdlc/**` from biome (`biome.json:146-159`) or from git.** Run artifacts are machine
   output; having them lint-gated means every AI-SDLC run must format its own telemetry to keep CI
   green. See NIT-5.
5. **Pre-existing biome errors in `packages/` and `self-host/`** (8 diagnostics: 2 in
   `packages/sync/src/domain/*.db.test.ts`, 2 in
   `packages/web/src/events/recurrence/recurrence-scope-opportunity.store.test.ts`, plus
   `DescriptionEditor.tsx:95`, `ShortcutKeys.tsx:58`, `shortcuts.data.test.ts:3`,
   `GridEvent.tsx:66`, `self-host/docker-compose.test.ts:469`). Untouched by this run; `bun run
   lint` is red on `main` because of them. Worth a cleanup ticket so lint becomes a meaningful gate
   again.
6. **Edge-navigation during an all-day create drag.** Week edge-navigation
   (`useDragEdgeNavigation.ts`) is wired to existing-event drags, not to this gesture, so nothing is
   broken today. But if edge-nav is ever extended to create-drags, the gesture's `getStartDate` is
   captured at mousedown and would resolve x against the *old* week. Worth a note on the edge-nav
   ticket rather than a change here.

---

```json
{
  "module": "week-allday-multiday-drag",
  "verdict": "approved",
  "verdict_detail": "approve-with-nits",
  "constraints": {
    "useTimedDraftCreation_unchanged": "PASS",
    "day_view_unchanged": "PASS",
    "no_new_dependencies": "PASS",
    "click_path_non_regressed": "PASS",
    "day_view_no_listeners": "PASS",
    "maingrid_test_single_line": "PASS"
  },
  "findings": [
    {
      "severity": "minor",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.ts:239-252",
      "issue": "startMultiDayGesture does not call gestureRef.current?.cancel() before arming, unlike useTimedDraftCreation.ts:73. The isDrafting guard does not cover an armed-but-not-previewing gesture, so a second eligible mousedown can double-register listeners, orphan the first gesture's handle, double-commit on release, and let a gesture outlive unmount.",
      "fix": "Add gestureRef.current?.cancel(); as the first statement of startMultiDayGesture."
    },
    {
      "severity": "minor",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:287,304,318",
      "issue": "W7/W8/W9 assert post-teardown inertness, which the isCancelled/isFinished guards provide even if listeners are never removed. A removeEventListener with a mismatched capture flag would leak four closures per gesture and every test would still pass. Capture flags are correct today (verified by inspection) but unprotected.",
      "fix": "Spy window.removeEventListener and assert the four (type, capture) pairs after each of the six teardown paths."
    },
    {
      "severity": "minor",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:344",
      "issue": "No test for the preview shrinking (FR-4 says grows AND shrinks) and none for the first preview inside the anchor column, which is the exact suppression-bypass case change_plan.md 8.3 argues for in prose.",
      "fix": "Add W15 (out-then-back to a narrower span) and W16 (past-threshold move within the anchor column still fires startGridDraft with activity creating)."
    },
    {
      "severity": "nit",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.ts:65-69,117-121",
      "issue": "createGridEventDraft(allDayGridSchedule(...), undefined, calendarId) is duplicated between commitAllDayDraft and previewDraft.",
      "fix": "Extract buildAllDayDraft(range, calendarId) and call it from both."
    },
    {
      "severity": "nit",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:335-341",
      "issue": "W10 asserts only the call count, not the committed span, so an inverted hasMoved branch in finish() would not be caught.",
      "fix": "Add expectCommitted(onCreateGridDraft, oneDaySchedule)."
    },
    {
      "severity": "nit",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.ts:142-147",
      "issue": "finish() recomputes the range from the mouseup coordinates rather than reusing lastRange, so preview and commit could theoretically disagree if a final mousemove is never delivered. Mirrors useTimedDraftCreation; recomputing is arguably more correct.",
      "fix": "No action recommended; recorded as an observation."
    },
    {
      "severity": "nit",
      "file": "packages/web/src/grid/hooks/useAllDayDraftCreation.ts:202-210",
      "issue": "A gesture stranded by a lost mouseup keeps the capture-phase keydown listener alive, swallowing Escape app-wide until the next pointer event. Escape outside a gesture is never affected.",
      "fix": "No action recommended; sub-second window, same root cause as MIN-1."
    },
    {
      "severity": "nit",
      "file": ".sdlc/runs/20260824-214500-feature-extend-weekbody-multiday-drag/",
      "issue": "biome.json includes ** with no .sdlc exclusion and .sdlc is not gitignored; this run's artifacts produce 4 biome errors. Committing them as-is fails the CI lint job. packages/ itself is clean for this run.",
      "fix": "Run bun run format over the run directory before committing, or exclude .sdlc from biome/git."
    }
  ],
  "refinement_packets": [
    {
      "task_type": "code-fix",
      "instruction": "Add gestureRef.current?.cancel(); as the first statement inside startMultiDayGesture in useAllDayDraftCreation.ts (before const pointerStart at line 83), mirroring useTimedDraftCreation.ts:73. Change nothing else; keep the existing gestureRef.current?.cancel() inside the isDrafting branch.",
      "inputs": [
        "packages/web/src/grid/hooks/useAllDayDraftCreation.ts",
        "packages/web/src/grid/hooks/useTimedDraftCreation.ts (read-only reference, off-limits for writes)"
      ],
      "acceptance": [
        "bun run test:web reports 0 fail",
        "bun run type-check exits 0",
        "A new test arms a gesture, fires a second eligible mousedown with no intervening mouseup, then one mouseup, and asserts onCreateGridDraft is called exactly once",
        "git diff main -- packages/web/src/grid/hooks/useTimedDraftCreation.ts and -- packages/web/src/views/Day/ are both empty"
      ]
    },
    {
      "task_type": "test-extend",
      "instruction": "In useAllDayDraftCreation.test.tsx add a window.removeEventListener spy capturing [type, capture] pairs, and assert removal of (mousemove,true),(mouseup,true),(keydown,true),(blur,false|undefined) after each teardown path: mouseup, mousemove with buttons 0, Escape, blur, unmount, and re-press over a live preview. Restore the spy in finally. Do not modify the existing 19 cases.",
      "inputs": [
        "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx",
        "packages/web/src/grid/hooks/useAllDayDraftCreation.ts (read-only)"
      ],
      "acceptance": [
        "Flipping or dropping any capture flag in cleanup() makes the new assertions fail; report how this was demonstrated",
        "bun run test:web reports 0 fail",
        "No mock.module anywhere; no spy left installed across tests"
      ]
    },
    {
      "task_type": "test-extend",
      "instruction": "In useAllDayDraftCreation.test.tsx add W15 (press x=50, move x=350, move back x=150, assert the store draft is the 2-day span 2026-05-20 to 2026-05-22) and W16 (press x=50, move x=60 past the 4px threshold within the anchor column, assert startGridDraft fired with activity creating and the one-day span). Also add expectCommitted(onCreateGridDraft, oneDaySchedule) to W10.",
      "inputs": [
        "packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx",
        "packages/web/src/grid/interaction/math/all-day.create.ts (read-only)"
      ],
      "acceptance": [
        "bun run test:web reports 0 fail and the count rises by 2",
        "Removing 'isPreviewStarted &&' from the suppression condition at useAllDayDraftCreation.ts:112 breaks at least one new assertion",
        "No changes outside this file"
      ]
    }
  ]
}
```
