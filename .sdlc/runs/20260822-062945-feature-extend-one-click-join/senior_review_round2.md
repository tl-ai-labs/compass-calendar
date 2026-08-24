# Senior code review — round 2 (scoped to the B-1 blocker fix)

**Run:** `20260822-062945-feature-extend-one-click-join` (CMP-103)
**Scope:** only what changed since round 1 — `event.registry.ts`, `EventJoinIcon.tsx`, `event.registry.test.ts`, `EventCard.test.tsx`. Card geometry/PII/FR-14, cleared in round 1, was not re-reviewed (confirmed unchanged: `TimedEventCard.tsx` and `AllDayEventCard.tsx` mtimes are 02:46/02:47, before the 03:05 round-1 artifact).
**Round-1 artifact:** `.sdlc/runs/20260822-062945-feature-extend-one-click-join/senior_review.md`

---

## Verdict: **approve-with-nits**

**B-1 is closed.** I traced it independently and the fix is correct, minimal, and complete for both card types and all four ownership paths in both adapters. No blocker, no regression to resize handles, no import cycle, and the module placement is defensible for a reason I verified rather than took on faith.

Two things keep this from a clean `approve`:

- **M2-1 (major, human decision):** the rewritten T-21 doesn't just document the absence of an `isBusy` guard — it *pins* it, so adding the guard would fail CI. I recommend adding the guard and flipping the assertion. This contradicts the render-time-revalidation stance the same file takes for the URL protocol.
- **m2-1 (minor):** the opt-out is applied at a choke point that also serves *keyboard* targeting, so `getFocused()` now returns `null` while the join button holds focus. Real, verifiable, untested, and undocumented in the new constant's docstring.

Everything else is nits.

---

## 1. Does the fix actually close B-1?

**Yes.** Traced from source, not from the packet.

Pointerdown on the join glyph (`event.target` is the `<svg>`, or the `<button>`):

1. `PointerCaptureBoundary.tsx:107` `onPointerDownCapture` → `:72` `adapter.handlePointerDown(event.nativeEvent)`.
2. Week: `week-interaction.adapter.ts:160` eligibility passes → `:167` `getInteractionTarget(event)`.
3. `getInteractionTarget` (`:483-505`) tries exactly four paths, in order: `getAllDayResizeTarget` (`:526`), `getTimedResizeTarget` (`:565`), `getTimedDragTarget` (`:548`), `getAllDayDragTarget` (`:507`). **All four** funnel through `resolveAllDayEventTarget` (`:587`) or `resolveTimedEventTarget` (`:610`) → `getRegisteredTarget` (`:633`) → `weekEventRegistry.resolveFromTarget(event.target)` (`:637`). There is no fifth path and no second `closest()` that reaches ownership. `getResizeHandleEdge` is only a *discriminator* between the four — it never grants a target on its own.
4. Day is structurally identical: `day-interaction.adapter.ts:434-455` → `:541`/`:564` → `:584-588` → `dayEventRegistry.resolveFromTarget`.
5. `event.registry.ts:114-120`: `ignored` = the `<button>`, `element` = the card, `element.contains(ignored)` is `true` → `null`.
6. Both adapters return `{ shouldOwn: false, reason: "no-*-interaction-target" }` → `PointerCaptureBoundary.tsx:74-76` returns early → **no `consumeOwnedPointerEvent`, no `setPointerCapture`, no window pointerup listener**.
7. `engine.handlePointerDown` is never called, so `interaction.engine.ts:126-157` opens no `pending` session and starts no hold timer. On pointerup, `handlePointerUpCapture` → `engine.handlePointerUp` → `:192-194` `session.phase === "idle"` → `null` → no `{type:"click"}` → `onClickTimedEvent`/`onClickAllDayEvent` are never reached.

All five B-1 consequences are closed, including hold-to-drag (no hold timer) and the double-action (`window.open` + form).

**Downstream of `shouldOwn:false` — the newly-reachable path — also checks out.** Because the boundary no longer calls `preventDefault()`, the compat `mousedown` now fires. I enumerated every mousedown listener that could catch it:

- Bubble-phase React ancestors that create drafts: `MainGrid.tsx:156`, `AllDayRow.tsx:143`, `AllDayEvents.tsx:196`, `TimedGrid.tsx:140`, `AllDayGridRow.tsx:74`, `EventGrid.tsx:60,66`. All bubble; all stopped by `EventJoinIcon.tsx:97`.
- The card's own `onEventMouseDown` (`TimedEventCard.tsx:326`, `AllDayEventCard.tsx:185`) — same, stopped by `:97`. This is the read-only/busy open path, so it matters.
- Capture-phase: only `DatePicker.tsx:91` (outside-click dismiss — firing here is correct) and `useKeyboardOnlyMode.ts:80` (see m2-2).

No text selection risk (`TimedEventCard.tsx:303` has `select-none`); mousedown-to-focus now works on the button, which the `c-focus-ring` needs.

---

## 2. Scope containment — is `ignored && element.contains(ignored)` correct and minimal?

**Yes, and the `contains` term is the right guard.** `element` is the nearest card ancestor of `target`; `ignored` is the nearest ignore-marked ancestor of `target`. Both are on the same root-ward chain from `target`, so `element.contains(ignored)` is exactly the predicate "the marker sits between the pointer and the card", i.e. inside the card. Everything else falls out correctly:

- **Marker above the card** (stray wrapper) → `contains` false → card still resolves. Pinned by `event.registry.test.ts:84`.
- **Marker on the card root itself** → `contains` includes self → card disabled. Consistent, and nothing does this today.
- **Nested cards** → `closest` picks the inner card, and an ignore wrapper between the two would *not* disable the inner card. No nested cards exist in this codebase; noting it only so the asymmetry isn't a surprise later.
- **Resize handles** → see §3.
- **Drag-ghost clone** (round-1 R-6) → **unaffected, verified.** `createDraftEventMount` (`grid/interaction/dom.ts:81-87`) strips only the id/type attributes, so the clone's join button *keeps* the ignore marker — but that's inert three times over: `resolveFromTarget` bails at `:107` (no id/type ancestor) before the ignore check ever runs; `draft-event.clone.ts:15` sets `pointerEvents = "none"`; and `FloatingDraftEvent.mount` (`interaction/dom/draft-event.ts:36`) appends to `document.body`, outside every card and outside the boundary. The attribute correctly does **not** need adding to `DRAFT_CLONE_STRIPPED_ATTRIBUTES`.

The only non-minimal thing is that `target.closest()` walks all the way to the document root when only the `target..element` segment can matter. Correct, just slightly wasteful; `resolveFromTarget` is on the pointerdown and targeting paths, not pointermove, so this is unmeasurable. Not a finding.

---

## 3. Did the fix break anything the grid depends on?

**Resize handles: unaffected. Confirmed by reading, not inference.**

- `grep -rn EVENT_INTERACTION_IGNORE_ATTRIBUTE packages/web/src` returns exactly three source sites: the constant, the registry check, and `EventJoinIcon.tsx:76`. No handle carries it.
- Timed handles are children of the content div (`TimedEventCard.tsx:362,373`); all-day handles are direct children of the card root (`AllDayEventCard.tsx:232,243`). In every case the handle is a **sibling** of the join button, not a descendant — so `handle.closest([IGNORE])` finds nothing inside the card and `ignored` is `null`. `getResizeHandleEdge` (`dom.ts:29-39`) is untouched and still runs first in `getInteractionTarget`.
- `event.targeting.ts:29-41` `listVisible` passes the *card element* as the target; walking up from a card never finds a descendant marker, so `listVisibleGridEventTargets` / `getFirstVisibleGridEventTarget` are byte-identical. The green 2324-test suite is consistent with that.

The one thing that *is* affected is `getFocusedGridEventTarget` — see **m2-1**.

---

## 4. Is the attribute in the right module?

**Yes, and the stated justification is factually correct — I checked the cycle rather than assuming it.**

`dom.ts:8` imports `viewInteractionAttributeNames` from `view-event-registry.ts`, and `view-event-registry.ts:1-5` imports `createEventRegistry` from `event.registry.ts`. So putting the constant in `dom.ts` and importing it into `event.registry.ts` would close a real three-module cycle: `event.registry → dom → view-event-registry → event.registry`. Placing it on the leaf (`event.registry.ts` has zero imports) is the correct call.

The layering is also already precedented: `TimedEventCard.tsx:39-43` and `AllDayEventCard.tsx` already import `EVENT_CONTENT_ATTRIBUTE` / `EVENT_RESIZE_HANDLE_ATTRIBUTE` / `EVENT_TIME_LABEL_ATTRIBUTE` from `@web/grid/interaction/dom`. A grid component importing a grid-interaction attribute name is the existing convention, not a new violation.

Residual cost is discoverability only: the `EVENT_*_ATTRIBUTE` family is now split across two files with no cross-reference. See **n2-1**.

---

## 5. Test quality of the 3 + 2 new tests

**None are vacuous.** Your mutation check (3 failures under `if (false && …)`) is the right instrument and I agree with its reading — including that `event.registry.test.ts:84` legitimately still passes, because it pins the `element.contains(ignored)` *scoping* term rather than the check's existence. (Mutating `element.contains(ignored)` → `true` is what fails it; that's the mutation that test exists for.)

The end-to-end test (`EventCard.test.tsx:1080-1143`) does faithfully reproduce the load-bearing part of the wiring — a real `PointerCaptureBoundary` above the card, a real `createEventRegistry`, real capture-phase dispatch — and it is the test that would have caught B-1. Good. Four divergences from the real adapter, none of which invalidate it, all of which narrow what a future regression would have to look like to slip through:

1. **It asserts the mechanism, not the symptom.** It only fires `pointerDown` and checks that no ownership was recorded. It never fires `pointerUp`, and the stub's `handlePointerUp` returns `false` unconditionally, so the actual B-1 failure mode — pending session → `{type:"click"}` → `onClickTimedEvent` → *the event form opens* — is asserted nowhere. `stubWindowOpen()` at `:1088` is called and then never asserted on, which reads like the click half was intended and dropped.
2. **No all-day mirror.** Round-1 packet R2's acceptance said "both card types covered." Neither the e2e test (`:1080`) nor the attribute test (`:1064`) has an `AllDayEventCard` case. Both cards render the same `EventJoinIcon`, so the risk is low — but §1's trace shows the all-day ownership path is *separate code* (`getAllDayDragTarget`/`getAllDayResizeTarget`), and nothing pins it.
3. **No resize-handle case.** `:1137` proves the card body still resolves, which is the important half. Firing `pointerDown` on `[data-calendar-event-resize-handle]` would additionally pin §3's guarantee, and it's one line.
4. **The stub skips `isEligibleInteractionPointerDown`, the `getResizeHandleEdge` branch ordering, and `engine.handlePointerDown` entirely.** Consequence: if someone later adds a fifth ownership path to a real adapter that doesn't consult the registry, this test stays green. An adapter-level assertion (`week-interaction.adapter` `handlePointerDown` returns `shouldOwn:false` for a target inside an ignore subtree) is what would bind that; this test can't.

One cheap upgrade that would close (1) with no new machinery: `fireEvent` returns `dispatchEvent`'s boolean, so `expect(fireEvent.pointerDown(joinButton)).toBe(true)` and `expect(fireEvent.pointerDown(cardBody)).toBe(false)` directly assert "the boundary did / did not consume the event", which is the exact property B-1 turned on.

---

## 6. The rewritten T-21 — recommendation

**Recommendation: add the `!event.isBusy` guard to `showJoinIcon` in both cards and flip the test to assert *no* join control.** Do not merge the current form.

First, the factual finding, because the design's premise is actually **true**: `event.view-model.ts:60-61` derives `isBusy = event.content.kind === "busy"` and `details = content.kind === "details" ? content : undefined`, and `:94` sets `conference: details?.conference`. `isBusy === true` ⟺ `details === undefined` ⟺ `conference === undefined`, enforced by a discriminated union. I checked every other producer of a `GridEvent.conference` in `packages/web` — there is exactly one (`event.view-model.ts:94`); the demo seed (`demo-data-seed.ts:144`) writes `content.kind: "details"`, and `grid-event-draft.adapter.ts` never sets `conference` at all. **So the guard is provably dead code today, and the test's factual claim is correct.**

That is precisely why pinning it is the wrong call:

1. **The test blocks the safe change.** `:1052-1061` asserts that a busy event *with* a conference **does** render a join control. Adding `!event.isBusy` — a zero-cost, zero-behavior-change hardening — would now fail CI. The comment at `:1047-1051` admits this ("someone added that guard — which is a fine thing to do"). A test whose failure message says "the change you just made is fine, please edit the docs" is a change-detector, and it biases the codebase against the safer of two states.
2. **It contradicts the same delta's own stated threat model.** `EventJoinIcon.tsx:14-24` justifies `isSafeConferenceUrl` with: *"a grid card renders whatever reached it — a cached IndexedDB row written by an older schema, a hand-seeded demo event, a future contract relaxation."* Every word of that applies to `isBusy` identically. This run re-validates the URL protocol at render time on exactly that reasoning and then declines to re-validate the masking rule, in the same component. One of the two positions has to give, and given the cost asymmetry it should be this one.
3. **The failure mode is a PII/masking leak, not a cosmetic bug.** A busy event is one whose title is masked to `BUSY_EVENT_TITLE` (`event.view-model.ts:64`) because the user is only entitled to free/busy visibility. Rendering a working join button on it hands the user a live capability token for a meeting they are not entitled to see the details of. That is a strictly worse class of failure than the one `isSafeConferenceUrl` defends against, and requirements §6's role matrix already says join is "not possible" for busy events — a guard *implements* the matrix; the current state *depends on an upstream derivation staying coupled*.
4. **The first half is still vacuous, just differently.** `:1033` `expect(busy.conference).toBeUndefined()` asserts on `createEvent`, a local test factory at `EventCard.test.tsx:29-47`. It pins the fixture, not `event.view-model.ts`. If the mapper ever attached a conference to a busy event, this assertion would still pass. The invariant it claims to cover lives next to the mapper, not in a card render test.

With the guard added, the same test becomes non-vacuous in the *safe* direction: it fails if the guard is ever removed. That is the strictly better test, and it costs one boolean term per card.

---

## Findings

### Major

#### M2-1 — T-21 pins the absence of the `isBusy` masking guard, making the safe hardening a CI failure

**File:** `packages/web/src/grid/components/EventCard.test.tsx:1026-1062` (assertion at `:1061`)
**Fix:** Add `!event.isBusy` to `showJoinIcon` in `TimedEventCard.tsx:138-143` and `AllDayEventCard.tsx` (same expression), then change `:1061` from `.not.toBeNull()` to `.toBeNull()` and rewrite the comment to say the guard enforces requirements §6's role matrix at render time, on the same reasoning `EventJoinIcon.tsx:14-24` gives for `isSafeConferenceUrl`. Delete the fixture-only assertion at `:1033`. Full rationale in §6 above.
**Note:** this is a decision item for the human; it does **not** affect whether B-1 is closed, and the current code is not exploitable today.

### Minor

#### m2-1 — The opt-out silently disables *keyboard* event targeting, not just pointer targeting

**Files:** `packages/web/src/grid/interaction/event.registry.ts:1-18` (docstring), `:111-120` (the check)
`event.targeting.ts:51-52` defines `getFocusedGridEventTarget: () => toTarget(document.activeElement)`, and `toTarget` (`:19`) calls the same `resolveFromTarget`. The join button is a native `<button>` inside a card that is itself `tabIndex={0}` (`TimedEventCard.tsx:301`), so it *is* in the tab order. After this change, while the join button holds focus, `getFocused()` returns `null` and every consumer silently no-ops: `useGridEventEditShortcuts.ts:177-192` (delete at `:207`, duplicate at `:222`, edit at `:362`, `:443`, `:455`, `:574`, `:599`), `useGridEventFormFieldSequences.ts:64,98,101`, `useDayEventNudgeShortcuts.ts:45`, `useWeekShortcutOwner.ts:178`.

It is inconsistent with `useIsAnyCalendarEventFocused.ts:13,22`, which does its own `closest(calendarEventIdElementSelector())` and therefore still reports **true** — so the sidebar tip bar advertises event shortcuts that have just stopped working. This is a *new* behaviour (in round 1 the same keypress acted on the card), it is untested, and the constant's docstring only claims "not a drag/click target", which understates it.

**Fix (preferred):** keep pointer semantics and focus semantics separate — give `resolveFromTarget` an options bag (`{ respectIgnore?: boolean }`, default `true`) and have `event.targeting.ts:19` pass `false`, so keyboard targeting keeps resolving the owning card. **Fix (acceptable):** accept the behaviour, but say so explicitly in the `EVENT_INTERACTION_IGNORE_ATTRIBUTE` docstring and add one test in `event.targeting`'s suite pinning that `getFocused()` is `null` when an ignore-marked descendant has focus, so the next reader doesn't rediscover it via a bug report.

#### m2-2 — `EventJoinIcon`'s rewritten comment names a mechanism that does not exist, and `onPointerDown` is still dead code

**File:** `packages/web/src/grid/components/EventJoinIcon.tsx:98-105`
The rewrite correctly stops claiming these handlers defend against the engine — good, that was the round-1 defect. But the replacement justification is wrong in both of its parts:

- *"keyboard-only mode"* — false. `useKeyboardOnlyMode.ts:66-88` binds `blockPointer` on **window capture** for `pointerdown`/`mousedown`/`click`/`auxclick` and calls `preventDefault()` + `stopPropagation()`. Window capture runs strictly before `PointerCaptureBoundary`, so in keyboard-only mode *none* of the button's handlers run — including `onClick`. The file's own comment at `:60-62` says exactly this, and round 1 cited it as corroboration.
- *"where the event does reach us and would otherwise bubble to the card's own handlers"* — true for `onMouseDown` (`:97`), false for `onPointerDown` (`:105`). I grepped every `onPointerDown=` / `addEventListener("pointerdown")` in `packages/web/src`: the only other pointerdown listeners are `PointerCaptureBoundary.tsx:107` (capture, ancestor) and `useEditSequenceShortcut.ts:190` (document **capture**). Neither is reachable by a bubble-phase `stopPropagation()`. **Nothing listens for a bubbled pointerdown**, so `:105` stops nothing.

I got this wrong in round 1 ("all four are load-bearing") — three are; `onPointerDown` is not.
**Fix:** Keep `:105` as cheap insurance if you like, but correct the comment to state the one true reason (the adapter now declines ownership, so the boundary doesn't consume, so `onMouseDown`'s `stopPropagation` is what keeps `MainGrid`/`AllDayRow`'s bubble-phase draft-create handlers and the card's `onEventMouseDown` from firing), and state plainly that `onPointerDown` is defensive with no current listener above it. Drop the keyboard-only-mode claim entirely, or replace it with the accurate note that keyboard-only mode blocks this button at window capture.

#### m2-3 — Regression test asserts the mechanism but never the symptom, and skips the all-day card and the resize handle

**File:** `packages/web/src/grid/components/EventCard.test.tsx:1064-1143`
Detail in §5. Three concrete gaps: no `pointerUp` → `{type:"click"}` → "form did not open" assertion (and `stubWindowOpen()` at `:1088` is consequently unused); no `AllDayEventCard` mirror for either new test, despite the all-day ownership path being separate code; no resize-handle case.
**Fix:** add `expect(fireEvent.pointerDown(joinButton)).toBe(true)` / `expect(fireEvent.pointerDown(cardBody)).toBe(false)` to pin consumption directly; extend the stub's `handlePointerUp` to mirror `interaction.engine.ts:192-210`'s pending→`{type:"click"}` contract and assert the click callback is never invoked for the join button; add the all-day mirror; add one `pointerDown` on `[data-calendar-event-resize-handle]` asserting ownership still happens.

#### m2-4 — The all-day end-resize handle overlaps the bottom ~2.25px of the join button

**Files:** `packages/web/src/grid/components/TimedEventCard.tsx:257-268,376-382` vs `EventJoinIcon.tsx:79`
Flagging with a caveat: this is *round-1 geometry*, which I cleared — but I cleared it against the repeat glyph, not against the resize handles, and it only became user-visible now that the button actually works. The timed `endDate` handle is `position:absolute; bottom:-0.25px; height:4.5px; width:100%; zIndex: ZIndex.LAYER_4` (=4). The join button is `bottom-0.5` (2px) with a 12px glyph, so it spans 2..14px from the card's bottom edge. The bands overlap over **2..4.25px** — roughly the bottom 19% of the button — and the handle wins on z-index (the button sets none). Pressing there starts a resize instead of joining. Note `EventRepeatIcon.tsx:17` sets `pointer-events-none` precisely so it never competes; the join button obviously can't. The all-day case is fine (`AllDayEventCard.tsx:130-141`, `right:-0.25px`, `width:4.5px` → 0.25px of overlap).
**Fix:** give the button `style={{ zIndex: ZIndex.LAYER_5 }}` so it sits above the handles inside the card's stacking context. `bottom-1` alone would not fully clear it.

### Nits

- **n2-1** — `dom.ts` still owns `EVENT_CONTENT_ATTRIBUTE` / `EVENT_RESIZE_HANDLE_ATTRIBUTE` / `EVENT_TIME_LABEL_ATTRIBUTE` while the fourth sibling lives in `event.registry.ts`, with no pointer between them. `dom.ts` could `export { EVENT_INTERACTION_IGNORE_ATTRIBUTE } from "./event.registry";` with **no** cycle (`event.registry` imports nothing), but `dom.ts` is off-contract this run. Follow-up: extract the pure attribute names into a leaf `grid/interaction/attributes.ts` that both import.
- **n2-2** — `event.registry.ts:103,114` use `closest<HTMLElement>(...)`, whose generic is an unchecked assertion (`closest<E extends Element>`), and the real pointer target is frequently an `SVGElement`. Pre-existing pattern (`dom.ts:33`), no behavioural risk here, noted for consistency only.
- **n2-3** — `event.registry.test.ts:73` uses `document.createElement("svg")`, which produces an `HTMLUnknownElement`, not an `SVGElement`. The `closest()` walk is identical so the test is valid, but it doesn't model the real glyph as the comment at `:71-72` implies. `document.createElementNS("http://www.w3.org/2000/svg", "svg")` would.
- **n2-4** — The `EVENT_INTERACTION_IGNORE_ATTRIBUTE` docstring (`event.registry.ts:10-15`) says the attribute "is the only available opt-out." Accurate for a descendant that must stay hit-testable, slightly overstated in general (`pointer-events: none`, as `EventRepeatIcon.tsx:17` uses, is the other one). Not worth changing unless m2-1's docstring edit lands anyway.

---

## Refinement TaskPacket specs

```json
{
  "module": "grid — one-click join icon, B-1 fix (CMP-103, round 2)",
  "verdict": "approve-with-nits",
  "refinement_packets": [
    {
      "task_type": "human_decision_then_patch",
      "id": "R2-1-isbusy-guard",
      "severity": "major",
      "instruction": "HUMAN DECISION FIRST. Present the two options below; the reviewer's recommendation is (A). (A) RECOMMENDED — add the masking guard: append `&& !event.isBusy` to the `showJoinIcon` expression in packages/web/src/grid/components/TimedEventCard.tsx:138-143 and to the identical expression in packages/web/src/grid/components/AllDayEventCard.tsx. Then rewrite EventCard.test.tsx:1026-1062: delete the fixture-only assertion `expect(busy.conference).toBeUndefined()` at :1033 (it asserts on the local createEvent helper at :29-47, not on any contract), keep the busy-without-conference render, and change the second render's assertion at :1061 from `.not.toBeNull()` to `.toBeNull()`. Retitle the test to 'renders no join control for a busy event even if a conference somehow reached it' and rewrite the comment to cite requirements §6's role matrix plus the identical render-time-revalidation rationale EventJoinIcon.tsx:14-24 already gives for isSafeConferenceUrl. Add a mirror case for AllDayEventCard. (B) If the human keeps the contract-only stance, still delete :1033 and demote the whole case to a one-line comment citing event.view-model.ts:60-61,94 — do NOT leave an assertion that a busy event with a conference DOES render a join control, because that makes the safe hardening a CI failure. Do not touch EventJoinIcon.tsx in either branch.",
      "inputs": [
        "packages/web/src/grid/components/EventCard.test.tsx:1026-1062",
        "packages/web/src/grid/components/TimedEventCard.tsx:136-143",
        "packages/web/src/grid/components/AllDayEventCard.tsx (showJoinIcon)",
        "packages/web/src/events/queries/event.view-model.ts:60-64,94",
        "packages/web/src/grid/components/EventJoinIcon.tsx:13-37",
        "requirements.md §6 role matrix, PII-1/PII-2"
      ],
      "acceptance": [
        "No assertion remains anywhere in the suite that a busy event with a conference renders a join control.",
        "If (A): the new assertion fails before the showJoinIcon change and passes after — demonstrate both states.",
        "If (A): both TimedEventCard and AllDayEventCard are covered.",
        "bun test:web, bun type-check and bun lint all clean."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R2-2-keyboard-targeting-scope",
      "severity": "minor",
      "instruction": "Resolve the keyboard-targeting side effect of the ignore check. PREFERRED: separate pointer semantics from focus semantics. Widen EventRegistry.resolveFromTarget in packages/web/src/grid/interaction/event.registry.ts to `resolveFromTarget(target: EventTarget | null, options?: { respectIgnore?: boolean })`, defaulting respectIgnore to true, and skip the :114-120 ignore block when it is false. Then have packages/web/src/grid/interaction/event.targeting.ts:19 (`toTarget`) pass `{ respectIgnore: false }`, so getFocusedGridEventTarget keeps resolving the owning card when focus is on the join button. Add one test in event.registry.test.ts pinning both branches for the same DOM. ACCEPTABLE ALTERNATIVE if the team prefers the current behaviour: leave the code as is, extend the EVENT_INTERACTION_IGNORE_ATTRIBUTE docstring (event.registry.ts:1-18) to state explicitly that the marker also removes the subtree from *keyboard* event targeting via event.targeting.ts, and note the resulting divergence from useIsAnyCalendarEventFocused.ts:13,22 (which still reports focused); then add a test pinning that getFocused() is null with an ignore-marked descendant focused. Do not change any shortcut hook.",
      "inputs": [
        "packages/web/src/grid/interaction/event.registry.ts:98-140",
        "packages/web/src/grid/interaction/event.targeting.ts:16-27,51-52",
        "packages/web/src/shortcuts/tips/useIsAnyCalendarEventFocused.ts:11-24",
        "packages/web/src/grid/shortcuts/useGridEventEditShortcuts.ts:177-192,443,455",
        "packages/web/src/grid/shortcuts/useGridEventFormFieldSequences.ts:64,98,101"
      ],
      "acceptance": [
        "The chosen behaviour is pinned by a test that fails if it is reversed.",
        "The pointer path is unchanged: a pointerdown inside an ignore subtree still yields shouldOwn:false.",
        "The EVENT_INTERACTION_IGNORE_ATTRIBUTE docstring no longer describes the marker as drag/click-only if the keyboard behaviour is being kept."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R2-3-comment-accuracy",
      "severity": "minor",
      "instruction": "Correct the two factual errors in packages/web/src/grid/components/EventJoinIcon.tsx:98-105. Remove the 'keyboard-only mode' claim: useKeyboardOnlyMode.ts:66-88 blocks pointerdown/mousedown/click/auxclick on WINDOW CAPTURE with preventDefault + stopPropagation, strictly before PointerCaptureBoundary, so none of this button's handlers (including onClick) run in that mode. Replace the justification with the single true one: the adapter now declines ownership for this subtree, so the boundary does not consume the pointerdown, and onMouseDown's stopPropagation at :97 is what keeps the card's onEventMouseDown (TimedEventCard.tsx:326 / AllDayEventCard.tsx:185) and the bubble-phase draft-create handlers (MainGrid.tsx:156, AllDayRow.tsx:143, TimedGrid.tsx:140) from firing. State plainly that onPointerDown at :105 is defensive only — grep confirms no bubble-phase pointerdown listener exists above it (the only pointerdown listeners in packages/web/src are PointerCaptureBoundary.tsx:107 and useEditSequenceShortcut.ts:190, both capture-phase). Comment-only change; do not remove or alter any handler.",
      "inputs": [
        "packages/web/src/grid/components/EventJoinIcon.tsx:86-105",
        "packages/web/src/shortcuts/keyboard-only/useKeyboardOnlyMode.ts:60-90",
        "packages/web/src/shortcuts/useEditSequenceShortcut.ts:185-195",
        "packages/web/src/interaction/react/PointerCaptureBoundary.tsx:69-80,104-113"
      ],
      "acceptance": [
        "No comment in EventJoinIcon.tsx asserts a mechanism that grep contradicts.",
        "The rendered output and all four handlers are unchanged; the existing 21 + 2 join tests still pass unmodified."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R2-4-regression-test-hardening",
      "severity": "minor",
      "instruction": "Harden the new regression tests in packages/web/src/grid/components/EventCard.test.tsx without touching any existing assertion. (a) In the end-to-end test at :1080-1143, add `expect(fireEvent.pointerDown(...)).toBe(false)` for the card body and `.toBe(true)` for the join button — fireEvent returns dispatchEvent's boolean, which pins 'the boundary did / did not consume' directly. (b) Give the stub adapter a real pending->click contract mirroring interaction.engine.ts:192-210 (open a pending session on an owned pointerdown; on pointerup, if pending, invoke an onClickEvent spy), fire pointerUp after each pointerDown, and assert the spy fires for the card body and NEVER for the join button — that is B-1's actual symptom, which the current test does not cover. This also gives stubWindowOpen() at :1088 something to assert. (c) Add an AllDayEventCard mirror for BOTH new tests (:1064 attribute assertion and :1080 e2e) — the all-day ownership path is separate code (week-interaction.adapter.ts:507-546 / day-interaction.adapter.ts:458-497) and is currently unpinned. (d) Add one case firing pointerDown on the card's `[data-calendar-event-resize-handle]` node and asserting ownership IS taken, pinning that the fix did not disable resizing. Append-only.",
      "inputs": [
        "packages/web/src/grid/components/EventCard.test.tsx:1064-1143",
        "packages/web/src/interaction/interaction.engine.ts:126-210",
        "packages/web/src/interaction/react/PointerCaptureBoundary.tsx",
        "packages/web/src/grid/components/TimedEventCard.tsx:362-382",
        "packages/web/src/grid/components/AllDayEventCard.tsx:231-252"
      ],
      "acceptance": [
        "Every new assertion fails when the ignore check in event.registry.ts:114-120 is disabled, and passes when it is restored — demonstrate the mutation both ways.",
        "The resize-handle case passes on the current tree (it is a guard, not a regression test).",
        "No existing assertion in EventCard.test.tsx is modified or removed."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R2-5-join-button-zindex",
      "severity": "minor",
      "instruction": "Lift the join button above the card's resize handles. In packages/web/src/grid/components/EventJoinIcon.tsx add `style={{ zIndex: ZIndex.LAYER_5 }}` to the <button> (import ZIndex from @web/common/constants/web.constants). Rationale: TimedEventCard.tsx's endDate handle is bottom:-0.25px / height:4.5px / zIndex LAYER_4 (=4) across the full card width, and the button is bottom-0.5 (2px) with a 12px glyph, so the handle currently covers the bottom ~2.25px of the button and a press there starts a resize instead of opening the meeting. Do NOT solve this by moving the button (bottom-1 still leaves 0.25px of overlap) and do NOT change the handles. Add a test asserting the join button carries a z-index above ZIndex.LAYER_4.",
      "inputs": [
        "packages/web/src/grid/components/EventJoinIcon.tsx:74-81",
        "packages/web/src/grid/components/TimedEventCard.tsx:257-268,372-382",
        "packages/web/src/grid/components/AllDayEventCard.tsx:130-141,242-252",
        "packages/web/src/common/constants/web.constants.ts:23-28",
        "packages/web/src/grid/components/EventRepeatIcon.tsx:17"
      ],
      "acceptance": [
        "The join button's computed z-index exceeds ZIndex.LAYER_4 and it remains inside the card's stacking context (no change to the card's own zIndex).",
        "Existing geometry tests (the pr-3.5 / pr-4 / pr-7 ladder and the right-1 / right-4 offset cases) still pass unchanged.",
        "The repeat glyph keeps pointer-events-none and is untouched."
      ]
    },
    {
      "task_type": "doc_update",
      "id": "R2-6-followups",
      "severity": "minor",
      "instruction": "Carry forward into the follow-up ticket list, with file:line pointers, so they survive this run: (1) extract the EVENT_*_ATTRIBUTE family into a leaf packages/web/src/grid/interaction/attributes.ts that both dom.ts and event.registry.ts import — today EVENT_INTERACTION_IGNORE_ATTRIBUTE has to live in event.registry.ts because dom.ts:8 -> view-event-registry.ts:1-5 -> event.registry.ts is a real cycle, and the family is now split across two files with no cross-reference (n2-1). (2) Round-1 Q-A: FR-2's @web/components/Icons/* wrapper convention is bypassed by EventJoinIcon.tsx:1's direct @phosphor-icons/react import. (3) Round-1 Q-C: darken(baseColor, 30) on an interactive control lands near 2.8:1, below WCAG 1.4.11's 3:1. Also update design.md §6.4 to delete the 'this path cannot be automated' claim (EventCard.test.tsx:1080 automates it) and close R-1/Q-B with the verified answer: PointerCaptureBoundary.tsx:107, capture phase, ancestor of every card; mitigated by EVENT_INTERACTION_IGNORE_ATTRIBUTE, not by any handler on the button.",
      "inputs": [
        "design.md §6.4, §7 R-1, §10 Q-A/Q-B/Q-C",
        "packages/web/src/grid/interaction/dom.ts:1-26",
        "packages/web/src/grid/interaction/event.registry.ts:1-18"
      ],
      "acceptance": [
        "R-1 and Q-B state the verified dispatch order and the actual mitigation.",
        "§6.4 no longer claims the pointer path cannot be automated.",
        "Q-A, Q-C and the attributes.ts extraction are logged as follow-ups with file:line pointers."
      ]
    }
  ]
}
```

---

## (a) Is B-1 closed?

**Yes.** Closed, and closed at the right layer.

The four ownership paths in `week-interaction.adapter.ts:483-505` and the four in `day-interaction.adapter.ts:434-455` all funnel through `getRegisteredTarget` → `resolveFromTarget`. I checked for the specific escapes you asked about and found none: the resize-handle path (`getResizeHandleEdge`) is a discriminator that still requires a registry hit; the all-day-row path is `getAllDayDragTarget`/`getAllDayResizeTarget`, both of which also require a registry hit; and there is no second `closest()` anywhere on the ownership chain. `grep shouldOwn` returns exactly the eight sites in those two adapters plus the boundary's own check — no third adapter, no other consumer. `PointerCaptureBoundary` is mounted in exactly two places (`WeekInteractionCoordinator.tsx:193`, `DayInteractionCoordinator.tsx:117`), both above the whole grid. The all-day card is therefore fixed by the same edit as the timed card — though, per m2-3, nothing in the test suite *pins* that, so please land R2-4(c).

The downstream path that the fix newly makes reachable also checks out: every draft-create and card-open handler that can now see the compat `mousedown` is bubble-phase and is stopped by `EventJoinIcon.tsx:97`.

Your mutation check is the right evidence and I agree with its reading. Note what it *doesn't* cover, per m2-3: the tests bind the mechanism (`resolveFromTarget` returns null) rather than the symptom (the form does not open), and they bind it only for the timed card and only through a hand-rolled adapter.

## (b) Is the R-1 manual pre-merge check still required?

**Yes — still required, and now it should actually pass.** The difference from round 1 is that I can no longer predict a failure from source; last time I could.

It remains necessary for three reasons the automated suite cannot reach:

1. **Real browser click generation after a non-consumed pointerdown.** Every assertion in the new tests runs in jsdom, which does not implement pointer capture, compatibility mouse-event suppression, or click retargeting. The whole B-1 mechanism lived in those semantics.
2. **The stub adapter is not the real adapter.** m2-3(4): `isEligibleInteractionPointerDown`, the `getResizeHandleEdge` branch ordering, and `engine.handlePointerDown`'s pending-session/hold-timer machinery are all bypassed by the test double. Only a real browser exercises the composed path.
3. **The all-day card is untested end-to-end** (m2-3(2)).

Run it on **both Week and Day**, on a recurring event (both glyphs in the corner) and a non-recurring one, and on **both a timed and an all-day** card. Confirm:

- exactly one new tab, and **no event form**;
- press-and-hold past the hold delay on the join icon does **not** start a drag;
- the card body still drags, and both resize handles still resize;
- **new for this round** — press the *bottom edge* of the join glyph (m2-4): if that starts a resize instead of joining, R2-5 is confirmed and should land before merge;
- **new for this round** — Tab to the join icon, then press Backspace / `e` / an arrow key (m2-1): note whether the shortcut acts on the card or silently no-ops, and whether the sidebar hint bar still advertises it. That is the observable form of m2-1 and should inform which option R2-2 takes.

Do not merge on a green suite alone.
