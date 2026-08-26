# Change Plan — CMP-103 · One-click join icon on grid event cards

- **Run:** `20260825-220640-feature-extend-one-click-join`
- **Intent:** `feature-extend` (Phase 2 form: *delta change plan*)
- **Branch:** `CMP-103/opus-plus-sonnet`
- **Contract:** `.sdlc/runs/20260825-220640-feature-extend-one-click-join/requirements.md` (FR-1…FR-8, NFR-1…NFR-5, AC-1…AC-11, R-1…R-5)
- **Write allowlist (frozen, 4 files):**
  - `packages/web/src/grid/components/EventJoinIcon.tsx` — new
  - `packages/web/src/grid/components/TimedEventCard.tsx` — edit
  - `packages/web/src/grid/components/AllDayEventCard.tsx` — edit
  - `packages/web/src/grid/components/EventCard.test.tsx` — edit

Everything below is implementable inside those four files. No fifth file is required.

---

## 0. Corrections to the inherited "verified facts"

Every anchor handed to this phase was re-read from source this session and **all of them
check out** — line numbers, gates, z-indexes, class strings, and the `EventRepeatIcon`
body. Two additions the inputs did not carry, both of which change the design:

1. **`EventRepeatIcon.tsx` is *not* in the allowlist.** Its `absolute right-1 bottom-0.5`
   slot is therefore immovable. The join affordance has to route around the repeat icon;
   the repeat icon cannot be nudged to make room. Every placement decision below follows
   from this.
2. **There is a second, native, pointer-based interaction layer.**
   `packages/web/src/grid/interaction/dom.ts:29-39` exports
   `getResizeHandleEdge(event: Pick<PointerEvent, "target">)`, which resolves the resize
   edge with `target.closest('[data-calendar-event-resize-handle]')`. That is a native
   `PointerEvent` consumer, not a React prop path — and the cards' `interactionAttributes`
   (`data-week-interaction-event-id` / `-event-type`) exist to be found the same way. So
   the cards are driven by **two** systems: the React props (`onEventMouseDown`,
   `onScalerMouseDown`) that `EventCard.test.tsx` exercises, and a native pointer layer
   that resolves targets by `closest()`.

   This matters enormously for FR-4a. The requirements say to "stopPropagation on mousedown
   the way the resize handles do". That closes the *React* path only. Against the native
   layer, the resize handles are not protected by `stopPropagation` at all — they are
   protected by being *recognised* (`getResizeHandleEdge`). The join link has no such
   recognition hook, and `interaction/dom.ts` is outside the allowlist, so we cannot add
   one. A React `onMouseDown` handler on the link would therefore **not** stop a drag
   started by a native ancestor `pointerdown` listener. See **D-7**.

---

## 1. Summary

A new `EventJoinIcon.tsx` under `grid/components/` owns the entire join affordance — the
anchor, its placement, its accessible name, its URL safety rule, and all of its interaction
isolation — so the two cards cannot drift (FR-1, NFR-2). It exports the component plus a
`joinableConference(conference, isSaved)` selector that both cards call to decide, in one
place, whether a join link is offered. `TimedEventCard` and `AllDayEventCard` each gain one
import, one gate variable, and one render site; `AllDayEventCard` additionally widens its
`pr-3.5` title reservation into an exhaustive four-way (none / repeat / join / both).
Interaction isolation is implemented with **target-phase native listeners bound on the
anchor itself** (`pointerdown`, `mousedown`, `keydown`), which is the only mechanism that
closes both the React prop path and the native grid-interaction path from inside the
allowlist. The link sits at `ZIndex.LAYER_5`, one layer above the resize strips, and steps
inboard from `right-1` to `right-4` when the repeat icon is present.

---

## 2. Component design: `EventJoinIcon.tsx` (new)

```tsx
import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { useEffect, useRef } from "react";
import { type Conference } from "@core/types/event-attendance.contracts";
import { ZIndex } from "@web/common/constants/web.constants";
import { theme } from "@web/common/styles/theme";
import { getInteractiveIconClassName } from "@web/components/Icons/icon.utils";

// ConferenceSchema's z.url() proves the provider string parses as a URL; it
// does not constrain the scheme, so `javascript:...` clears the contract. A
// video entry point is always http(s), so anything else is dropped rather than
// handed to an href sink (NFR-5).
const SAFE_JOIN_PROTOCOLS = new Set(["http:", "https:"]);

// 12px matches the sidebar's join link (UpNextCard.tsx:94) and is the largest
// glyph that still clears the repeat icon's slot on a 20px-tall all-day card.
const JOIN_ICON_SIZE = 12;

// Bound on the anchor itself, not through React. The grid's drag layer reads
// native pointer events and resolves the card with target.closest(...) - see
// getResizeHandleEdge in grid/interaction/dom.ts:29-39. React attaches its own
// handlers at the app root, so a React onPointerDown here would run only after
// an ancestor listener had already started a drag. A listener on the target
// runs in the target phase, ahead of every ancestor bubble listener, and so
// closes the native path and the React prop path with one stop.
const ISOLATED_POINTER_EVENTS = ["pointerdown", "mousedown"] as const;

interface Props {
  /** The card's current fill; the glyph takes the same contrast color as the title. */
  baseColor: string;
  /** Already narrowed by joinableConference - never null here. */
  conference: Conference;
  /**
   * True when the card is also rendering EventRepeatIcon, which owns the
   * bottom-right slot (right-1 = 4px offset + a 10px glyph = 14px). The join
   * link steps inboard to right-4 (16px) so the two never touch.
   */
  hasRepeatIcon: boolean;
  /** Raw event title. The "Untitled event" fallback is applied here so both cards pass it through unchanged. */
  title?: string | null;
}

/**
 * The single gate on whether a card may offer a join link, and the conference
 * to render it from. Both cards call this so the URL rules live in one place
 * and the all-day card's padding reservation can never disagree with what
 * actually renders. Only the "is this card saved?" question is answered
 * per-card, because the timed card has displayMode and the all-day card has
 * nothing but isPlaceholder.
 */
export const joinableConference = (
  conference: Conference | null | undefined,
  isSaved: boolean,
): Conference | null => {
  if (!isSaved || !conference?.url) {
    return null;
  }

  try {
    return SAFE_JOIN_PROTOCOLS.has(new URL(conference.url).protocol)
      ? conference
      : null;
  } catch {
    return null;
  }
};

/**
 * The one-click join affordance shared by the timed and all-day grid cards: a
 * small video-camera glyph pinned to the card's bottom-right that opens the
 * meeting in a new tab. Keeping it in one place stops the two cards from
 * drifting apart - the same rule EventRepeatIcon states - and keeps the three
 * propagation paths it has to close from being copied into two card roots.
 *
 * Unlike EventRepeatIcon this is a real, focusable link, so it cannot use
 * `pointer-events-none` to get out of the resize handles' way. It sits one
 * layer above them (LAYER_5 vs LAYER_4) and accepts the small notch that
 * carves out of the endDate strip at that corner; the strip stays grabbable
 * across the rest of the card's width, and keyboard edge-resize is unaffected.
 *
 * Interaction isolation is bound natively on the anchor (see
 * ISOLATED_POINTER_EVENTS above) so the card root never starts a select or a
 * drag and its keydown handler can neither preventDefault the link's own
 * activation nor open the event form underneath. Nothing here is
 * preventDefault'ed: Enter's native link activation is the entire point, and
 * Space keeps its native scroll rather than being redefined as an activation
 * key an anchor does not have. Only Enter and Space are stopped - swallowing
 * every key would trap the user on the link, because Escape and the arrow keys
 * belong to the grid's shortcut layer. There is deliberately no click handler:
 * neither card has an onClick today (FR-4c), and swallowing clicks would break
 * document-level click-outside listeners.
 */
export const EventJoinIcon = ({
  baseColor,
  conference,
  hasRepeatIcon,
  title,
}: Props) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = linkRef.current;

    if (!node) {
      return;
    }

    const stopPointer = (e: Event) => e.stopPropagation();
    const stopActivationKey = (e: Event) => {
      const { key } = e as KeyboardEvent;

      if (key === "Enter" || key === " ") {
        e.stopPropagation();
      }
    };

    for (const type of ISOLATED_POINTER_EVENTS) {
      node.addEventListener(type, stopPointer);
    }
    node.addEventListener("keydown", stopActivationKey);

    return () => {
      for (const type of ISOLATED_POINTER_EVENTS) {
        node.removeEventListener(type, stopPointer);
      }
      node.removeEventListener("keydown", stopActivationKey);
    };
  }, []);

  const eventTitle = title?.trim() || "Untitled event";
  // conference.label is the provider's conferenceSolution.name ("Google Meet",
  // "Zoom Meeting") - google-event.normalizer.ts:172 - so it reads naturally
  // as the medium, not as a second title.
  const accessibleName = conference.label
    ? `Join ${eventTitle} via ${conference.label}`
    : `Join ${eventTitle}`;

  return (
    <a
      aria-label={accessibleName}
      className={cn(
        "c-focus-ring absolute bottom-0.5 flex h-3 w-3 items-center justify-center",
        hasRepeatIcon ? "right-4" : "right-1",
      )}
      href={conference.url}
      ref={linkRef}
      rel="noopener noreferrer"
      style={{ zIndex: ZIndex.LAYER_5 }}
      target="_blank"
    >
      <VideoCameraIcon
        aria-hidden="true"
        className={getInteractiveIconClassName()}
        color={theme.getContrastText(baseColor)}
        size={JOIN_ICON_SIZE}
        weight="bold"
      />
    </a>
  );
};
```

Two properties of this source that the test plan depends on and a reviewer should check
did not drift:

- **The glyph's own `class` attribute must never contain the substring `right-1`.**
  `getInteractiveIconClassName()` resolves to `"c-icon"`, and the positional classes live
  on the `<a>`, not the `<svg>`. This is what keeps the existing repeat-icon probes
  (`container.querySelector('svg[class*="right-1"]')` at `EventCard.test.tsx:279, 307, 326,
  342, 430`) unambiguous once both icons render.
- **No hover styling.** `theme.getContrastText` returns a near-black or near-white glyph, so
  `hover:brightness-*` is a visual no-op on both, and an `opacity-*` dim would eat into the
  4.5:1 the contrast helper guarantees. Hover feedback comes from the card's existing
  `hover:bg-(--event-hover-bg)` and `hover:cursor-pointer`; keyboard feedback from
  `c-focus-ring`. A dedicated hover token is a follow-up, not an allowlist-safe change here.

---

## 3. Delta: `TimedEventCard.tsx`

Three hunks, +11 lines, no change to any existing handler.

### T1 — import (insert between `:48` and `:49`)

```diff
 import { type EventPosition } from "@web/grid/types/grid.types";
+import { EventJoinIcon, joinableConference } from "./EventJoinIcon";
 import { EventRepeatIcon } from "./EventRepeatIcon";
```

`./EventJoinIcon` sorts before `./EventRepeatIcon`; the existing relative-import block stays
biome-clean.

### T2 — gate variable (insert after `:120`, immediately below `showRepeatIcon`)

```diff
     durationMinutes >= REPEAT_ICON_MIN_DURATION_MINUTES &&
     position.width >= REPEAT_ICON_MIN_WIDTH;
+  // displayMode, not the repeat icon's !isPlaceholder: a timed *draft*
+  // deliberately does show the repeat icon (see the test at
+  // EventCard.test.tsx:310) and must not show a join link. Drafts carry
+  // conference === undefined anyway - editableContent() in
+  // grid-event-draft.adapter.ts:529-534 picks title|description|location|color
+  // only - so this is the second lock, not the only one.
+  const joinConference = joinableConference(
+    event.conference,
+    displayMode === "saved",
+  );
 
   const showTimeLabel =
```

### T3 — render site (replace `:363`, making the link the card's last child)

```diff
-      {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
+      {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
+      {joinConference && (
+        <EventJoinIcon
+          baseColor={bgColor}
+          conference={joinConference}
+          hasRepeatIcon={showRepeatIcon}
+          title={event.title}
+        />
+      )}
     </div>
   );
```

**Not changed, deliberately:** the root `onKeyDown` (`:290-302`), the root `onMouseDown`
(`:303-310`), the resize handles (`:338-359`), the content div's classes, `lineClamp`, and
`titleStyle`. The timed card gains **no** padding reservation — see **D-3**.

---

## 4. Delta: `AllDayEventCard.tsx`

Four hunks, +14 lines net.

### A1 — import (insert between `:29` and `:30`)

```diff
 import { type EventPosition } from "@web/grid/types/grid.types";
+import { EventJoinIcon, joinableConference } from "./EventJoinIcon";
 import { EventRepeatIcon } from "./EventRepeatIcon";
```

### A2 — gate variable (insert after `:77`)

```diff
   const showRepeatIcon =
     isRecurring && !isPlaceholder && position.width >= REPEAT_ICON_MIN_WIDTH;
+  // isPlaceholder is the only draft signal this card has - there is no
+  // displayMode prop - so it is also the saved gate for the join link. The
+  // divergence from TimedEventCard is forced by that structural difference,
+  // not drift (NFR-2).
+  const joinConference = joinableConference(event.conference, !isPlaceholder);
```

### A3 — title reservation (replace `:187-192`)

```diff
       <div
         className={cn("flex min-w-0 items-center", {
-          // Reserve room so a long title truncates before the bottom-right icon.
-          "pr-3.5": showRepeatIcon,
+          // Reserve room so a long title truncates before the bottom-right
+          // icons. Arithmetic: the repeat glyph occupies 4px offset + 10px =
+          // 14px (pr-3.5); the join link alone occupies 4px + 12px = 16px
+          // (pr-4); together the join link steps inboard to right-4, so the
+          // pair occupies 16px + 12px = 28px (pr-7). All four combinations are
+          // enumerated, so the no-conference case is byte-identical to today
+          // (NFR-1).
+          "pr-3.5": showRepeatIcon && !joinConference,
+          "pr-4": !showRepeatIcon && !!joinConference,
+          "pr-7": showRepeatIcon && !!joinConference,
         })}
       >
```

### A4 — render site (insert after the `endDate` handle closes at `:223`, making the link the card's last child)

```diff
         onMouseDown={(e) => {
           e.stopPropagation();
           onScalerMouseDown?.(event, e, "endDate");
         }}
       />
+      {joinConference && (
+        <EventJoinIcon
+          baseColor={bgColor}
+          conference={joinConference}
+          hasRepeatIcon={showRepeatIcon}
+          title={event.title}
+        />
+      )}
     </div>
   );
```

**Not changed, deliberately:** the root `onKeyDown` (`:162-170`), the root `onMouseDown`
(`:171-176`), both resize handles (`:202-223`), the title span (`:193-199`), and
`EventRepeatIcon`'s position at `:201`.

Note the render-site asymmetry between the two files (timed: after the repeat icon, which
is already last; all-day: after the resize handles). The invariant that is actually shared
is **"the join link is the card root's last child"** — so DOM paint order and the explicit
`ZIndex.LAYER_5` agree instead of one propping up the other.

---

## 5. Decision record

### D-1 — Interaction isolation lives in `EventJoinIcon`, not in the card roots (P1 / FR-4b / R-1)

**Context.** Both card roots handle `onKeyDown` as bubbling handlers with no `e.target`
check (`TimedEventCard.tsx:290-302`, `AllDayEventCard.tsx:162-170`). For `Enter`/`Space`
they `preventDefault()`, `stopPropagation()`, then `onEventKeyDown(event)`. A keydown from a
focused inner `<a>` reaches them, which would both cancel the anchor's native activation and
open the event form.

**Decision.** Stop the key at the link. Do **not** add an `e.target !== e.currentTarget`
guard to either card root.

**Rationale.** The target check is the more "fix it once" shape, but it is strictly less
safe here: a card root that ignores a keydown lets it keep bubbling to the week/day
shortcut listeners above it, so `Enter` on a join link would become a grid shortcut. Both
cards have a shipped test asserting exactly that nothing escapes to a parent
(`EventCard.test.tsx:223, 394`), and the target-check variant would quietly break the
premise those tests encode. Stopping at the source closes the card root *and* every
ancestor with one line. It also keeps the two card roots' shared interaction logic
byte-identical (NFR-2, and no risk to the Day view, NFR-3), and it puts all of the
affordance's isolation in the one file FR-1 says owns it.

**Space.** Space is stopped but **not** `preventDefault`ed and **not** translated into an
activation. An anchor is not a button; Space scrolls. Redefining it would diverge from the
three sibling join links already shipped (`UpNextCard`, `EventDetailsSection`,
`UpNextBanner`), all plain anchors, and would have the link swallowing a page-level
behaviour it does not own. What we must not allow is the card's `preventDefault` +
`onEventKeyDown` firing while a link is focused, and stopping propagation is exactly enough
for that. FR-4b asks for Enter *and* Space to be stopped; this satisfies it literally.

**Consequences.** A future inner interactive element in either card must repeat this
isolation; the card roots stay naive. That is recorded in the component docstring and is
worth a hardening follow-up ticket ("add a `target === currentTarget` guard to both card
roots") once there is more than one inner interactive. Arrow keys, `Escape`, and `Tab` are
deliberately *not* stopped, so grid navigation still works while the link is focused —
asserted by test **N11**.

### D-2 — Placement and stacking (P2 / FR-8 / AC-10 / R-2)

**Context.** The resize handles are `ZIndex.LAYER_4` overlays: timed = full-width 4.5px
strips at `top: -0.25px` / `bottom: -0.25px`; all-day = full-height 4.5px strips at
`left: -0.25px` / `right: -0.25px`. `EventRepeatIcon` escapes them only via
`pointer-events-none`; a link cannot. `EventRepeatIcon.tsx` is outside the allowlist, so
its `right-1 bottom-0.5` slot is fixed and the join link must route around it.

**Decision.** The link is `absolute bottom-0.5`, `right-1` normally and `right-4` when the
repeat icon is present, `h-3 w-3` (12px, glyph-sized — no padding bleed), at
`style={{ zIndex: ZIndex.LAYER_5 }}`.

**Rationale.**

*Bottom, not top.* On a tall card the bottom-right corner is empty while the top-right
overlays the first line of the title; on a compact card (`height <= COMPACT_EVENT_MAX_HEIGHT`
= 15px) there is only one line, so top and bottom are equivalent. Bottom is therefore never
worse and usually better. It also puts the join link in the same visual band as the repeat
icon, which is what makes the all-day `pr-*` reservation a single one-dimensional
calculation instead of two.

*Above the strips, not below.* There is no placement that avoids the strips on a compact
timed card: a 15px card has 4.5px of strip top and bottom, leaving a 6px free band that a
12px glyph cannot fit in. Since overlap is unavoidable, the only real question is who wins
the overlap, and the link must — an unclickable join link is not a feature.
`ZIndex.LAYER_5` states that explicitly rather than relying on sibling paint order.

*The trade-off, quantified and accepted.* Timed card: the link covers 12px of card width
and, at `bottom-0.5`, the top 10px of the 12px sit above the strip while the bottom 2px
of the `endDate` strip remain exposed underneath it. So the `endDate` strip loses roughly a
12px-wide × 2.5px-tall notch at one corner and keeps its full 4.5px everywhere else — on a
card at the repeat gate's 40px minimum width that is 70% of the strip intact, and far more
on a normal-width card. On a very short card the `startDate` strip loses a comparable notch.
Keyboard edge-resize (`edge-focus.store`) is a second, untouched path to the same
operation. This is the right side of the trade: the resize strips degrade gracefully at one
corner, whereas the join link degrades to "broken" if it loses.
All-day card: `right-1` puts the link's right edge 4px from the card edge and the `endDate`
strip spans 4.25px inward, so the overlap is **0.25px** — sub-pixel, not a functional loss.
At `right-4` there is no overlap at all. The all-day resize handles are effectively
untouched.

**Consequences.** `LAYER_5` is scoped: each card root is positioned with an explicit
`zIndex` (`position.zIndex ?? ZIndex.LAYER_1`) and therefore forms a stacking context, so
the link can never paint over a neighbouring card. Manual check at review: drag the bottom
edge of a conference-bearing timed event, and grab it at the exact bottom-right corner.

### D-3 — Collision and reservation strategy (FR-5 / R-3 / NFR-1)

**Context.** The all-day card reserves `pr-3.5` (14px) for the repeat icon and nothing
otherwise — correct for two of four combinations. The timed card reserves nothing at all
and lets the repeat glyph overlay the last clamped line.

**Decision.** All-day: enumerate all four combinations —
`none` / `pr-3.5` (repeat only) / `pr-4` (join only) / `pr-7` (both). Timed: **no
reservation at all**, matching how the timed card already treats the repeat icon.

**Rationale.** Collision is avoided by the `right-1` → `right-4` step, so the reservation is
purely about title truncation. On the all-day card the reservation already exists and
extending it is a one-line arithmetic change (4+10=14; 4+12=16; 16+12=28). On the timed
card, adding a reservation would change the title's wrap width and therefore `lineClamp`
and truncation *for conference-bearing events only* — a real layout change to solve a
problem the card has already decided it does not have (the repeat glyph overlays the title
today and always has). Adding it would also make the timed card inconsistent with itself.

**Consequences.** On a narrow timed card the join glyph may overlay the tail of the last
title line, exactly as the repeat glyph does. Accepted, and consistent. All four all-day
combinations are asserted (tests **N13**, **N14**, **N15**, **N6**), including the
unchanged-today ones, so NFR-1 is proved rather than assumed.

### D-4 — Saved-state gating, and where it lives (FR-2 / AC-8)

**Context.** The timed card has `displayMode: "draft" | "placeholder" | "saved"`; the
all-day card has only `isPlaceholder: boolean`. The timed `showRepeatIcon` gate uses
`!isPlaceholder`, so a timed **draft** does show the repeat icon — there is a shipped test
asserting it (`EventCard.test.tsx:310`).

**Decision.** Timed uses `displayMode === "saved"`; all-day uses `!isPlaceholder`. Both feed
a single exported selector, `joinableConference(conference, isSaved)`, that owns the
null/undefined tolerance, the non-empty-`url` check, and the scheme check (D-8). Each card
holds the result in one variable, `joinConference`, that drives both the render and (all-day)
the padding reservation.

**Rationale.** Copying `showRepeatIcon`'s `!isPlaceholder` onto the timed join gate would be
the obvious move and would be **wrong** — it would render a join link on a draft, failing
AC-8. `=== "saved"` is the deliberate divergence and the comment in T2 records why. The
selector exists so that the all-day reservation can never disagree with what renders: a
single value decides both, so a URL rejected by D-8 cannot leave phantom padding behind
(which is what an early `return null` *inside* the component would have caused).

**Consequences.** The two cards' gate expressions differ by one term, forced by an actual
structural difference (NFR-2 satisfied). The draft adapter is untouched, so drafts keep
carrying `conference === undefined` and the gate remains belt-and-braces — but the tests
force the belt by passing a conference to a draft card explicitly, so the gate is what is
under test, not the adapter.

### D-5 — Accessible-name construction (FR-6 / AC-6 / OQ-2)

**Context.** A week grid renders many cards; a bare "Join" is ambiguous. `conference.label`
is the provider's `conferenceSolution.name` (`google-event.normalizer.ts:172`) — "Google
Meet", "Zoom Meeting" — not a second title.

**Decision.**
`` `Join ${eventTitle} via ${conference.label}` `` when a label is present, otherwise
`` `Join ${eventTitle}` ``. `eventTitle = title?.trim() || "Untitled event"`, applied inside
`EventJoinIcon` so both cards pass `title={event.title}` verbatim.

**Rationale.** Matches the Gate-1 decision ("`Join <event title>`, incorporating
`conference.label` where it adds information"). Because the label is a *medium*, "via" is
the phrasing that adds information rather than noise; `ConferenceSchema` already guarantees
a non-null label is trimmed and non-empty, so no extra emptiness handling is needed. The
untitled fallback lives in the component rather than in each card so the name can never
degrade to "Join " — and so `AllDayEventCard`, which has no `eventTitle` local, does not
have to grow one.

**Consequences.** Three name shapes are asserted (N1/N2 with label, N3 without, N4
untitled). Deliberately **no** `title` attribute on the anchor: it duplicates the accessible
name, some SR/browser pairs double-announce, and the repo's `Tooltip` component would need a
portal that an `overflow-hidden` card would fight.

### D-6 — Direct `@phosphor-icons/react` import, no `components/Icons/*` wrapper (FR-7 / AC-9 / OQ-1)

**Context.** `EventRepeatIcon` goes through `@web/components/Icons/Repeat`, which applies
`getInteractiveIconClassName`. There is no `VideoCamera.tsx` wrapper, and creating one would
need a fifth file.

**Decision.** `EventJoinIcon` imports `VideoCameraIcon` directly from `@phosphor-icons/react`
and applies `getInteractiveIconClassName()` itself. Confirmed at Gate 1.

**Rationale.** This is exactly what both existing join precedents do — `UpNextCard.tsx:1`
and `EventDetailsSection.tsx:1` — so it is the established pattern for this specific glyph,
not a shortcut invented for the allowlist. `package.json` is unchanged; no new icon
dependency (AC-9).

**Consequences.** The `c-icon` class still lands on the glyph, so the convention half that
actually matters is preserved. If the team later wants the indirection, adding
`components/Icons/VideoCamera.tsx` and swapping one import is a mechanical follow-up.

### D-7 — Isolation via target-phase native listeners, not React handlers (FR-4a / FR-4b — **new this phase**)

**Context.** See §0.2. React 17+ attaches all delegated handlers at the app root container,
so a React `onMouseDown`/`onPointerDown` on the link fires only once the native event has
already bubbled past every intermediate ancestor — including any grid element that binds
`pointerdown` natively and resolves the card with `target.closest(...)`. The resize handles
are safe from that layer because it *recognises* them via
`getResizeHandleEdge`/`EVENT_RESIZE_HANDLE_ATTRIBUTE`; the join link has no recognition
hook and `grid/interaction/dom.ts` is outside the allowlist.

**Decision.** Bind `pointerdown`, `mousedown`, and `keydown` listeners **on the anchor
element itself** via a `useRef` + `useEffect` pair, each calling `stopPropagation()` and
nothing else. Do not add React `onMouseDown`/`onKeyDown` props to the anchor.

**Rationale.** A listener on the target runs in the target phase, before *every* ancestor
bubble listener — native or React-delegated. It is the only mechanism available inside the
four-file allowlist that closes both interaction systems, and it closes the React prop path
as a side effect (the card root's React handler never runs because the native event never
reaches the root container). Adding React handlers on top would be dead code, since the
native stop fires first. `stopImmediatePropagation` is deliberately not used: it is not
needed for ancestors and would silently break any other listener legitimately bound to the
link itself.

**Consequences.** A ten-line `useEffect` appears in an otherwise presentational component.
It has no dependencies, updates no state, and cleans up on unmount, so it adds no
`act(...)` noise to the two pre-existing card-base warnings. It is directly testable
against a *native* ancestor listener, which the React-only design was not — see tests
**N7**/**N8**. If review disagrees and prefers the React-handler form, the escalation ladder
is: (1) React `onMouseDown` only — closes the prop path, leaves the native layer open;
(2) add React `onPointerDown` — still too late for intermediate ancestors; (3) this design.
Ship (3).

**Verification step for the implementation packet:** before writing, read (do not edit)
`packages/web/src/grid/interaction/**` and confirm the pointer-layer binding site. If the
layer turns out to bind on `document`/`window` only, this design remains correct and simply
over-delivers; if it binds on an intermediate grid container — which §0.2 suggests — this
design is the only one that works. Either way, do not weaken it.

### D-8 — `http(s)`-only guard on the href (NFR-5 / R-4 — **architect-initiated**)

**Context.** `conference.url` is provider-sourced and now reaches a DOM `href` sink on
every grid card. Zod's `z.url()` validates that the string parses as a URL; it does **not**
constrain the scheme, so `javascript:alert(1)` clears `ConferenceSchema`. NFR-5 records the
boundary and defers the mitigation to Phase 8 "on the evidence".

**Decision.** `joinableConference` returns `null` unless `new URL(url).protocol` is `http:`
or `https:`. A rejected URL renders no link and reserves no padding.

**Rationale.** The mitigation is two lines, sits inside the allowlist, is testable (**N20**),
and closes the vector now rather than after a security review round-trip. Every real video
entry point is https (`hangoutLink`, `conferenceData.entryPoints[video].uri`), so the guard
has no false-negative cost. Providing the mitigation *is* the evidence NFR-5 asks Phase 8 to
evaluate.

**Consequences.** This goes marginally beyond the letter of FR-2 ("renders iff non-empty
`conference.url` and saved"), so it is flagged explicitly for the gate reviewer to strike if
they disagree. It does **not** touch `UpNextCard` / `EventDetailsSection` / `UpNextBanner`,
which remain unguarded — that stays the deferred follow-up the brief describes, though this
run now establishes the pattern for it.

---

## 6. Test plan

All new blocks go in `packages/web/src/grid/components/EventCard.test.tsx`. **No existing
`it(...)` block is edited or moved** — none of them carries a conference, so all nine
repeat/interaction tests are unaffected and must pass verbatim. One shared fixture is added
next to `position` at `:40-45`:

```tsx
const CONFERENCE = {
  label: "Google Meet",
  url: "https://meet.google.com/abc-defg",
};
```

**Query policy (NFR-4).** Every join assertion uses `getByRole("link", { name })` /
`queryByRole("link")`. Three structural queries are used and each is justified in-line:
(a) `container.querySelector('svg[class*="right-1"]')` for the repeat glyph, legitimate
because that glyph is `aria-hidden` — the same justification the shipped tests carry;
(b) `toHaveClass("right-4" | "pr-7" | …)` for geometry, because jsdom has no layout engine
and `getBoundingClientRect` returns zeros, so the class that encodes the offset is the only
observable; (c) `screen.getByText("…").parentElement` for the all-day title wrapper, derived
from a semantic query rather than a raw selector.

**Do not `fireEvent.click(link)` anywhere.** jsdom emits a "Not implemented: navigation"
error for a click on an anchor with an href. Enter-key and mousedown coverage is what AC-3/
AC-4/AC-5 actually need.

| AC | Test (`it` name) | Card | New? | Query | Asserts |
|---|---|---|---|---|---|
| AC-1, AC-3, AC-6 | **N1** "renders a join link on a saved timed event with a conference" | Timed | new | `getByRole("link", { name: "Join Planning block via Google Meet" })` | link exists; `href` = `CONFERENCE.url`; `target="_blank"`; `rel="noopener noreferrer"` |
| AC-1, AC-3, AC-6 | **N2** "renders a join link on a saved all-day event with a conference" | All-day | new | `getByRole("link", { name: "Join Standup via Google Meet" })` | same four assertions, `isPlaceholder={false}`, `isAllDay: true` |
| AC-6 | **N3** "names the join link from the title alone when the conference has no label" | Timed | new | `getByRole("link", { name: "Join Planning block" })` | `{ ...CONFERENCE, label: null }` → no "via" clause |
| AC-6 | **N4** "falls back to Untitled event in the join link's name" | Timed | new | `getByRole("link", { name: "Join Untitled event" })` | `title: ""` + conference |
| AC-2 | **N5** "renders no join link on a timed event without a conference" | Timed | new | `queryByRole("link")` | `toBeNull()` |
| AC-2, NFR-1 | **N6** "renders no join link and reserves no room on an all-day event without a conference" | All-day | new | `queryByRole("link")`; `getByText("Planning block").parentElement` | link null; wrapper has none of `pr-3.5` / `pr-4` / `pr-7` |
| AC-4, FR-4a | **N7** "keeps a mousedown on the timed join link from starting a card interaction" | Timed | new | `getByRole("link", …)` | `fireEvent.mouseDown(link)` → `onEventMouseDown` not called; a native `container.addEventListener("pointerdown", spy)` is not called after `fireEvent.pointerDown(link)`; control: `fireEvent.mouseDown(card)` → called once |
| AC-4, FR-4a | **N8** "keeps a mousedown on the all-day join link from starting a card interaction" | All-day | new | same | same, `onEventMouseDown` not called, control passes |
| AC-5, FR-4b, R-1 | **N9** "lets Enter reach the timed join link instead of opening the event" | Timed | new | `getByRole("link", …)` inside a `<div onKeyDown={onParentKeyDown}>` wrapper | `expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(true)` (i.e. **not** `preventDefault`ed); `onEventKeyDown` not called; `onParentKeyDown` not called; repeat for `{ key: " " }` |
| AC-5, FR-4b, R-1 | **N10** "lets Enter reach the all-day join link instead of opening the event" | All-day | new | same | same |
| D-1 | **N11** "keeps arrow keys flowing past the join link to the grid" | Timed | new | same wrapper | `fireEvent.keyDown(link, { key: "ArrowDown" })` → `onParentKeyDown` **called once** (proves only Enter/Space are stopped) |
| AC-7, FR-5 | **N12** "shows the repeat and join indicators side by side on a timed card" | Timed | new | `getByRole("link", { name: /^Join / })` + `container.querySelectorAll('svg[class*="right-1"]')` | recurring + conference: link has `right-4` and not `right-1`; repeat-glyph query has **length 1** (the join glyph did not steal the selector) |
| AC-7, FR-5 | **N13** "shows both indicators and reserves room for both on an all-day card" | All-day | new | as N12 + `getByText(…).parentElement` | link has `right-4`; repeat glyph present; wrapper `toHaveClass("pr-7")` |
| FR-5 (combo 3) | **N14** "reserves room for the join indicator alone on an all-day card" | All-day | new | as above | non-recurring + conference: link has `right-1`; wrapper `toHaveClass("pr-4")` |
| FR-5 (combo 2), NFR-1 | **N15** "leaves the repeat-only reservation on an all-day card unchanged" | All-day | new | `getByText(…).parentElement` | recurring, no conference: wrapper `toHaveClass("pr-3.5")`; `queryByRole("link")` null |
| AC-8 | **N16** "renders no join link on a timed draft or placeholder" | Timed | new | `queryByRole("link")` | conference **is** supplied, `displayMode="draft"` → null; `rerender` with `displayMode="placeholder"` → null |
| AC-8 | **N17** "renders no join link on an all-day placeholder" | All-day | new | `queryByRole("link")` | conference supplied, `isPlaceholder={true}` → null |
| AC-9 | — | — | review | — | reviewer confirms the `@phosphor-icons/react` import line and `getInteractiveIconClassName` usage; `package.json` diff empty |
| AC-10 | **N18** "keeps both timed resize handles working on a conference-bearing card" | Timed | new | `document.querySelectorAll("[data-calendar-event-resize-handle]")` | conference present: mousedown on both handles → `onScalerMouseDown` twice, edges `startDate`/`endDate`; mousedown on the join link → `onScalerMouseDown` **not** called again |
| AC-10 | **N19** "keeps both all-day resize handles working on a conference-bearing card" | All-day | new | same | same |
| AC-10 | existing `:52` and `:345` | both | **must keep passing** | — | the two shipped `onScalerMouseDown` assertions, unchanged |
| NFR-5, D-8 | **N20** "renders no join link for a non-http conference URL" | Timed | new | `queryByRole("link")` | `url: "javascript:alert(1)"` → null; all-day wrapper equivalent not needed (the selector is shared) |
| AC-11 | — | — | observed run | — | full `bun test:web` in Phase 7 vs. the 2298 baseline; focused probe of `EventCard.test.tsx` + `AllDayGridRow.test.tsx` + `calendarCardIdentity.test.tsx` ≥ 30 pass / 0 fail — expected ≈ **50 pass** after 20 new blocks |

**Explicitly called out:** AC-10 is *not* covered by the two shipped resize tests. Those
events carry no conference, so no join link renders and the strips are untouched — the
tests pass whether or not this change broke anything. N18/N19 are what actually verify
AC-10, and they are the reason the AC-10 row above lists both.

**Also called out:** AC-7's "without overlap" cannot be verified geometrically in jsdom.
N12/N13 verify the *encoding* of non-overlap (`right-4` when the repeat icon is present)
plus the pixel arithmetic recorded in the A3 comment. Actual visual non-overlap is a manual
check at review (see §8).

---

## 7. Packet decomposition

React has no module-registration wiring (no Nest `@Module`, no `urls.py`); the import
statement *is* the wiring, and it lives in the same file as the render site. So the
paired-packet rule collapses to "each card's import and render site ship in one packet".

**Recommended: three packets, strictly sequential.**

| # | Packet | Files | Depends on | Contents |
|---|---|---|---|---|
| **P1** | `join-icon-component` | `EventJoinIcon.tsx` (new) | — | The full §2 source: `SAFE_JOIN_PROTOCOLS`, `JOIN_ICON_SIZE`, `ISOLATED_POINTER_EVENTS`, `Props`, `joinableConference`, `EventJoinIcon`. Must land first — both cards import from it, and a card packet that lands first will not typecheck. |
| **P2** | `wire-both-cards` | `TimedEventCard.tsx`, `AllDayEventCard.tsx` | P1 | Hunks T1–T3 and A1–A4 together. **Both cards in one packet on purpose:** NFR-2 says the two must not drift, and splitting them creates a window where they have. The two edits are also structurally identical apart from the gate term and the reservation, so a single diff is the cheapest place to spot drift. |
| **P3** | `join-icon-tests` | `EventCard.test.tsx` | P1, P2 | The `CONFERENCE` fixture plus N1–N20. Must be last: it exercises both cards, so splitting it across P2's two files would mean two packets writing the same file. |

**Pre-P1 read-only step (not a packet):** the D-7 verification — read
`packages/web/src/grid/interaction/**` to confirm where the pointer layer binds. Reading is
allowlist-neutral. Its outcome does not change the design; it changes only how confidently
the reviewer can sign off on FR-4a.

**Alternative (four packets, one per file)** is available if the runner prefers one file per
packet, with P2a = timed, P2b = all-day, and P2a→P2b ordered. It is strictly worse for the
NFR-2 review and buys nothing. Do not split P3.

**Typecheck/lint gates:** after P1 the repo compiles (an unused new module); after P2 it
compiles and the shipped 30-test probe still passes unchanged; after P3 the probe is ≈50.

---

## 8. Risks and invariants to re-check at review

**From the risk register.**

- **R-1 (keydown bubbling)** — closed by D-1 + D-7, asserted by N9/N10. Invariant: neither
  card root gained a `target` check, so *any future* inner interactive element in either
  card must bring its own isolation. Recommend filing the hardening follow-up.
- **R-2 (resize handles at LAYER_4)** — closed by D-2, asserted by N18/N19. **Manual check
  required:** with a conference-bearing timed event on screen, grab the bottom edge at the
  extreme bottom-right corner and drag; then grab it 20px to the left. The first may need
  the bottom ~2px; the second must be unaffected.
- **R-3 (all-day `pr-3.5`)** — closed by D-3, all four combinations asserted (N6, N13, N14,
  N15).
- **R-4 (provider URL → href)** — closed by D-8 rather than deferred. Flag for Phase 8 that
  the guard exists *here only*; `UpNextCard`, `EventDetailsSection`, and `UpNextBanner`
  remain unguarded by design.
- **R-5 (Day view is a second consumer)** — no card prop changed, no consumer edited, so the
  Day view picks the affordance up for free. Confirmed by the full `bun test:web` in Phase 7.

**Things the requirements did not anticipate — flag each at gate review.**

1. **The native pointer interaction layer (§0.2 / D-7).** FR-4a's prescribed remedy
   ("stopPropagation on mousedown the way the resize handles do") is insufficient on its
   own, because the resize handles are protected by recognition, not by propagation. This is
   the single highest-risk item in the change and the reason for the `useEffect`. If a
   reviewer wants the "simpler" React-handler version, they are choosing a design that
   probably does not close FR-4a — say so out loud.
2. **`onFocus`/`onBlur` bubbling on the timed card.** `TimedEventCard` passes `onFocus` and
   `onBlur` to its root (`:288-289`). React maps these to `focusin`/`focusout`, which
   bubble. Tabbing into the join link will now fire the card's `onFocus`, and tabbing out
   will fire `onBlur`. `AllDayEventCard` has no such props, so this is timed-only. I could
   not open the `GridEvent.tsx` call site this session to see what those callbacks do; if
   they drive selection or edge-focus state it is probably benign (focus *is* on the event),
   but **this must be checked at review** and, if it misbehaves, the fix belongs in the same
   `useEffect` (stop `focusin` at the target) rather than in the card.
3. **Tab order.** Each conference-bearing card gains a second tab stop. If grid keyboard
   navigation is Tab-based rather than arrow-based, traversal across a busy week doubles in
   length. FR-3/AC-6 require a genuinely reachable link, so this is accepted, not fixed —
   but a manual keyboard pass across a week with several meetings is worth five minutes.
4. **Target size.** The link is a 12×12 hit target, below WCAG 2.2 SC 2.5.8's 24×24 AA
   minimum. A 24×24 target does not fit a 20px-tall all-day card, and enlarging it on the
   timed card would widen the resize-strip notch from D-2. Keyboard activation is provided.
   Flag for Phase 8 as a known, layout-constrained deviation rather than an oversight.
5. **No width or duration gate on the join link.** The repeat icon hides below 40px (timed)
   / 60px (all-day) because it is decorative and costs nothing to drop. The join link is the
   feature, and FR-2 names exactly two conditions; adding a third would make the affordance
   silently unreliable. Consequence: on a card narrower than ~28px the glyph dominates. If
   that shows up in practice it is a follow-up, not a change to make here.
6. **`EventRepeatIcon.tsx` being outside the allowlist is load-bearing**, not incidental.
   Every "why not just move the repeat icon" question at review has the same answer.

**Invariants a reviewer should confirm by reading the diff.**

- The join glyph's `class` attribute contains no `right-1` (keeps the five shipped
  `svg[class*="right-1"]` probes unambiguous — asserted by N12's length-1 check).
- Neither card root's `onKeyDown`, `onMouseDown`, or resize-handle block was touched.
- Nothing in `EventJoinIcon` calls `preventDefault`.
- Only `Enter` and `Space` are stopped on keydown (N11 guards this).
- `joinConference` — not a separate boolean — drives both the all-day padding and the
  render, so the two cannot disagree.
- `package.json` is unchanged (AC-9).
- No `fireEvent.click` on the link anywhere in the test file.
