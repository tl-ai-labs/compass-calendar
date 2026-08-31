# Change Plan — feature-extend — One-click join icon on grid event cards

- **Run:** `20260830-164154-feature-extend-one-click-join`
- **Mode / intent:** brownfield / `feature-extend` (delta plan)
- **Spec:** `.sdlc/runs/20260830-164154-feature-extend-one-click-join/requirements.md` (Gate 1 approved)
- **Write-contract allowlist:** `packages/web/src/grid/components/**` — every path below is inside it.
- **Stack:** React 18 + TypeScript, Tailwind 4 utilities via `classnames`/`cn`, `@web/*` / `@core/*`
  path aliases, named exports, Biome formatting, tests under `bun:test` +
  `@testing-library/react`.

---

## 1. Summary

Adds a nested, focusable **join button** to `TimedEventCard` and `AllDayEventCard`, rendered only
when `event.conference` carries an `http:`/`https:` URL. The button is a new shared presentational
component `EventJoinIcon.tsx`, deliberately mirroring the existing `EventRepeatIcon.tsx` precedent
(size-10 `VideoCameraIcon`, `weight="bold"`, tinted `darken(bgColor, 30)`, pinned to the card's
bottom-right) so the two glyphs read as one icon family and the two cards cannot drift apart. The
URL-scheme allowlist lives in a sibling util `event-join-url.util.ts` (following the
`calendar-accent.util.ts` precedent in the same directory) and is applied **at render time, fail
closed** — a conference whose URL is not http(s) produces no control at all — and re-applied at
click time inside the component so the guard cannot be bypassed by a careless caller. The join
glyph sits at `right-4.5` (18px), one slot **left** of the repeat glyph's `right-1` (4px), which
both prevents visual overlap and keeps the four existing `svg[class*="right-1"]` repeat assertions
resolving to exactly the repeat icon. Isolation from the card's drag/open handlers is done with
`stopPropagation` on `onMouseDown` / `onPointerDown` / `onClick` / `onKeyDown`, matching the
mechanism the cards' own resize handles already rely on.

---

## 2. Files touched

| Path | Action | Why | Rough size |
|---|---|---|---|
| `packages/web/src/grid/components/event-join-url.util.ts` | `new_file_add` | `isJoinableUrl` + `getJoinableConferenceUrl` — the http(s) scheme allowlist, shared by both cards and the icon component | ~30 lines |
| `packages/web/src/grid/components/event-join-url.util.test.ts` | `new_file_add` | Direct unit coverage of the guard (`javascript:`, `data:`, `vbscript:`, `file:`, relative, empty) — cheapest way to prove AC-6 exhaustively | ~45 lines |
| `packages/web/src/grid/components/EventJoinIcon.tsx` | `new_file_add` | Shared presentational join control (button + `VideoCameraIcon`), event-handler isolation, accessible name | ~65 lines |
| `packages/web/src/grid/components/TimedEventCard.tsx` | `patch_apply` | 1 import, 1 constant rename, 1 derived `joinUrl` + `showJoinIcon`, 1 JSX mount | ~12 lines changed |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | `patch_apply` | 1 import, 1 constant rename, 1 derived `joinUrl` + `showJoinIcon`, title-row padding rule, 1 JSX mount | ~14 lines changed |
| `packages/web/src/grid/components/EventCard.test.tsx` | `existing_file_edit` | 12 new `it(...)` cases + `window.open` stub/restore wiring in the existing `afterEach` | ~230 lines added |

**No file outside `packages/web/src/grid/components/` is written.** No `package.json` change
(`@phosphor-icons/react` is already a dependency — NFR-2).

### Packet order

1. `event-join-url.util.ts` + `event-join-url.util.test.ts` (no dependencies).
2. `EventJoinIcon.tsx` (imports the util).
3. `TimedEventCard.tsx` (imports both).
4. `AllDayEventCard.tsx` (imports both).
5. `EventCard.test.tsx` (asserts against 3 and 4).

Packets 3 and 4 are independent of each other and may run in parallel. Packet 5 must run last.

---

## 3. Files removed

None.

---

## 4. New component contract — `EventJoinIcon.tsx`

### 4.1 Props

```ts
interface Props {
  /** The card's resolved fill (`bgColor`), not the raw palette base — the glyph
      is tinted from what is actually painted behind it. */
  baseColor: string;
  /** `conference.label`; null/absent falls back to "Join meeting". */
  label?: string | null;
  /** Already scheme-checked by the card; re-checked here (fail closed). */
  url: string;
}
```

Exported as a named const: `export const EventJoinIcon = ({ baseColor, label, url }: Props) => {`.
No `forwardRef`, no memo — matches `EventRepeatIcon`.

### 4.2 Imports

```ts
import { VideoCameraIcon } from "@phosphor-icons/react";
import { ZIndex } from "@web/common/constants/web.constants";
import { darken } from "@web/common/styles/color.utils";
import { isJoinableUrl } from "./event-join-url.util";
```

`VideoCameraIcon` is imported from the package root, exactly as `UpNextCard.tsx:1` does.

### 4.3 Rendered element tree

```
<button type="button" aria-label={accessibleLabel} class=… style={{ zIndex: ZIndex.LAYER_5 }} …handlers>
  └── <VideoCameraIcon aria-hidden="true" className="pointer-events-none" color={darken(baseColor, 30)} size={10} weight="bold" />
</button>
```

Exact classes on the `<button>`:

```
"absolute right-4.5 bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-(--event-focus-color)"
```

- `right-4.5` = 18px, `bottom-0.5` = 2px, `h-2.5 w-2.5` = a 10×10 box that exactly fits the glyph.
  `pr-0.75` / `pl-1.25` on the cards prove fractional Tailwind-4 spacing values resolve in this
  repo.
- `--event-focus-color` is already set as an inline CSS variable on **both** card roots
  (`TimedEventCard.tsx:195`, `AllDayEventCard.tsx:105`), so the button inherits the card's
  calendar-colored focus chrome for free. `outline-offset-0` keeps the ring inside the card's
  `overflow-hidden` box so it is not clipped.
- `style={{ zIndex: ZIndex.LAYER_5 }}` (5) — the timed card's bottom resize handle is a
  full-width, 4.5px-tall strip at `bottom: -0.25px` with `zIndex: ZIndex.LAYER_4`
  (`TimedEventCard.tsx:350-359`). It overlaps the bottom ~2px of the join button; without a
  higher z-index the handle would eat mousedowns on that sliver.
- **No positioning class is placed on the `<svg>`.** Its class attribute is exactly
  `"pointer-events-none"`. See §9 ADR-4.

Glyph: `size={10}`, `weight="bold"`, `color={darken(baseColor, 30)}` — byte-identical treatment to
`EventRepeatIcon.tsx:19-21`.

### 4.4 Accessible name

```ts
const accessibleLabel = label ? `Join ${label}` : "Join meeting";
```

Mirrors `EventDetailsSection.tsx:55`'s `label ?? "Join meeting"` fallback. Satisfies AC-9 exactly:
`"Join Google Meet"` / `"Join meeting"`. The card's own `aria-label` is **not** modified (ruling 2,
NFR-6).

### 4.5 Fail-closed render guard

First statement in the component body, before any JSX:

```ts
if (!isJoinableUrl(url)) return null;
```

No hooks precede it, so there is no conditional-hook hazard.

### 4.6 Activation

```ts
const openConference = () => {
  if (!isJoinableUrl(url)) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
```

Ruling 1, verbatim. The URL passed to `window.open` is the **original** provider string, not
`new URL(url).href` (see §5).

### 4.7 Full handler set

| Handler | Body | Why |
|---|---|---|
| `onMouseDown` | `e.stopPropagation();` | **The load-bearing one.** Both cards drive selection/drag from `mousedown`, not `click` (`TimedEventCard.tsx:303-310` calls `onEventMouseDown(event, e)`; `AllDayEventCard.tsx:171-176` calls `onEventMouseDown?.(e, event)`). Stopping only `click` would still start a drag. No `preventDefault` — that would suppress focus on the button. |
| `onPointerDown` | `e.stopPropagation();` | Defense in depth against any pointer-event-driven interaction listener mounted between the card and the React root. Costs nothing; see §10 R-2. |
| `onClick` | `e.stopPropagation(); openConference();` | Pointer activation. `stopPropagation` because the all-day row's create handler and grid-level click handlers sit above the card. No `preventDefault` needed — `type="button"` already means no form submit and no navigation. |
| `onKeyDown` | `if (e.key !== "Enter" && e.key !== " ") return; e.stopPropagation(); e.preventDefault(); openConference();` | Keyboard activation is **hand-built** (ADR-1). `stopPropagation` stops the card's own Enter/Space handler (`TimedEventCard.tsx:290-302`, `AllDayEventCard.tsx:162-170`), which would otherwise open the event form. `preventDefault` suppresses the browser's native button click-on-Enter so the link opens exactly once, and suppresses Space-scroll. Non-Enter/Space keys deliberately fall through so grid shortcuts keep working while the button holds focus. |

Everything else (blur/focus/mouseenter/mouseleave) is left alone — the card's hover/focus chrome
should still react while the pointer is over the icon.

`type="button"` is mandatory and must be written explicitly.

### 4.8 TSDoc (required — voice of `EventRepeatIcon.tsx`, explains *why*)

Draft the block comment along these lines:

> The one-click join affordance shared by the timed and all-day grid cards. It is a real `<button>`
> rather than part of the card's own click target because the card's mousedown starts a drag — a
> nested control with its own name is the only way to offer "join" without also meaning "select and
> drag this event". Sits one slot left of the repeat glyph and borrows its size/weight/tint so the
> two read as one icon family rather than two competing badges. The URL is re-checked here, not
> just at the call site, because `conference.url` is provider-sourced and a control that can be
> tricked into opening a `javascript:` URL is worse than no control.

---

## 5. URL-scheme guard — `event-join-url.util.ts`

Lives in its own file, next to `calendar-accent.util.ts` (same directory, same `*.util.ts`
naming), because both **cards** need it at render time while only the **component** needs the
primitive — keeping it out of `EventJoinIcon.tsx` stops the cards from importing a JSX module for a
pure predicate.

### 5.1 Exports

```ts
export const isJoinableUrl = (url: string | null | undefined): url is string => { … };

export const getJoinableConferenceUrl = (
  conference: GridEvent["conference"],
): string | null => { … };
```

- `isJoinableUrl` is a **type predicate** so `getJoinableConferenceUrl` narrows without a cast.
- `getJoinableConferenceUrl` body: `const url = conference?.url; return isJoinableUrl(url) ? url : null;`
- Type import: `import { type GridEvent } from "@web/common/types/web.event.types";` (type-only
  import of an off-limits module is read-only and allowed). `GridEvent["conference"]` is
  `Conference | null | undefined` (B-2), so no separate `@core` import is needed.

### 5.2 `isJoinableUrl` implementation shape

```ts
if (!url) return false;
try {
  const { protocol } = new URL(url);
  return protocol === "http:" || protocol === "https:";
} catch {
  return false;
}
```

### 5.3 Behaviour table

| Input | Result | Note |
|---|---|---|
| `"https://meet.google.com/abc-defg-hij"` | `true` | |
| `"http://meet.example.com/x"` | `true` | plain http accepted per FR-4 |
| `"HTTPS://Meet.Example.com"` | `true` | `URL` lowercases the protocol before comparison |
| `"javascript:alert(1)"` | `false` | AC-6 |
| `"data:text/html,<script>x</script>"` | `false` | |
| `"vbscript:msgbox(1)"` | `false` | |
| `"file:///etc/passwd"` | `false` | |
| `"//meet.google.com/x"` (protocol-relative) | `false` | `new URL` throws without a base — fail closed by design |
| `"meet.google.com/x"` (relative/bare host) | `false` | throws |
| `""` | `false` | short-circuits on `!url` |
| `null` / `undefined` | `false` | |

### 5.4 Where the guard is applied — **both**, and render-time is authoritative

- **Render time, fail closed (confirmed, per FR-4/FR-2):** each card computes
  `const joinUrl = getJoinableConferenceUrl(event.conference);` and folds `joinUrl !== null` into
  its `showJoinIcon` predicate. A conference with a bad URL produces **no button, no wrapper, no
  reserved space** — a visible control that silently does nothing is worse than an absent one.
- **Click time, secondarily:** `EventJoinIcon` re-checks in both its render (`return null`) and its
  `openConference` handler. This is not redundant paranoia — it makes the component safe for any
  future call site that forgets the card-level gate.

### 5.5 Return the original string, not the normalized one

`getJoinableConferenceUrl` returns `conference.url` **unchanged**, never `new URL(url).href`.
`new URL("https://zoom.us").href` is `"https://zoom.us/"`; normalizing would silently rewrite the
provider's URL and would make AC-4's exact-argument assertion depend on WHATWG normalization rules.

---

## 6. `TimedEventCard.tsx` delta

Four edits. Line numbers are against the current file.

**(a) Import — after line 49 (`import { EventRepeatIcon } from "./EventRepeatIcon";`)**

```ts
import { getJoinableConferenceUrl } from "./event-join-url.util";
import { EventJoinIcon } from "./EventJoinIcon";
```

(Biome will order these against the existing relative import; keep both relative-path imports
adjacent at the end of the import block.)

**(b) Constants — lines 51-58.** Rename both module-local constants so a shared gate is not
named after one of its two consumers. Exactly two occurrences each; both are module-local (not
exported), so the rename is contained.

- `REPEAT_ICON_MIN_DURATION_MINUTES` → `CARD_ICON_MIN_DURATION_MINUTES` (declaration line 57, use
  line 119)
- `REPEAT_ICON_MIN_WIDTH` → `CARD_ICON_MIN_WIDTH` (declaration line 58, use line 120)
- **Values are unchanged: `15` and `40`** (binding decision 4 — do not widen).
- Amend the first sentence of the block comment above them from
  `// Gate the repeat indicator on the event's duration, not its rendered pixel`
  to
  `// Gate the card's corner indicators on the event's duration, not its rendered pixel`.
  Leave the rest of the comment (lines 52-56) byte-identical — its reasoning about resize paths is
  still exactly right.

**(c) Derived state — immediately after `showRepeatIcon` (after line 120)**

```ts
const joinUrl = getJoinableConferenceUrl(event.conference);
const showJoinIcon =
  joinUrl !== null &&
  !isPlaceholder &&
  durationMinutes >= CARD_ICON_MIN_DURATION_MINUTES &&
  position.width >= CARD_ICON_MIN_WIDTH;
```

The predicate is `showRepeatIcon`'s shape with `joinUrl !== null` substituted for `isRecurring` —
same placeholder exclusion, same duration gate, same width gate. Drafts are **not** placeholders,
so a draft carrying a conference shows the icon, matching the repeat icon's draft behaviour.

**(d) JSX mount — replace line 363**

```tsx
{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
{showJoinIcon && joinUrl && (
  <EventJoinIcon
    baseColor={bgColor}
    label={event.conference?.label ?? null}
    url={joinUrl}
  />
)}
```

Notes for the implementer:

- The join mount is the **last child** of the card root, immediately after the repeat icon and
  outside the `EVENT_CONTENT_ATTRIBUTE` wrapper — same structural position as `EventRepeatIcon`, so
  the draft-clone's time-label insertion logic (`interaction/dom.ts:117-123`, which searches inside
  the content wrapper) is unaffected.
- The redundant-looking `&& joinUrl` is deliberate: it gives TypeScript a direct `string`
  narrowing at the prop site instead of relying on aliased-condition narrowing through
  `showJoinIcon`. Do not "simplify" it away.
- `baseColor={bgColor}` — the card's resolved fill, matching how `EventRepeatIcon` is called on
  line 363 (not `baseColor`, which is the pre-state palette value).
- **No title-padding reservation is added to the timed card.** It has none today for the repeat
  icon (the glyph overlays the clamped title), and adding one is a behaviour change outside this
  delta.
- This card's `onMouseDown` calls `onEventMouseDown(event, e)` and a **drag starts from mousedown,
  not click** — which is precisely why §4.7 stops `mousedown` and not just `click`.

---

## 7. `AllDayEventCard.tsx` delta

Five edits.

**(a) Import — after line 30 (`import { EventRepeatIcon } from "./EventRepeatIcon";`)**

```ts
import { getJoinableConferenceUrl } from "./event-join-url.util";
import { EventJoinIcon } from "./EventJoinIcon";
```

**(b) Constant — line 32.** Rename `REPEAT_ICON_MIN_WIDTH` → `CARD_ICON_MIN_WIDTH` (declaration
line 32, use line 77). **Value unchanged: `60`** (binding decision 4).

**(c) Derived state — immediately after `showRepeatIcon` (after line 77)**

```ts
const joinUrl = getJoinableConferenceUrl(event.conference);
const showJoinIcon =
  joinUrl !== null && !isPlaceholder && position.width >= CARD_ICON_MIN_WIDTH;
```

**(d) Title-row reservation — replace the `cn` object at lines 188-191**

```tsx
<div
  className={cn("flex min-w-0 items-center", {
    // Reserve room so a long title truncates before the bottom-right icons.
    // The join glyph sits further left than the repeat glyph, so it needs the
    // wider reservation whether or not the repeat glyph is also showing.
    "pr-3.5": showRepeatIcon && !showJoinIcon,
    "pr-7": showJoinIcon,
  })}
>
```

Arithmetic behind the two values: the repeat glyph occupies 4→14px from the right edge, so one icon
needs `pr-3.5` (14px, unchanged from today). The join glyph occupies 18→28px, so **any** state that
shows the join icon needs `pr-7` (28px) — including "join only", because the join icon keeps its
left slot even when the repeat slot is empty (§8). The four cases collapse to exactly these two
mutually exclusive rules; no third padding value is introduced.

**(e) JSX mount — replace line 201**

```tsx
{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
{showJoinIcon && joinUrl && (
  <EventJoinIcon
    baseColor={bgColor}
    label={event.conference?.label ?? null}
    url={joinUrl}
  />
)}
```

Mount point stays **before** the two resize handles (lines 202-223), same as the repeat icon.
The handles are 4.5px-wide vertical strips at the card's left/right edges with
`zIndex: ZIndex.LAYER_4`; the join button starts 18px in from the right, so there is no overlap,
and `LAYER_5` covers the case anyway.

This card's root `onMouseDown` **already** calls `e.stopPropagation()` unconditionally before
invoking `onEventMouseDown` (lines 171-176), to keep the all-day row's create handler from
overwriting a card click. That protects the *row*, not the *card* — the card's own
`onEventMouseDown` still fires. The button's own `stopPropagation` is what keeps the card handler
from firing, and it is still required here.

---

## 8. Icon co-location layout

Both cards, bottom-right corner, measured from the card's right edge (glyphs are 10px wide):

```
                             28px  18px       14px   4px  0
   … truncated title …         ├────[join]────┤ 4px ├─[rpt]─┤
                                  right-4.5           right-1
                                  bottom-0.5          bottom-0.5
```

| Case | Repeat glyph | Join glyph | All-day title padding |
|---|---|---|---|
| Neither | — | — | none |
| Repeat only | `right-1 bottom-0.5` | — | `pr-3.5` |
| Join only | — | `right-4.5 bottom-0.5` | `pr-7` |
| Both | `right-1 bottom-0.5` | `right-4.5 bottom-0.5` | `pr-7` |

**The join icon's position is stable across "join only" and "both"** — it never reflows into the
`right-1` slot when the event stops being recurring. Two reasons: (1) an icon that jumps 14px
sideways when a recurrence rule is added or removed is a worse affordance than 14px of dead space;
(2) a join glyph that can land at `right-1` would reintroduce exactly the selector ambiguity §9
ADR-4 exists to prevent. The repeat glyph's position is unchanged in every case.

A 4px gutter separates the two glyphs. Nothing about the card's width, `pl-1.25`/`pr-0.75`, or the
`overflow-hidden` clipping changes.

---

## 9. Test plan

All card-level cases go in `packages/web/src/grid/components/EventCard.test.tsx`; the guard's
scheme matrix goes in the new `event-join-url.util.test.ts`.

### 9.1 Shared fixtures + `window.open` stubbing

Add near the top of `EventCard.test.tsx`, after the existing `position` const:

```ts
const conference = {
  url: "https://meet.google.com/abc-defg-hij",
  label: "Google Meet",
};
const originalWindowOpen = window.open;
const stubWindowOpen = () => {
  const openMock = mock(() => null);
  window.open = openMock as unknown as typeof window.open;
  return openMock;
};
```

`mock` is already imported from `bun:test` (line 14). Restore in the **existing** `afterEach`
(lines 48-50) by appending one line, so a stub can never leak into a later test:

```ts
afterEach(() => {
  useEdgeFocusStore.setState(initialEdgeFocusState, true);
  window.open = originalWindowOpen;
});
```

Query convention: always `getByRole("button", { name: … })` / `queryAllByRole("button", { name: /^Join/ })`.
**Never** a class-substring query for the join control. Safety note for the implementer: the cards
themselves are `role="button"`, so a bare `screen.getByRole("button")` becomes ambiguous on a card
that has a conference. The two existing bare-`getByRole("button")` call sites (lines 240 and 413)
render events with **no** conference, so they are unaffected — do not add a conference to those
events.

### 9.2 New cases in `EventCard.test.tsx`

| # | `it(...)` title | AC | Query | Assertion |
|---|---|---|---|---|
| T-1 | `"renders a join control on a timed event with a conference link"` | AC-1 | `screen.getByRole("button", { name: "Join Google Meet" })` | `.toBeInTheDocument()` |
| T-2 | `"renders no join control on a timed event without a conference link"` | AC-2 | render twice — `conference: undefined` and `conference: null` — then `screen.queryAllByRole("button", { name: /^Join/ })` | `.toHaveLength(0)` |
| T-3 | `"renders a join control on an all-day event with a conference link"` | AC-3 | `screen.getByRole("button", { name: "Join Google Meet" })` on `AllDayEventCard` (`isAllDay: true`, `isPlaceholder={false}`) | `.toBeInTheDocument()` |
| T-4 | `"renders no join control on an all-day event without a conference link"` | AC-3 | `screen.queryAllByRole("button", { name: /^Join/ })` after `undefined` + `null` renders | `.toHaveLength(0)` |
| T-5 | `"opens the timed event conference link without selecting the card"` | AC-4 | `const openMock = stubWindowOpen();` `const join = screen.getByRole("button", { name: "Join Google Meet" });` `fireEvent.mouseDown(join); fireEvent.click(join);` | `expect(openMock).toHaveBeenCalledWith("https://meet.google.com/abc-defg-hij", "_blank", "noopener,noreferrer")`; `expect(openMock).toHaveBeenCalledTimes(1)`; `expect(onEventMouseDown).not.toHaveBeenCalled()` — firing `mouseDown` explicitly is the point, since drag starts there |
| T-6 | `"opens the all-day event conference link without selecting the card"` | AC-3, AC-4 | same, on `AllDayEventCard` with an `onEventMouseDown` mock | same three assertions |
| T-7 | `"opens the conference link on Enter without triggering the card's open handler"` | AC-5 | wrap the card in `<div onKeyDown={onParentKeyDown}>` as the existing keyboard tests do; `fireEvent.keyDown(join, { key: "Enter" })` | `expect(openMock).toHaveBeenCalledTimes(1)`; `expect(onEventKeyDown).not.toHaveBeenCalled()`; `expect(onParentKeyDown).not.toHaveBeenCalled()`. Note: jsdom does not synthesize a `click` from `keyDown`, so this case is what proves the hand-built keyboard path of §4.7 actually exists |
| T-8 | `"refuses to render a join control for a non-http conference url"` | AC-6 | render `conference: { url: "javascript:alert(1)", label: "Sketchy" }` and a second card with `{ url: "data:text/html,x", label: null }`; `screen.queryAllByRole("button", { name: /^Join/ })` | `.toHaveLength(0)` **and** `expect(openMock).not.toHaveBeenCalled()` |
| T-9 | `"places the join glyph clear of the repeat glyph when an event is both recurring and joinable"` | AC-7 | `container.querySelectorAll('svg[class*="right-1"]')` **and** `screen.getByRole("button", { name: "Join Google Meet" })` | `expect(container.querySelectorAll('svg[class*="right-1"]')).toHaveLength(1)` — the collision proof; plus `expect(join.className).toContain("right-4.5")` and `expect(join.className).not.toContain("right-1")` |
| T-10 | `"reserves title room for both bottom-right icons on an all-day card"` | AC-7, FR-6 | `screen.getByText("Conference").parentElement` across three renders: recurrence-only → `pr-3.5`; conference-only → `pr-7`; both → `pr-7` (use separate `it`-local renders with distinct titles, or `rerender`) | `toHaveClass(...)` per case |
| T-11 | `"hides the join control on a too-narrow or too-short timed event"` | AC-8 | render `{ ...position, width: 30 }` with a conference, and a second card with `endDate` 10 minutes after `startDate` at full width; `screen.queryAllByRole("button", { name: /^Join/ })` | `.toHaveLength(0)` |
| T-12 | `"hides the join control on a too-narrow or placeholder all-day event"` | AC-8 | render `{ ...position, width: 50 }` with a conference, and a second card at full width with `isPlaceholder`; `screen.queryAllByRole("button", { name: /^Join/ })` | `.toHaveLength(0)` |
| T-13 | `"names the join control from the conference label"` | AC-9 | two renders: `label: "Google Meet"` and `label: null` | `getByRole("button", { name: "Join Google Meet" })` and `getByRole("button", { name: "Join meeting" })` both resolve |

T-9 is the mandated regression proof for the four pre-existing repeat assertions (lines 279, 307,
326, 342, 430): with both glyphs rendered, `svg[class*="right-1"]` must match **exactly one**
element, and it must be the repeat glyph.

`createEvent` already spreads `overrides` over a `GridEvent` cast, so `conference` can be passed
through it with no change to the helper.

### 9.3 `event-join-url.util.test.ts`

One `describe("isJoinableUrl")` with a table-driven set of `it`s over §5.3's ten rows, plus
`describe("getJoinableConferenceUrl")` covering: `undefined` → `null`, `null` → `null`,
`{ url: "https://…", label: "x" }` → the **original** string (assert identity with the input
string, which is what pins §5.5), and `{ url: "javascript:alert(1)", label: null }` → `null`.

### 9.4 Suite-level gates

`bun test:web` and `bun type-check` both pass (AC-10, AC-11). `git diff --name-only` lists only
`packages/web/src/grid/components/` paths (AC-12).

---

## 10. ADR-style decisions

### ADR-1 — `window.open` instead of a nested `<a href>`

**Context.** The repo already has two Join affordances and both are plain anchors:
`UpNextCard.tsx:88-96` and `EventDetailsSection.tsx:47-57`, each `target="_blank"
rel="noopener noreferrer"`. Gate 0 ruling 1 mandates `window.open(url, "_blank",
"noopener,noreferrer")`, and Gate 1 re-confirmed it: this run is a faithful reproduction of an
earlier arm and changing the mechanism would invalidate the comparison.

**Decision.** Use `window.open` in a `<button type="button">`. Do not use an anchor. Hand-build the
keyboard path (§4.7 `onKeyDown`) that an anchor would have provided for free.

**Consequences.** Accepted, eyes open: (1) a popup blocker can swallow the call — the click is
user-initiated so most blockers allow it, but there is no anchor fallback; (2) no middle-click /
ctrl-click "open in background tab"; (3) no "Copy link address" in the context menu, and no status-
bar URL preview on hover, so the user cannot see where the button goes before pressing it;
(4) keyboard activation is our code, not the platform's, and is therefore a thing that can regress
— T-7 exists specifically to hold that line; (5) the control is invisible to link-oriented
assistive-tech navigation (it is a button, not a link, so it will not appear in a screen reader's
links list); (6) `noopener,noreferrer` must be passed as a string feature list and is easy to typo,
where an anchor's `rel` would be lint-checked. Divergence from the repo's own pattern is recorded
here so a future reader does not "fix" it by accident. If this constraint is ever lifted, the swap
to a nested `<a>` is local to `EventJoinIcon.tsx` and preserves rulings 2 and 3 unchanged.

### ADR-2 — Fail closed at render, re-check at click

**Context.** `conference.url` is provider-sourced (`hangoutLink` / `conferenceData.entryPoints[].uri`).
`ConferenceSchema` validates it with `z.url()`, which accepts any well-formed URL — including
`javascript:` and `data:`. A grid card is a dense surface where a user clicks fast and reads little.

**Decision.** `isJoinableUrl` allowlists exactly `http:` and `https:`; anything else, including
unparseable and protocol-relative strings, is rejected. The check runs at **render time in both
cards**, so a rejected URL yields no button and no reserved space, and again at **click time inside
the component**, so the component is safe on its own.

**Consequences.** A conference on an exotic-but-legitimate scheme (`msteams:`, `zoommtg:`,
`tel:`) renders no icon at all rather than a broken one — acceptable, since the normalizer sources a
web URL. The double check means a URL is parsed up to three times per activation; `new URL` on a
short string is free at this scale. Silent absence is undiscoverable to the user; that is the
deliberate trade (FR-4: "a visible control that silently does nothing is worse than an absent one"),
and the guard's behaviour is pinned by `event-join-url.util.test.ts` so the silence is at least
tested.

### ADR-3 — Reuse the existing 40 / 60 width gates, do not widen

**Context.** Two 10px glyphs plus a 4px gutter need 28px of the card's right edge; one glyph needs
14px. The timed card's existing gate is `position.width >= 40`, the all-day card's is `>= 60`.
Widening the gate when both icons show, or widening the card layout, was considered and rejected at
Gate 0 (binding decision 4) — partly on scope, partly because it worsens a known collision with a
sibling branch.

**Decision.** Both icons share the card's existing gate constants, unchanged in value. The
constants are renamed `REPEAT_ICON_MIN_*` → `CARD_ICON_MIN_*` so a shared gate is not named after
one of its two consumers.

**Consequences.** At the extreme low end — a 40px-wide timed card with both icons — 28px of icons
plus `pl-1.25` leaves roughly 7px of title. That column is already unreadable at that width with a
single icon, so the change makes a bad case marginally worse rather than creating a new one. The
all-day card is protected by the `pr-7` reservation (§7d), so its title truncates rather than
running under the glyphs. If a "two icons need more room" gate is ever wanted, it is a one-line
change to the two `showJoinIcon` predicates. The rename touches exactly four lines across two files
and one comment sentence; it is contained to module-local, non-exported constants.

### ADR-4 — `right-4.5` on the button, and no position class on the `<svg>`

**Context.** Four existing tests select the repeat glyph with
`container.querySelector('svg[class*="right-1"]')` (EventCard.test.tsx lines 279, 307, 326, 342,
plus 430 for the all-day card). That is a substring match on an `svg` element's class attribute. Any
new `svg` in the same card whose class contains the substring `right-1` would make those
assertions match the wrong element and pass or fail for the wrong reason — silently.

**Decision.** Two independent protections. (1) All positioning lives on the wrapping `<button>`;
the `VideoCameraIcon` `<svg>` receives exactly `className="pointer-events-none"` and takes its tint
via the `color` prop, so **no `svg` other than the repeat glyph carries a `right-*` class at all**.
(2) The button's own position class is `right-4.5`, which does not contain the substring `right-1`.
Forbidden alternatives, explicitly: `right-1.5`, `right-10`, `right-12`, `right-14`, `right-16` —
every one of them contains `right-1` as a substring and would defeat protection (2) if the icon's
markup is ever restructured.

**Consequences.** T-9 pins the invariant with an exact `toHaveLength(1)`. `pointer-events-none` on
the glyph also guarantees the click target is always the button itself, so any `closest()`-based
hit-testing sees the button, not an inner `svg`. The cost is one extra DOM node per joinable card
versus putting position classes directly on the glyph — worth it, and required anyway since the
control must be a real focusable button (ruling 2).

### ADR-5 — `ZIndex.LAYER_5` on the button

**Context.** The timed card's end-date resize handle is a full-width 4.5px strip at
`bottom: -0.25px` with `zIndex: ZIndex.LAYER_4`, overlapping the bottom ~2px of the join button.
The repeat icon never noticed because it is `pointer-events-none`.

**Decision.** The button carries `style={{ zIndex: ZIndex.LAYER_5 }}`, using the existing enum
rather than a Tailwind `z-*` class, matching how both cards already express z-index.

**Consequences.** The bottom 2px of the button wins the hit test over the resize handle. The
handle's remaining 90%+ of card width is untouched, so resize-from-bottom still works everywhere
else. `LAYER_5` is below `Z_INDEX_FLOATING_MENU`, so menus/modals still paint over the card.

### ADR-6 — The guard lives in `event-join-url.util.ts`, not in the component

**Context.** Both cards need the guard at render time; the component needs it at click time.
Putting it in `EventJoinIcon.tsx` would make two card modules import a JSX component module for a
pure predicate.

**Decision.** A sibling `*.util.ts` in the same directory, following the existing
`calendar-accent.util.ts` precedent, exporting `isJoinableUrl` and `getJoinableConferenceUrl`.

**Consequences.** One more file. In exchange the guard is unit-testable without rendering, which is
how the `vbscript:` / `file:` / protocol-relative cases get covered cheaply, and the cards' import
graph stays honest.

---

## 11. Risks & non-goals

### Risks

- **R-1 (accepted, recorded, not this run's job) — sibling-branch collision.** Branch
  `CMP-105/opus-plus-flash-v37`, commit `649aea0c`, edits the same bottom-right render region of
  both `TimedEventCard.tsx` and `AllDayEventCard.tsx` and adds cases to `EventCard.test.tsx`. A
  future merge to `main` will conflict in: the card imports block, the derived-state block near
  `showRepeatIcon`, the JSX tail after `{showRepeatIcon && …}`, the all-day title-row `cn` object,
  and the test file. Per Gate 0 and requirements §2.6, **reconciling this is explicitly out of
  scope.** Do not look at that branch; do not pre-emptively restructure to reduce the conflict.
- **R-2 — window/capture-level pointer listeners.** `stopPropagation` on a React handler stops
  propagation to React-root-attached and ancestor-bubble listeners, but cannot stop a listener
  registered in the capture phase on `window`/`document` above the React root. The cards' own
  resize handles rely on exactly this mechanism (`TimedEventCard.tsx:344-347`), which is strong
  evidence it is sufficient here; `onPointerDown` is stopped as well for depth. **Manual
  verification step for Phase 7:** in the running app, mouse-down on the join icon and drag —
  the event must not move and must not become selected.
- **R-3 — drag-clone carries an inert copy of the button.** `createDraftEventMount` clones the card
  node for the drag ghost (`interaction/dom.ts:71-99`). The clone includes the join button, without
  React handlers, so it is decorative and harmless — but it will be visible on the ghost.
- **R-4 — double-click double-open.** Two fast clicks fire `openConference` twice and open two tabs.
  No debounce is specified; adding one is a judgement call better made with real usage.
- **R-5 — 10×10 hit target.** Below the 24×24 minimum of WCAG 2.2 SC 2.5.8. It is dictated by
  ruling 3's "degrade exactly like `EventRepeatIcon`" plus ruling 4's no-widening constraint; a
  larger padded target would push the glyph out of the repeat icon's visual family and eat title
  width. Keyboard activation is the accessible path and is fully supported. Recorded as a known
  a11y debt, not silently ignored.
- **R-6 — extra tab stop per joinable card.** Each conference event now contributes two tab stops
  (card + join button) inside a week grid that can hold dozens. A roving-tabindex scheme for
  in-card controls is the real fix and is a follow-up, not this delta.
- **R-7 — no visible hover affordance.** The glyph looks identical to the decorative repeat icon
  but is clickable. No hover/underline treatment is specified, to stay inside "matches
  `EventRepeatIcon`". Candidate follow-up: a hover tint or the card's `group-hover` opacity idiom.

### Non-goals

- No change to width-gate values or card layout width (binding decision 4).
- No nested `<a href>` (binding decision 1).
- No change to `UpNextCard` or `EventDetailsSection`.
- No provider branching (Meet vs Zoom), no in-app preview, no embedded call UI.
- No change to how `conference` is derived, typed, or persisted — `packages/sync/**`,
  `packages/core/**`, `packages/web/src/common/types/**`, `packages/web/src/events/**` are all
  off-limits and untouched. `conference` never enters a write payload (FR-7); mechanically
  guaranteed here because this run writes nothing outside `grid/components/`.
- `.gitignore` stays untouched (Gate 0).
- No reconciliation with `649aea0c`.

---

## 12. Open issues for the user

No contradiction was found between the binding decisions and the code. Three things worth a
sentence each:

1. **OQ-1 is closed.** Gate 1 kept ruling 1 (`window.open`). ADR-1 records the divergence from the
   repo's two anchor-based Join affordances and every downside it buys, so the decision is
   auditable later. Nothing needed from you.
2. **OQ-3 is closed by binding decision 4** — gates stay at 40 / 60, unchanged. Note that FR-6's
   "the title row's reserved right padding must grow when both icons show" is about the all-day
   card's `pr-*` **content reservation**, not about the **width gate**; growing the padding
   (§7d, `pr-3.5` → `pr-7`) is required by FR-6 and does not violate decision 4. The two are
   different knobs and are easy to confuse when reviewing the diff.
3. **FR-1 wording vs. implementation.** FR-1 says the component is "positioned `absolute
   bottom-0.5`". In this design those classes sit on the wrapping `<button>` rather than on the
   `<svg>` — required by ruling 2 (a real focusable control) and by ADR-4 (nothing but the repeat
   glyph may be an `svg` with a `right-*` class). The rendered geometry is exactly what FR-1
   describes. Flagged only so a reviewer diffing against the requirement text is not surprised.
