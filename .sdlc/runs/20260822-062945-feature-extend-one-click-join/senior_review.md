# Senior code review — CMP-103 one-click join icon

**Run:** `20260822-062945-feature-extend-one-click-join`
**Intent:** `feature-extend` (brownfield, scoped to the 5 files this run touched)
**Reviewed against:** `design.md` (§2 contract, §3 integration, §4 a11y, §5 ADR-1..5, §7 R-1..R-9), `requirements.md` (FR-1..14, NFR-1..6, AC-1..10, PII-1/2)

---

## Verdict: **changes-required**

One blocker. The delta is otherwise high quality — the geometry, the type-safety story, the PII story and 20 of the 21 new tests are correct, and I could not find an FR-14 regression in either card. But **ADR-5's four-handler set does not close the pointer path it was written to close.** Two of the four handlers (`onPointerDown`, `onMouseDown`) are unreachable dead code in the running app, and clicking the join icon in the Week or Day grid opens the event form. This is the same defect the two prior attempts shipped; ADR-5 correctly diagnosed *that* the pointer engine was the problem, then picked a lever that cannot reach it.

The green unit suite is **not** evidence to the contrary: every new test renders a bare card with no `PointerCaptureBoundary` above it, so the production dispatch order is never exercised.

---

## Blocker

### B-1 — `EventJoinIcon`'s `onPointerDown` runs *after* the interaction engine has already claimed the gesture; both it and `onMouseDown` are unreachable in the app

**Files:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/components/EventJoinIcon.tsx:95,101`
**Root cause (out of contract):** `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/interaction/react/PointerCaptureBoundary.tsx:69-80,104-113`

ADR-5 assumed the engine's `pointerdown` is bound at or above the React root and could therefore be beaten by a synthetic bubble-phase `stopPropagation()` on the button. It is not. It is bound as a **React capture-phase handler on an ancestor of the card**:

```tsx
// PointerCaptureBoundary.tsx:104-113
<div
  onPointerDownCapture={handlePointerDownCapture}   // <- ancestor, CAPTURE phase
  ...
  style={{ display: "contents" }}
>
  {children}
</div>
```

`WeekView.tsx:179` → `WeekInteractionCoordinator.tsx:193` wraps the entire grid (and `DayInteractionCoordinator.tsx:117` does the same for Day), so every event card — and therefore every join button — is a descendant of this boundary.

Capture-phase dispatch runs root → target and completes **before** any bubble-phase handler on the target. The concrete sequence for a real pointerdown on the join button:

1. `handlePointerDownCapture` fires first (`PointerCaptureBoundary.tsx:69`) → `adapter.handlePointerDown(event.nativeEvent)`.
2. `week-interaction.adapter.ts:160-181`: `isEligibleWeekPointerDown` passes (primary, button 0, no modifiers) → `getInteractionTarget(event)` → `getTimedDragTarget` → `resolveTimedEventTarget` → `getRegisteredTarget` → `event.registry.ts:resolveFromTarget(event.target)`, which does `target.closest("[data-week-interaction-event-id][data-week-interaction-event-type]")`. **The join button is a descendant of the card, so this resolves the card.** There is no interactive-descendant exclusion anywhere on this path.
3. `engine.handlePointerDown` (`interaction.engine.ts:126-157`) opens a `pending` session; the adapter returns `shouldOwn: true`.
4. `PointerCaptureBoundary.tsx:78` calls `consumeOwnedPointerEvent(event)` → **`event.preventDefault(); event.stopPropagation();` — in the capture phase**.

Consequences, in order of severity:

- **`EventJoinIcon.tsx:101` (`onPointerDown`) never executes.** React's synthetic `stopPropagation` calls through to the native event; propagation is halted at the boundary during capture, so the event never reaches the button and React's bubble-phase root listener never fires. The one handler ADR-5 identified as "the **only** lever" is dead code.
- **`EventJoinIcon.tsx:95` (`onMouseDown`) never executes either.** `preventDefault()` on `pointerdown` suppresses the compatibility mouse events (`mousedown`/`mouseup`) per Pointer Events L3. AC-4 therefore "passes" in production for an unrelated reason — the card's `onEventMouseDown` is suppressed by the same mechanism — but the handler contributes nothing. It also means the button never receives focus from a mouse press.
- **The event form opens on release.** `connectActivePointer` (`PointerCaptureBoundary.tsx:163-165`) binds `pointerup` on `window` in the capture phase; `handleWindowPointerUp` → `adapter.handlePointerUp` → `interaction.engine.ts:203-210` returns `{ type: "click" }` on a `pending` session → `week-interaction.adapter.ts:207-214` calls `onClickTimedEvent(result.target.event)` / `onClickAllDayEvent(...)`. **This is FR-4 / AC-4 / AC-5's failure mode, verbatim.**
- **`window.open` still runs.** Per Pointer Events L3, `click` is still fired when `pointerdown`'s default was prevented, so `EventJoinIcon.tsx:80-83` fires too. Net user-visible behaviour: **a new tab AND the event form**. (If a given browser suppresses the click under active pointer capture, the degraded outcome is "form opens, join never works" — an FR-3 failure instead. Both are unacceptable.)
- **Hold-to-drag:** the `pending` session's hold timer (`interaction.engine.ts:142-144`) is live, so pressing and holding on the join icon promotes to `motion` and drags the card.

Corroborating evidence that this ordering is understood elsewhere in the repo: `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/shortcuts/keyboard-only/useKeyboardOnlyMode.ts:60-62` — *"Window capture runs before React's delegated root listeners (and grid PointerCaptureBoundary), so clicks never reach event open handlers."*

**There is no in-contract fix.** No listener on a descendant — React or native, bubble or capture — can pre-empt an ancestor's capture-phase handler. Capture order is strictly root → target. `EventJoinIcon.tsx` cannot solve this by itself; Q-B must be reopened as a scope extension, exactly as ADR-5 said it should be if the manual check failed.

**Recommended fix (minimal, idiomatic, one choke point).** The repo already has the pattern: `getResizeHandleEdge` (`grid/interaction/dom.ts:29-39`) lets a descendant change how the adapter resolves a pointer target, via a `data-*` attribute plus `closest()`. Mirror it with an opt-out, applied at `event.registry.ts:resolveFromTarget` — the single function both the Week (`week-interaction.adapter.ts:637`) and Day (`day-interaction.adapter.ts:588`) adapters call:

```ts
// grid/interaction/dom.ts
export const EVENT_INTERACTION_IGNORE_ATTRIBUTE =
  "data-calendar-event-interaction-ignore";

// grid/interaction/event.registry.ts — resolveFromTarget
const element = target.closest<HTMLElement>(
  `[${eventIdAttribute}][${eventTypeAttribute}], [${EVENT_INTERACTION_IGNORE_ATTRIBUTE}]`,
);
if (!element || element.hasAttribute(EVENT_INTERACTION_IGNORE_ATTRIBUTE)) {
  return null; // an interactive descendant opted out of grid drag/click
}
```

`closest()` returns the *nearest* match, so an ignore element inside a card wins over the card. `EventJoinIcon` then spreads `{...{ [EVENT_INTERACTION_IGNORE_ATTRIBUTE]: "true" }}` on its `<button>`. With the target unresolved, `handlePointerDown` returns `shouldOwn: false`, nothing is consumed, and the existing four handlers on the button then work exactly as designed (`onMouseDown` still stops the column's draft-create handler in `useTimedDraftCreation`, `onClick` still calls `window.open` once). The added attribute is a boolean marker — no PII-2 impact.

Keep all four existing handlers: once the boundary stops consuming the event they become reachable and are all load-bearing.

---

## Major

### M-1 — §6.4's claim that the pointer path "cannot be automated" is wrong, and it is why this shipped twice

**File:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/components/EventCard.test.tsx` (new block, §6.4 rationale)

§6.4 justifies the coverage gap with "`fireEvent.mouseDown` in jsdom does not dispatch `pointerdown`, and the interaction engine is not mounted by these unit renders." Both halves are true and neither is a reason to skip the test — `fireEvent.pointerDown`/`pointerUp` exist in dom-testing-library, and `PointerCaptureBoundary` is an ordinary component that a test can mount around the card. The gap is what let B-1 through a third time.

The AC-4/AC-5 tests as written (T-6..T-10) are correct assertions about the *component*, but they render the card bare, so they are silent about the production dispatch order. That silence read as coverage.

### M-2 — R-1's manual pre-merge check is not a mitigation, because it is guaranteed to fail

**File:** `design.md:673` (R-1), `design.md:722` (Q-B)

R-1 rates the pointer-engine bypass as "Medium likelihood, mitigated by handler 1 + a manual check." Handler 1 does not run, so the likelihood is 1.0 and the mitigation is a detector, not a mitigation. Merging on a green suite plus a skipped manual check would ship the defect. This needs re-rating in the risk register once B-1 is fixed, and R-1's manual check should be retained as a *confirmation* step rather than as the mitigation itself.

---

## Minor

### m-1 — T-21 ("renders no join control for a busy event") is vacuous

**File:** `packages/web/src/grid/components/EventCard.test.tsx:1019-1030`

```tsx
event={createEvent({ isBusy: true })}   // no `conference` at all
...
expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
```

The event has no conference, so this is byte-for-byte the same assertion as T-2 ("renders no join control on a timed event without a conference link"). It passes with `isBusy` deleted, passes with the whole feature reverted, and pins nothing about the §6 role-matrix rule it claims to cover. It is the one test in the appended 21 that would still pass for entirely the wrong reason.

Either delete it, or make it assert the rule: render `createEvent({ isBusy: true, conference: CONFERENCE })` and assert no join control — which would currently **fail**, since neither card checks `isBusy`. If the contract really guarantees busy events carry no conference, deletion plus a comment pointing at the contract is the honest option; a test that can't fail is worse than no test.

### m-2 — FR-2 literal deviation is real and should be tracked, not silently absorbed

**File:** `packages/web/src/grid/components/EventJoinIcon.tsx:1`

`VideoCameraIcon` is imported straight from `@phosphor-icons/react`, not via the `@web/components/Icons/*` wrapper convention FR-2 names. This is Q-A, resolved at Gate 2 with sound reasoning and no wrapper file exists to use — I agree with the call. Flagging only so it lands in the follow-up list rather than evaporating: every other grid icon (`EventRepeatIcon` → `Icons/Repeat.tsx`) goes through the wrapper.

Incidental upside worth recording: because the wrapper is bypassed, `getInteractiveIconClassName` never runs, so the rendered `<svg>` carries **no `class` attribute at all** — see R-4 verification below.

### m-3 — NFR-5 contrast bar is not met and the design says so

**File:** `packages/web/src/grid/components/EventJoinIcon.tsx:106`

`darken(baseColor, 30)` on an interactive control: NFR-5 asks for "the repo's stated 4.5:1 contrast bar that the surrounding card code repeatedly defends," and the cards themselves use `theme.getContrastText(bgColor)` for exactly that reason (`TimedEventCard.tsx:213`, `AllDayEventCard.tsx:108`). §4 concedes this lands near 2.8:1 and fails even the 3:1 WCAG 1.4.11 bar. Accepted at Gate 2 as Q-C because D2 binds the tint for cross-run consistency. Not blocking this run; it should not be lost.

---

## Nits

- **n-1** — `EventJoinIcon.tsx:77`: `c-focus-ring` `@apply`s `rounded` (`index.css:260-262`) while the button also sets `rounded-xs`; which radius wins depends on stylesheet source order, not class order. Precedent exists (`UpNextBanner.tsx:91` does the same), so this is consistency, not a bug.
- **n-2** — Both cards derive `conferenceUrl`/`joinUrl` into locals but then re-read `event.conference?.label ?? null` at the JSX site. Harmless (the optional chain is type-safe), slightly asymmetric.
- **n-3** — The format-after-edit hook has already rewritten `EventJoinIcon.tsx` since it was written (import collapsed to one line, `ph-no-capture` re-sorted to position 2 in the class string). R-8 anticipated this and the assertions are all `toContain`/`toHaveClass`, so nothing broke. Confirming R-8 held.

---

## Explicit answers to the seven questions asked

**1. ADR-5 handler completeness — does the four-handler set close the pointer path?**
**No.** See B-1. Handlers 1 and 2 (`onPointerDown`, `onMouseDown`) never execute in the app. The remaining route by which clicking join also opens the event form is `PointerCaptureBoundary`'s `onPointerDownCapture` → `engine.handlePointerDown` (pending session) → window-capture `pointerup` → `{type:"click"}` → `onClickTimedEvent` / `onClickAllDayEvent`. Handlers 3 and 4 (`onClick`, `onKeyDown`) are correct and reachable; the keyboard path is genuinely closed.

**2. R-4 regression risk — can the join glyph match `svg[class*="right-1"]`?**
**No. Verified against the source, not the design's claim.** Three independent reasons, all confirmed:
- `EventJoinIcon.tsx:104-109` passes **no `className`** to `VideoCameraIcon`. Phosphor's `IconBase` (`node_modules/@phosphor-icons/react/dist/lib/IconBase.es.js:21-33`) sets no default class, and the app's `IconContext.Provider` supplies only `{ size: 25 }` (`IconProvider.tsx:6-9`) — so the rendered `<svg>` has no `class` attribute and cannot match an attribute-substring selector.
- The `right-1`/`right-4` class lives on the `<button>` (`EventJoinIcon.tsx:76-79`), not the svg.
- All four pre-existing queries (`EventCard.test.tsx:296, 324, 343, 359`, plus `447`) render events with **no `conference`**, so no join node exists in those renders at all.

The new T-18 additionally asserts `withRepeat.container.querySelector('svg[class*="right-1"]')` is non-null on a card that renders **both** icons (line 944) — that test now pins R-4 directly. Good.

**3. FR-14 — byte-identical rendering for conference-less events?**
**Yes, both cards.**
- `TimedEventCard.tsx:138-143`: `showJoinIcon` is `false` whenever `joinUrl === null`; `:387` emits no node. No root class or `aria-label` change.
- `AllDayEventCard.tsx:209-211`: when `showJoinIcon` is `false`, `"pr-3.5": showRepeatIcon && !showJoinIcon` collapses to `"pr-3.5": showRepeatIcon` — exactly the pre-edit expression. The no-icon case emits no padding class.
- Pinned by T-19's exact-string assertion (`toBe("flex min-w-0 items-center")`) and by T-2/T-4.

**4. All-day padding ladder (`pr-3.5` / `pr-4` / `pr-7`)?**
**Mutually exclusive and geometrically correct.** The three predicates are `A&&!B`, `B&&!A`, `A&&B` — no pair can be simultaneously true, and the neither-case correctly emits nothing. Geometry checks out against §3.3: repeat = 10px glyph at `right-1` → occupies 4..14px → 14px = `pr-3.5`; join alone = 12px at `right-1` → 4..16px → 16px = `pr-4`; both = repeat 4..14 plus join at `right-4` → 16..28px → 28px = `pr-7`, with a 2px gap and no overlap, so no z-index is needed. All three are canonical Tailwind steps per AGENTS.md. (Pedantically the reserve over-shoots by the card's own `pr-0.75`, since the absolute icons are positioned against the padding box while the ladder pads the content box — but that is pre-existing `pr-3.5` behaviour, unchanged, and it errs toward over-reserving.)

**5. NFR-2 — no `any`, no non-null assertion?**
**Clean.** Grepped all three source files: zero `any`, zero non-null assertions. The `isSafeConferenceUrl` type predicate (`url is string`) does the narrowing work as designed, and the redundant-looking `showJoinIcon && joinUrl &&` at both JSX sites is what keeps `url` a `string` without an assertion — keep both operands. The test's `open as unknown as typeof window.open` (`EventCard.test.tsx:59`) is the correct deliberate cast; it is not `any` and it will satisfy `tsconfig.test.json`.

**6. PII-1 / PII-2 / ADR-1?**
**Clean.** The URL exists only as a closed-over prop passed to `window.open` (`EventJoinIcon.tsx:82`) — no `href`, no `title`, no `data-*`, no tooltip. The accessible name uses only `conference.label` (rated Low in the §5 PII table) and rejects URL-shaped labels via the slash discriminator (`:71`), so even a provider that emits the meeting address as its label cannot leak it into `aria-label`. `ph-no-capture` is present and correctly named for posthog-js. Grepped the new component for `console.`/`posthog`/`fetch(`/`axios`/`track(`/`capture(` — none. No new dependency, no `package.json` edit. T-20 pins both halves (`ph-no-capture` class + `container.innerHTML` does not contain the URL).

**7. Test quality — do the 21 cases pin what they claim?**
**20 of 21 are non-vacuous.** T-1/T-3 fail if the feature is reverted; T-5 pins the exact `window.open` triple including both `noopener` and `noreferrer` (load-bearing for NFR-4 since ADR-1 removed the `rel` attribute); T-6..T-10 fail if the corresponding handler is deleted from the component; T-11's `userEvent` Enter is the right instrument and is the only thing proving `stopPropagation` without `preventDefault` did not break Space/Enter activation; T-14 fails if `isSafeConferenceUrl` is removed (and the padded-whitespace case genuinely exercises WHATWG stripping); T-17/T-18 fail if the offset or width gates are removed; T-19's exact-string assertion is the strongest FR-14 guard in the file.

**T-21 is the exception — it is vacuous.** See m-1.

Two structural notes, both fine: the new tests correctly disambiguate the nested `role="button"` by name (`/join/i` never matches a card `aria-label`), and multi-render tests call `unmount()` explicitly rather than relying on the global `cleanup()` in `__tests__/setup/test-lifecycle.ts:73`.

---

## Refinement packets

```json
{
  "module": "grid/components — one-click join icon (CMP-103)",
  "verdict": "needs_changes",
  "refinement_packets": [
    {
      "task_type": "scope_extension_then_patch_apply",
      "id": "R1-pointer-engine-optout",
      "severity": "blocker",
      "instruction": "Reopen Gate 0 to add two paths to the write contract (packages/web/src/grid/interaction/dom.ts, packages/web/src/grid/interaction/event.registry.ts), then close the pointer-engine bypass described in B-1. (a) In grid/interaction/dom.ts export `EVENT_INTERACTION_IGNORE_ATTRIBUTE = \"data-calendar-event-interaction-ignore\"`, placed alongside the existing EVENT_RESIZE_HANDLE_ATTRIBUTE it is modelled on. (b) In grid/interaction/event.registry.ts, widen `resolveFromTarget`'s `closest()` selector to `[idAttr][typeAttr], [EVENT_INTERACTION_IGNORE_ATTRIBUTE]` and return null when the nearest match carries the ignore attribute — this is the single choke point both week-interaction.adapter.ts:637 and day-interaction.adapter.ts:588 call, so one edit covers Week and Day. (c) In EventJoinIcon.tsx spread `{...{ [EVENT_INTERACTION_IGNORE_ATTRIBUTE]: \"true\" }}` onto the <button>. Keep all four existing propagation handlers — once the boundary stops consuming the pointerdown they become reachable and each is load-bearing (onMouseDown still guards useTimedDraftCreation's column handler). Do NOT add the attribute to the card root, the resize handles, or anything else. Do NOT change PointerCaptureBoundary or interaction.engine.ts.",
      "inputs": [
        "packages/web/src/interaction/react/PointerCaptureBoundary.tsx:69-80,104-113,137-148",
        "packages/web/src/grid/interaction/event.registry.ts (resolveFromTarget)",
        "packages/web/src/grid/interaction/dom.ts:20-39",
        "packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts:157-189,199-214,633-640",
        "packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts:115-140,588",
        "packages/web/src/interaction/interaction.engine.ts:126-157,192-211",
        "packages/web/src/grid/components/EventJoinIcon.tsx",
        "design.md ADR-5, R-1, Q-B"
      ],
      "acceptance": [
        "A pointerdown whose event.target is inside an element carrying EVENT_INTERACTION_IGNORE_ATTRIBUTE resolves to no interaction target, so the adapter returns shouldOwn:false and no pending session opens.",
        "A pointerdown on a card, on a resize handle, or on the card's title still resolves exactly as it does today — no behavioural change for any existing target.",
        "The conference URL is still absent from every DOM attribute; the new attribute's value is the literal string \"true\".",
        "bun test:web, bun type-check and bun lint all clean.",
        "R-1's manual check now passes: one new tab, no event form."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R2-pointer-path-regression-test",
      "severity": "major",
      "instruction": "Append to packages/web/src/grid/components/EventCard.test.tsx the regression test §6.4 wrongly declared impossible. Mount a TimedEventCard with a conference inside a real <PointerCaptureBoundary adapter={...}> whose adapter is a hand-built stub exposing the PointerCaptureAdapter interface and delegating handlePointerDown/handlePointerUp to a real createInteractionEngine (or, if wiring the real engine is disproportionate, to a minimal fake that mirrors interaction.engine.ts's pending -> {type:\"click\"} contract). Then fireEvent.pointerDown + fireEvent.pointerUp on the join button and assert (1) the adapter's open-event callback was NOT invoked, and (2) window.open was called exactly once with the conference URL. Add the mirror case for AllDayEventCard. This test MUST fail against the current EventJoinIcon and pass only after R1-pointer-engine-optout lands — verify that ordering explicitly. If jsdom cannot construct usable PointerEvents in this harness, fall back to a direct unit test of event.registry.ts's resolveFromTarget (returns null for a target inside the ignore element, unchanged for every other target) and say so in a comment naming the limitation. Append-only; do not touch the existing 575 lines or the 21 cases added this run.",
      "inputs": [
        "packages/web/src/grid/components/EventCard.test.tsx",
        "packages/web/src/interaction/react/PointerCaptureBoundary.tsx",
        "packages/web/src/interaction/interaction.engine.ts:126-211",
        "design.md §6.4, R-1"
      ],
      "acceptance": [
        "The new test fails on the pre-R1 tree and passes on the post-R1 tree (both states demonstrated).",
        "Both card types covered.",
        "No existing assertion in EventCard.test.tsx is modified or removed."
      ]
    },
    {
      "task_type": "existing_file_edit",
      "id": "R3-fix-vacuous-busy-test",
      "severity": "minor",
      "instruction": "Replace the vacuous 'renders no join control for a busy event' case at the end of EventCard.test.tsx. Preferred: delete it and add a one-line comment on the role matrix explaining that busy events carry no conference by contract (cite packages/core/src/types/event-attendance.contracts.ts), so there is nothing renderable to assert. Alternative, only if the team wants a defence-in-depth guard: render createEvent({ isBusy: true, conference: CONFERENCE }), assert no join control, and add the corresponding `!event.isBusy` term to showJoinIcon in BOTH cards so the test can actually fail. Do not leave the current form, which passes identically with isBusy removed and with the feature reverted.",
      "inputs": [
        "packages/web/src/grid/components/EventCard.test.tsx:1019-1030",
        "requirements.md §6 role matrix",
        "packages/core/src/types/event-attendance.contracts.ts:31-35"
      ],
      "acceptance": [
        "No test remains in the appended block that would pass unchanged if the whole feature were reverted, other than the deliberate FR-14 negative guards (T-2/T-4) which are paired with positive cases.",
        "If the alternative is chosen, the new assertion fails before the showJoinIcon change and passes after."
      ]
    },
    {
      "task_type": "doc_update",
      "id": "R4-risk-register-correction",
      "severity": "minor",
      "instruction": "Update design.md: re-rate R-1 from 'Medium, mitigated by handler 1' to 'realised — handler 1 is unreachable behind PointerCaptureBoundary's capture-phase onPointerDownCapture; mitigated by the EVENT_INTERACTION_IGNORE_ATTRIBUTE opt-out'. Close Q-B with the answer (PointerCaptureBoundary.tsx:107, capture phase, ancestor of every card). Correct §6.4's claim that the pointer path cannot be automated. Carry Q-A (FR-2 Phosphor wrapper) and Q-C (WCAG 1.4.11 contrast on darken(baseColor,30)) into the follow-up ticket list so they survive this run.",
      "inputs": ["design.md §6.4, §7 R-1, §10 Q-A/Q-B/Q-C"],
      "acceptance": [
        "R-1 and Q-B reflect the verified dispatch order.",
        "Q-A and Q-C are logged as follow-ups with file:line pointers."
      ]
    }
  ]
}
```

---

## R-1 manual pre-merge check — explicit statement

**Yes, it remains necessary — and as of this commit it will fail.**

R-1 is currently mis-specified: it is written as a *confirmation* of a mitigation, but the mitigation (ADR-5 handler 1) does not execute. From source alone I can predict the outcome of the manual check today: `bun dev:web`, click a join icon on a real event with a Meet link → the event form opens, alongside (in Chrome) a new tab. That is the check failing, not passing.

After `R1-pointer-engine-optout` lands, the manual check is still required and must actually be performed — R2's automated test proves the target no longer resolves, but it cannot prove that no *other* native `pointerdown` listener elsewhere in the app (or a browser-specific click-retargeting behaviour under `setPointerCapture`) reintroduces the problem. Run it on both the Week and the Day view, on a recurring event (both icons in the corner) and a non-recurring one, and confirm: exactly one new tab, no event form, and no drag when the press is held past the hold delay.

Do not merge on a green suite alone. That is precisely what happened the previous two times.
