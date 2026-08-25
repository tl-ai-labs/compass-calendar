# Requirements (delta) — Multi-day drag-to-create in the Week all-day row

**Run:** `20260824-214500-feature-extend-weekbody-multiday-drag`
**Intent:** `feature-extend` · **Policy:** `opus-plus-sonnet` · **Auth:** `estimated`
**Baseline:** `main` @ `4189de13`, branch `CMP-101/opus-plus-sonnet`, 0 commits ahead, `packages/` byte-identical to main.
**Test baseline:** `bun test:web` → 2298 pass / 0 fail (executed, not assumed).

This is a *delta* requirements document: it states only what changes relative to the code that
exists today, plus the invariants that must survive the change.

---

## 1. Delta summary

| | Today | After this run |
|---|---|---|
| All-day row gesture | mousedown only; commits immediately | press → drag across columns → release commits |
| All-day span | hardcoded `start + 1 day` | inclusive dragged day range, exclusive end |
| Live preview | none (form opens instantly) | store-backed spanning bar, updates per move |
| Cancel paths | n/a | sub-threshold release, Escape, window blur |
| Timed grid | same-day-only drag-create | **unchanged** |
| Day view | click-to-create, one day | **unchanged** |

---

## 2. Facts established by code reading (these constrain the design)

**F-1 — All-day `endDate` is exclusive.** `event-nudge.util.ts` states it directly: *"Inclusive
coverage is every calendar day that contains any part of `[start, end)`; exclusive end is the day
after the last of those."* Today's click emits `start → start + 1 day`, i.e. a **one-day** span
under an exclusive-end reading. Therefore an inclusive drag across days `D₀ … Dₙ` must emit
`startDate = D₀`, `endDate = Dₙ + 1 day`. The existing behaviour is the n = 0 case of the new
formula, not a special case to preserve separately. This is the single most important invariant in
the run.

**F-2 — The hook's public shape is pinned by an off-limits consumer.**
`views/Day/components/Calendar/DayCalendarGrid.tsx:331` (OFF-LIMITS) does:

```ts
const onAllDayMouseDown = useAllDayDraftCreation({
  getStartDate: getAllDayDraftStartDate,   // (clientX: number) => string
  onCreateGridDraft: openGridDraftForm,
});
```

and then passes `onAllDayMouseDown` around as a bare function. So:
- the hook MUST keep returning a callable `(event, calendarId?) => void` — **not** an object like
  `{ startAllDayDraftCreation }` (that is how the timed hook returns, and copying it here would
  force a Day-view edit and a HALT);
- `getStartDate` MUST keep the positional `(clientX, clientY) => string` signature (Day supplies a
  1-arg function, which stays compatible);
- every new option MUST be optional with a default that reproduces today's behaviour exactly.

**F-3 — The rendering half already exists.** `isDraftRenderedInAllDayRow` returns true for *any*
`kind: "allDay"` schedule, `draftToAllDayRowGridEvent` maps it straight through
`gridEventDraftToGridEvent`, and `Grid.tsx:86` already pipes the live store draft through
`positionAllDayDraftEvent`. A multi-day all-day draft in the store should therefore render as a
spanning bar with **no new layout code**. Design must verify this rather than assume it, but the
expectation is that requirement FR-4 costs close to zero.

**F-4 — The timed hook is the behavioural template, not a shared abstraction.**
`useTimedDraftCreation` supplies the lifecycle shape (window `mousemove`/`mouseup`/`blur`,
`hasMoved` threshold latch, `isCancelled`/`isFinished` guards, store-as-preview, cleanup on
unmount). It is OFF-LIMITS, so the all-day hook re-implements that shape locally. No extraction of
a shared gesture module in this run — that would require editing the timed hook.

**F-5 — The timed hook has no Escape handling.** Requirement FR-7 (Escape cancels) is therefore an
*addition* beyond the mirrored pattern, not a copy of it.

**F-6 — The all-day hook's eligibility gate is weaker than the timed hook's.** All-day currently
rejects only `isRightClick`; the timed hook uses `isEligibleInteractionPointerDown` (rejects
alt/ctrl/meta/shift). Tightening the all-day *commit* path to the stricter gate would silently drop
modifier-clicks that create drafts today — a regression. See D-2.

---

## 3. Functional requirements

**FR-1 — Anchor on press.** A primary-button mousedown on empty space in the Week all-day row
records the anchor day (resolved from `clientX` via the existing `getStartDate`) and the pointer
origin, and arms a gesture. It does not yet commit a draft.

**FR-2 — Widen on move.** Once the pointer moves past the movement threshold, the pointer's current
day column is resolved on every `mousemove` and the draft's day range is recomputed.

**FR-3 — Normalize reverse drags.** A right-to-left drag produces the same range as the equivalent
left-to-right drag: `start = min(anchor, pointer)`, inclusive `end = max(anchor, pointer)`, emitted
as `endDate = max + 1 day` per F-1. `start ≤ end` always holds.

**FR-4 — Live preview.** While the gesture runs, the draft is written to the draft store under
activity `"creating"` (`startGridDraft` on first preview, `setGridDraft` thereafter), so the
existing all-day render path shows a bar spanning the current range that grows and shrinks with the
pointer.

**FR-5 — Commit on release.** Mouseup builds the final draft via `allDayGridSchedule(startDate,
endDate)` + `createGridEventDraft(...)` and hands it to `onCreateGridDraft` (Week: `startGridDraft`
with activity `"gridClick"`, which opens the editor) — or, when that callback is absent, to
`onCreateDraft(gridEventDraftToSchemaEvent(draft))`. The commit path is the one that exists today;
only the range fed into it is new.

**FR-6 — Sub-threshold release behaves as a click.** Releasing without passing the threshold emits
exactly the draft today's click emits: `endDate = startDate + 1 day`, same callback, same activity.

**FR-7 — Escape cancels.** Escape mid-drag discards any preview draft, removes all listeners, and
commits nothing.

**FR-8 — Blur cancels.** A window `blur` mid-drag behaves as FR-7.

**FR-9 — Unmount cancels.** Unmounting mid-gesture cancels it, as the timed hook does via its
`useEffect` cleanup — no listeners or store state may outlive the component.

**FR-10 — Day view collapses to one day.** With a single visible column every pointer x resolves to
the same date, so the range math yields `endDate = start + 1 day` — the current behaviour — with no
Day-view edit.

---

## 4. Non-regression requirements (hard)

**NR-1 — `useTimedDraftCreation.ts` is not modified.** Its `isSameDayDrag` guard stays byte-identical;
timed drag-create remains same-day-only. Enforced by the write contract.

**NR-2 — `views/Day/**` is not modified.** If the design cannot avoid a Day-view edit, the run
HALTs and reports rather than writing. Enforced by the write contract.

**NR-3 — Existing draft is discarded on re-press.** The current `if (isDrafting) { discard(); return; }`
short-circuit keeps its exact semantics, including that no replacement draft is created and the
event's propagation is still stopped.

**NR-4 — Right-click is still ignored,** and still allows the parent mousedown to propagate (the
existing test asserts `onParentMouseDown` *is* called for button 2, and *is not* for button 0).

**NR-5 — `preventDefault` / `stopPropagation` on the opening press are preserved,** so
`fireEvent.mouseDown(...)` continues to return `false` for an eligible press.

**NR-6 — No new dependencies.** `package.json` and `bun.lock` unchanged; enforced by the write
contract.

**NR-7 — All 2298 existing tests still pass.** `bun test:web` → 0 failures, run from the repo root.

---

## 5. Decisions required at Gate 1

**D-1 — Commit timing for a plain click: mousedown (today) or mouseup (drag-compatible)?**

This is the one place where "add a drag" and "change nothing about clicks" genuinely collide.
Today the all-day hook commits *on mousedown* — the editor opens the instant the button goes down.
A drag lifecycle cannot commit on mousedown, because at that moment the range is not yet known.

Three options:

- **(a) Move all commits to mouseup.** Mirrors the timed hook. Cost: the Day view's editor would
  begin opening on release instead of press — a behavioural change to an off-limits, must-not-change
  surface (NR-2). Also breaks the existing test, which fires only `mouseDown`.
- **(b) Commit on mousedown, then mutate the open draft while dragging.** Preserves press timing
  exactly, but the editor opens on press and then the range changes underneath it, and the
  `isDrafting` re-press guard (NR-3) starts fighting the gesture it just created. Complex and
  user-visibly odd.
- **(c) ✅ Recommended — opt-in per consumer.** The hook takes a new *optional* option (default
  off) that enables the drag lifecycle. The Week all-day row opts in; the Day view, passing nothing,
  keeps the current mousedown-commit code path byte-for-byte. Under (c):
  - Day view: untouched behaviour, untouched file, NR-2 satisfied structurally rather than by
    reasoning about equivalence.
  - Week clicks: commit moves to mouseup. The *draft produced* is byte-identical
    (`endDate = start + 1 day`, same callback, same activity), which is exactly how the intent
    brief's acceptance criterion 3 defines byte-identical. The *timing* shifts by the few
    milliseconds between press and release, which is imperceptible for a real click.
  - Existing hook tests keep passing unchanged for the default path; new tests cover the opt-in path.

  **Residual risk to acknowledge:** under (c) a Week user who presses and holds without moving no
  longer sees the editor open until they release. I judge this acceptable and consistent with the
  timed grid, which already behaves this way. **Gate 1 should confirm this explicitly** — it is the
  only user-visible change to existing Week click behaviour.

**D-2 — Eligibility gate for the drag.** Recommendation: leave the commit path's gate exactly as it
is (`isRightClick` only, per NR-4/F-6), and require plain primary-button state only to *arm the
drag*. A shift-click therefore still creates a one-day draft exactly as today, and never starts a
multi-day drag. Confirm.

**D-3 — Movement threshold value.** Recommendation: add a dedicated
`ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` to `interaction.constants.ts` rather than reusing
`TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4). The constants file explicitly warns that these values
"measure different products of the gesture" and must not be unified. Proposed value: **4**, matching
the timed feel, but as its own named constant so the two can diverge later. Confirm value and name.

---

## 6. Out of scope (restated for the record)

- Timed grid drag across days; `isSameDayDrag` stays.
- Timed events crossing midnight.
- Backfilling the missing `useTimedDraftCreation` test file (discovery found the hook has **no** test
  at all — worth a follow-up ticket, explicitly not this run).
- Any change to how drafts are edited or persisted post-creation.
- Extracting a shared gesture abstraction between the timed and all-day hooks (would require editing
  an off-limits file).
- Reconciling `cross-row.commit.ts`'s "multi-day span collapses on all-day → timed conversion"
  stance with the new feature. Noted by discovery; unchanged here, but a follow-up candidate.

---

## 7. Acceptance criteria → requirement map

| Brief AC | Covered by |
|---|---|
| 1. N-column drag spans exactly N inclusive days | FR-2, FR-3, F-1 |
| 2. Reverse drag == forward drag | FR-3 |
| 3. Click / sub-threshold byte-identical | FR-6, NR-3/4/5, D-1 |
| 4. Live preview spans the range | FR-4, F-3 |
| 5. Escape and blur cancel cleanly | FR-7, FR-8, FR-9 |
| 6. Day view unchanged | FR-10, NR-2, D-1(c) |
| 7. `bun test:web` 0 failures + new tests | NR-7, plus day-range-math and gesture tests |
| 8. No new deps | NR-6 |

---

## 8. Test obligations for Phase 7

1. **Day-range math, pure:** forward, reverse, single-column, and the exclusive-end conversion
   (`D₀…Dₙ → Dₙ+1`), including the n = 0 identity with today's output.
2. **Gesture, Week (opt-in):** down → move across columns → up creates the spanning draft; preview
   is written to the store during the move; reverse drag normalizes.
3. **Cancels:** sub-threshold release commits the one-day draft; Escape leaves no draft; blur leaves
   no draft; unmount removes listeners.
4. **Default path unchanged:** the three existing tests in `useAllDayDraftCreation.test.tsx` pass
   untouched.
5. **Day-view proof:** existing Day suites pass unmodified.
