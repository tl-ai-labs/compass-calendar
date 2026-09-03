# Delta Design — feature-extend — One-click join icon on grid event cards

Run: `20260903-105448-feature-extend-oneclick-join`
Inputs: `requirements.md` (rev 2), `intent_brief.md`, repo at HEAD `2d81253a`
Allowlist: the **11** paths fixed at Gate 1 rev 2. This design needs no twelfth. See §11.

---

## 1. Summary

1. A new `EventJoinIcon` renders an `<a>` "join" control tinted from the card fill, laid over the
   card's **right edge**, with an `http:`/`https:`-only `href` and an accessible name of
   `Join <title>`.
2. It is rendered as a **sibling of the card root, not a descendant** — both cards return a
   fragment. This is the whole answer to the axe `nested-interactive` conflict (§3) and it also
   removes the drag-ghost-clone problem for free (§6, OQ-2).
3. `dom.ts` gains `EVENT_JOIN_CONTROL_ATTRIBUTE` + `isJoinControlTarget()`; both interaction
   adapters bail to `null` at the top of `getInteractionTarget` (pointer path). The control also
   `stopPropagation()`s its own `onMouseDown` (mouse path). Both layers, as the resize handles do.
4. Two new Playwright specs seed conference-bearing rows straight into the `compass-local`
   IndexedDB store through one additive helper in `e2e/utils/event-test-utils.ts`, then assert
   join-click, no-panel and no-regression. The **timed** spec additionally runs
   `expectNoAxeViolations` scoped to `#mainGrid`; the **all-day** spec does not (Gate-2 decision
   (B) — a 24px control cannot coexist with a 20px chip under `target-size`; see §7.3 and R-4).
   The control is **24px**, forced by `target-size`.
5. No new props on either card (memo comparators in non-allowlisted files must not change), no new
   dependency, and zero DOM delta for any event without a conference URL.

---

## 2. Component design — `packages/web/src/grid/components/EventJoinIcon.tsx`

### 2.1 Public surface

```ts
// 24, not 20: axe's target-size rule (WCAG 2.5.8) requires 24px, and it DOES
// run under expectNoAxeViolations — see R-4. At 20px the control fails the new
// timed spec AND introduces a new failure in the untouched
// e2e/accessibility/app-a11y.spec.ts, which already renders a conference-bearing
// demo event ("Morning standup", demo-data-seed.ts:144). Forced, not preferential.
export const JOIN_CONTROL_SIZE_PX = 24;
/** Right inset that clears EventRepeatIcon's `right-1` + 10px glyph. */
export const JOIN_CONTROL_REPEAT_CLEARANCE_PX = 16;

/**
 * Renders the stored conference URL only when it parses AND its protocol is
 * exactly http:/https:. Returns the original string (never a normalized href)
 * so the rendered link is byte-identical to what the provider sent.
 */
export const resolveJoinHref = (url: string | null | undefined): string | null;

interface EventJoinIconProps {
  /** The host card's resolved fill; the glyph is darken(baseColor, 30), as EventRepeatIcon does. */
  baseColor: string;
  /** Event title, for the accessible name. Falls back to "Untitled event". */
  eventTitle: string;
  /** The host card's rect — the control is laid over its right edge in the same coordinate space. */
  position: EventPosition;
  /** px from the card's right edge. Defaults to 2; pass JOIN_CONTROL_REPEAT_CLEARANCE_PX when the repeat glyph shows. */
  rightInsetPx?: number;
  /** Raw conference URL, unvalidated. */
  url: string;
}

export const EventJoinIcon = ({ ... }: EventJoinIconProps) => ReactElement | null;
```

### 2.2 The AC-9 scheme guard (FR-2)

```ts
export const resolveJoinHref = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    // new URL() throws on unparseable input and on scheme-relative/relative
    // values (no base is supplied on purpose — a relative "join" URL must not
    // silently resolve against the app's own origin).
    parsed = new URL(url);
  } catch {
    return null;
  }

  // z.url() on ConferenceSchema validates parseability, not scheme, so a stored
  // `javascript:` URL would be click-to-execute the moment it reaches an href.
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
};
```

- **`try`/`catch`, not `URL.canParse`.** `canParse` is newer than the oldest browser the app
  supports and than some DOM shims used by `bun:test`; `try`/`catch` has zero compatibility risk.
- Behaviour table (all covered by tests):
  | input | result |
  |---|---|
  | `https://meet.example.com/abc-defg-hij` | rendered |
  | `HTTPS://MEET.EXAMPLE.COM/x` | rendered (`protocol` normalizes to `https:`) |
  | `http://localhost:9150/e2e-join-target` | rendered |
  | `javascript:alert(1)` | `null` — no element, no `href` |
  | `data:text/html,<script>…` | `null` |
  | `vbscript:msgbox(1)` | `null` |
  | `not a url`, `"/relative"`, `""`, `null`, `undefined` | `null` |
- Scope is this component only. `ConferenceSchema` is untouched; the three pre-existing anchors
  (`UpNextCard`, `UpNextBanner`, `EventDetailsSection`) keep their unguarded sink — follow-up ticket.

### 2.3 Render tree

```tsx
const href = resolveJoinHref(url);
if (!href) return null;

return (
  <a
    {...{ [EVENT_JOIN_CONTROL_ATTRIBUTE]: "true" }}
    aria-label={`Join ${eventTitle.trim() || "Untitled event"}`}
    className="c-focus-ring absolute flex select-none items-center justify-center rounded-xs"
    href={href}
    rel="noopener noreferrer"
    style={{
      color: darken(baseColor, 30),
      height: JOIN_CONTROL_SIZE_PX,
      left: position.left + position.width - rightInsetPx - JOIN_CONTROL_SIZE_PX,
      top: position.top + Math.max(0, (position.height - JOIN_CONTROL_SIZE_PX) / 2),
      width: JOIN_CONTROL_SIZE_PX,
      zIndex: (position.zIndex ?? ZIndex.LAYER_1) + 1,
    }}
    target="_blank"
    onMouseDown={(e) => {
      // Mouse path (AC-3 layer 2). PointerCaptureBoundary never touches
      // mousedown, so without this the event bubbles to the card root's
      // onEventMouseDown / the grid's create-draft handler and opens the panel.
      e.stopPropagation();
    }}
  >
    <VideoCameraIcon
      aria-hidden="true"
      className={getInteractiveIconClassName()}
      size={12}
      weight="bold"
    />
  </a>
);
```

Element / role choices, and why each:

| Choice | Reason |
|---|---|
| `<a href target="_blank" rel="noopener noreferrer">` | FR-1/AC-2. Exactly the existing repo idiom (`UpNextCard.tsx:87-97`). `noopener` severs `window.opener`; `noreferrer` stops the join URL leaking as a `Referer` (§7 of requirements). Keyboard-activatable for free — no `onKeyDown` needed. |
| Implicit role `link` (no `role=` attribute) | NFR-2: tests read the accessibility tree. A native anchor with an `href` maps to `link` without an explicit attribute, so there is no raw `role` attribute for a test to cheat against. |
| `aria-label` on the anchor, `aria-hidden` on the SVG | FR-4/OQ-4. The glyph carries no text, so the name must be authored. `aria-hidden` on the child keeps any future phosphor `<title>` out of the name computation. axe `link-name` is satisfied by the label. |
| Data attribute on the **anchor**, not the SVG | FR-3. The real pointer target is the child `<svg>`/`<path>`; `closest()` from there must find the attribute. |
| No `onClick` handler | Nothing to stop: the grid's create-draft paths are `mousedown`-driven and already stopped above; adding a click handler only risks interfering with native activation. |
| No `preventDefault()` anywhere | `preventDefault()` on `mousedown` suppresses focus; the control must stay focusable. |

### 2.4 Styling — conventions and non-collision

- `getInteractiveIconClassName()` (`components/Icons/icon.utils.ts:3-6`) supplies the `c-icon`
  utility (`index.css:403-405`, `transition-[filter] hover:brightness-[1.3]`) — §4.6 of the
  requirements. We call it directly rather than adding a `components/Icons/VideoCamera.tsx`
  wrapper, because that path is not on the allowlist.
- `c-focus-ring` (`index.css:260-262`) is the repo's focus treatment and the same class the
  `UpNextCard` join anchor uses.
- Colour: `darken(baseColor, 30)`, identical to `EventRepeatIcon`, so the two glyphs read as one
  family. axe's `color-contrast` rule only evaluates text nodes; the anchor has none, so this
  cannot introduce a contrast violation.
- **Placement is right-edge, vertically centred — never bottom-right.** `EventRepeatIcon` hardcodes
  `absolute right-1 bottom-0.5` inside a file that is *not* on the allowlist, so the join control
  must move out of its way rather than the reverse. When the repeat glyph is showing, callers pass
  `rightInsetPx = JOIN_CONTROL_REPEAT_CLEARANCE_PX` (16), putting the join box at
  `x ∈ [w-40, w-16]` and the repeat glyph at `x ∈ [w-14, w-4]` — a 2px gap, no overlap, at any card
  height. NFR-6 satisfied.
- `Math.max(0, …)` on `top` means a card shorter than 20px (the all-day chip is exactly
  `EVENT_ALLDAY_HEIGHT = 20`) pins the control to the card's top edge instead of floating above it.
- Size: **24×24** hit box around a 12px glyph. 12px matches the app's existing join glyph
  (`UpNextCard.tsx:94`). 24px is forced by axe's `target-size` rule (WCAG 2.5.8), which **does**
  run under `expectNoAxeViolations` — see the rewritten R-4. Empirically: on a timed card a 24px
  control passes and a 20px control fails.
- **The 24px control overflows the 20px all-day chip by 4px** (`top: Math.max(0, (20-24)/2)` → 0,
  so it spans y ∈ [0, 24] against a chip of y ∈ [0, 20]). Accepted: it is absolutely positioned in
  the events layer, the 4px lands in `EVENT_ALLDAY_GAP`, and shrinking it back to 20px is not
  available — that is what fails `target-size`. This overflow is cosmetic; the all-day
  `target-size` finding it cannot fix is recorded as a product bug, see §6 OQ-1 and R-4.

---

## 3. The nested-interactive resolution (AC-5) — **the join control is a sibling of the card, not a child**

### 3.1 The decision

`TimedEventCard` and `AllDayEventCard` each change from returning a single `<div role="button">` to
returning a fragment:

```tsx
return (
  <>
    <div /* …the existing card root, byte-for-byte unchanged… */>…</div>
    {showJoinIcon && joinHref && (
      <EventJoinIcon … />
    )}
  </>
);
```

The anchor is absolutely positioned into the *same* coordinate space as the card (it is rendered in
the identical DOM position, one node later, and derives its geometry from the same `position`
prop), so it always lands exactly over the card's right edge — in the Week timed layer, the Week
all-day layer, the Day view, and the draft overlay alike. All four consumers
(`GridEvent.tsx:134`, `AllDayEvent.tsx:64`, `DayCalendarEventCards.tsx:93/180`, `GridDraft.tsx`)
render the card as their own returned element inside a `position: relative` events layer, so the
containing block is shared by construction.

### 3.2 Why this is the only resolution that survives the axe scan

axe-core's `nested-interactive` rule matches on **role**: any element whose role declares
presentational children (`button` does) is checked by `no-focusable-content`, which fails if *any*
DOM descendant is focusable. Two consequences that rule out the obvious alternatives:

- The rule matches on `role="button"` regardless of whether the container itself is focusable, so
  dropping `tabIndex={0}` from the card root would not help.
- The check is about focusability, not role, so giving the inner control a non-widget role, or
  `role="presentation"` plus a keydown handler, does not help either: anything keyboard-reachable
  inside the card fails. And a control that is *not* keyboard reachable fails AC-5 by definition.

Therefore: a keyboard-reachable join control **cannot** be a DOM descendant of the card root.
Moving it out is not a workaround, it is the only shape that satisfies AC-5 and the axe guard
simultaneously.

### 3.3 Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| **Remove `role="button"` / `tabIndex` from the card roots** | Fixes axe, catastrophic blast radius. `e2e/utils/event-test-utils.ts` resolves every event by `getByRole("button", { name })` (`expectTimedEventVisible:341`, `expectAllDayEventVisible:347`, `expectTimedEventMissing:353`, `openEventForEditingWithMouse:326`), and `EventCard.test.tsx` uses it in 12 places, as does `calendarCardIdentity.test.tsx`. Most of those files are not on the allowlist, so the change is unshippable as well as wrong. |
| **Accept the nesting with a documented justification** | Not available. `nested-interactive` carries `wcag2a`, which is inside `expectNoAxeViolations`'s tag set, and the helper is read-only (NFR-7) with no rule-disable option. The two new specs would fail. (A prior arm, `af2eadd0`, recorded this as a "known deviation" — it had no e2e scan to hold it.) |
| **Non-focusable in-card glyph + a card-level keyboard shortcut** | Fails AC-5's "keyboard reachable" and re-creates the exact class of bug the `-t2` arm shipped (works one way, dead the other). |
| **React portal to `document.body`** | Also escapes the `role="button"` subtree, but breaks scroll/measurement coupling: the grid scrolls inside `#weekGridScroller`, so a body-portaled anchor would need per-frame repositioning. The sibling shares the card's containing block and needs none. |
| **Wrapper div around the card (card becomes `absolute inset-0`)** | Would move the ref/registry target or force `inset-0` sizing into `createDraftEventClone`, whose floating mount sets its own rect. Higher risk than the fragment for no benefit. |

### 3.4 Blast radius of the fragment, and why AC-4 holds

The containment property that makes this safe: **when the event has no valid conference URL the
second fragment child is `null`, so the rendered DOM is byte-identical to today.** No existing test
in the repo has a conference-bearing card (`grep -rn "conference" e2e/` is empty; `EventCard.test.tsx`
and `calendarCardIdentity.test.tsx` fixtures carry none), so no existing test can regress.

Everything else about the card root is untouched:

- The `ref` still lands on the card root, so `weekEventRegistry` / `dayEventRegistry` registration,
  `engine.rebindPreparedSource`, and `readElementRect` are unchanged.
- `interactionAttributes` still live only on the card root, so `resolveFromTarget`'s
  `closest([data-*-interaction-event-id][…-type])` is unchanged.
- `createDraftEventClone(source)` clones the ref'd card root; the anchor is not a descendant, so it
  is **never cloned into the drag ghost** (this is OQ-2, resolved structurally — see §6).
- No new prop is added to either card, so the `memo` comparators at `GridEvent.tsx:154-167` and
  `AllDayEvent.tsx:81-92` (neither on the allowlist) stay correct.

Three behavioural edges this creates, all accepted and documented:

1. **Hover.** Pointing at the join control no longer triggers the card's `hover:bg-(--event-hover-bg)`,
   because the anchor is not a descendant. Reads as a distinct affordance; acceptable.
2. **Right-click on the 20×20 control** does not open the card's context menu, because
   `readCalendarEventIdFromElement` walks `closest()` and finds no card ancestor. Deliberately not
   fixed by stamping the interaction id onto the anchor — that would put a duplicate
   `data-*-interaction-event-id` in the DOM and put `document.querySelector(calendarEventIdValueSelector(id))`
   (`week-interaction.adapter.ts:148`) one ambiguity away from resolving the wrong node.
3. **Stacking.** The anchor takes `zIndex = (position.zIndex ?? LAYER_1) + 1`. A deck card stacked
   above its neighbour still paints over that neighbour's join control (equal z, later in DOM
   order), which is the desired behaviour.

### 3.5 Why the axe scan will pass

After the change the anchor's ancestor chain is: events layer → `#allDayRow` / `#timedEvents` →
`#mainGrid`. None of those carries a `childrenPresentational` role, so `nested-interactive` does not
match. `link-name` is satisfied by `aria-label`. `color-contrast` does not apply (no text node).
The two specs scan `#mainGrid` / `#allDayRow`, which contain both the card and the anchor — so the
scan is genuinely capable of failing if a future change nests the control again. That is the point.

---

## 4. Interaction-layer design (AC-3 layer 1 — the pointer path)

### 4.1 `packages/web/src/grid/interaction/dom.ts` (FR-7)

Add next to `EVENT_RESIZE_HANDLE_ATTRIBUTE` (`:22-23`), in the existing alphabetical block:

```ts
export const EVENT_JOIN_CONTROL_ATTRIBUTE = "data-calendar-event-join-control";
export const EVENT_JOIN_CONTROL_SELECTOR = `[${EVENT_JOIN_CONTROL_ATTRIBUTE}='true']`;
```

and the predicate, shaped exactly like `getResizeHandleEdge` (`:29-39`) and placed immediately
after it:

```ts
/**
 * True when a pointerdown landed inside the join control. The adapters use it
 * to disown the pointer: PointerCaptureBoundary captures pointerdown on an
 * ancestor of the cards and preventDefault()s it on ownership, so a nested
 * control can never defend itself — the only way to keep the event alive is
 * for getInteractionTarget to return null over it. Mirrors getResizeHandleEdge.
 */
export const isJoinControlTarget = (
  event: Pick<PointerEvent, "target">,
): boolean => {
  const pointerTarget = event.target instanceof Element ? event.target : null;

  return Boolean(pointerTarget?.closest(EVENT_JOIN_CONTROL_SELECTOR));
};
```

`DRAFT_CLONE_STRIPPED_ATTRIBUTES` (`:15-18`) is **not** modified — see §6 OQ-2.

### 4.2 Adapter insertion points (FR-8, FR-9)

Identical edit in both files, as the **first statement** of `getInteractionTarget`, ahead of every
other resolution:

`packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` — at `:483`:

```ts
  function getInteractionTarget(
    event: PointerEvent,
  ): WeekInteractionTarget | null {
    // Join control: hand the pointer back so the anchor's own click survives.
    // Bails before every branch below, exactly as each branch bails on
    // getResizeHandleEdge.
    if (isJoinControlTarget(event)) {
      return null;
    }

    const allDayResizeTarget = getAllDayResizeTarget(event);
    // …unchanged from here…
```

`packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` — at `:434`, the same
three lines ahead of `const allDayResizeTarget = getAllDayResizeTarget(event);`.

Import edits (both files already import from `@web/grid/interaction/dom`; add one specifier, keeping
Biome's alphabetical ordering of named imports):

- week `:7-12` → `{ createDraftEventMount, getResizeHandleEdge, hideDraftEventTimeLabel, isJoinControlTarget, updateDraftEventTimeLabel }`
- day `:10-14` → `{ createDraftEventMount, getResizeHandleEdge, isJoinControlTarget, updateDraftEventTimeLabel }`

### 4.3 How it composes with `getResizeHandleEdge`, and what actually protects the click

Both adapters resolve in a fixed order (all-day resize → timed resize → timed drag → all-day drag)
and each branch already bails on `getResizeHandleEdge`. The join bail sits **above** all four, so
it short-circuits every branch with one check instead of four. `handlePointerDown` then returns
`{ reason: "no-week-interaction-target", shouldOwn: false }` (`week:167-174`, `day:125`), the
boundary skips `consumeOwnedPointerEvent`, and the browser goes on to fire `mousedown` → `click`
on the anchor.

Honest note on layering: because the anchor is now a *sibling* of the card, `resolveFromTarget`'s
`closest()` already returns `null` over it, so `getInteractionTarget` would return `null` even
without the new guard. The guard is kept anyway and is not decorative:

- FR-7/FR-8/FR-9 require it, and AC-3 layer 1 is defined in terms of it.
- It makes the guarantee **structural rather than incidental**. Any future change that nests the
  control, wraps cards in a registered container, or introduces a third grid view keeps working.
- It is provably inert for every existing interaction: no element in the repo carries
  `data-calendar-event-join-control` today, so `isJoinControlTarget` returns `false` for every
  pointerdown that exists at HEAD. That is what bounds the risk of touching two shared adapters.

**Coverage gap to record:** no adapter test file is on the allowlist, so FR-8/FR-9 have no unit
test. Layer 1's acceptance signal is the two e2e specs plus the AC-8 human browser check, exactly
as requirements §4.3 anticipated. This is a stated limitation, not a request for a twelfth path.

---

## 5. Card integration

### 5.1 `TimedEventCard.tsx`

New module constants beside `REPEAT_ICON_MIN_WIDTH` (`:58`):

```ts
// The join control is an interactive 24px box, not a 10px decoration, so it
// needs more room than the repeat glyph: 40px would leave 16px of title.
const JOIN_ICON_MIN_WIDTH = 60;
// Duration, not rendered height — same reason as the repeat icon above: a true
// 15-minute event and one resized down to 15 minutes lay out through different
// height paths and would disagree at a pixel threshold.
const JOIN_ICON_MIN_DURATION_MINUTES = 30;
```

Derived state, after `showRepeatIcon` (`:116-120`):

```ts
const joinHref = resolveJoinHref(event.conference?.url);
const showJoinIcon =
  joinHref !== null &&
  !isPlaceholder &&
  motionMode === "idle" &&
  durationMinutes >= JOIN_ICON_MIN_DURATION_MINUTES &&
  position.width >= JOIN_ICON_MIN_WIDTH;
```

The card resolves the href itself (rather than gating on `event.conference?.url` alone) so a
rejected scheme also skips the title padding below — the component re-guards internally regardless.

Content wrapper (`:321-325`) — reserve the right column so a wrapping title cannot run under the
control:

```tsx
<div
  className={cn("flex flex-col flex-wrap items-start", {
    // CORRECTED after senior review (B-2). These were pr-5/pr-9, sized for the
    // original 20px control; JOIN_CONTROL_SIZE_PX became 24 for target-size and
    // the timed card's padding was not brought along, leaving the reserve 3px
    // short bare and 1px short alongside the repeat glyph. The control occupies
    // rightInsetPx + 24 from the right edge (26 / 40) and the card root already
    // contributes 3px via pr-0.75, so the reserve must be >= 23 / >= 37.
    "pr-6": showJoinIcon && !showRepeatIcon,   // 24px (+3 root = 27 >= 26)
    "pr-10": showJoinIcon && showRepeatIcon,   // 40px (+3 root = 43 >= 40)
  })}
  style={{ color: contentColor }}
  {...{ [EVENT_CONTENT_ATTRIBUTE]: "true" }}
>
```

Return value (`:270-365`) becomes a fragment; the card `<div>` is unchanged, and after it:

```tsx
{showJoinIcon && joinHref && (
  <EventJoinIcon
    baseColor={bgColor}
    eventTitle={eventTitle}
    position={position}
    rightInsetPx={showRepeatIcon ? JOIN_CONTROL_REPEAT_CLEARANCE_PX : undefined}
    url={joinHref}
  />
)}
```

`eventTitle` (`:246`) already carries the `"Untitled event"` fallback.

### 5.2 `AllDayEventCard.tsx`

```ts
// Matches REPEAT_ICON_MIN_WIDTH; kept as its own constant so the two gates can
// diverge without a silent coupling.
const JOIN_ICON_MIN_WIDTH = 60;

const joinHref = resolveJoinHref(event.conference?.url);
const showJoinIcon =
  joinHref !== null && !isPlaceholder && position.width >= JOIN_ICON_MIN_WIDTH;
```

Title row (`:187-192`) — extend the existing conditional `pr-3.5`:

```tsx
<div
  className={cn("flex min-w-0 items-center", {
    // Reserve room so a long title truncates before the bottom-right icon.
    "pr-3.5": showRepeatIcon && !showJoinIcon,  // 14px — repeat only (today's behaviour)
    "pr-6": showJoinIcon && !showRepeatIcon,    // 24px — join only
    "pr-10": showJoinIcon && showRepeatIcon,    // 40px — join sits left of repeat
  })}
>
```

Return value becomes a fragment; after the card `<div>`:

```tsx
{showJoinIcon && joinHref && (
  <EventJoinIcon
    baseColor={bgColor}
    eventTitle={event.title || "Untitled event"}
    position={position}
    rightInsetPx={showRepeatIcon ? JOIN_CONTROL_REPEAT_CLEARANCE_PX : undefined}
    url={joinHref}
  />
)}
```

**Asymmetry, stated deliberately:** the timed card suppresses the control while
`motionMode !== "idle"`; the all-day card cannot, because it has no motion prop and adding one
would force edits to `AllDayEvent.tsx:81-92` and `DayCalendarEventCards.tsx` — neither on the
allowlist. Consequence: during an all-day drag the live draft bar keeps its join control. It is not
clickable mid-drag (the pointer is captured), the floating ghost never contains a duplicate anchor
(§3.4), and the source card is a placeholder so there is no duplicate accessible name. Accepted.

### 5.3 Mouse path recap (AC-3 layer 2)

`stopPropagation()` on the anchor's `onMouseDown` is what keeps the detail panel closed. It works
whether the anchor is inside or outside the card, because it stops the event at the anchor before
it can reach *any* ancestor — the card root's `onMouseDown` → `onEventMouseDown`
(`TimedEventCard.tsx:303-310`, `AllDayEventCard.tsx:171-176`), the all-day row's create handler
(`AllDayGridRow.tsx:74` → `useAllDayDraftCreation`), and the timed grid's create handler.

---

## 6. OQ resolutions

### OQ-1 — which card states get the icon? **Amended.**

| State | Decision | Reasoning |
|---|---|---|
| `displayMode="placeholder"` / `isPlaceholder` | **suppress** | 0.5 opacity, non-interactive by design, and it is the dimmed *source* of an in-flight drag. A live link on it is wrong, and suppressing it is what keeps the a11y tree free of a duplicate `Join <title>` during a drag. |
| `displayMode="draft"` | **render** | An edit-draft of a conference-bearing event should not make the affordance flicker away while the form is open. Drafts are already treated as real cards for the repeat icon (`EventCard.test.tsx:310-327`). |
| `motionMode="dragging" \| "resizing"` (timed) | **suppress** | A focusable anchor tracking a live gesture is noise. All-day cannot do this — see §5.2. |
| `isDemo` | **render** | The demo seed ships a real Google Meet URL (`demo-data-seed.ts:144-147`) which is `https:` and works. Suppressing it would make the sample event misrepresent the product. |
| narrow / short cards | **width gate 60 on both cards; duration gate 30 min on timed** | Overrides the proposed default of 40/60. |

**Overriding the proposed 40px timed gate, and the tradeoff.** The prompt is right that a width gate
on an *interactive* control is not obviously correct: hiding it makes the feature unreachable rather
than merely undecorated. Weighed both ways:

- *Against the gate:* unreachability. Mitigated — the join affordance is not lost, only this
  shortcut. The card is still keyboard-reachable, Enter opens the detail panel, and
  `EventDetailsSection.tsx:46-58` has its own join anchor. Nothing becomes impossible.
- *For the gate:* a 20px control on a 40px card leaves 20px of title, i.e. the card stops
  communicating *which* meeting it is. A cramped, overlapping control on an unreadable card is
  worse than a clean card plus a two-keystroke path. And a control that overlaps the title is an
  accessibility problem in its own right (obscured content, WCAG 2.4.11-adjacent).
- The gate is also close to theoretical: `EVENT_WIDTH_MINIMUM = 80`, `DECK_MIN_WIDTH = 72`, and
  `DAY_COLUMN_MIN_USABLE_WIDTH = 140`, so a sub-60px card only appears under heavy same-slot
  overlap. Choosing 60 over 40 costs very little reach and buys a legible card.

The 30-minute duration gate follows the reasoning already written at `TimedEventCard.tsx:51-57`:
gate on duration, never rendered pixel height, so the same event does not show the icon on one
render path and hide it on another.

**The gate is `>= 30`, inclusive, and must stay that way (Gate-2 instruction).** The demo seed's
"Morning standup" (`demo-data-seed.ts:132-146`) is timed 9:00–9:30 — exactly 30 minutes — and is
the only conference-bearing event in the seed. Tightening the gate past 30 would stop it rendering
the icon, which would both remove the join control from the existing `app-a11y.spec.ts` scan and
make the timed spec's ambient fixture unreliable. Do not "round up" this constant.

### OQ-2 — the drag-ghost clone. **Overridden: no `dom.ts` clone change at all.**

The proposed default was to add the join attribute to `DRAFT_CLONE_STRIPPED_ATTRIBUTES`. That would
only strip the *attribute*, leaving a focusable, non-functional `<a>` inside the floating ghost —
which is the actual failure mode, and which would also put a second `Join <title>` into the
accessibility tree mid-drag, in view of the e2e axe scan.

Because the control is a sibling of the card root and `createDraftEventClone(source)` clones the
ref'd card root (`dom.ts:79`), **the anchor is structurally absent from the clone**. Nothing to
strip, nothing to remove, no duplicate name, no dead focus stop. `DRAFT_CLONE_STRIPPED_ATTRIBUTES`
stays exactly as it is. This is a second, independent reason the sibling shape is the right one.

### OQ-4 — accessible name content. **Accepted as proposed: include the title.**

Name is `Join ${title}`, e.g. `Join Planning block`; `Join Untitled event` when the title is empty.

- FR-4 requires the name to identify *which* event is being joined. On a week grid there are
  routinely a dozen cards on screen; a bare "Join" produces a dozen identically-named links, which
  is a genuine screen-reader failure, not a theoretical one.
- Exposure: meeting titles are medium-sensitivity (§7 of requirements — client and candidate
  names), but the card's own `aria-label` already announces the same title to the same user in the
  same view (`TimedEventCard.tsx:265-268`, `AllDayEventCard.tsx:138-141`). **No net new exposure.**
- The conference *label* (e.g. "Google Meet") is deliberately excluded: it lengthens every name
  without disambiguating anything.
- The URL never enters the accessible name, is never logged, and is never sent anywhere —
  `rel="noopener noreferrer"` keeps it out of the `Referer` header at the join target.

---

## 7. e2e design

### 7.1 The helper — `e2e/utils/event-test-utils.ts` (**additive only**)

Every existing export is untouched; this module is imported by every spec in the repo. Two new
symbols appended at the end of the file:

```ts
export interface SeededLocalEvent {
  /** Omit for the conference-free control event the AC-4 assertions use. */
  conferenceUrl?: string;
  conferenceLabel?: string | null;
  /** "YYYY-MM-DD" (end EXCLUSIVE) for allDay; ISO datetime with offset for timed. */
  end: string;
  kind: "allDay" | "timed";
  start: string;
  title: string;
}

/**
 * Writes one event straight into the `compass-local` IndexedDB `events` store.
 *
 * Necessary because conference is read-only provider-sourced data: the event
 * form has no input that can set one (EventDetailsSection only renders it), so
 * an event created through the UI can never show the join control. Every e2e
 * spec runs signed out against local IndexedDB, so this is the only route.
 *
 * MUST be called after prepareCalendarPage(): that helper DELETES the database
 * and reloads, which is what recreates the store at schema v5. Caller reloads
 * afterwards so the app re-reads.
 *
 * Returns the generated event id.
 */
export const seedEventWithConference = async (
  page: Page,
  seed: SeededLocalEvent,
): Promise<string> => { /* … */ };
```

Implementation contract for codegen:

1. **Ids are generated Node-side** and passed into `page.evaluate`, so nothing inside the page has
   to know the repo's id utilities:
   `const objectIdHex = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");`
   That is a 24-lowercase-hex string, which satisfies `ObjectIdStringSchema` (`/^[0-9a-f]{24}$/i`)
   for `calendarId` and trivially satisfies `EventIdSchema` (non-empty string ≤ 256).
2. Generate both `id` and a `calendarIdFallback` and pass `{ dbName: "compass-local", id,
   calendarIdFallback, seed }` into a single `page.evaluate`.
3. Inside the page:
   - `const CALENDAR_KEY = "compass.localCalendarId";` — read it with `localStorage.getItem`
     (`persistentBrowserStore` stores raw strings, **not** JSON, see
     `browser-key-value.store.ts:31-36`). If absent, write `calendarIdFallback` with
     `localStorage.setItem` so the app's `getLocalCalendarSentinelId()` resolves to the same id.
   - `indexedDB.open(dbName)` with **no version argument** so no upgrade transaction is triggered.
   - If `!db.objectStoreNames.contains("events")`, `throw new Error("seedEventWithConference ran
     before the app created compass-local — call prepareCalendarPage(page) first")`. A silent
     no-op here would surface later as an inexplicable "event never rendered".
   - `store.put(record)` in a `readwrite` transaction (`put`, not `add`, so a re-seed is
     idempotent), resolve on `transaction.oncomplete`, reject on `onerror`/`onabort`, then
     `db.close()`.
4. The record (must satisfy `LocalEventRecordSchema` → `EventSchema`, both `z.strictObject`, so no
   extra keys):

```js
{
  version: 2,
  id,
  isDemo: false,
  event: {
    id,                                   // refine: must equal the top-level id
    calendarId,
    content: {
      kind: "details",
      title: seed.title,
      description: "",                    // required, not optional
      ...(seed.conferenceUrl
        ? { conference: { url: seed.conferenceUrl, label: seed.conferenceLabel ?? "Compass Meet" } }
        : {}),                            // omit entirely for the control event
    },
    schedule:
      seed.kind === "timed"
        ? { kind: "timed", start: seed.start, end: seed.end, timeZone: "UTC" }
        : { kind: "allDay", start: seed.start, end: seed.end },
    recurrence: { kind: "single" },
    createdAt: new Date().toISOString(),  // z.iso.datetime({ offset: true }) accepts "…Z"
    updatedAt: null,                      // nullable, but required
  },
}
```

Notes that will otherwise be rediscovered the hard way:
`icalUid`/`location`/`organizer`/`attendees`/`color`/`colorHex` must be **omitted**, not set to
`undefined`, because IndexedDB stores the `undefined` key and `strictObject` is unforgiving.
`timeZone: "UTC"` (not `"Etc/UTC"`) — `TimezoneSchema` validates via `new Intl.DateTimeFormat`, and
`"UTC"` is universally accepted. Timed `end >= start`; all-day `end > start` and **exclusive**.

### 7.2 Ordering, and why a reload is required

```ts
await prepareCalendarPage(page);                    // goto → clear auth → DELETE db → reload → week view
const conferenceUrl = new URL("/e2e-join-target", page.url()).toString();
await seedEventWithConference(page, joinSeed);      // store exists now
await seedEventWithConference(page, controlSeed);
await page.reload({ waitUntil: "domcontentloaded" });
await expectTimedEventVisible(page, joinTitle);     // re-waits on #mainGrid
```

`resetLocalEventDb` **deletes** the database, so seeding before `prepareCalendarPage` is thrown
away and seeding between the delete and the app's re-open races the app. Seeding after, then
reloading, is the only correct order. A raw IndexedDB write does not invalidate any TanStack Query
cache, so the reload is what makes the app re-read.

Dates are built in the test process as `new Date().toISOString().slice(0, 10)` — the browser runs
at `Etc/UTC` (`e2e/compass.playwright.yaml`) and `toISOString()` is UTC, so the two agree. Seed
timed events at `T10:00`/`T13:00` on today's UTC date and call `scrollIntoViewIfNeeded()` before
asserting, since the timed grid shows only `TIMED_VISIBLE_HOURS = 13` at a time.

The conference URL is same-origin (`http://localhost:9150/e2e-join-target`, derived from
`page.url()` so it tracks `TEST_PORT`). It must never be an external host: CI has no outbound
network guarantee, and the assertion is about *which URL was opened*, not what it serves.

### 7.3 Spec structure — two `test()` blocks per file

**Locators must tolerate the demo events.** `prepareCalendarPage` empties the store, which triggers
the demo seed (`demo-data-seed.ts:292`), so every spec starts with demo cards on the grid —
including "Morning standup", which carries a conference and therefore renders its own join control.
Consequences for codegen: never assert a bare `getByRole("link")` count over the whole grid, and
never use `toHaveCount(0)` / `queryByRole` without a `name` filter. Every locator must be name-scoped
to this spec's own generated titles (`createEventTitle` already suffixes a timestamp + random
token, so seeded titles are unique and cannot collide with demo titles).

Both files follow the same shape. **The conference-bearing card is never dragged or resized**: the
known local-mode bug destroys `conference` on any move/resize/edit, the icon would correctly
vanish, and the spec would misreport a pre-existing bug as a failure of this feature. All AC-4
assertions run against a second, conference-free event.

`e2e/timed/event-join.spec.ts`

- **test 1 — "joins a timed conference event without opening the detail panel"**
  1. seed three timed events: `joinTitle` (`https`-equivalent same-origin URL), `blockedTitle`
     (`conferenceUrl: "javascript:alert(1)"`), `controlTitle` (no conference); reload.
  2. `const joinLink = page.locator("#mainGrid").getByRole("link", { name: \`Join ${joinTitle}\` });`
     → `toBeVisible()`, `toHaveAttribute("target", "_blank")`,
     `toHaveAttribute("rel", "noopener noreferrer")`, `toHaveAttribute("href", conferenceUrl)`.  (AC-1, AC-2)
  3. `expect(page.locator("#mainGrid").getByRole("link", { name: \`Join ${blockedTitle}\` })).toHaveCount(0)`  (AC-9)
  4. `expect(page.locator("#mainGrid").getByRole("link", { name: \`Join ${controlTitle}\` })).toHaveCount(0)`  (AC-1 negative)
  5. `await expectNoAxeViolations(page, { include: "#mainGrid", checkpoint: "timed grid with join control" });`  (AC-5)
  6. click it and prove both halves of AC-3:
     ```ts
     const [joined] = await Promise.all([
       page.context().waitForEvent("page"),   // NOT page.on("popup"): rel=noopener severs the
       joinLink.click(),                      // opener, so the popup event may never fire
     ]);
     await joined.waitForURL(conferenceUrl);
     await joined.close();
     await expect(page.getByRole("form").getByPlaceholder("Title")).toBeHidden();
     ```
- **test 2 — "leaves click, drag-to-move and resize working on a conference-free timed event"**
  1. seed `controlTitle` only; reload.  (AC-4)
  2. card-body click → `openEventForEditingWithMouse(page, controlTitle)` → title input holds the
     title → `page.keyboard.press("Escape")` to close.
  3. drag: `card.scrollIntoViewIfNeeded()`, `boundingBox()`, `mouse.move(cx, cy)` → `mouse.down()`
     → three `mouse.move(..., { steps: 5 })` steps downward by ~1 hour → `mouse.up()`. Assert with
     `expect.poll(() => getSavedEventsByTitle(page, controlTitle))` that `startDate` changed.
  4. resize: grab the bottom edge (`box.y + box.height - 2`), same multi-step drag downward, poll
     that `endDate` changed and `startDate` did not.

`e2e/allday/event-join.spec.ts` — same two tests, with:
- `kind: "allDay"`, start = today (UTC), end = tomorrow (exclusive); the control event on the next
  day so a horizontal drag has somewhere to land.
- locators scoped to `page.locator("#allDayRow")`; `expectAllDayEventVisible` for the wait.
- **NO `expectNoAxeViolations` call — Gate-2 decision (B).** A 24px control overlapping a 20px-tall
  all-day chip cuts the chip's own `target-size` safe space to ~2px, and no on-card size avoids it
  (16/20/24 all fail; only placing the control outside the chip passes). The scan cannot be kept
  and narrowed: `include` scopes a *region* and the chip **is** the region, and `knownIncomplete`
  only covers axe's `incomplete` bucket while `target-size` returns a hard violation. Editing
  `e2e/utils/axe-assertion.ts` is prohibited (NFR-7). So the scan is dropped here and **kept in the
  timed spec**, which still guards `nested-interactive` for the shared `EventJoinIcon` component.
  **What this forfeits is narrower than it looks:** the demo seed carries exactly one conference
  (`demo-data-seed.ts:144`, on the *timed* standup); its only all-day event (`:212`) has none, so
  the all-day `target-size` violation is unreachable from demo data and materialises only in this
  spec's own deliberately-seeded fixture. The underlying product bug is still real — see R-4b.
- **drag-to-move only, no resize.** The all-day resize handle is 4.5px wide on the left/right edge
  of a 20px chip; driving it with `page.mouse` is the flakiest target in the app. All-day resize
  stays covered by `EventCard.test.tsx`'s existing handle tests and the AC-8 human browser check,
  and that is recorded rather than quietly dropped.

Splitting join assertions and drag assertions into separate `test()` blocks is deliberate: the repo
has **no existing e2e spec that drives a drag**, so the drag path is unproven. Isolating it means a
flaky drag cannot mask a genuine join regression.

---

## 8. Test plan

### 8.1 `packages/web/src/grid/components/EventJoinIcon.test.tsx` (new, `bun:test`)

Imports mirror `EventCard.test.tsx:1-18` exactly: `@testing-library/react`, `bun:test`
(`describe/it/expect/mock`), then `import "@testing-library/jest-dom";`. **No axe** (§2.7 of
requirements). All presence/absence assertions go through the accessibility tree.

| # | Case | Assertion |
|---|---|---|
| 1 | renders a named link | `screen.getByRole("link", { name: "Join Planning block" })` |
| 2 | opens in a new tab, opener severed | `toHaveAttribute("target","_blank")`, `toHaveAttribute("rel","noopener noreferrer")`, `toHaveAttribute("href", url)` |
| 3 | untitled fallback | name is `"Join Untitled event"` when `eventTitle` is `""` |
| 4 | attribute reachable from the real pointer target | `link.querySelector("svg")!.closest(\`[${EVENT_JOIN_CONTROL_ATTRIBUTE}]\`)` `toBe(link)` |
| 5 | rejects `javascript:` | `screen.queryByRole("link")` is `null` |
| 6 | rejects `data:` and `vbscript:` | as above |
| 7 | rejects unparseable / relative / empty (`"not a url"`, `"/relative"`, `""`) | as above |
| 8 | accepts an uppercase scheme (`HTTPS://…`) | link rendered |
| 9 | mousedown does not reach a parent handler | render inside `<div onMouseDown={parentSpy}>` (with the same `biome-ignore lint/a11y/noStaticElementInteractions` comment style as `EventCard.test.tsx:228`); `fireEvent.mouseDown(link)`; `expect(parentSpy).not.toHaveBeenCalled()` |
| 10 | geometry | with `position={{ left: 10, top: 20, width: 140, height: 60 }}` and `rightInsetPx: 16`: `link.style.left === "110px"` (10+140−16−24), `link.style.top === "38px"` (20+(60−24)/2), `width/height === "24px"` |

Do **not** `fireEvent.click` the anchor: a real `href` triggers a "navigation not implemented"
console error in the DOM shim. Case 9 covers the propagation contract with `mouseDown`, which is
the event that actually matters (Path B).

### 8.2 `packages/web/src/grid/components/EventCard.test.tsx` (edit — append inside the existing `describe("EventCard")`)

`createEvent` already spreads `Partial<GridEvent>`, so `createEvent({ conference: { url, label } })`
works with no factory change.

| # | Card | Case | Assertion |
|---|---|---|---|
| 1 | timed | renders the join control when a conference exists | `getByRole("link", { name: "Join Planning block" })`, and `getByRole("button", { name: /Planning block/ })` still resolves the card |
| 2 | timed | absent without a conference | `queryByRole("link")` is `null` |
| 3 | timed | absent on `displayMode="placeholder"` | `queryByRole("link")` is `null` |
| 4 | timed | absent while `motionMode="dragging"` | `queryByRole("link")` is `null` |
| 5 | timed | absent below the width gate (`width: 30`) | `queryByRole("link")` is `null` |
| 6 | timed | absent on a 15-minute event (duration gate) | `queryByRole("link")` is `null` |
| 7 | timed | present on `displayMode="draft"` | link rendered |
| 8 | timed | `javascript:` conference URL renders nothing | `queryByRole("link")` is `null` |
| 9 | timed | repeat icon still bottom-right alongside the join control | existing `container.querySelector('svg[class*="right-1"]')` still non-null with both showing |
| 10 | all-day | present with / absent without a conference | as rows 1–2, name `"Join Conference"` |
| 11 | all-day | absent when `isPlaceholder` | `queryByRole("link")` is `null` |
| 12 | all-day | absent below the width gate (`width: 30`) | `queryByRole("link")` is `null` |
| 13 | all-day | title row reserves `pr-10` when both glyphs show | class assertion on the title row (layout, not a11y) |

**Prohibited, and codegen must not do it:** asserting a raw `role=` DOM attribute via
`getAttribute("role")` or a `[role="link"]` / `[role="button"]` CSS selector. A prior arm on this
repo shipped exactly that and the tests could not fail. Every presence/absence assertion above is
`getByRole` / `queryByRole` against the accessibility tree.

Existing cases that must keep passing unchanged: the repeat-icon locator
`container.querySelector('svg[class*="right-1"]')` still matches only the repeat glyph, because the
join anchor positions itself with inline `left`/`top` styles and its SVG's only class is `c-icon`.

### 8.3 AC → test mapping

| AC | Discharged by |
|---|---|
| **AC-1** renders iff a conference URL is present | `EventCard.test.tsx` 1–2, 10; `e2e/*/event-join.spec.ts` test 1 steps 2 & 4 |
| **AC-2** new tab, opener severed, referrer suppressed | `EventJoinIcon.test.tsx` 2; e2e test 1 step 2 |
| **AC-3.1** pointer path (adapters return `null`) | **e2e test 1 step 6 + AC-8 human check only** — no adapter test file is allowlisted (§4.3) |
| **AC-3.2** mouse path (`stopPropagation`) | `EventJoinIcon.test.tsx` 9; e2e test 1 step 6 (`form` stays hidden) |
| **AC-4** no regression: click, drag, resize | full `bun run test:web` delta; `EventCard.test.tsx` 1, 9; e2e test 2 (conference-free event only) |
| **AC-5** keyboard reachable, named, nested-interactive resolved | `EventJoinIcon.test.tsx` 1, 3; `EventCard.test.tsx` 1, 10; `expectNoAxeViolations` in the **timed spec only** (§7.3 step 5) — the all-day spec drops its scan per Gate-2 decision (B), see §7.3. `nested-interactive` is still guarded, because both cards render the same `EventJoinIcon` in the same sibling shape and the timed scan exercises it. |
| **AC-6** no new failures vs 2297 pass / 1 fail | phase-7 suite run, delta only |
| **AC-7** no new deps | `git diff --stat` shows only the 11 allowlisted paths |
| **AC-8** human browser verification | manual gate; backed by both e2e specs |
| **AC-9** `http:`/`https:` only | `EventJoinIcon.test.tsx` 5–8; `EventCard.test.tsx` 8; e2e test 1 step 3 |

---

## 9. File-by-file change list (packet plan)

| # | Path | Kind | Change | Size |
|---|---|---|---|---|
| 1 | `packages/web/src/grid/interaction/dom.ts` | edit | Add `EVENT_JOIN_CONTROL_ATTRIBUTE`, `EVENT_JOIN_CONTROL_SELECTOR` beside `EVENT_RESIZE_HANDLE_ATTRIBUTE`; add `isJoinControlTarget()` after `getResizeHandleEdge`. `DRAFT_CLONE_STRIPPED_ATTRIBUTES` untouched. | ~+18 |
| 2 | `packages/web/src/grid/components/EventJoinIcon.tsx` | new | `resolveJoinHref`, `JOIN_CONTROL_SIZE_PX`, `JOIN_CONTROL_REPEAT_CLEARANCE_PX`, `EventJoinIcon`. Imports `VideoCameraIcon` from `@phosphor-icons/react`, `darken` from `@web/common/styles/color.utils`, `getInteractiveIconClassName` from `@web/components/Icons/icon.utils`, `ZIndex`, `EventPosition`, `EVENT_JOIN_CONTROL_ATTRIBUTE`. | ~80 |
| 3 | `packages/web/src/grid/components/EventJoinIcon.test.tsx` | new | 10 cases per §8.1. | ~150 |
| 4 | `packages/web/src/grid/components/TimedEventCard.tsx` | edit | 2 constants, `joinHref`/`showJoinIcon`, `cn()` on the content wrapper, fragment return + `<EventJoinIcon>`, 1 import line. | ~+22 |
| 5 | `packages/web/src/grid/components/AllDayEventCard.tsx` | edit | 1 constant, `joinHref`/`showJoinIcon`, 2 extra title-row padding branches, fragment return + `<EventJoinIcon>`, 1 import line. | ~+20 |
| 6 | `packages/web/src/grid/components/EventCard.test.tsx` | edit | 13 appended cases per §8.2; no existing case modified. | ~+200 |
| 7 | `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` | edit | 1 import specifier + 3-line bail at the top of `getInteractionTarget` (`:483`). | ~+6 |
| 8 | `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` | edit | Identical edit at `:434`. | ~+6 |
| 9 | `e2e/utils/event-test-utils.ts` | edit — **additive only** | Append `SeededLocalEvent` + `seedEventWithConference`. **No existing export altered, reordered, or re-typed.** | ~+75 |
| 10 | `e2e/timed/event-join.spec.ts` | new | 2 tests per §7.3. | ~120 |
| 11 | `e2e/allday/event-join.spec.ts` | new | 2 tests per §7.3 (drag only, no resize). | ~110 |

**Sequencing.** 1 → 2 → {3, 4, 5} → 6; 1 → {7, 8}; 9 → {10, 11} (10/11 also require 4 and 5).
Packets 7 and 8 are independent of the component work and can run in parallel with it. Packets 10
and 11 must run last.

---

## 10. Risks / blast radius

| # | Risk | Severity | Mitigation / reasoning |
|---|---|---|---|
| **R-1** | `dom.ts` and both adapters are on every grid interaction path | medium → low | The new predicate matches on an attribute that **no element in the repo carries at HEAD**, so `isJoinControlTarget` returns `false` for every pointerdown that exists today. The edit is additive and provably inert for existing behaviour. Nothing in `getResizeHandleEdge`, `createDraftEventMount` or `DRAFT_CLONE_STRIPPED_ATTRIBUTES` changes. |
| **R-2** | Both cards now return a fragment — a DOM-shape change in a component with four consumers | medium → low | The second child is `null` unless the event has a scheme-valid conference URL. **Corrected at Gate 2:** this is true of the *bun* suite (no `EventCard.test.tsx` / `calendarCardIdentity.test.tsx` fixture carries a conference), but it is **false of the e2e layer.** `demo-data-seed.ts:144` seeds "Morning standup" (timed, 9:00–9:30) with `https://meet.google.com/abc-defg-hij`, and the seed migration runs whenever the store is empty (`:292`) — which `prepareCalendarPage` guarantees by deleting the DB. So a conference-bearing card renders a join control in **every e2e test**, including the untouched `app-a11y.spec.ts` week-view scan. That is exactly why 24px is forced (R-4). For the bun suite the byte-identity argument stands unchanged. All four consumers return the card as their own element inside a `position: relative` events layer, so the sibling shares the card's containing block. No new prop, so the two `memo` comparators in non-allowlisted files stay correct. |
| **R-3** | Overlap with `EventRepeatIcon`, whose file is not editable | low | Join is right-edge/vertically-centred with a 16px inset whenever the repeat glyph shows; repeat occupies `x ∈ [w-14, w-4]`, join `x ∈ [w-36, w-16]`. Non-overlapping at any card height, verified by `EventCard.test.tsx` case 9 and the padding assertion in case 13. |
| **R-4** | axe `target-size` (WCAG 2.5.8, `wcag22aa` — inside the helper's tag set) **does** fire | **RESOLVED at Gate 2** | **This entry originally claimed the rule ships disabled and `withTags()` cannot enable it. That was wrong and was corrected at Gate 2.** Source-level cause: in axe-core 4.12.1 `ruleShouldRun`, the `runOnly.type === 'tag'` branch delegates to `matchTags` and never consults `rule.enabled`; `matchTags` only applies its `rule.enabled !== false` guard in the `include.length === 0` branch. So a `wcag22aa`-tagged rule runs despite `enabled: false`. Empirically confirmed against the repo's own playwright+axe stack. **Consequences, both handled:** (1) the control is **24px, not 20px** (§2.1) — at 20px it fails the new timed spec *and* introduces a new failure in the untouched `e2e/accessibility/app-a11y.spec.ts`, which renders the conference-bearing demo event; (2) on a 20px-tall all-day chip **no on-card size passes** — any overlapping target cuts the chip's own safe clickable space to ~2px. Per Gate-2 decision **(B)**, the all-day spec drops its axe scan; the timed spec keeps it. `e2e/utils/axe-assertion.ts` is **not** modified (NFR-7). |
| **R-4b** | The all-day `target-size` finding is a real product bug, not an artifact of this run | informational | **File as its own ticket, independent of this feature:** *a 20px-tall all-day chip cannot host any adjacent or overlapping interactive target without breaching WCAG 2.5.8 (target-size); this is a pre-existing constraint of the all-day row's height, exposed — not caused — by adding a join control.* Note the violation is **introduced, not pre-existing**, in the narrow sense that a bare all-day chip passes `target-size` on its own and only fails once a neighbouring target exists. A user syncing an all-day event that carries a Meet link reaches this in the product. |
| **R-5** | No e2e spec in this repo drives a drag today; the AC-4 drag/resize steps are an unproven path | medium | Isolated into their own `test()` so a flake cannot mask a join regression; multi-step `mouse.move` with `expect.poll` on `getSavedEventsByTitle`; all-day resize deliberately excluded. If the drag proves unstable, it is downgraded to the AC-8 human check and recorded — never "fixed" by dragging the conference card. |
| **R-6** | The seeded record must satisfy two `z.strictObject`s; a shape error makes the event silently absent | medium | Exact record given in §7.1, derived from `EventSchema`/`LocalEventRecordSchema` at HEAD. Optional fields are **omitted**, never `undefined`. The helper throws a named error if the `events` store does not exist. First diagnostic if a card never appears: the browser console's local-repository parse error. |
| **R-7** | Anonymous-mode data loss bug destroys `conference` on any edit | accepted debt | Explicit non-goal. Contained by never dragging/resizing/editing the conference-bearing card in either spec, and by seeding a dedicated conference-free control event for all AC-4 assertions. |
| **R-8** | AC-3 layer 1 (pointer path) has no unit test — no adapter test file is allowlisted | medium | Stated openly. Covered by e2e test 1 step 6 and the mandatory AC-8 human browser check, which is exactly the combination requirements §4.3 prescribes after the `-t2` arm shipped a green suite with a dead mouse click. |
| **R-9** | Cursor/Codex format-on-edit hooks may reformat written files out of band | low | Known from the baseline; byte-identity checks on written files can fail spuriously. Re-read before asserting. |
| **R-10** | Right-click on the join control does not open the card context menu | low | Accepted (§3.4). The control is 20×20; the surrounding card is a much larger right-click target. Not fixed by stamping interaction ids onto the anchor — that would introduce duplicate `data-*-interaction-event-id` nodes. |

---

## 11. Blockers

**None.** The design fits inside the 11 allowlisted paths with room to spare:

- No twelfth path is required. In particular, `EventRepeatIcon.tsx` is *not* edited (the join
  control moves out of its way instead), `DRAFT_CLONE_STRIPPED_ATTRIBUTES` is *not* changed (OQ-2
  is resolved structurally), no `components/Icons/` wrapper is added (`icon.utils.ts` is imported
  read-only), and `e2e/utils/axe-assertion.ts` is imported and never modified.
- No new prop is added to either card, so the memo comparators in `GridEvent.tsx`,
  `AllDayEvent.tsx` and `DayCalendarEventCards.tsx` — none of which are allowlisted — do not need
  to change.
- No `package.json` / `bun.lock` change: `@phosphor-icons/react` is already a dependency (AC-7).

Two limitations are recorded rather than blocking, and should be visible at Gate 3:

1. **FR-8/FR-9 ship without unit tests** because no adapter test file is on the allowlist (R-8).
2. **All-day resize is not asserted in e2e** (R-5); it remains covered by the existing bun handle
   tests and the AC-8 human browser check.
