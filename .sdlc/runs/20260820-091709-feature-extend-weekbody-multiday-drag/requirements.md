# Requirements (delta) — Multi-day drag-to-create in the Week all-day row

- **Run:** `20260820-091709-feature-extend-weekbody-multiday-drag`
- **Mode / intent:** brownfield · `feature-extend` (delta requirements form)
- **Baseline:** `4189de1` on `CMP-101/opus-only`; `bun test:web` = 2298 pass / 0 fail / 302 files
- **Gate 0 decision carried in:** shared-hook **option (a)** — additive opt-in on
  `useAllDayDraftCreation`; `packages/web/src/views/Day/**` is off-limits and must not change.

This is a *delta* document. It states only what changes relative to the code at `4189de1`, plus the
invariants that must survive the change. Behaviour not named here is required to stay bit-identical.

---

## 1. In scope

1. Add a press-and-drag gesture to the Week view's all-day row that creates **one** all-day draft
   spanning every day column the pointer crossed, from press to release.
2. Make the gesture **opt-in** on the shared `useAllDayDraftCreation` hook, defaulting to today's
   click-only behaviour, so the Day view's call site is unaffected without being edited.
3. Give the in-progress span a **live preview** by writing the draft into the Zustand draft store on
   every qualifying move, matching the house pattern set by `useTimedDraftCreation`.
4. Reuse the existing pointer-x → day-column mapping rather than inventing geometry
   (`getVisibleDateIndexByX` / `getNearestDayColumn`, per §4 FR-3).
5. Extend `useAllDayDraftCreation.test.tsx` and add the tests needed to cover the new gesture,
   including its opt-out (click-only) path.
6. Add a `.sdlc/` entry to `.gitignore` (Gate 0 approved; this is the file's only permitted change).

## 2. Out of scope

1. Cross-day drag in the timed `MainGrid`. `useTimedDraftCreation`'s `isSameDayDrag` clamp stays
   exactly as-is, and that file is off-limits.
2. Any change to Day view behaviour or to `packages/web/src/views/Day/**`.
3. Changes to how existing multi-day all-day events **render, resize, or move**
   (`views/Week/interaction/adapter/**` is off-limits — that is the existing-event surface).
4. Touch / `PointerEvent` support beyond the mouse events the current gestures already use.
5. Backend, sync, or `@core` event-schema changes.
6. Playwright e2e / a11y coverage.
7. Vertical (cross-row) drag out of the all-day row into the timed grid, or vice versa.

---

## 3. Current behaviour being extended (the "before")

| Concern | Today at `4189de1` |
|---|---|
| Gesture | `useAllDayDraftCreation` returns a single `onMouseDown`. No `mousemove` / `mouseup` / `blur` listeners exist. |
| Span | Hard-coded: `end = dayjs(start).add(1, "day")` — always exactly one day. |
| Preview | None. The draft is handed to `onCreateGridDraft` immediately on press. |
| Store activity | Week's `AllDayRow` opens it as `activity: "gridClick"`. |
| Consumers | `views/Week/.../AllDayRow.tsx:58` and `views/Day/.../DayCalendarGrid.tsx:331` — both pass only `getStartDate` + `onCreateGridDraft`. |
| Guards | `isRightClick` early-return; `isDrafting` → `draftActions.discard()` and return. |

---

## 4. Functional requirements

### Module: `grid/hooks/useAllDayDraftCreation` (shared hook)

- **FR-1 — Additive opt-in.** The hook gains a new optional option that enables the multi-day drag
  gesture. When the option is absent or falsy, the hook's observable behaviour, its return value's
  call signature, and its store writes are **identical to today's**. The Day view call site compiles
  and behaves unchanged with no edit to `DayCalendarGrid.tsx`.
- **FR-2 — Return-shape compatibility.** Whatever the hook returns must remain directly usable as the
  `onMouseDown` handler both existing call sites pass it as, i.e. `(event, calendarId?) => void`. If
  the design instead returns an object (as `useTimedDraftCreation` does), the Day call site would
  need editing — which is forbidden — so the callable shape is a hard constraint, not a preference.
- **FR-3 — Pointer → day resolution is x-only.** The day column under the pointer must be derived
  from `clientX` alone. The `clientY` fed to the caller's `getStartDate` during a move must be the
  `clientY` captured at mousedown (or another y known to sit inside the all-day row), **never** the
  live move y.
  *Rationale (found during requirements, not in the brief):* `useGridCoordinates.getDateByXY` returns
  `visibleDate.add(getMinuteByY(y), "minutes")`. A pointer dragged far below the grid yields
  >1440 minutes and silently rolls the resolved date to the **next day**. Passing the live y would
  make a purely-vertical drag change the span. `getMinuteByY` already floors at 0, so upward
  excursion is safe; downward is not.
- **FR-4 — Normalised range.** For a press on day index `i` and a release on day index `j`, the
  created draft's start is the date of `min(i, j)` and its (exclusive) end is the date of
  `max(i, j)` **plus one day**. Right-to-left and left-to-right drags over the same two columns
  produce the identical schedule.
- **FR-5 — Exclusive end preserved.** All-day schedules keep the existing exclusive-end convention:
  a single-day draft is `start` → `start + 1 day`, formatted with `YEAR_MONTH_DAY_FORMAT` and
  constructed through `allDayGridSchedule` so dates stay local midnight. An N-column drag yields
  `end - start === N days`.
- **FR-6 — Move threshold.** The gesture only becomes a drag after the pointer exceeds a move
  threshold, evaluated with the existing `hasExceededInteractionMoveThreshold`. Below the threshold
  the interaction is a click and MUST produce today's exact result. `interaction.constants.ts`
  carries an explicit comment forbidding unification of the two existing thresholds, so a **new,
  separately-named all-day constant** is required — do not reuse or re-tune
  `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` or `INTERACTION_MOVE_THRESHOLD_PX`, and extend the file's
  doc comment to say what the new one measures.
- **FR-7 — Gesture lifecycle mirrors `useTimedDraftCreation`.** Window-level `mousemove` / `mouseup`
  listeners registered with `capture: true`, a window `blur` listener, `isFinished` / `isCancelled` /
  `isPreviewStarted` flags, a `cleanup()` that removes all three listeners, a `gestureRef` cancelled
  on unmount, and re-entrancy protection (`gestureRef.current?.cancel()` before starting a new one).
- **FR-8 — Live preview through the store.** Once the threshold is crossed, the first move calls
  `draftActions.startGridDraft({ activity: "creating", draft })` and every subsequent move calls
  `draftActions.setGridDraft(draft)`. No local component state is used for the preview.
- **FR-9 — Terminal handoff.** On `mouseup` the resolved draft is handed to the existing
  `onCreateGridDraft` / `onCreateDraft` callback exactly as the click path does today, so the draft
  enters the existing draft/confirm flow. Nothing is persisted on pointer-up.
- **FR-10 — Cancellation.** Window `blur` cancels the gesture: listeners are removed and, if a
  preview had started, `draftActions.discard()` runs so no orphan draft remains. A gesture cancelled
  before the threshold leaves the store untouched.
- **FR-11 — Existing guards survive.** `isRightClick` still returns early with no `preventDefault`
  (the existing test asserts the parent mousedown still fires). An in-flight `isDrafting` still
  discards and returns without opening a replacement and without registering any listener.
- **FR-12 — Column clamping.** A pointer horizontally outside the rendered columns resolves to the
  nearest edge column. `getVisibleDateIndexByX` already clamps to `[0, N-1]`; that clamp is the
  required behaviour, not a bug to fix.

### Module: `views/Week/.../AllDayRow.tsx` (Week wiring)

- **FR-13 — Week opts in.** `AllDayRow` enables the gesture. It continues to resolve dates via
  `dateCalcs.getDateStrByXY(..., YEAR_MONTH_DAY_FORMAT)` and to open the finished draft via
  `draftActions.startGridDraft({ activity: "gridClick", draft })`, so a completed drag lands in the
  same draft/confirm flow a click does today.
- **FR-14 — Prop contract unchanged.** `AllDayRowRenderProps.onAllDayMouseDown` keeps its
  `(event: MouseEvent<HTMLElement>) => void` type, so `AllDayGridRow`, `Grid.tsx` and the render-prop
  children need no signature change. If a Week-local wrapper hook is introduced
  (`views/Week/hooks/grid/useAllDayGridDraftCreation.ts`, mirroring `useTimedGridDraftCreation.ts`),
  it must preserve this contract.

### Module: Day view (no edit, verified by test)

- **FR-15 — Day view untouched.** `DayCalendarGrid.tsx` is off-limits. Day's all-day press must still
  produce a one-day draft with no window listeners attached. Because the file cannot be edited, the
  proof is the shared hook's default path (FR-1) plus a test that exercises the hook **without** the
  opt-in and asserts no multi-day span and no listener registration.

### Cross-cutting

- **FR-16 — Keyboard-place drafts unaffected.** Tab edge-focus cycling and escape-discards-unused
  keyboard drafts continue to work; the new mouse gesture adds no keyboard handlers and no store
  state beyond the draft it already writes.
- **FR-17 — `.gitignore`.** Append a `.sdlc/` entry. Append-only merge semantics: no existing line is
  reordered, rewritten or removed, and the entry is not duplicated if already present.

---

## 5. Non-functional requirements

- **NFR-1 — Test suite green.** `bun test:web` finishes with **0 failures**; the 2298-pass baseline
  does not regress. New tests ship with the change.
- **NFR-2 — Type + lint clean.** `bun type-check` and `bun lint` pass. No new `any`, no
  `@ts-expect-error`.
- **NFR-3 — Repo conventions.** Follows `AGENTS.md` and the two read-only Cursor rules:
  `@web/*` / `@core/*` path aliases (no deep relative imports across packages), **no barrel files**,
  React Testing Library with semantic role/name queries (no CSS or `data-*` locators), Tailwind
  semantic colors if any markup changes, and one component per file.
- **NFR-4 — No perf regression during drag.** Move handling does bounded O(columns) work per event
  and writes the store only when the resolved span actually changes; no layout thrash beyond what
  the existing gestures already do.
- **NFR-5 — No listener leak.** After finish, cancel, or unmount, zero `mousemove` / `mouseup` /
  `blur` listeners added by this gesture remain on `window`. A test must assert this.
- **NFR-6 — Write contract.** Only paths in `.sdlc/local/write-contract.json`'s allowlist are
  written. No file under `packages/backend/**`, `packages/sync/**`, `packages/core/**`, `e2e/**`,
  `views/Day/**`, or `views/Week/interaction/adapter/**` is modified.
- **NFR-7 — Idempotent range math.** If the span resolver is placed behind the interaction-math layer,
  it must be idempotent under repeated application with an unchanged pointer, per
  `docs/frontend/week-drag-interaction.md` §"updateVisual Must Be Idempotent", and must branch only
  on values captured at press time — never on a value it rewrites.
- **NFR-8 — Formatting hooks.** Cursor/Codex format-after-edit hooks may reformat emitted files via
  Biome. Output must be Biome-stable; post-write reformatting is expected, not tampering.

---

## 6. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| Draft event start / end date | Low — user calendar metadata | Client-only for the gesture's lifetime; already covered by the existing draft store and confirm flow. Nothing is persisted until the user confirms. |
| Draft `calendarId` | Low — identifier, not content | Passed through unchanged from the existing call signature. |
| Event title / description | n/a | **Not touched.** The gesture creates an untitled draft; text is entered later in the existing form. |

**No new PII is collected, stored, logged or transmitted.** This change adds no network call, no
persistence, and no logging. The pre-existing exclusive-end date convention is preserved so no date
is silently shifted.

## 7. Role matrix

| Role | Resource | Action | Change? |
|---|---|---|---|
| Authenticated user | own calendar all-day draft | create (drag) | **New gesture, same authority** — a superset of a right the user already exercises by clicking. |
| Authenticated user | own calendar all-day draft | confirm / discard | Unchanged — existing draft flow. |
| Anonymous / IndexedDB-mode user | local all-day draft | create (drag) | Same as authenticated; the web app's anonymous mode is unchanged. |
| Any role | another user's calendar | any | Unchanged — no authorization surface is touched. This is a client-side pointer gesture; all authorization remains where it already is (backend, untouched). |

No new roles, no new permissions, no change to any authorization check.

---

## 8. Acceptance criteria

Numbered to map onto the Gate 0 brief's list; AC-9 … AC-14 are additions from this analysis.

1. **AC-1** — Pressing in day column `i` of the Week all-day row, dragging across to column `j`, and
   releasing creates exactly **one** draft whose start is `min(i, j)`'s date and whose exclusive end
   is `max(i, j)`'s date + 1 day (`|i - j| + 1` days inclusive).
2. **AC-2** — A right-to-left drag from column `j` to column `i` produces the identical schedule to a
   left-to-right drag from `i` to `j`.
3. **AC-3** — A press and release within one column, and a plain click, produce today's exact
   one-day draft. The three existing tests in `useAllDayDraftCreation.test.tsx` pass **unmodified in
   intent** (right-click ignored, in-flight draft dismissed, one-day draft created).
4. **AC-4** — On release the draft is handed to `onCreateGridDraft` and opened via the existing
   `startGridDraft` flow; nothing is written to the backend and no event is committed.
5. **AC-5** — During the drag, after the threshold is crossed, the store holds a draft with
   `activity: "creating"` that updates on each move; the Week all-day row renders it as a live
   preview spanning the current columns.
6. **AC-6** — Keyboard-place drafts still work: Tab edge-focus cycling and escape-discards-unused
   behave as at baseline (covered by the existing suites, which must stay green).
7. **AC-7** — A window `blur` mid-drag removes every listener and, if a preview had started, leaves
   `useDraftStore.getState().gridDraft === null`. Unmounting mid-drag does the same.
8. **AC-8** — `bun test:web` reports 0 failures and ≥ 2298 passing tests.
9. **AC-9** — Dragging vertically only — same column, pointer moved far below the grid — still
   produces a one-day draft for that column (guards FR-3's date-rollover trap).
10. **AC-10** — Dragging past the left or right edge of the rendered columns clamps to the first or
    last visible column; no draft extends outside the rendered window.
11. **AC-11** — Calling `useAllDayDraftCreation` **without** the opt-in (the Day view's call shape)
    registers no window listeners and produces a one-day draft on mousedown, proving Day view is
    behaviourally unchanged. `git diff --stat` shows no file under `packages/web/src/views/Day/`.
12. **AC-12** — `bun type-check` and `bun lint` pass.
13. **AC-13** — `.gitignore` contains a `.sdlc/` entry, added append-only, with every pre-existing
    line byte-identical.
14. **AC-14** — `git diff --name-only` against `4189de1` lists only paths present in the write
    contract's allowlist.

---

## 9. Traceability

| Gate 0 AC | Covered by |
|---|---|
| 1 (N-day span) | FR-4, FR-5 · AC-1 |
| 2 (reverse drag normalised) | FR-4 · AC-2 |
| 3 (click / same-day unchanged) | FR-1, FR-6, FR-11 · AC-3 |
| 4 (existing draft flow, no commit) | FR-9, FR-13 · AC-4 |
| 5 (keyboard-place drafts) | FR-16 · AC-6 |
| 6 (cleanup, no orphan draft) | FR-7, FR-10 · NFR-5 · AC-7 |
| 7 (`bun test:web` green + new tests) | NFR-1 · AC-8 |
| 8 (no backend/sync/core change) | NFR-6 · AC-14 |

---

## 10. Open questions for HITL

None blocking. Three design-level calls are **deliberately deferred to Gate 2** rather than being
pre-decided here, because they are the architect's to make:

- **Q1 — Where the range math lives.** Inline in the hook, or extracted to a new pure module
  (`grid/interaction/math/all-day.create.ts`, which the write contract has already allowlisted).
  Extraction buys a cheap unit test for FR-4/FR-5 and satisfies NFR-7; inline is fewer files.
- **Q2 — Shape of the opt-in.** A boolean flag plus the existing `getStartDate`, versus an options
  object carrying its own resolver. FR-2's callable-return constraint binds either way.
- **Q3 — Whether a Week-local wrapper hook is introduced.** `useAllDayGridDraftCreation.ts` would
  mirror the existing `useTimedGridDraftCreation.ts` symmetry; skipping it keeps the diff smaller.
  Allowlisted either way.

One item is worth the human's attention even though it does not block:

- **Note — preview rendering may already be free.** `all-day-draft.position.ts` positions a draft in
  the all-day row straight from the store, so the live preview in FR-8/AC-5 may need no rendering
  change at all. If Gate 2 confirms that, `AllDayGridRow.tsx` and `AllDayEvents.tsx` drop out of the
  write set entirely and the change stays confined to the hook plus its wiring.
