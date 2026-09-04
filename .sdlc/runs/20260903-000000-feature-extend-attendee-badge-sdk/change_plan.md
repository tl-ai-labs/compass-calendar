# Change Plan — feature-extend — Attendee avatar badge on grid event cards

Run: `20260903-000000-feature-extend-attendee-badge-sdk`
Intent: `feature-extend` (delta plan — the existing system is not restated)
Baseline: `main@2d81253a`, branch `CMP-105/opus-plus-flash-v37-sdk`
Binding inputs: `requirements.md` (human-approved, not contradicted here) + the Gate 1 rulings
recorded in §3 below.

There is **no `## CONTRACT CONFLICT`** in this plan. Every file this design needs is one of the
eight allowlisted paths. `packages/web/src/grid/grid.constants.ts`,
`packages/core/src/types/event-attendance.contracts.ts` and
`packages/web/src/common/styles/color.utils.ts` are **read from (imported)** but never edited —
importing an off-limits file is not a write.

---

## 1. Delta summary

Two private symbols (`ATTENDEE_STATUS_DOT`, `attendeeStatusLabel`) move out of
`EventDetailsSection.tsx` into a new shared util, which also gains a third pure function
(`attendeeStatusSummary`) that turns an attendee list into a names-free status sentence. A new
presentational `AttendeeBadge` component renders up to three status-coloured dots plus a `+N`
overflow counter, and carries an `sr-only` span holding that sentence. `TimedEventCard` pins the
badge to its bottom-right (left of `EventRepeatIcon`, reserving matching right padding on the
content column so the title and time label can never sit under it); `AllDayEventCard` renders it
inline after the title, `shrink-0`, so the title truncates first. Both cards point
`aria-describedby` at the badge's `sr-only` span — **not** at their own `aria-label`, which stays
byte-identical, so all eleven existing accessible-name queries in `EventCard.test.tsx` keep
resolving with their query lines unedited. A card whose event has no attendees emits zero new DOM
and zero new attributes, and a new guard test in `EventCard.test.tsx` proves it.

Per the Gate 2 ruling, the badge **yields to the time label**: on a timed card narrower than
`MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL` (170px) that is showing a time label, the badge is
dropped and — because the padding reserve is keyed off the same flag — the content column keeps its
full width, so those cards render exactly as they do today. See D-7.

---

## 2. Per-file plan (dependency order)

### 2.1 `packages/web/src/common/utils/attendee-status.util.ts` — NEW

Flat sibling of `app-init.util.ts` / `external-store.util.ts`.

Exported surface — exactly three symbols:

```ts
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>;
export const attendeeStatusLabel: (status: AttendeeResponseStatus) => string;
export const attendeeStatusSummary: (attendees: readonly Attendee[]) => string;
```

Full intended contents:

```ts
import {
  type Attendee,
  type AttendeeResponseStatus,
} from "@core/types/event-attendance.contracts";

/**
 * Single source of truth for the RSVP status -> semantic color token map,
 * shared by the event form's attendee list and the grid card's AttendeeBadge.
 * Values are semantic tokens (index.css), never raw palette utilities.
 */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

// Fixed reporting order so the summary sentence is deterministic regardless of
// the provider's attendee ordering. Not a precedence rule - every non-zero
// status is reported, this only fixes the sequence.
const ATTENDEE_STATUS_SUMMARY_ORDER: readonly AttendeeResponseStatus[] = [
  "accepted",
  "declined",
  "tentative",
  "needsAction",
];

/**
 * Names-free accessible summary of an attendee list, e.g.
 * "3 guests: 2 accepted, 1 hasn't responded".
 *
 * Deliberately carries counts and status words only - no displayName, no
 * email. This text lands in the card's accessible description and therefore
 * in every DOM snapshot; a grid is a shoulder-surfable surface, so no personal
 * identifier goes into it (PII-1 / PII-2).
 *
 * Reads the array without sorting, splicing or reversing it; `attendees` is
 * `readonly` and may be frozen (NFR-6).
 */
export const attendeeStatusSummary = (
  attendees: readonly Attendee[],
): string => {
  if (attendees.length === 0) return "";

  const counts: Partial<Record<AttendeeResponseStatus, number>> = {};
  for (const attendee of attendees) {
    counts[attendee.responseStatus] =
      (counts[attendee.responseStatus] ?? 0) + 1;
  }

  const parts = ATTENDEE_STATUS_SUMMARY_ORDER.filter(
    (status) => (counts[status] ?? 0) > 0,
  ).map((status) => `${counts[status]} ${attendeeStatusLabel(status)}`);

  const noun = attendees.length === 1 ? "guest" : "guests";

  return `${attendees.length} ${noun}: ${parts.join(", ")}`;
};
```

Exact output strings the tests will assert against:

| Input | Output |
|---|---|
| `[]` | `""` |
| 1 × `accepted` | `"1 guest: 1 accepted"` |
| 2 × `accepted`, 1 × `needsAction` | `"3 guests: 2 accepted, 1 hasn't responded"` |
| 1 each of all four (any input order) | `"4 guests: 1 accepted, 1 declined, 1 tentative, 1 hasn't responded"` |

`bg-success` / `bg-error` / `bg-warning` / `bg-text-subtle` are not palette names, so
`check-semantic-colors.ts` does not match them.

---

### 2.2 `packages/web/src/common/utils/attendee-status.util.test.ts` — NEW

Bun test file, no DOM. Imports from `./attendee-status.util`. Cases listed in §4.

---

### 2.3 `packages/web/src/grid/components/AttendeeBadge.tsx` — NEW

Purely presentational. Owns no state, no hooks, no data fetch. Owns the two layout constants
because `grid.constants.ts` is off-limits for writes.

Exported surface — six symbols:

```ts
export const MAX_VISIBLE_ATTENDEE_DOTS: 3;
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE: 140;
export const MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL: 170;
export const ATTENDEE_BADGE_ATTRIBUTE: "data-attendee-badge";
export const hasAttendeesToShow: (
  attendees: readonly Attendee[] | undefined,
) => attendees is readonly Attendee[];
export const AttendeeBadge: (props: AttendeeBadgeProps) => JSX.Element | null;
```

Full prop interface:

```ts
export interface AttendeeBadgeProps {
  /** The event's attendee list. May be undefined (busy projection), [] or frozen. */
  attendees: readonly Attendee[] | undefined;
  /**
   * The card's resolved fill. Only the overflow counter's text color is derived
   * from it (darken 30), matching EventRepeatIcon's tinting so the badge
   * complements the card instead of a fixed white.
   */
  baseColor: string;
  /** Positioning/spacing supplied by the host card. Merged last via `cn`. */
  className?: string;
  /** Id the host card points `aria-describedby` at. Produced by the card's `useId()`. */
  descriptionId: string;
}
```

Full intended contents:

```tsx
import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { darken } from "@web/common/styles/color.utils";
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusSummary,
} from "@web/common/utils/attendee-status.util";

// Three is what fits. A grid card is 140px wide at the badge's own width gate;
// after the card's pl-1.25 (5px), its pr-0.75 (3px) and the 14px EventRepeatIcon
// reserve (right-1 + size 10), the badge's own column is 35px at most: three
// 6px dots (`size-1.5`) + two 2px gaps = 22px, plus a 2px gap and an ~11px
// "+9" counter. A fourth dot pushes that to 43px and eats the all-day card's
// title budget below a readable width. EventDetailsSection's
// MAX_VISIBLE_ATTENDEES = 6 is sized for a 320px form column, not for this.
export const MAX_VISIBLE_ATTENDEE_DOTS = 3;

// Deliberately stricter than the 90px MIN_EVENT_WIDTH_FOR_TIME_LABEL gate: the
// badge costs the timed card up to 56px of reserved right padding, which is
// unaffordable on a very narrow card.
//
// This is NOT DAY_COLUMN_MIN_USABLE_WIDTH (grid.constants.ts:33), which also
// happens to be 140. That constant is the minimum width of a whole day COLUMN
// and is used by week-window.util.ts to decide how many columns fit the track.
// A card is not a column: overlapping events divide a column by
// position.widthMultiplier, so a card is routinely half a column wide. The two
// numbers coincide today by accident, and tying the badge's legibility gate to
// the week's column-count arithmetic would couple two unrelated things - a
// later change to how many columns fit a screen would silently change which
// cards show a badge. Kept local and deliberate, not drift.
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 140;

// Second, higher gate: the width below which the badge YIELDS TO THE TIME
// LABEL rather than coexisting with it. Applies only when the time label is
// actually showing.
//
// Derived from the COMMON label, not the worst case (see D-7 as amended at
// Gate 3). `_cleanStartMeridiem` drops the start meridiem whenever both ends
// share one, so most labels are same-meridiem and short:
//   "9 - 10 AM" ~48px · "10:30 - 11 AM" ~69px
//   "10:30 - 11:45 AM" ~85px  <- same-meridiem worst case, the design point
//   "11:30 AM - 12:45 PM" ~108px <- cross-meridiem outlier, NOT the design point
//
//   pl-1.25 left padding                                         5px
//   "10:30 - 11:45 AM" at 11px                             ~=   85px
//   pr-14 worst-case reserve (badge + repeat icon)               56px
//                                                         -----------
//                                                              146px  -> 150
export const MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL = 150;

// Carries no attendee data - the literal string "true" only (PII-3).
export const ATTENDEE_BADGE_ATTRIBUTE = "data-attendee-badge";

export const hasAttendeesToShow = (
  attendees: readonly Attendee[] | undefined,
): attendees is readonly Attendee[] => (attendees?.length ?? 0) > 0;

export interface AttendeeBadgeProps {
  attendees: readonly Attendee[] | undefined;
  baseColor: string;
  className?: string;
  descriptionId: string;
}

/**
 * Compact RSVP indicator for a grid event card: up to
 * MAX_VISIBLE_ATTENDEE_DOTS status dots plus a "+N" counter.
 *
 * The dots are `aria-hidden` - color alone is not an accessible signal (the
 * rule documented at EventDetailsSection.tsx:72-75). The accessible equivalent
 * is the `sr-only` span below, which the host card references with
 * `aria-describedby`. It is referenced rather than nested-with-a-name because
 * the card is `role="button"`, whose descendants are children-presentational
 * and are pruned from the accessibility tree; an IDREF description is computed
 * from the referenced subtree regardless, and it does not touch the card's
 * accessible NAME.
 *
 * `pointer-events-none` on the root: the badge overlaps the cards' invisible
 * 4.5px resize handles and must stay out of `elementFromPoint` (FR-11 / AC-10).
 */
export const AttendeeBadge = ({
  attendees,
  baseColor,
  className,
  descriptionId,
}: AttendeeBadgeProps) => {
  if (!hasAttendeesToShow(attendees)) return null;

  // slice() copies; the source array is readonly and may be frozen (NFR-6).
  // Provider order is preserved - ranking statuses would invent product
  // semantics, and the sr-only summary reports every attendee anyway.
  const visibleAttendees = attendees.slice(0, MAX_VISIBLE_ATTENDEE_DOTS);
  const overflowCount = attendees.length - visibleAttendees.length;

  return (
    <span
      {...{ [ATTENDEE_BADGE_ATTRIBUTE]: "true" }}
      className={cn(
        "pointer-events-none inline-flex items-center gap-0.5",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {visibleAttendees.map((attendee) => (
          <span
            key={attendee.email}
            className={`size-1.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`}
          />
        ))}
        {overflowCount > 0 && (
          <span
            className="shrink-0 text-[8px] leading-none"
            style={{ color: darken(baseColor, 30) }}
          >
            +{overflowCount}
          </span>
        )}
      </span>
      <span className="sr-only" id={descriptionId}>
        {attendeeStatusSummary(attendees)}
      </span>
    </span>
  );
};
```

Notes the implementer must not "improve":

- **No `title` attribute anywhere.** The root is `pointer-events-none`, so a native tooltip can
  never fire. A dead `title` would be misleading, not a second signal.
- **No organizer prop.** The summary contains no names, so organizer identity is never needed.
- `key={attendee.email}` mirrors `EventDetailsSection.tsx:79`. React keys are never serialised to
  the DOM, so this is not a PII-3 violation. Do not move the email into an attribute.
- `text-[8px]` is an arbitrary value, not a palette utility — `check-semantic-colors.ts` does not
  match it.

---

### 2.4 `packages/web/src/grid/components/AttendeeBadge.test.tsx` — NEW

`@testing-library/react` + `bun:test` + `@testing-library/jest-dom`, same header shape as
`EventCard.test.tsx`. Cases listed in §4.

---

### 2.5 `packages/web/src/grid/components/TimedEventCard.tsx` — EDIT (5 surgical hunks)

**Hunk 1 — react import (current lines 2-9).** Add `useId,` immediately before `useMemo,`:

```ts
import {
  type CSSProperties,
  type ForwardedRef,
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
  useId,
  useMemo,
} from "react";
```

**Hunk 2 — local import.** Insert immediately BEFORE the existing
`import { EventRepeatIcon } from "./EventRepeatIcon";` (current line 49) so relative-import order
stays alphabetical:

```ts
import {
  AttendeeBadge,
  hasAttendeesToShow,
  MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE,
  MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL,
} from "./AttendeeBadge";
```

**Hunk 3 — gating.** Immediately AFTER the existing
`const isCompactEvent = position.height <= COMPACT_EVENT_MAX_HEIGHT;` (current line 206), insert:

```ts
  const attendeeDescriptionId = useId();
  // The badge YIELDS TO THE TIME LABEL. The label is nowrap and the card is
  // overflow-hidden, so the badge's 40-56px reserve would clip a long range
  // like "11:30 AM - 12:45 PM" on a card that renders it fine today. Below
  // MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL the badge is dropped entirely -
  // which, because the pr-10/pr-14 reserve in hunk 4b is keyed off this same
  // flag, also means the reserve is not applied and the content column keeps
  // its full width. Suppressing the dots while still reserving the space would
  // shrink the column for nothing and fix nothing.
  //
  // The gate is a CONJUNCTION, not a raised floor: it binds only when the time
  // label is actually showing. A short card with no time label (height < 36)
  // still shows the badge from 140px up.
  //
  // Also suppressed on compact cards for the same reason the time label is: at
  // <= 15px the title is already a single cramped 10px line. On any suppressed
  // card the attendee list is still one click away in the event form - the grid
  // card is a summary surface.
  const showAttendeeBadge =
    !isPlaceholder &&
    !isCompactEvent &&
    position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE &&
    (!showTimeLabel ||
      position.width >= MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL) &&
    hasAttendeesToShow(event.attendees);
```

(`showTimeLabel` is already declared at current line 122, well above this
insertion point, so the reference resolves. `AllDayEventCard` needs no
equivalent — it has no time label.)

(`useId` is called unconditionally and this component has no early return, so hook order is
stable.)

**Hunk 4 — root div + content wrapper.** Two edits inside the returned JSX.

4a. On the root `<div>`, insert `aria-describedby` immediately BEFORE the existing
`aria-label={accessibleLabel}` (current line 274):

```tsx
      aria-describedby={showAttendeeBadge ? attendeeDescriptionId : undefined}
      aria-label={accessibleLabel}
```

When `showAttendeeBadge` is false React omits the attribute entirely, so a no-attendee card's root
element is unchanged (AC-13). **The `aria-label` expression itself is not touched.**

4b. The content wrapper (current lines 321-325) changes its className from a bare string to a `cn`
call. `cn` is already imported at line 1.

```tsx
      <div
        className={cn("flex flex-col flex-wrap items-start", {
          "pr-10": showAttendeeBadge && !showRepeatIcon,
          "pr-14": showAttendeeBadge && showRepeatIcon,
        })}
        style={{ color: contentColor }}
        {...{ [EVENT_CONTENT_ATTRIBUTE]: "true" }}
      >
```

With both keys false, `classnames` returns exactly `"flex flex-col flex-wrap items-start"` — the
class attribute is byte-identical to today. The reserve is what makes overlap impossible by
construction rather than by luck: the badge's own column is at most 35px wide, sitting at `right-1`
(4px) alone or `right-4` (16px) alongside the repeat icon; adding back the root's `pr-0.75` (3px)
gives 36px / 48px of required reserve, rounded up to `pr-10` (40px) / `pr-14` (56px). The title and
the time label therefore never enter the badge's column and never need to be truncated by it.

**Hunk 5 — render the badge.** Insert as a sibling of, and immediately AFTER,
`{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}` (current line 363), still inside the
root `<div>` and still before its closing `</div>`:

```tsx
      {showAttendeeBadge && (
        <AttendeeBadge
          attendees={event.attendees}
          baseColor={bgColor}
          className={cn(
            "absolute bottom-0.5",
            showRepeatIcon ? "right-4" : "right-1",
          )}
          descriptionId={attendeeDescriptionId}
        />
      )}
```

The badge is a direct child of the ROOT, not of the `data-calendar-event-content` wrapper, so
`grid/interaction/dom.ts`'s `getFirstDirectResizeHandle` (which walks the content wrapper's direct
children) is unaffected and the draft-clone time-label insertion point does not move.

Geometry check, `position = { width: 140, height: 60 }`, repeat icon shown: repeat icon occupies
`right 4 .. 14px`, badge occupies `right 16 .. 51px` — a 2px gap, no overlap (FR-10). Both sit at
`bottom-0.5`, badge 6px tall vs icon 10px tall, same row. Content column = 140 − 5 (`pl-1.25`) − 56
(`pr-14`) = 79px for the title.

Note that at `height: 60` this particular card **does** render a time label (60 ≥ 36), so under D-7
it is inside the 140–169px yield band and shows **no** badge at all — the 79px figure above is the
geometry for a 140px card that has no time label (`height` under 36). The narrowest card that shows
both a badge and a time label is 170px, where the content column is 170 − 5 − 56 = 109px, which is
1px more than the ~108px widest realistic label needs. That is the honest cost of the badge.

---

### 2.6 `packages/web/src/grid/components/AllDayEventCard.tsx` — EDIT (4 surgical hunks)

**Hunk 1 — react import (current lines 2-8).** Add `useId,` after `type MouseEvent,`:

```ts
import {
  type CSSProperties,
  type ForwardedRef,
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
  useId,
} from "react";
```

**Hunk 2 — local import.** Insert immediately BEFORE
`import { EventRepeatIcon } from "./EventRepeatIcon";` (current line 30):

```ts
import {
  AttendeeBadge,
  hasAttendeesToShow,
  MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE,
} from "./AttendeeBadge";
```

**Hunk 3 — gating.** Immediately AFTER the existing `showRepeatIcon` declaration (current lines
76-77), insert:

```ts
  const attendeeDescriptionId = useId();
  // No compact gate here - the all-day row is a fixed 20px
  // (EVENT_ALLDAY_HEIGHT) and a 6px dot row fits. Only the width gate applies,
  // because the badge shares the single flex row with the title.
  const showAttendeeBadge =
    !isPlaceholder &&
    position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE &&
    hasAttendeesToShow(event.attendees);
```

**Hunk 4a — root div.** Insert `aria-describedby` immediately BEFORE the existing
`aria-label={accessibleLabel}` (current line 147). Identical expression to TimedEventCard's:

```tsx
      aria-describedby={showAttendeeBadge ? attendeeDescriptionId : undefined}
      aria-label={accessibleLabel}
```

**Hunk 4b — render the badge inline.** Inside the existing content row
(`<div className={cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon })}>`, current lines
187-192), insert immediately AFTER the title `</span>` (current line 199) and BEFORE that div's
closing `</div>` (current line 200):

```tsx
        {showAttendeeBadge && (
          <AttendeeBadge
            attendees={event.attendees}
            baseColor={bgColor}
            className="ml-1"
            descriptionId={attendeeDescriptionId}
          />
        )}
```

**The content row's own className is NOT changed.** The badge is inline inside the row, so the
existing `pr-3.5` repeat-icon reserve already keeps it clear of the bottom-right icon (FR-10). The
badge is `shrink-0` (inherited from its `inline-flex` root's non-shrinking children plus the
explicit `shrink-0` on each dot) and the title span keeps `min-w-0 truncate`, so **the title
truncates and the badge never gets pushed out or wrapped**. At 140px: 140 − 5 − 3 − 14 = 118px for
the row, badge takes at most 4 (`ml-1`) + 35 = 39px, leaving 79px of title.

The badge sits close to the card's right edge, which is where the `endDate` resize handle's
full-height 4.5px strip is. `pointer-events-none` on the badge root means `elementFromPoint` never
returns it, so the handle stays exactly as hit-testable as it is today — no better, no worse
(FR-11 / AC-10).

---

### 2.7 `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` — EDIT (3 hunks)

**Hunk 1 — delete the now-unused type import.** `AttendeeResponseStatus` is referenced only at
lines 12 and 19, both of which are being deleted; leaving the import in will fail biome's
unused-import rule. Delete current line 4 in full:

```ts
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";
```

**Hunk 2 — add the util import.** Insert after the remaining
`import { type EventContent } from "@core/types/event.contracts";` (current line 3):

```ts
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "@web/common/utils/attendee-status.util";
```

**Hunk 3 — delete the two local declarations.** Remove current lines 12-20 in full (the
`ATTENDEE_STATUS_DOT` object literal, the blank line, and the `attendeeStatusLabel` arrow), leaving
`const MAX_VISIBLE_ATTENDEES = 6;` as the first declaration after the imports.

**Nothing else in this file changes.** The JSX at lines 76 and 86 already calls
`attendeeStatusLabel(...)` and indexes `ATTENDEE_STATUS_DOT[...]` by those exact names, so the
rendered output is identical and `EventForm.test.tsx` (off-limits, unedited) stays green — that
untouched-and-green state IS the enforcement of AC-4.

---

### 2.8 `packages/web/src/grid/components/EventCard.test.tsx` — EDIT (append only)

**Zero edits to any existing line.** Specifically: none of the eleven accessible-name queries
(lines 75, 165, 193, 215, 263, 367, 457, 477 exact strings; 509, 541, 569 regexes) is touched, and
neither is the `svg[class*="right-1"]` family (279, 307, 326, 342, 430) or the resize-handle
assertions (84-87, 374-384).

Two additions only:

1. **New import**, appended to the existing import block after
   `import { TimedEventCard } from "./TimedEventCard";` — reordered by biome to keep `./AttendeeBadge`
   first among the relative imports:
   `import { ATTENDEE_BADGE_ATTRIBUTE } from "./AttendeeBadge";`
2. **New helper + new `it(...)` blocks appended inside the existing `describe("EventCard", ...)`**,
   after the final existing test (current line 574) and before the closing `});`.

Shared helper to append (placed just above the first new test):

```ts
  const attendee = (
    email: string,
    responseStatus: "accepted" | "declined" | "needsAction" | "tentative",
    displayName: string | null = null,
  ) => ({ displayName, email, responseStatus });

  const futureEvent = (overrides: Partial<GridEvent> = {}) =>
    createEvent({
      startDate: "2099-01-15T09:00:00.000Z",
      endDate: "2099-01-15T10:00:00.000Z",
      ...overrides,
    });

  const badgeDescriptionOf = (card: HTMLElement) => {
    const id = card.getAttribute("aria-describedby");
    return id === null ? null : document.getElementById(id)?.textContent ?? null;
  };
```

`badgeDescriptionOf` is the **exact mechanism every accessible-text assertion in this file uses**.
Do not substitute `toHaveAccessibleDescription` — `@types/testing-library__jest-dom` is pinned at
`^5.9.1` and does not declare that matcher, so it will not typecheck.

Test cases listed in §4.

---

## 3. Key decisions (ADR-style)

### D-1 — Accessible text attaches via `aria-describedby` from the card root to an `sr-only` span inside the badge

**Decision.** The badge renders `<span class="sr-only" id={descriptionId}>{summary}</span>`. Each
card computes `const attendeeDescriptionId = useId()` and sets
`aria-describedby={showAttendeeBadge ? attendeeDescriptionId : undefined}` on its root. The card's
`aria-label` expression is not modified in any way.

**Why this and not "a nested element with its own accessible name".** Gate 1 ruled option (b) — a
nested element carrying its own accessible name — and this is the only form of (b) that actually
works. The naive form (`<span role="img" aria-label="...">` inside the card) is a trap: the card is
`role="button"`, and `button` is defined **children-presentational**, so real assistive tech prunes
the entire descendant subtree from the accessibility tree. That nested name would be findable by
`getByRole("img", { name })` in tests — `dom-accessibility-api` does not implement the
children-presentational prune — and simultaneously invisible to a screen reader user. A test that
passes while the feature is broken is worse than no test.

`aria-describedby` escapes the prune: an IDREF description is computed from the referenced subtree
by the description algorithm, independent of whether that subtree is rendered presentational as a
child of the button. The button is announced as "*Timed event: Planning block, 9 - 10 AM, button*"
followed by its description, "*3 guests: 2 accepted, 1 hasn't responded*". It is a nested element
with its own accessible text, referenced rather than inferred.

**And it cannot alter the card's name.** Name computation (`aria-labelledby` → `aria-label` →
content) never consults `aria-describedby`. `aria-label` wins, unchanged, byte for byte.

**Exact test query for the badge's status text:**

```ts
const card = screen.getByRole("button", {
  name: "Timed event: Planning block, 9 - 10 AM",
});
expect(badgeDescriptionOf(card)).toBe("3 guests: 2 accepted, 1 hasn't responded");
```

i.e. resolve the card by its unchanged name, read `aria-describedby`, resolve that id with
`document.getElementById`, compare `textContent`. Presence of the badge element itself is asserted
separately with `card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)`.

**Alternatives rejected.** (a) fold into `aria-label` — breaks all eleven name queries plus
`AllDayGridRow.test.tsx`, which is not in the allowlist; explicitly forbidden by Gate 1.
(c) `title` + `aria-hidden` only — fails AC-5, and is unreachable anyway on a
`pointer-events-none` element.

**Consequence.** Adding `aria-describedby` to the card root is a new root attribute — which is why
it is conditional on `showAttendeeBadge`, and why AC-13's guard asserts the exact attribute-name
set of a no-attendee card root. Also note `createDraftEventClone` (`interaction/dom/draft-event.clone.ts`
lines 5-9) already strips `id` and `aria-describedby` from every node of the drag ghost, so the
clone introduces no duplicate ids and no dangling reference. That is luck we get to keep, not
something to rely on silently — it is asserted nowhere and is called out in §5.

### D-2 — Per-attendee dots, capped at `MAX_VISIBLE_ATTENDEE_DOTS = 3`, overflow as `+N`

**Decision.** Render `attendees.slice(0, 3)` as 6px (`size-1.5`) dots with 2px (`gap-0.5`) gaps, in
**provider order, unsorted**. If `attendees.length > 3`, append a `+N` counter (`text-[8px]`) where
`N = attendees.length - 3`. The `sr-only` summary always reports **all** attendees, capped or not.

**Why 3.** Worst-case badge width = 3 × 6px + 2 × 2px gaps + 2px gap + ~11px `"+9"` = **35px**. The
binding surface is the all-day card, where the badge is inline and competes with the title: at the
140px width gate the row has 140 − 5 (`pl-1.25`) − 3 (`pr-0.75`) − 14 (`pr-3.5` repeat reserve) =
118px; the badge takes 39px with its `ml-1`, leaving 79px ≈ 13 characters of `text-xs` title. A
fourth dot costs another 8px and drops that to ~11 characters. On the timed card the same 35px sets
the `pr-10` / `pr-14` content reserve; a fourth dot would push the reserve past `pr-14` and cut the
title column below 70px on a 140px card. `EventDetailsSection`'s `MAX_VISIBLE_ATTENDEES = 6` is
sized for a ~320px form column with a `+N more` **button**; a grid card has neither the width nor
anywhere to put an interactive control (FR-11 forbids one).

**Why not a single aggregate dot.** Gate 1 ruled per-attendee dots. An aggregate needs a precedence
rule ("declined beats tentative beats…") that this repo has never stated — inventing one is
inventing product semantics, and it destroys information the user can see at a glance today in the
form.

**Why unsorted.** Same reason: any ordering is a precedence rule. `slice` copies, so NFR-6 is
satisfied for free and AC-12 passes trivially.

**Consequence.** With 12 attendees the card shows 3 dots + `+9` and the description says
`"12 guests: 7 accepted, 5 hasn't responded"` — the dots are a sample, the description is complete.
This asymmetry is intentional and is asserted by a test.

### D-3 — Placement: bottom-right on the timed card (left of the repeat icon), inline-after-title on the all-day card

**Decision.** Timed: `absolute bottom-0.5` + `right-1` alone / `right-4` alongside the repeat icon,
as a direct child of the card root, **paired with a `pr-10` / `pr-14` reserve on the content
wrapper**. All-day: inline `shrink-0` element in the existing content flex row, immediately after
the title span, with `ml-1`.

**Why not top-right on the timed card.** Q-4 flagged the `startDate` handle overlap, but that is a
non-issue (`pointer-events-none`, see D-4). The real blocker is the title: it starts at the card's
top-left and wraps across the full width with `WebkitLineClamp` up to 3 lines, so a top-right badge
lands on top of it on every card with a title longer than one line.

**Why not bottom-left on the timed card.** The time label lives at the bottom-left of the content
column (`showTimeLabel`, 11px, `whiteSpace: nowrap`). On a 36px-tall card the label's line box and a
bottom-pinned badge occupy overlapping pixels at the same x-origin.

**Why the reserve, not just a corner.** Pinning without reserving is how overlap bugs happen: an
absolutely positioned element does not remove space from the flow. `AllDayEventCard` already solved
exactly this for `EventRepeatIcon` with `pr-3.5` ("Reserve room so a long title truncates before the
bottom-right icon", line 189-190). The timed card copies that pattern. This is why the answer to
"the badge competes horizontally with the title and with `EventRepeatIcon`" is: **it does not
compete — it is allocated a column, and the title's box shrinks to match.**

**Why inline on the all-day card.** The all-day card is a fixed 20px-tall single flex row with the
title vertically centred. An absolutely positioned badge would sit on top of that text no matter
which corner it took. Inline + `shrink-0` next to a `min-w-0 truncate` title is the standard,
already-used solution.

**Consequence.** Two different placements for one component, which is why `AttendeeBadge` takes a
`className` and owns no positioning of its own.

### D-4 — Non-hit-testable: `pointer-events-none` on the badge root

**Decision.** The badge root always carries `pointer-events-none`. It has no `role`, no `tabIndex`,
no handlers, no `title`.

**Rationale.** Both cards' resize handles are invisible 4.5px strips with `zIndex: LAYER_4` and
`opacity: 0`; the timed card's are full-width at top and bottom, the all-day card's full-height at
left and right. The badge sits at `bottom-0.5` (timed) and near the right edge (all-day), i.e.
inside those strips. `pointer-events-none` removes the badge from `elementFromPoint` entirely,
regardless of stacking order, so `getResizeHandleEdge`'s `closest("[data-calendar-event-resize-handle]")`
resolves exactly as it does today. `EventRepeatIcon` already establishes this precedent — it has sat
at `bottom-0.5` over the `endDate` strip since it was introduced, with `pointer-events-none`.

The known pre-existing `endDate` `elementFromPoint` failure on ~30% of cards is neither fixed nor
worsened; it is out of scope, and the badge is invisible to hit-testing so it cannot contribute.

**Alternative rejected.** Giving the badge an interactive role (a `<button>` opening the attendee
list) — FR-11 allows it only with a story for handle reachability, and there is no such story on a
6px target inside a 4.5px strip.

### D-5 — PII: the badge renders counts and status words only. No names. No emails. Anywhere.

**Decision, made explicitly rather than inherited from `EventDetailsSection.tsx:70`:**

- The always-visible card text contains **no attendee-derived text at all** except the `+N` integer.
- The `sr-only` accessible description contains **counts and status words only** —
  `"3 guests: 2 accepted, 1 hasn't responded"`. It does **not** use `displayName ?? email`.
- There is no `title` tooltip.
- The only new `data-*` attribute is `data-attendee-badge="true"`, a literal (PII-3).
- `key={attendee.email}` is used for React reconciliation. React keys are never serialised to the
  DOM; a test asserts the email is absent from `card.outerHTML`, which covers this.

**Why stricter than PII-2 permits.** PII-2 permits `displayName ?? email` inside an accessible name
or tooltip. We decline that permission on this surface. The `sr-only` span's text is part of
`element.textContent` and therefore appears verbatim in every DOM snapshot, error report and
testing-library `prettyDOM` dump — a grid renders dozens of cards at once, so one screenshot or one
failing-test dump would expose an entire week of attendee names. The form is opened one event at a
time and is already the place to read names; the grid answers "how many, and are they in?" only.

**Consequence.** A screen-reader user hears counts, not who. That is a deliberate, stated
information trade, not an oversight.

### D-6 — Byte-identity guard (AC-13): exact root attribute-name set + exact content-wrapper class + badge-marker absence + a sensitivity control

**Decision.** For each card, one test that:

1. Renders the card with **no `attendees` key at all**, captures `container.innerHTML` as `baseline`,
   and `unmount()`s.
2. Renders the same card with `attendees: undefined`, asserts `container.innerHTML === baseline`,
   unmounts.
3. Renders the same card with `attendees: []`, asserts `container.innerHTML === baseline`, unmounts.
4. Asserts the no-attendee card root's attribute-name set is **exactly**
   `["aria-label", "class", "role", "style", "tabindex"]` (sorted). This is the assertion that fails
   if `aria-describedby` leaks.
5. Asserts the content wrapper's `class` attribute is **exactly** the pre-change string —
   `"flex flex-col flex-wrap items-start"` (timed) / `"flex min-w-0 items-center"` (all-day). This is
   the assertion that fails if the `pr-10` / `pr-14` reserve is applied unconditionally.
6. Asserts `baseline` does not contain the substrings `data-attendee-badge`, `aria-describedby` or
   `sr-only`.
7. **Sensitivity control:** renders the same card with one attendee and asserts
   `container.innerHTML !== baseline`. Without this, steps 2-6 could all pass against a badge that
   never renders at all, and the guard would be a test that cannot fail.

**Why not a frozen `innerHTML` literal checked into the test.** That is the only true byte-for-byte
guard, and it was considered and rejected: the literal must be seeded from a real run of the
pre-change component, which a codegen worker cannot do reliably and will instead invent — producing
either a false-green (literal written from post-change output) or a permanently red test. It would
also go stale on any unrelated card change, converting every future card edit into a
change-detector failure.

**What this mechanism catches:** every way the badge can leak onto a no-attendee card — a stray
wrapper element, an unconditional `aria-describedby`, an unconditional padding reserve, an
`AttendeeBadge` that returns an empty `<span>` instead of `null` for `[]`, and a divergence between
the `undefined`, missing-key and `[]` paths.

**What it cannot catch — stated plainly:** a change to a surface this delta does not touch. If the
implementer also altered, say, the title span's inline `style` or the resize handles' `scalerStyle`,
steps 4-6 would not notice; only steps 1-3's mutual `innerHTML` equality would, and only if the
three attendee shapes diverged. It is a targeted guard on the three surfaces this change modifies,
plus proof that the guard is live — not a universal snapshot.

### D-7 — The badge yields to the time label below `MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL = 170`

**Decision (Gate 2 ruling).** On `TimedEventCard` the badge is suppressed when `showTimeLabel` is
true **and** `position.width < 170`. Because the `pr-10` / `pr-14` content reserve in §2.5 hunk 4b
is keyed off the same `showAttendeeBadge` flag, suppression drops the reserve too: such a card
renders **exactly as it does today**, with the full content column and a byte-identical content
wrapper class.

**The regression this fixes.** The reserve is real estate taken from the content column. At the
badge's own 140px gate the column becomes 140 − 5 (`pl-1.25`) − 56 (`pr-14`) = **79px**, while the
time label is `whiteSpace: "nowrap"` inside an `overflow-hidden` card and shows from 90px up. A
long cross-meridiem range measures ~108px, so a card between 140px and ~170px that has attendees
and a long range would have had its time label silently clipped — a surface that renders correctly
today. No test in the original §4 would have caught it.

**Why a conjunction rather than simply raising `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` to 170.**
The conflict is with the *label*, not with width as such. A card at 150px whose height is under
`MIN_EVENT_HEIGHT_FOR_TIME_LABEL` (36) shows no label, has the whole column to itself, and can
afford the badge. Raising the single floor would suppress the badge on those cards for no reason.

**Why the badge yields and not the label.** The time label answers "when", which is the grid's
primary job and is not available anywhere else on the card. The badge answers "who/how many",
which is one click away in the event form. When only one fits, the one with no alternative wins.

**Derivation of 170** — shown in full in the constant's comment in §2.3: 5px left padding + ~108px
widest realistic label + 56px worst-case reserve = 169, rounded to 170. One constant covers both
reserve sizes; on a non-recurring card (`pr-10`, 40px) the exact threshold would be 153px, so cards
between 153 and 170 are suppressed marginally more eagerly than strictly required. That is a
deliberate simplification, recorded so it is not later mistaken for an arithmetic slip.

**Consequence.** There are now three distinct timed-card regimes, all asserted in §4: below 140px
no badge; 140–169px with a label, no badge and no reserve (identical to today); 170px+ badge and
label coexist. Plus the label-less path, where 140px+ shows the badge regardless of width.

---

### D-7a — Gate 3 amendment: the threshold is lowered 170 → 150, derived from the COMMON label

**Why the original 170 was wrong.** It was sized against the cross-meridiem outlier
`"11:30 AM - 12:45 PM"` (~108px). But `_cleanStartMeridiem` (`web.date.util.ts:277-284`) strips the
start meridiem whenever both ends share one, so that shape is the *exception*; the common label is
`"9 - 10 AM"` (~48px), `"10:30 - 11 AM"` (~69px), or at worst same-meridiem `"10:30 - 11:45 AM"`
(~85px). Sizing the gate for the exception penalised every ordinary event.

**The defect that exposed it (R-6).** `computeVisibleDayCount` is
`floor((track − GRID_MARGIN_LEFT 50) / DAY_COLUMN_MIN_USABLE_WIDTH 140)` capped at 7, so column
width is pinned inside the 140–170 band at every column count until the 7-column cap is reached. A
1440px laptop with a sidebar lands near **163px** — under the old gate, no timed card there ever
cleared 170.

**Corrected characterisation (this replaces the "never appears" wording used at Gate 3, which was
overstated).** The gate is a conjunction and `showTimeLabel` additionally requires
`height >= MIN_EVENT_HEIGHT_FOR_TIME_LABEL (36)` and a non-past event. So at ~163px the badge *did*
still show on cards under 36px tall (a 30-minute event at typical zoom) and on past events. The real
defect was **inconsistency**: a 30-minute meeting showed a badge while the 60-minute meeting below
it in the same column did not. That is a worse failure mode than the clipping the gate was
protecting against, and it is the actual argument for lowering it.

**New derivation** — same shape as the original, common label substituted for the outlier:
`5px (pl-1.25) + 85px (same-meridiem worst case) + 56px (pr-14 reserve) = 146px`, rounded up to
**150** for font-metric margin.

**New band boundaries** (computed, `pr-14` worst case; content column = `width − 61`):

| Card width | Behaviour |
|---|---|
| < 140 | No badge at all (the floor governs). Unchanged. |
| 140–149 | Time label showing → no badge, no reserve, card renders exactly as today. No label (height < 36) → badge shows. |
| 150–168 | Badge and label coexist. Labels up to `width − 61`px fit: 89px at 150, **102px at the 163px laptop column**. The ~108px cross-meridiem outlier clips. |
| ≥ 169 | Every label shape fits, including the cross-meridiem outlier. |

**Accepted trade, stated plainly.** Between 140 and 168 a cross-meridiem range with minutes on both
ends is clipped by the card's `overflow-hidden`. That is one label shape — it needs the meeting to
straddle noon or midnight *and* both ends to carry minutes. Same-meridiem labels, which are the
majority, fit from 146px up. The user accepted this trade at Gate 3 in exchange for the badge
appearing consistently.

**Is the 140 floor still right?** Yes, and it is unchanged. The floor is about whether the ~35px
badge column is affordable at all, not about the label: at 140 the content column is still 79px,
enough for a clamped title. The two constants now sit 10px apart, so the label gate binds only in
that narrow band — which is exactly what C-18 and C-20 pin.

**Test consequences (§4).** C-18 moved 150 → **145** (150 is now *on* the gate, so the case would
have inverted rather than failed). C-20 moved 150 → **145** for the same reason — at 150 the gate no
longer binds, so it would have stopped proving the conjunction. New **C-21** renders at the real
163px column width with a time label and asserts the badge is present: the direct regression test
for R-6. Re-verified by mutation testing after the change (see §4 note).

---

## 4. Test plan

### `packages/web/src/common/utils/attendee-status.util.test.ts` (new)

| # | Case | Assertion |
|---|---|---|
| U-1 | `ATTENDEE_STATUS_DOT` map | `toEqual({ accepted: "bg-success", declined: "bg-error", tentative: "bg-warning", needsAction: "bg-text-subtle" })` |
| U-2 | `attendeeStatusLabel("needsAction")` | `toBe("hasn't responded")` |
| U-3 | `attendeeStatusLabel` for `accepted` / `declined` / `tentative` | returns the status string itself |
| U-4 | `attendeeStatusSummary([])` | `toBe("")` |
| U-5 | one accepted attendee | `toBe("1 guest: 1 accepted")` (singular noun) |
| U-6 | 2 accepted + 1 needsAction | `toBe("3 guests: 2 accepted, 1 hasn't responded")` |
| U-7 | all four statuses supplied in reverse order | `toBe("4 guests: 1 accepted, 1 declined, 1 tentative, 1 hasn't responded")` — order is fixed by the module, not by input |
| U-8 | `Object.freeze([...])` input | no throw, and `toBe` the expected string |
| U-9 | summary contains no PII | `expect(summary).not.toContain("@")` for a fixture whose attendees all have emails and display names |

### `packages/web/src/grid/components/AttendeeBadge.test.tsx` (new)

| # | Case | Assertion |
|---|---|---|
| B-1 | `attendees={undefined}` | `expect(container.firstChild).toBeNull()` |
| B-2 | `attendees={[]}` | `expect(container.firstChild).toBeNull()` |
| B-3 | 2 attendees | exactly 2 elements match `[class*="rounded-full"]`; no `+` counter text |
| B-4 | dot colours | the two dot elements' `class` contains `bg-success` and `bg-error` respectively |
| B-5 | 5 attendees | exactly `MAX_VISIBLE_ATTENDEE_DOTS` (3) dots rendered, and `getByText("+2")` resolves |
| B-6 | description text | `document.getElementById(descriptionId)?.textContent` equals the `attendeeStatusSummary` string for **all 5**, not the visible 3 |
| B-7 | frozen input | `Object.freeze([...])` renders without throwing (AC-12) |
| B-8 | no mutation | the input array reference is `toEqual` its pre-render copy after render |
| B-9 | non-hit-testable | badge root `class` contains `pointer-events-none` |
| B-10 | no PII in DOM | fixture attendee `{ email: "secret@example.com", displayName: "Ada" }`; `expect(container.innerHTML).not.toContain("secret@example.com")` **and** `.not.toContain("Ada")` |
| B-11 | marker attribute | badge root has `data-attendee-badge="true"` and no other `data-*` |

### `packages/web/src/grid/components/EventCard.test.tsx` (appended)

| # | Case | Assertion |
|---|---|---|
> **Width requirement for every timed-card case that expects a badge (added after the first test
> run).** The shared `position` fixture in `EventCard.test.tsx` is `{ width: 140, height: 60 }`.
> At height 60 the card renders a time label, so under D-7 the badge is **correctly suppressed**
> at width 140. Every timed-card case below that expects a badge to be present must therefore use
> a widened position — `const badgePosition = { ...position, width: 190 }` — or a height under
> `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` (36). This applies to **C-1, C-3, C-11, C-15 and C-16**.
> All-day cases (C-2, C-5, C-7, C-9, C-17) are unaffected: that card has no time label and its
> gate stays at 140.
>
> This was a defect in the Gate 2 amendment of this plan: D-7 and C-18/19/20 were added without
> reconciling the pre-existing C-cases against the new threshold. It was caught by D-6 step 7,
> the sensitivity control — C-16 failed because the attendee-bearing render came out byte-identical
> to the no-attendee baseline, which is exactly the "guard that cannot fail" condition step 7
> exists to detect.

| C-1 | timed card, 1 accepted attendee, at `badgePosition` (190×60) | `card.querySelector("[data-attendee-badge]")` is not null |
| C-2 | all-day card, 1 accepted attendee | same, on `AllDayEventCard` |
| C-3 | timed card, 2 accepted + 1 needsAction | `badgeDescriptionOf(card)` === `"3 guests: 2 accepted, 1 hasn't responded"` |
| C-4 | card name unchanged with a badge present | `screen.getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM" })` resolves on a card **with** attendees; and `expect(card.getAttribute("aria-label")).toBe("Timed event: Planning block, 9 - 10 AM")` |
| C-5 | all-day name unchanged with a badge present | `screen.getByRole("button", { name: "All-day event: Conference" })` resolves with attendees present |
| C-6 | timed `attendees: undefined` and `attendees: []` | render does not throw; `card.querySelector("[data-attendee-badge]")` is null; `card).not.toHaveAttribute("aria-describedby")` |
| C-7 | all-day `attendees: undefined` and `[]` | same |
| C-8 | resize handles survive a badge | render a timed card **with** attendees, `document.querySelectorAll("[data-calendar-event-resize-handle]")` has length 2 and both `fireEvent.mouseDown` calls reach `onScalerMouseDown` with `"startDate"` / `"endDate"` |
| C-9 | all-day resize handles survive a badge | same on `AllDayEventCard` |
| C-10 | no email in card DOM | attendee `{ email: "secret@example.com", displayName: "Ada Lovelace" }`; `expect(card.outerHTML).not.toContain("secret@example.com")` and `.not.toContain("Ada Lovelace")` |
| C-11 | badge does not displace the repeat icon | recurring event **with** attendees: `container.querySelector('svg[class*="right-1"]')` is not null AND the badge root's class contains `right-4` (timed) |
| C-12 | compact timed card suppresses the badge | `position: { ...position, height: COMPACT_EVENT_MAX_HEIGHT }` with attendees → no `[data-attendee-badge]`, no `aria-describedby` |
| C-13 | narrow card suppresses the badge | `position: { ...position, width: 90 }` with attendees → no `[data-attendee-badge]`, on both cards |
| C-14 | frozen attendees on a card | `attendees: Object.freeze([...])` renders without throwing, on both cards |
| C-15 | overflow cap on a card | 12 attendees → exactly 3 dots and `getByText("+9")`; `badgeDescriptionOf(card)` reports all 12 |
| C-16 | **byte-identity guard, timed** | the 7-step mechanism in D-6 against `TimedEventCard` |
| C-17 | **byte-identity guard, all-day** | the 7-step mechanism in D-6 against `AllDayEventCard` |
| C-18 | **time-label regression band — badge yields (D-7)** | Timed card, `position: { ...position, width: 150, height: 60 }`, attendees present, `startDate`/`endDate` chosen so `getTimesLabel` returns the long cross-meridiem range `"11:30 AM - 12:45 PM"` (e.g. `2099-01-15T11:30` → `2099-01-15T12:45` local). Assert **all three**: (a) `card.querySelector("[data-attendee-badge]")` is null; (b) the time label element `[data-calendar-event-time-label]` is present and its `textContent` is the **full** `"11:30 AM - 12:45 PM"`; (c) the content wrapper's `class` attribute is **exactly** `"flex flex-col flex-wrap items-start"` — i.e. neither `pr-10` nor `pr-14` was applied. (c) is the assertion that fails if someone hides the dots but keeps the reserve. |
| C-19 | **above the threshold they coexist (D-7)** | Same event and same long range, `width: 170`. Assert the badge **is** present AND the time label is present with the full text. This is C-18's sensitivity control: without it, C-18 passes trivially against a badge that never renders at any width. |
| C-21 | **badge shows at a real Week column width (R-6 / D-7a)** | `width: 163, height: 60` — the column width a 1440px laptop with a sidebar actually produces — with attendees and a time label showing. Assert the time label element is present (so the conjunction's binding branch is the one under test) AND `expectBadge(card)`. This is the direct regression test for R-6: it fails against the pre-amendment 170 gate. |

> **Mutation-verified after the D-7a gate change.** Moving a threshold can silently push a width
> fixture onto the wrong side and re-vacuate the guards that R-1 was about. Re-proved by temporarily
> making `AttendeeBadge` return `null`: **12 cases fail**, including C-10 (the PII guard), C-4, C-8
> and C-14 — the four that were vacuous before R-1 — plus the new C-21. `AttendeeBadge.tsx` restored
> byte-identical afterwards (`fc4b0bd85ac8c876`).
| C-20 | **the gate is a conjunction, not a raised floor (D-7)** | Timed card, `width: 150` (inside the band) but `height: 30` — below `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` (36), so `showTimeLabel` is false and the card is not compact (30 > 15). Attendees present. Assert the badge **is** present. Fails if the implementer raises `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` to 170 instead of writing the conjunction. |

### AC coverage map

| AC | Covered by | Notes |
|---|---|---|
| AC-1 | C-1 | |
| AC-2 | C-2 | |
| AC-3 | U-1 (proxy) | **Not mechanically testable as written.** "Declared exactly once in the repo" is a `grep -rn "ATTENDEE_STATUS_DOT\s*[:=]" packages/` check performed at the review gate; a test cannot assert a repo-wide absence. U-1 pins the surviving declaration's contents; §2.7 hunk 3 is what deletes the duplicate. |
| AC-4 | none in the allowlist — **by design** | Enforced negatively: `EventForm.test.tsx` is off-limits and must pass with zero edits. If it needs an edit, AC-4 has failed. |
| AC-5 | C-3, B-6 | Queried by description text, never by class. |
| AC-6 | B-1, B-2, C-6, C-7 | |
| AC-7 | none — process AC | `bun run test:web` diffed against 2297 pass / 1 fail / 1 error. Report raw numbers; do not call the suite green. |
| AC-8 | none — process AC | `bun lint` (`check-semantic-colors.ts` first, then biome). |
| AC-9 | C-4, C-5 + the 11 untouched existing queries | The existing queries at lines 75/165/193/215/263/367/457/477/509/541/569 stay unedited; C-4/C-5 add the with-attendees case they don't cover. |
| AC-10 | C-8, C-9 | |
| AC-11 | C-10, B-10 | |
| AC-12 | B-7, B-8, C-14 | |
| AC-13 | C-16, C-17 | Mechanism and its limits in D-6. |
| NFR-5 (degrade on small cards) | C-12, C-13, C-18, C-19, C-20 | C-18/19/20 cover the D-7 time-label yield added at Gate 2. C-19 and C-20 are the controls that stop C-18 from being a test that cannot fail. |

---

## 5. Risks against the 2297 / 1 / 1 baseline

| # | Risk | Specific test that would break | Avoidance |
|---|---|---|---|
| R-1 | Badge text folded into `aria-label` | All 11 name queries in `EventCard.test.tsx`, plus `AllDayGridRow.test.tsx` (**not in the allowlist**) | D-1: `aria-describedby` only. The `aria-label` expression in both cards is not in any hunk. C-4/C-5 assert the literal string. |
| R-2 | Badge matched by the repeat-icon selector | `EventCard.test.tsx:279/307/326/430` (`container.querySelector('svg[class*="right-1"]')` not null) and **:342** (`.toBeNull()` on a 30px-wide card) | The badge root is a `<span>`, never an `<svg>`, so `svg[class*="right-1"]` cannot match it even when its className contains `right-1`. Line 342's card is 30px wide, below the 140px gate, so no badge renders at all. |
| R-3 | A second element acquires `role="button"` | `EventCard.test.tsx:240` and `:413` use bare `screen.getByRole("button")` — these throw on multiple matches | The badge and all its children are `<span>` with no `role` and no `tabIndex`. D-4 forbids adding one. |
| R-4 | New elements counted as resize handles | `EventCard.test.tsx:84-87` (`toHaveLength(2)`), `:374-384` | The badge sets exactly one `data-*` attribute, `data-attendee-badge`. |
| R-5 | `EventDetailsSection` output drifts during extraction | `EventForm.test.tsx` attendee assertions (off-limits file) | §2.7 deletes declarations and adds an import; no JSX line is touched. The two call sites keep the identical symbol names. Also delete the now-unused `AttendeeResponseStatus` import or biome fails the build. |
| R-6 | Content-wrapper class string changes for no-attendee cards | Nothing asserts it today — which is why C-16/C-17 add the assertion | `cn("flex flex-col flex-wrap items-start", { "pr-10": false, "pr-14": false })` returns the base string verbatim. |
| R-7 | Non-allowlisted tests render these cards with attendee-bearing fixtures | **Measured at Gate 2: the intersection is empty.** Only two test files render either card — `EventCard.test.tsx` (allowlisted) and `calendarCardIdentity.test.tsx` (zero occurrences of `attendees`). The only two test files carrying `attendees` fixtures are `EventForm.test.tsx` and `useUndoRedo.test.tsx`, neither of which renders a grid card. Demo seed data does carry attendees, but is imported only by `migrations.test.ts` and `demo-data-seed.test.ts`, which render nothing. | Downgraded from "the real residual risk" to **low**. No file both renders a card and supplies attendees. The badge additionally emits new DOM only when `attendees.length > 0` **and** the width gates pass, so a fixture without attendees cannot be affected at all. Still verified at Phase 7 by diffing against the 2297/1/1 baseline; if a non-allowlisted file does go red, it is a **design defect to raise, not a file to edit**. |
| R-8 | `useId` ids leaking into a drag ghost as duplicate DOM ids | No current test | `createDraftEventClone` (`interaction/dom/draft-event.clone.ts:5-9`) already strips `id` and `aria-describedby` from the clone and every descendant. No action needed; recorded so a future change to that file knows this depends on it. |
| R-9 | Lint: a raw palette class sneaks into a test fixture | `check-semantic-colors.ts` runs before biome and scans test files too | Test fixtures assert on `bg-success` / `bg-error` / `bg-warning` / `bg-text-subtle` only. Do not write a `bg-green-500` "expected" string anywhere, including in comments. |
| R-10 | ~~`toHaveAccessibleDescription` would fail typecheck~~ — **WITHDRAWN at Gate 2, the claim was false** | none | The original entry asserted that the `^5.9.1` range in `packages/web/package.json` pinned types lacking the matcher. Verified false against the installed tree: `@types/testing-library__jest-dom@5.14.9` declares `toHaveAccessibleDescription` in `matchers.d.ts`, and `@testing-library/jest-dom@5.17.0` implements it (`dist/to-have-accessible-description.js`). Either form typechecks and runs. §2.8 still prescribes `badgeDescriptionOf` — but now on its merits, not on a phantom constraint: it asserts the exact `aria-describedby` → id → `textContent` chain this design depends on, so a regression that broke the IDREF wiring but left some other description source intact would still fail it. Implementers may use `toHaveAccessibleDescription` as an *additional* assertion; it is not forbidden. |
| R-11 | The byte-identity guard is written so it cannot fail | AC-13 silently satisfied by a badge that never renders | D-6 step 7 is a mandatory sensitivity control: an attendee-bearing render must differ from the baseline `innerHTML`. |

---

## 6. Packet decomposition hint

Six packets. P1 has no dependency; P3 can run any time after P1; P4/P5 are independent of each
other; P6 must be last.

| Packet | Files | Depends on | Rationale |
|---|---|---|---|
| **P1** | `common/utils/attendee-status.util.ts` (new) + `common/utils/attendee-status.util.test.ts` (new) | — | Pure, DOM-free, self-verifying. Everything downstream imports it. Ship it green before anything else exists. |
| **P2** | `grid/components/AttendeeBadge.tsx` (new) + `grid/components/AttendeeBadge.test.tsx` (new) | P1 | The component and its own unit tests, in isolation from either card. Exports the two constants and `hasAttendeesToShow` that P4/P5 need. |
| **P3** | `views/Forms/EventForm/EventDetailsSection.tsx` (edit) | P1 | The extraction's other half. Deliberately **not** bundled with P1: it is the packet whose verification is "`EventForm.test.tsx` still passes untouched", a different signal from P1's own tests. Removing the `AttendeeResponseStatus` import is part of this packet, not optional cleanup. |
| **P4** | `grid/components/TimedEventCard.tsx` (edit) | P2 | Five surgical hunks (§2.5). Use `patch_apply`. |
| **P5** | `grid/components/AllDayEventCard.tsx` (edit) | P2 | Four surgical hunks (§2.6). Use `patch_apply`. Independent of P4 — may run in parallel. |
| **P6** | `grid/components/EventCard.test.tsx` (edit) | P4 **and** P5 | Append-only (§2.8). Must be last: C-16/C-17's baselines are captured from the post-edit components, and C-1..C-15 exercise both cards. Any packet that edits an existing line of this file is out of contract. |

Suggested gate between P5 and P6: run `bun run test:web` and confirm the failure count is still
1 fail / 1 error **before** adding new tests, so a regression introduced by P4/P5 is attributed to
P4/P5 rather than blamed on the new test file.
