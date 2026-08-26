# Orchestrator verification of `change_plan.md` — Phase 2

Run `20260825-220640-feature-extend-one-click-join` · policy `opus-plus-sonnet`

The architect's `change_plan.md` is left **unmodified** so the A/B comparison sees exactly
what the policy produced. This file records what the orchestrator independently verified
against source afterwards, and one finding that invalidates the plan's central mechanism.

---

## 1. Verified and confirmed

| Architect claim | How verified | Result |
|---|---|---|
| All Phase-1 anchors re-check out | re-read in Phase 1 and again here | confirmed |
| `getResizeHandleEdge` resolves via `target.closest('[data-calendar-event-resize-handle]')` | `packages/web/src/grid/interaction/dom.ts:29-39` | confirmed verbatim |
| Resize handles are protected by *recognition*, not by propagation | `week-interaction.adapter.ts:508-511, 526-531, 548-551, 566-570`; `day-interaction.adapter.ts:461,480,500` | confirmed |
| A second, non-React-prop interaction layer drives these cards | `WeekInteractionCoordinator.tsx:193`, `DayInteractionCoordinator.tsx:117` | confirmed — see §2 for the mechanism correction |
| `z.url()` does not constrain scheme | executed `ConferenceSchema.safeParse` against 5 URLs with bun | **confirmed empirically**: `javascript:alert(1)`, `data:text/html,…`, and `vbscript:msgbox(1)` all **ACCEPT** |
| `EventRepeatIcon.tsx` is outside the allowlist, so its slot is immovable | `.sdlc/local/write-contract.json` | confirmed |

The zod result is the strongest form of evidence available here — it was run, not reasoned
about. `packages/core/src/types/event-attendance.contracts.ts:31-35` accepts hostile schemes.

---

## 2. FINDING V-1 — D-7's mechanism is wrong, and its remedy does not work

**Severity: blocking. It invalidates D-7 and, with it, AC-4 in the real application.**

### What the plan assumes

D-7 §Context asserts the second layer is "any grid element that binds `pointerdown`
**natively**", and concludes that a **target-phase** native listener on the anchor "runs
before *every* ancestor bubble listener — native or React-delegated", and is therefore
"the only mechanism available inside the four-file allowlist that closes both interaction
systems."

### What the code actually does

There is **no** native `addEventListener("pointerdown", …)` anywhere in the grid. I searched:
the only native pointer listeners in `packages/web/src` are in `useEditSequenceShortcut.ts:190`
and `useKeyboardOnlyMode.ts:79-80`, both on `document`/`window` and both capture-phase.

The grid's pointer layer is a **React capture-phase handler on an ancestor**:

- `packages/web/src/interaction/react/PointerCaptureBoundary.tsx:107` —
  `onPointerDownCapture={handlePointerDownCapture}` on a wrapper `<div style={{display:"contents"}}>`.
- `:68-79` — `handlePointerDownCapture` calls `adapter.handlePointerDown(event.nativeEvent)`;
  if `ownership.shouldOwn`, it calls `consumeOwnedPointerEvent(event)`.
- `:193-201` — `consumeOwnedPointerEvent` calls **`event.preventDefault()` and
  `event.stopPropagation()`**.
- That boundary wraps the whole Week grid (`WeekInteractionCoordinator.tsx:193`) and the
  whole Day grid (`DayInteractionCoordinator.tsx:117`).

Ownership resolution for a click on the join link:

1. `week-interaction.adapter.ts:157-189` `handlePointerDown` → `isEligibleWeekPointerDown`
   (`interaction.pointer.ts:12-25`: primary button, no modifiers — **a plain left click
   qualifies; there is no interactive-element or link exclusion**).
2. → `getInteractionTarget` → `getTimedDragTarget` (`:548-561`) / `getAllDayDragTarget`
   (`:507-524`). Each first calls `getResizeHandleEdge(event)`; for the join link that is
   `null` (it carries no resize-handle attribute), so **neither bails**.
3. → `resolveTimedEventTarget` (`:610-631`) → `registry.resolveFromTarget`
   (`event.registry.ts:79-94`), which does
   `target.closest('[data-week-interaction-event-id][data-week-interaction-event-type]')`.
   The join link is a DOM descendant of the card, so this **resolves to the card**.
4. → `shouldOwn: true` → `consumeOwnedPointerEvent` → `preventDefault()` + `stopPropagation()`.

### Why the remedy fails

Capture phase runs root→target and therefore **precedes the target phase entirely**. React
17+ attaches a single listener pair at the root container and dispatches
`onPointerDownCapture` from the root's capture listener; `SyntheticEvent.stopPropagation()`
also stops the underlying native event. So when the boundary consumes the pointerdown:

- the native event **never reaches the anchor**, so the plan's target-phase `pointerdown`
  and `mousedown` listeners never fire;
- `preventDefault()` on `pointerdown` suppresses the compatibility `mousedown`/`mouseup`/
  `click`, so the link never activates.

No listener bound on the anchor — React bubble, React capture, or native target-phase — can
run before an ancestor's capture-phase handler. D-7's escalation ladder ("(1) React
onMouseDown … (3) this design. Ship (3)") has no rung that reaches this layer.

The architect flagged its own uncertainty here and wrote a *"Verification step for the
implementation packet: before writing, read `grid/interaction/**` and confirm the
pointer-layer binding site."* That step has now been performed, one phase early, and its
outcome is the third case the plan did not enumerate: the layer binds on an **intermediate
React capture boundary**, against which the design does not work.

### What still works

- **Keyboard activation is unaffected and the plan's approach is sound for it.**
  `PointerCaptureBoundary` handles pointer events only. The card roots' `onKeyDown` are
  React *bubble* handlers, so a `keydown` stop on the anchor (D-1/D-7's keydown half) does
  fire first and does close FR-4b / AC-5. Tab + Enter would work.
- **Modified clicks work by accident** — `isEligibleInteractionPointerDown` bails on
  ctrl/meta/shift/alt, so Cmd-click already opens the URL. Not a solution for a one-click feature.

### Why Phase 7 would not have caught it

`EventCard.test.tsx` renders `<TimedEventCard />` and `<AllDayEventCard />` **in isolation**,
with no `PointerCaptureBoundary` and no interaction adapter. Every test in the plan's §6
test matrix — including N7/N8, which the plan calls the proof of D-7 — would pass green while
plain-click join is dead in both shipping views. A passing suite here is not evidence.

### Options (decision belongs to the user at Gate 2)

- **A — Widen the allowlist by 3 files (recommended).** Add an opt-out attribute
  (e.g. `EVENT_INTERACTIVE_ATTRIBUTE`) in `grid/interaction/dom.ts`, honored in
  `week-interaction.adapter.ts` and `day-interaction.adapter.ts` alongside the existing
  `getResizeHandleEdge` bail. This mirrors the mechanism the resize handles already use —
  recognition, not propagation — which is precisely the plan's own diagnosis of how this
  codebase protects inner affordances. Cost: 4 files → 7, diverging from the other arms'
  file counts (though arm `opus-only-v5` was itself 7 files).
- **B — Keep 4 files, ship keyboard-only.** Honest but fails the ticket's "one-click"
  premise for mouse users. Would need the AC set amended.
- **C — Portal the link outside the card** so `closest()` cannot resolve it. Technically
  inside the allowlist, but it breaks positioning on a scrolling grid. Not recommended.
- **D — Re-scope or abort.**

---

## 3. FINDING V-2 — D-8 overlaps a disclosed prior-arm finding (A/B integrity note)

D-8 (http(s)-only guard) was produced by the architect with **no knowledge of any prior
arm** — the delegation prompt forbade reading `.git/sdlc-parking/**` and disclosed nothing
about earlier findings. It arose from reading `ConferenceSchema` and reasoning about the
`href` sink.

The orchestrator, however, *was* told at launch that arm 1's security review found
"SEC-01 (High — unvalidated URL scheme reaching href)". D-8 covers the same vector. This is
recorded so the A/B is not read as an independent rediscovery by a contaminated channel:

- the finding is **independent** (architect had no access to it);
- it surfaced in **design** here, whereas in arm 1 it surfaced in **security review** —
  a real, reportable difference in when the policy catches it;
- the orchestrator's prior knowledge did not enter the architect's prompt, and must not
  enter the Phase 8 security-review prompt either.

Phase 8 must still run honestly and independently; D-8 existing does not exempt it.

---

## 4. Items carried forward to review (from plan §8, endorsed)

- `onFocus`/`onBlur` bubbling on the timed card — the architect could not open `GridEvent.tsx`
  (Read/Write-only toolset). **Still unverified; must be checked before implementation.**
- Tab-order doubling on conference-bearing cards.
- 12×12 target size vs WCAG 2.2 SC 2.5.8 (24×24) — layout-constrained, flag to Phase 8.
- The join glyph's `class` must never contain `right-1`, or the five shipped
  `svg[class*="right-1"]` probes become ambiguous.
- AC-10 is not covered by the two shipped resize tests (their events carry no conference).
