# Change Plan — Attendee avatar badge on grid event cards

- **Run:** `20260829-122202-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield · `feature-extend`
- **Baseline commit:** `2d81253a` · `bun test:web` green at 2298 pass / 0 fail / 302 files
- **Stack (from stack profile):** React 19 + TypeScript + Tailwind v4 semantic tokens +
  `classnames`; tests are `bun:test` + React Testing Library + `@testing-library/jest-dom`,
  run sequentially via `bun test:web`.

---

## 1. Summary

Three new files and four edited files. A new pure styling module
(`common/styles/attendee-status.styles.ts`) becomes the single source of truth for the
`AttendeeResponseStatus → semantic color` relationship and exports it in three shapes: a
paired `{ bg, ring }` record (source of truth), a `bg-*` projection named
`ATTENDEE_STATUS_DOT` (so `EventDetailsSection`'s call site is untouched), and a `ring-*`
projection `ATTENDEE_STATUS_RING` (for the badge). A new presentational component
`EventAttendeeBadge` renders up to `ATTENDEE_BADGE_MAX_VISIBLE = 3` overlapping initials
circles ringed by RSVP status, plus a `+N` chip; it returns `null` for
`undefined`/`[]`. `TimedEventCard` and `AllDayEventCard` each gain one guarded
`{showAttendeeBadge && <EventAttendeeBadge … />}` expression and one derived boolean —
nothing else.

What stays: both cards' exported prop types, both cards' `aria-label` strings, every
existing `it()` block in `EventCard.test.tsx`, `EventDetailsSection`'s rendered output,
`packages/core/**`, `web.event.types.ts`, `grid.constants.ts`, and `index.css`. There is no
new dependency, no feature flag, no store access, no `useEffect`.

---

## 2. Module inventory

| # | Path | New / Edited | Contents | FRs |
|---|---|---|---|---|
| 1 | `packages/web/src/common/styles/attendee-status.styles.ts` | **new** | `ATTENDEE_STATUS_CLASSES`, `ATTENDEE_STATUS_DOT`, `ATTENDEE_STATUS_RING`, `attendeeStatusLabel` | FR-A1…A5, FR-E2 |
| 2 | `packages/web/src/common/styles/attendee-status.styles.test.ts` | **new** | Exhaustiveness + bg/ring parity + inherited-token assertions | FR-F3 |
| 3 | `packages/web/src/grid/components/attendee-badge.constants.ts` | **new** | `ATTENDEE_BADGE_MAX_VISIBLE`, `ATTENDEE_BADGE_MIN_WIDTH`, `ATTENDEE_BADGE_MIN_HEIGHT`, `ATTENDEE_BADGE_ROW_HEIGHT` | FR-B2, FR-C1, FR-D1 |
| 4 | `packages/web/src/grid/components/EventAttendeeBadge.tsx` | **new** | The badge component + module-private `attendeeInitials` / `attendeeBadgeLabel` | FR-B1…B8 |
| 5 | `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` | **new** | Initials, null cases, overflow, ring classes, a11y label, pointer-events | FR-F4, FR-F5 |
| 6 | `packages/web/src/grid/components/TimedEventCard.tsx` | **edited** (`patch_apply`) | `showAttendeeBadge` derivation, `lineClamp` reservation, one guarded JSX child, one import pair | FR-C1…C4 |
| 7 | `packages/web/src/grid/components/AllDayEventCard.tsx` | **edited** (`patch_apply`) | `showAttendeeBadge` derivation, one guarded JSX child in the title row, one import pair | FR-D1…D3 |
| 8 | `packages/web/src/grid/components/EventCard.test.tsx` | **edited** (`patch_apply`, append-only) | Local `attendee()` helper + 8 appended `it()` blocks | FR-F1, FR-F2 |
| 9 | `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | **edited** (`patch_apply`) | Delete local map + label helper, add shared import, drop now-unused type import | FR-E1…E3 |

**Allowlist confirmation.** Paths 1–2 fall under `packages/web/src/common/styles/**`; paths
3–8 under `packages/web/src/grid/components/**`; path 9 is the named file. Nothing in this
plan writes to `packages/web/src/common/utils/**` (the third allowlist entry is unused —
see ADR-3). No path outside the allowlist is written. Files 1–8 satisfy NFR-8; AC-9 holds
by construction.

**Files removed:** none.

**Data-layer changes:** none. `AttendeeSchema` / `AttendeeResponseStatus` are consumed as
type-only imports from `@core/types/event-attendance.contracts`; no schema, migration, or
view-model change (requirements §2.1, §2.2).

---

## 3. Module A — shared status map

**File:** `packages/web/src/common/styles/attendee-status.styles.ts`
(dotted-suffix naming matches `calendar-accent.util.ts` / `event-attendance.contracts.ts`;
`common/styles/` chosen per Gate-1 decision 1 and requirements §8.1.)

### FR-A2 resolution

Tailwind v4's scanner is a **regex pass over source text**, not an evaluator. Any class it
must emit has to appear as a complete literal substring somewhere in a scanned file.
Therefore:

> The eight class names — `bg-success`, `ring-success`, `bg-error`, `ring-error`,
> `bg-warning`, `ring-warning`, `bg-text-subtle`, `ring-text-subtle` — are written as
> whole string literals **in this one file**, side by side in a paired record. The `bg-*`
> and `ring-*` consumer-facing maps are then *projections* of that record, computed once at
> module load. Projection is safe because the literals the scanner needs already exist in
> this file's text; no consumer ever builds a class with a template literal, and no consumer
> hand-writes a second map.

Pairing bg and ring on the same object literal line is what makes drift structurally
impossible to introduce silently, and the colocated test (§7) asserts
`ring === bg.replace("bg-", "ring-")` for every member so a typo fails CI rather than
producing a class Tailwind never emitted.

### Intended source

```ts
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/**
 * Single source of truth for the RSVP status -> semantic color relationship,
 * shared by the event form's attendee dots and the grid cards' attendee badge.
 *
 * Tailwind v4 scans source text for whole class names, so BOTH variants are
 * written out as complete literals here. Never build one of these with a
 * template literal (`ring-${status}`) at a call site - the class would not be
 * emitted into the stylesheet and the ring would silently render transparent.
 *
 * Typed as a total Record over AttendeeResponseStatus so a new enum member in
 * @core/types/event-attendance.contracts is a compile error here rather than an
 * `undefined` className at runtime.
 */
export const ATTENDEE_STATUS_CLASSES: Record<
  AttendeeResponseStatus,
  { bg: string; ring: string }
> = {
  accepted: { bg: "bg-success", ring: "ring-success" },
  declined: { bg: "bg-error", ring: "ring-error" },
  tentative: { bg: "bg-warning", ring: "ring-warning" },
  needsAction: { bg: "bg-text-subtle", ring: "ring-text-subtle" },
};

// Computed once at module load, not per render. The cast is the one place the
// projection loses Record totality; ATTENDEE_STATUS_CLASSES above is where
// exhaustiveness is actually enforced.
const projectVariant = (
  variant: "bg" | "ring",
): Record<AttendeeResponseStatus, string> =>
  Object.fromEntries(
    Object.entries(ATTENDEE_STATUS_CLASSES).map(([status, classes]) => [
      status,
      classes[variant],
    ]),
  ) as Record<AttendeeResponseStatus, string>;

/** Background fill for the form's attendee status dot. */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> =
  projectVariant("bg");

/** Ring color for the grid cards' attendee avatar circles. */
export const ATTENDEE_STATUS_RING: Record<AttendeeResponseStatus, string> =
  projectVariant("ring");

/**
 * Human-readable RSVP status for accessible text. Lifted here alongside the
 * color map (FR-A3) because color alone must never be the only signal, and both
 * the form rows and the grid badge need the same wording.
 */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
```

### Exported symbols

| Symbol | Signature |
|---|---|
| `ATTENDEE_STATUS_CLASSES` | `Record<AttendeeResponseStatus, { bg: string; ring: string }>` |
| `ATTENDEE_STATUS_DOT` | `Record<AttendeeResponseStatus, string>` |
| `ATTENDEE_STATUS_RING` | `Record<AttendeeResponseStatus, string>` |
| `attendeeStatusLabel` | `(status: AttendeeResponseStatus) => string` |

FR-A1 ✓ (`ATTENDEE_STATUS_DOT` values are byte-identical to the four inherited tokens).
FR-A4 ✓ (type-only import; no edit to the contract file).
FR-A5 ✓ (no React import, no store, no side effect beyond two module-load projections).
NFR-1 ✓ (`check-semantic-colors.ts`'s regex matches only raw palette families —
`success`, `error`, `warning`, `text-subtle` are not in its alternation).

---

## 4. Module B — the badge component

**Component file:** `packages/web/src/grid/components/EventAttendeeBadge.tsx`
**Component name:** `EventAttendeeBadge` (exported — the component only; its props
interface stays module-private, matching `EventRepeatIcon`'s `interface Props` precedent).
**Constants file:** `packages/web/src/grid/components/attendee-badge.constants.ts`
(see ADR-3 for why the constants do not go in `grid.constants.ts`).

### Constants

```ts
// Grid-card attendee badge geometry gates. These live here rather than in
// @web/grid/grid.constants.ts so the badge's tuning stays next to the component
// it tunes; grid.constants.ts holds layout math consumed by the positioning
// engine, not presentational chrome thresholds.

/**
 * Circles rendered before the +N chip takes over. Deliberately NOT the form's
 * MAX_VISIBLE_ATTENDEES (6): a grid card is a fraction of the form panel's
 * width, and the form can expand its list on click while the card cannot.
 */
export const ATTENDEE_BADGE_MAX_VISIBLE = 3;

/**
 * Rendered height of one badge row (a size-3.5 circle). The timed card's title
 * line clamp subtracts this the same way it subtracts the time label's line box,
 * so a wrapping title cannot push the badge past the card's clipped edge.
 */
export const ATTENDEE_BADGE_ROW_HEIGHT = 14;

/**
 * Below this width the badge is suppressed. Matches
 * MIN_EVENT_WIDTH_FOR_TIME_LABEL (90) by value, so a card either carries its
 * secondary chrome or carries none of it - it is deliberately a separate
 * constant rather than an import, because the all-day card has no time label
 * and must not inherit a timed-label threshold by coupling.
 * Budget at 90px: 3px calendar accent + 5px pl-1.25 + 34px of overlapping
 * circles (14 + 10 + 10) + 20px +N chip + 3px pr-0.75 = 75px, leaving ~15px of
 * title before the badge crowds it.
 */
export const ATTENDEE_BADGE_MIN_WIDTH = 90;

/**
 * Below this height the timed card suppresses the badge. Budget: 16px title line
 * (GRID_EVENT_TITLE_LINE_HEIGHT_PX) + 13px time-label line box
 * (GRID_EVENT_TIME_LABEL_LINE_HEIGHT) + 14px badge row + 7px vertical slack
 * (GRID_EVENT_TITLE_VERTICAL_SLACK_PX) = 50; rounded to 52. Comfortably above
 * MIN_EVENT_HEIGHT_FOR_TIME_LABEL (36) so the badge never appears on a card
 * already too short for its own time label, and ~3.5x COMPACT_EVENT_MAX_HEIGHT
 * (15) so no compact card ever shows it. The all-day card does NOT use this
 * gate - see AllDayEventCard.
 */
export const ATTENDEE_BADGE_MIN_HEIGHT = 52;
```

### Props (internal, not exported)

```ts
interface Props {
  attendees: GridEvent["attendees"];
  /** Extra classes for the badge root; used by AllDayEventCard for its
   * single-row left margin. Kept as a prop so the timed card's stacked layout
   * does not inherit spacing it does not want. */
  className?: string;
}
```

`GridEvent` is a **type-only import** from `@web/common/types/web.event.types` (import is
allowed; that file is off-limits for edits). `GridEvent["attendees"]` resolves to
`readonly Attendee[] | undefined`, so no card prop type is widened (NFR-3 / FR-C4 / FR-D3).

### Initials algorithm (FR-B3, AC-5)

```ts
const attendeeInitials = ({ displayName, email }: Attendee): string => {
  const name = displayName?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
};
```

- `"Ada Lovelace"` → `"AL"`; `"Ada"` → `"A"`; `displayName: null, email: "ada@x.com"` → `"A"`.
- `.slice(0, 2)` before `.map` caps the output at two characters unconditionally.
- The `?? "?"` on email is belt-and-braces: `AttendeeSchema` enforces `min(1)`, but the card
  path receives already-parsed data and must not render `undefined`.
- Called only for the visible slice → O(cap), satisfying NFR-6.

### Overflow rule (FR-B6, AC-4)

`overflowCount = attendees.length - visible.length`, where
`visible = attendees.slice(0, ATTENDEE_BADGE_MAX_VISIBLE)`. The chip renders only when
`overflowCount > 0`; with exactly `ATTENDEE_BADGE_MAX_VISIBLE` or fewer attendees the chip
is absent. `.length` is O(1) and `.slice` is O(cap).

### Accessibility (FR-B7)

**Decision: one label on the badge root, `aria-hidden` on every circle.** See ADR-4.

```ts
const attendeeBadgeLabel = (
  total: number,
  visible: readonly Attendee[],
  overflowCount: number,
): string => {
  const parts = visible.map(
    (attendee) =>
      `${attendee.displayName ?? attendee.email}, ${attendeeStatusLabel(attendee.responseStatus)}`,
  );
  if (overflowCount > 0) parts.push(`${overflowCount} more`);
  return `${total} ${total === 1 ? "guest" : "guests"}: ${parts.join("; ")}`;
};
```

Example: `"3 guests: Ada Lovelace, accepted; Bob Stone, declined; Cara Diaz, tentative"`.
The `"N guest(s)"` opening mirrors `EventDetailsSection`'s existing wording. Status text is
present as words, so color is never the only signal. Building only from the visible slice
keeps it O(cap).

### Pointer events (FR-B8)

The badge root carries `pointer-events-none`. There is **no** `onClick`, no `tabIndex`, no
`role="button"`, no focusable descendant. Mouse-downs over the badge fall through to the
card root's `onMouseDown` (drag) and to the absolutely-positioned resize handles at
`ZIndex.LAYER_4`, exactly as they do over the title span today. Consequence: a native
`title` tooltip would never appear on a `pointer-events-none` element, so the badge
deliberately omits `title` — the `aria-label` is the only text channel. Requirements §2.6
already rules tooltips out of scope.

### Intended source

```tsx
import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_RING,
  attendeeStatusLabel,
} from "@web/common/styles/attendee-status.styles";
import { type GridEvent } from "@web/common/types/web.event.types";
import { ATTENDEE_BADGE_MAX_VISIBLE } from "@web/grid/components/attendee-badge.constants";

interface Props { /* as above */ }

/**
 * Stacked attendee avatar circles for the grid event cards, ringed by RSVP
 * status. Purely presentational and pointer-transparent so the card's drag and
 * resize handlers keep every event that lands on it.
 *
 * Returns null - not an empty wrapper - when there are no attendees, so the
 * majority of cards (Compass-native and busy-projection events carry no
 * attendees) render byte-identical DOM to before this component existed.
 */
export const EventAttendeeBadge = ({ attendees, className }: Props) => {
  if (!attendees || attendees.length === 0) return null;

  const visible = attendees.slice(0, ATTENDEE_BADGE_MAX_VISIBLE);
  const overflowCount = attendees.length - visible.length;

  return (
    <div
      aria-label={attendeeBadgeLabel(attendees.length, visible, overflowCount)}
      className={cn(
        "-space-x-1 pointer-events-none flex shrink-0 items-center",
        className,
      )}
    >
      {visible.map((attendee) => (
        <span
          key={attendee.email}
          aria-hidden="true"
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text text-xs leading-none ring-2",
            ATTENDEE_STATUS_RING[attendee.responseStatus],
          )}
        >
          {attendeeInitials(attendee)}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          aria-hidden="true"
          className="flex h-3.5 shrink-0 items-center justify-center rounded-full bg-surface-raised px-1 text-text-muted text-xs leading-none ring-2 ring-border-strong"
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
```

Class notes for the codegen packet:

- `size-3.5` = 14px circles; `-space-x-1` = −4px overlap (FR-B4). DOM order is array order;
  a later circle paints over its predecessor, which is the conventional stack.
- `ring-2` supplies the width, `ATTENDEE_STATUS_RING[…]` supplies the color (FR-B5).
- `bg-surface-raised` / `text-text` / `text-text-muted` / `ring-border-strong` are all
  registered `@theme inline` tokens; none matches `check-semantic-colors.ts`'s raw-palette
  regex (NFR-1). Nothing is theme-conditional — every color resolves through a CSS variable
  (NFR-7).
- `text-xs` (`--font-size-xs`, 0.563rem ≈ 9px) rather than an arbitrary `text-[8px]`, per
  the canonical-scale-utility convention in `AGENTS.md`.
- Class strings above are written in the repo's sorted order; the codegen packet must let
  `bun lint` (biome) confirm the ordering rather than hand-shuffling.
- No `useMemo`, no `useEffect`, no store read, no context read (NFR-6). Every derivation is
  O(cap) straight-line code.

---

## 5. Modules C & D — card integration

The two cards have **different layout shapes and therefore different gates**. Do not
factor these into one helper.

### C — `TimedEventCard.tsx` (column flex + absolute chrome)

**Imports added** (two lines, placed by biome's organize-imports):

```ts
import {
  ATTENDEE_BADGE_MIN_HEIGHT,
  ATTENDEE_BADGE_MIN_WIDTH,
  ATTENDEE_BADGE_ROW_HEIGHT,
} from "@web/grid/components/attendee-badge.constants";
import { EventAttendeeBadge } from "./EventAttendeeBadge";
```

(`./EventAttendeeBadge` relative, matching the existing `./EventRepeatIcon` sibling import;
the constants module uses the `@web/grid/components/…` alias, matching
`calendar-accent.util`.)

**Derivation** — inserted immediately after the existing `showTimeLabel` block (~line 126):

```ts
const showAttendeeBadge =
  (event.attendees?.length ?? 0) > 0 &&
  position.height >= ATTENDEE_BADGE_MIN_HEIGHT &&
  position.width >= ATTENDEE_BADGE_MIN_WIDTH;
```

No `!isPlaceholder` clause: a placeholder is the ghost of a real event mid-drag, and
dropping identity chrome for the duration of a drag makes the badge flicker. (The repeat
icon excludes placeholders because it is absolutely pinned bottom-right where the drag
ghost's chrome sits; the badge is in normal flow and has no such collision.)

**`lineClamp` reservation (FR-C1)** — replaces the current ternary at lines 131–139:

```ts
const lineClamp = useMemo(() => {
  // Reserve the rows the title must not eat: the time label's line box and the
  // badge row. Clamping against the full height lets a wrapping title occupy
  // every line the card has and shove them past the card's clipped edge.
  const reservedHeight =
    (showTimeLabel ? GRID_EVENT_TIME_LABEL_LINE_HEIGHT : 0) +
    (showAttendeeBadge ? ATTENDEE_BADGE_ROW_HEIGHT : 0);
  return getLineClamp(position.height - reservedHeight);
}, [position.height, showAttendeeBadge, showTimeLabel]);
```

**Mount point** — the badge is the **last child of the existing content wrapper**
(`<div className="flex flex-col flex-wrap items-start" …>`), i.e. inserted between the
closing `)}` of the `{!event.isAllDay && (…)}` fragment (line 361) and that wrapper's
`</div>` (line 362):

```tsx
        )}
        {showAttendeeBadge && <EventAttendeeBadge attendees={event.attendees} />}
      </div>
```

The wrapper is `flex-col`, so the badge occupies its own row beneath the title and time
label and displaces neither. It sits inside the wrapper so it inherits the wrapper's
per-state `color: contentColor` (irrelevant to the circles, which set their own token
colors, but consistent). It is placed **after** the `!event.isAllDay` fragment so the
timed-only branch — including both resize handles — is not reindented or otherwise touched.

**NFR-2 / FR-C2 / FR-C3 byte-identity guarantee:**

1. When `attendees` is `undefined` or `[]`, `showAttendeeBadge` is `false` and
   `false && <…/>` renders **nothing** — React emits no element and no text node. No
   wrapper, no `<></>`, no extra class on any existing element.
2. The `lineClamp` refactor is *arithmetically identical* on that path:
   `reservedHeight` collapses to `showTimeLabel ? 13 : 0`, so
   `position.height - reservedHeight` equals today's ternary for every input. The extra
   `useMemo` dependency changes memo invalidation only, never output.
3. `accessibleLabel` is not read, referenced, or concatenated by any line in this diff
   (FR-C3). Attendee information is announced by the badge's own label.
4. `TimedEventCardProps` is not opened (FR-C4, AC-10). The badge reads `event.attendees`,
   already present on `GridEvent`.

Reviewer check: the whole `TimedEventCard` diff is two import statements, one `const`, one
`useMemo` body, and one JSX line.

### D — `AllDayEventCard.tsx` (single-row flex with a truncating title)

**Imports added:**

```ts
import { ATTENDEE_BADGE_MIN_WIDTH } from "@web/grid/components/attendee-badge.constants";
import { EventAttendeeBadge } from "./EventAttendeeBadge";
```

**Derivation** — inserted after the existing `showRepeatIcon` line (~line 77):

```ts
// Width-only gate. An all-day row is a fixed EVENT_ALLDAY_HEIGHT (20px), which
// always clears the 14px badge - applying the timed card's
// ATTENDEE_BADGE_MIN_HEIGHT (52) here would suppress the badge on every all-day
// card that will ever render.
const showAttendeeBadge =
  (event.attendees?.length ?? 0) > 0 &&
  position.width >= ATTENDEE_BADGE_MIN_WIDTH;
```

**Mount point** — inside the existing single-row content div, **after** the title span
(lines 193–199), as its second child:

```tsx
      <div
        className={cn("flex min-w-0 items-center", {
          "pr-3.5": showRepeatIcon,
        })}
      >
        <span
          className="relative min-w-0 truncate text-xs"
          style={{ color: titleColor }}
        >
          {event.title}
          {" "}
        </span>
        {showAttendeeBadge && (
          <EventAttendeeBadge attendees={event.attendees} className="ml-1" />
        )}
      </div>
```

**Why `truncate` still works (FR-D1):** the title span keeps `min-w-0` and the flex default
`flex-shrink: 1`; the badge root carries `shrink-0`. In a constrained row the title is the
only shrinkable item, so it absorbs the deficit and ellipsises — the badge never collapses
and never pushes the title out of the card. Separation comes from the badge's own `ml-1`
(passed via the `className` prop), **not** from adding a `gap-*` class to the row div —
adding `gap-1` to that `cn(...)` string would change the row's className on
attendee-less cards and break NFR-2.

**NFR-2 / FR-D2 guarantee:** the row div's `cn(...)` call is untouched; the only added JSX
is a `false &&` expression on the empty path; `accessibleLabel`, `eventStyle`,
`scalerStyle`, and both resize handles are untouched.

**FR-D3 / NFR-3 / AC-10:** `AllDayEventCardProps` is *exported* and is not opened — no
member added, renamed, or removed.

---

## 6. Module E — `EventDetailsSection`

**Deleted:**

- Line 4: `import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";`
  — becomes unused once both consumers move out; leaving it fails biome's
  `noUnusedImports`.
- Lines 12–17: the `const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {…}`
  declaration (FR-E1, AC-6).
- Lines 19–20: the `attendeeStatusLabel` arrow function (FR-A3 — lifted, not duplicated).

**Added** — one import, placed by biome's organize-imports after the `@core` group:

```ts
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "@web/common/styles/attendee-status.styles";
```

**Unchanged:** everything else in the file, including `MAX_VISIBLE_ATTENDEES = 6` (which
stays local and is explicitly **not** shared with the grid cap — Gate-1 decision 2), the
`showAllAttendees` state and its `+N more` button, the organizer marking, and the
color-only-signal comment at lines 72–75.

**Call sites, verbatim unchanged (FR-E2):**

- line 76: `const statusText = attendeeStatusLabel(attendee.responseStatus);`
- line 86: ``className={`size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`}``

**Why the render output cannot change (FR-E3):** `ATTENDEE_STATUS_DOT` is exported with the
identical name, the identical `Record<AttendeeResponseStatus, string>` type, and the
identical four values (`bg-success` / `bg-error` / `bg-warning` / `bg-text-subtle`);
`attendeeStatusLabel`'s body is moved character-for-character. Both are plain module-scope
values, so lookup semantics at the call site are indistinguishable from the local
declaration. Same classes, same `title`, same `aria-label`, same button behavior.

AC-6 verification:
`grep -n "ATTENDEE_STATUS_DOT" packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`
must show exactly two hits — the import specifier and the line-86 usage — and no `const`.

---

## 7. Module F — test plan

Runner is `bun test:web` (bun:test + RTL + jest-dom, sequential). No snapshots, no
`vitest`/`jest` APIs, no `--parallel`.

### F.1 `packages/web/src/common/styles/attendee-status.styles.test.ts` (new) — FR-F3

Imports `AttendeeResponseStatusSchema` from `@core/types/event-attendance.contracts` and
enumerates members via `AttendeeResponseStatusSchema.options` (fallback if the zod/v4
surface differs: `Object.keys(AttendeeResponseStatusSchema.enum)`).

| Case | Assertion |
|---|---|
| every status has both variants | for each member: `ATTENDEE_STATUS_CLASSES[s].bg` starts with `"bg-"`, `.ring` starts with `"ring-"`, both non-empty |
| bg and ring never drift | for each member: `ATTENDEE_STATUS_CLASSES[s].ring === ATTENDEE_STATUS_CLASSES[s].bg.replace("bg-", "ring-")` |
| inherited tokens preserved | `expect(ATTENDEE_STATUS_DOT).toEqual({ accepted: "bg-success", declined: "bg-error", tentative: "bg-warning", needsAction: "bg-text-subtle" })` |
| ring projection matches source | for each member: `ATTENDEE_STATUS_RING[s] === ATTENDEE_STATUS_CLASSES[s].ring` |
| no status missing from either projection | `Object.keys(ATTENDEE_STATUS_DOT).sort()` and `Object.keys(ATTENDEE_STATUS_RING).sort()` both equal the enum members sorted |
| label wording | `attendeeStatusLabel("needsAction") === "hasn't responded"`; the other three round-trip their own name |

This is a pure-data module, so value assertions are the user-facing contract, not
implementation detail (FR-F5 is satisfied by construction — there is no DOM here).

### F.2 `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` (new) — FR-F4

Local fixture helper:

```tsx
const attendee = (
  displayName: string | null,
  email: string,
  responseStatus: AttendeeResponseStatus = "accepted",
): Attendee => ({ displayName, email, responseStatus });
```

| Case | Query / assertion |
|---|---|
| `attendees={undefined}` renders nothing | `const { container } = render(…); expect(container).toBeEmptyDOMElement();` |
| `attendees={[]}` renders nothing | same |
| two-word name → `"AL"` (AC-5) | `expect(screen.getByText("AL")).toBeInTheDocument()` |
| one-word name → `"A"` | `screen.getByText("A")` |
| `displayName: null` → email initial `"A"` | `screen.getByText("A")` |
| four-word name capped at two chars | `screen.getByText("AL")`, and `queryByText(/^.{3,}$/)` inside the badge is null |
| ring per status (AC-1 at unit level) | `expect(screen.getByText("AL")).toHaveClass("ring-success")`, `…("BS")).toHaveClass("ring-error")`, `…("CD")).toHaveClass("ring-warning")`, `…("DN")).toHaveClass("ring-text-subtle")` |
| accessible label, exact | `expect(screen.getByLabelText("3 guests: Ada Lovelace, accepted; Bob Stone, declined; Cara Diaz, tentative")).toBeInTheDocument()` |
| singular wording | one attendee → label starts `"1 guest: "` |
| overflow chip (AC-4) | `ATTENDEE_BADGE_MAX_VISIBLE + 3` attendees → `screen.getByText("+3")`; the 4th attendee's initials are absent via `queryByText` |
| exactly the cap → no chip | `expect(screen.queryByText(/^\+\d+$/)).toBeNull()` |
| pointer transparency (FR-B8) | `expect(screen.getByLabelText(/guests/)).toHaveClass("pointer-events-none")` and `expect(container.querySelector("[tabindex]")).toBeNull()` |

Note for the packet: the pointer-events case is asserted as a class, not a behavior —
jsdom does not implement `pointer-events` hit testing, so a `fireEvent.mouseDown` on the
badge would bubble regardless and prove nothing. Put that reason in a code comment so a
future reader does not "fix" it into a fake behavioral test.

Circles are `aria-hidden`, which does **not** hide them from `getByText` (DOM Testing
Library's default `ignore` covers only `script`/`style`), so initials remain queryable by
their user-visible text.

### F.3 `packages/web/src/grid/components/EventCard.test.tsx` (edited, append-only) — FR-F1, FR-F2

**`createEvent` needs no change.** Its signature is already
`(overrides: Partial<GridEvent> = {})` and `GridEvent` already declares
`attendees?: readonly Attendee[]`, so `createEvent({ attendees: [...] })` type-checks
today. Adding an `attendees` key to the factory's default object would give *every* existing
card test an attendee list and break NFR-2's own coverage — do not do it. Instead append the
same local `attendee()` helper used in F.2 (three-arg, returns `Attendee`) next to
`createEvent`, plus the imports `type Attendee` / `type AttendeeResponseStatus` from
`@core/types/event-attendance.contracts` and `ATTENDEE_BADGE_MAX_VISIBLE` from
`./attendee-badge.constants`.

**Do not modify any existing `it()` block.** All eight new cases are appended inside the
existing `describe("EventCard")`, after the final all-day test.

| # | Case | Card | Key assertions |
|---|---|---|---|
| 1 | shows the attendee badge with per-status rings (AC-1) | Timed, default `position` (60×140 clears both gates) | `getByText("AL")` has class `ring-success`; `"BS"` has `ring-error`; `"CD"` has `ring-warning`; `getByLabelText(/^3 guests:/)` present |
| 2 | shows the same badge on an all-day card (AC-2) | All-day, default `position` | same three ring assertions + `getByLabelText(/^3 guests:/)` |
| 3 | renders no badge when the event has no attendees (AC-3) | Timed, `attendees: undefined` | `expect(screen.queryByLabelText(/guest/)).toBeNull()` |
| 4 | renders no badge for an empty attendee list (AC-3) | Timed, `attendees: []` | same |
| 5 | renders no all-day badge without attendees (AC-3) | All-day, `undefined` then `[]` | same |
| 6 | collapses attendees past the cap into a `+N` chip (AC-4) | Timed, `ATTENDEE_BADGE_MAX_VISIBLE + 3` attendees | `getByText("+3")`; the 4th attendee's initials absent; label ends `"; 3 more"` |
| 7 | hides the badge on a card too short for it | Timed, `{...position, height: 15}` (compact) | `queryByLabelText(/guest/)` null, and `getByText("Planning block")` still present |
| 8 | hides the badge on a card too narrow for it | Timed `{...position, width: 30}` **and** All-day `{...position, width: 30}` | `queryByLabelText(/guest/)` null in both |

**Anti-brittleness rules for the packet:**

- Anchor every class assertion to a **user-visible string** (`getByText("AL")`) or to the
  accessible label (`getByLabelText`), never to a `container.querySelector` on a layout
  class. The ring class is the one assertion the requirement forces (FR-F5).
- Assert `toHaveClass("ring-success")` — a single token, not the whole className string —
  so a spacing or radius tweak does not fail the test.
- Query the *absence* of the badge through `queryByLabelText(/guest/)`, which is the badge's
  contract, rather than counting DOM nodes.
- Reference `ATTENDEE_BADGE_MAX_VISIBLE` in case 6 rather than hard-coding `3`, so a future
  cap change fails one arithmetic line instead of silently passing.
- Keep the existing `afterEach` edge-focus store reset as the only teardown; the badge holds
  no state and needs none.

**Expected suite delta:** +8 in `EventCard.test.tsx`, +~12 in `EventAttendeeBadge.test.tsx`,
+6 in `attendee-status.styles.test.ts`, +2 test files. Baseline moves from
2298 pass / 302 files to approximately **2324 pass / 304 files**, 0 fail (AC-8: `>= 2298`
passing and 0 failing).

---

## 8. Key decisions (ADR-style)

### ADR-1 — Paired `{ bg, ring }` record with computed projections

- **Decision.** `ATTENDEE_STATUS_CLASSES` is the source of truth, holding both class names
  as literals on one line per status; `ATTENDEE_STATUS_DOT` and `ATTENDEE_STATUS_RING` are
  `Object.fromEntries` projections computed once at module load.
- **Alternatives.** (a) Two hand-written sibling maps in the shared module — a typo pairing
  `accepted` with `ring-error` compiles cleanly. (b) A single `Record<status, colorRole>`
  plus `cn(\`ring-${role}\`)` at the call site — forbidden; Tailwind's scanner never sees
  the class and the ring renders transparent in production while passing in jsdom, the worst
  possible failure mode. (c) A Tailwind `safelist` — v4 has no config file in this repo to
  put one in, and `index.css` is off-limits.
- **Why.** Both literals must exist in source text anyway (FR-A2); pairing them makes the
  colocation structural, and the projection means neither consumer writes a second map.
  Projection cost is two `Object.entries` passes at import time, not per render.
- **Consequence.** One localized `as Record<…>` cast inside `projectVariant`.
  Exhaustiveness lives on `ATTENDEE_STATUS_CLASSES`, so a new `AttendeeResponseStatus`
  member is still a compile error (FR-A4). The colocated test's
  `ring === bg.replace("bg-", "ring-")` assertion closes the remaining typo hole.

### ADR-2 — Suppress the badge below 90px wide / 52px tall (timed), 90px wide (all-day)

- **Decision.** `ATTENDEE_BADGE_MIN_WIDTH = 90` gates both cards.
  `ATTENDEE_BADGE_MIN_HEIGHT = 52` gates the **timed card only**. The all-day card has no
  height gate.
- **Alternatives.** (a) Always render and accept clipping — a 15px compact card would show a
  sliver of a circle over its own title. (b) Import `MIN_EVENT_WIDTH_FOR_TIME_LABEL` and
  `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` directly — couples the all-day card, which has no time
  label, to a timed-label constant, and re-tuning the time label would silently re-tune the
  badge. (c) One shared height gate for both cards — would suppress the badge on 100% of
  all-day cards, since `EVENT_ALLDAY_HEIGHT` is a fixed 20px.
- **Why.** 52 = 16px title line + 13px time-label line box + 14px badge row + 7px slack,
  rounded up; it sits above `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` (36) so the badge never
  outlives the time label, and far above `COMPACT_EVENT_MAX_HEIGHT` (15). 90 matches
  `MIN_EVENT_WIDTH_FOR_TIME_LABEL` by value so a card shows all its secondary chrome or
  none, and the 90px budget leaves ~15px of title after 75px of accent, padding, circles,
  and chip.
- **Consequence.** Short meetings (15–30 min on a compressed grid) and narrow overlapping
  columns show no badge — matching the existing repeat-icon behavior users already know.
  The values are two named constants with the arithmetic in a comment, so a designer can
  re-tune them in one place. The default test `position` (60×140) clears both gates, so no
  existing test changes and badge tests need no bespoke position.

### ADR-3 — New constants live in `grid/components/attendee-badge.constants.ts`

- **Decision.** Create a new sibling constants module under `grid/components/` rather than
  appending to `grid/grid.constants.ts`.
- **Alternatives.** (a) Append to `grid.constants.ts` — **impossible**: it lives at
  `packages/web/src/grid/`, outside the `grid/components/**` allowlist, so the
  write-contract validator would reject the packet. (b) Export the constants from
  `EventAttendeeBadge.tsx` — mixes a component module with values that tests and both cards
  import, and forces the card modules to import a `.tsx` for a number. (c) Put them in
  `common/utils/` — they are grid-card geometry, not shared utilities; the layering would
  be wrong.
- **Why.** The allowlist forces a new file; a `.constants.ts` sibling matches the existing
  `calendar-accent.util.ts` sibling-module pattern and keeps the badge's tuning next to the
  component it tunes.
- **Consequence.** Grid constants now live in two places. Mitigated by the module's header
  comment stating the split rule (`grid.constants.ts` = positioning-engine layout math;
  `attendee-badge.constants.ts` = presentational chrome thresholds) and by each constant's
  comment naming the `grid.constants.ts` value it is calibrated against. Flag for the
  follow-up backlog: consolidate into `grid.constants.ts` in a run whose allowlist includes
  `packages/web/src/grid/`.

### ADR-4 — One `aria-label` on the badge root; circles are `aria-hidden`

- **Decision.** The badge root is a plain `div` with `aria-label="3 guests: Ada Lovelace,
  accepted; …"` and **no explicit `role`**. Every circle and the `+N` chip carry
  `aria-hidden="true"` and no `title`.
- **Alternatives.** (a) Per-circle `aria-label` — adds up to 4 extra a11y nodes per card on
  a grid rendering dozens of cards, and repeats the guest count implicitly. (b)
  `role="img"` or `role="group"` on the root — ARIA's *presentational children* rule already
  flattens descendants of the card's `role="button"`, so the role buys nothing, and
  `role="img"` additionally risks a biome `useSemanticElements` diagnostic whose
  `biome-ignore` suppression would itself be reported as unused if the rule does not fire.
  (c) Fold attendee text into the card's `aria-label` — explicitly forbidden by FR-C3.
- **Why.** A single label is the cheapest correct signal, it carries the status as **words**
  (so color is never the only cue, matching the existing comment in `EventDetailsSection`),
  and `getByLabelText` matches `aria-label` on any element, so RTL can assert it with a
  semantic query per `.cursor/rules/web-testing.mdc`.
- **Consequence.** ~~the badge's label is reachable in browse mode and by tooling~~ —
  **AMENDED at Gate 3 (2026-08-29). The struck claim was false.** See the amendment below.
- **AMENDMENT — Gate 3, 2026-08-29.** Senior review M-1 and security review both landed on
  this independently, and the original Consequence overstated what this design delivers.

  **Accurate position: the badge is decorative-only to assistive technology.** The root is a
  role-less `div`, whose implicit role is `generic`; ARIA does not permit `aria-label` on
  `generic`, so user agents drop it. Every descendant is `aria-hidden="true"`. The badge
  therefore contributes **nothing** to the accessibility tree — not in the button's accessible
  name, and **not in browse mode either**. The label is reachable only by tooling that reads
  the raw attribute, which includes RTL's `getByLabelText`.

  **FR-B7 ("the group carries a label") is knowingly NOT met at the AT level in this run.**
  It is satisfied in source only. This is recorded as a known gap, not as a solved problem.

  Two corrections to Alternatives (b) above, both now disproven:
  - The *presentational children* argument does not save the design. It explains why a role
    would not help **inside the card's `role="button"` accessible name**; it does not make a
    role-less `div` announceable in browse mode, which is the mode the old Consequence relied on.
  - The `useSemanticElements` concern **does not reproduce.** Adding `role="img"` was probed
    through biome during review: it clears `lint/a11y/useAriaPropsSupportedByRole` and raises
    no `useSemanticElements` diagnostic. The stated reason for rejecting `role="img"` was wrong.

  **Why not simply add `role="img"` now:** deliberately out of scope for this run — it is a
  behavioural a11y change that wants its own design pass (which role, what the label should
  say once actually announced, and how it interacts with security finding F-1, which removed
  attendee emails from that same label). Gate 3 chose to record the gap accurately rather than
  ship a one-line change to the accessibility tree unreviewed.

  **Follow-up ticket (to file):** *"Give the grid attendee badge a real accessible
  representation."* Scope: pick `role="img"` vs `role="group"` vs folding a count into the
  card's own `aria-label` (currently barred by FR-C3, which may itself deserve revisiting);
  decide the announced wording; and replace the `getByLabelText` assertions with ones that
  prove AT reachability rather than attribute presence. A caveat comment now sits above those
  assertions in `EventAttendeeBadge.test.tsx` so nobody reads them as an accessibility guarantee.

  Unchanged and still accurate: `title` tooltips are impossible on a `pointer-events-none`
  element, so mouse users get initials and ring color only — accepted, tooltips are an explicit
  non-goal (§2.6).

### ADR-5 — `className` prop on the badge instead of a `gap-*` class on the all-day row

- **Decision.** `EventAttendeeBadge` accepts an optional internal `className` prop;
  `AllDayEventCard` passes `"ml-1"`. `TimedEventCard` passes nothing.
- **Alternatives.** (a) Add `gap-1` to the all-day row's `cn("flex min-w-0 items-center", …)`
  — changes that element's className on attendee-less cards and breaks NFR-2's
  byte-identity. (b) Rely on the title span's existing trailing ` ` — ~3px at
  `text-xs`, too tight, and it exists for truncation reasons that could be revisited.
  (c) Bake `ml-1` into the badge unconditionally — puts unwanted leading space on the timed
  card's own flex row.
- **Why.** It keeps the spacing decision at the call site that needs it while leaving the
  no-attendee render path bit-identical.
- **Consequence.** One extra optional prop on an *internal, unexported* interface. No
  exported prop type is affected (NFR-3, AC-10).

---

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **NFR-2 regression** — a wrapper, fragment, or className tweak leaks onto the no-attendee path, changing DOM for the majority of cards | High | The only added JSX in either card is a `{cond && <…/>}` expression, which emits nothing when false. The `lineClamp` refactor is arithmetically identical when `showAttendeeBadge` is false (`- 0`). No existing className string is edited. Tests 3, 4, 5 in §7.3 assert absence for both cards on both `undefined` and `[]`. Reviewer gate: the `TimedEventCard` diff must be exactly 2 imports + 1 `const` + 1 `useMemo` body + 1 JSX line; anything more is a defect. |
| **Tailwind scanner never emits `ring-success` et al.** — a runtime-built class passes jsdom (which does not resolve Tailwind) and ships a transparent ring | High | All eight literals are written whole in `attendee-status.styles.ts`, which Tailwind v4 auto-content-detection scans (it is a non-ignored `.ts` under `packages/web/src`). The module header comment forbids template-literal construction. The colocated test pins the literal values. Manual verification step for the packet: after build, `grep -c "ring-success" dist/**/*.css` (or a browser check of a card with attendees) — jsdom tests alone cannot catch this class of bug. |
| **Compact / crowded card layout** — a 3-line clamped title plus badge overflows the card's `overflow-hidden` edge | Medium | The timed `lineClamp` now subtracts `ATTENDEE_BADGE_ROW_HEIGHT`, so the title yields a line to the badge exactly as it already yields one to the time label. Both dimension gates suppress the badge entirely below 90×52. All-day is a fixed 20px row with a `shrink-0` badge and a `min-w-0 truncate` title, so the title absorbs any deficit. Residual: at exactly 52px with a long title the badge sits tight against the time label — cosmetic, tunable via one constant. |
| **2298-test baseline shifts** — an existing assertion changes, so `bun test:web` is no longer comparable | Medium | `EventCard.test.tsx` is edited **append-only**; no existing `it()` body, no existing query, and no `createEvent` default is touched (adding a default `attendees` would silently give every legacy card test a badge). The default `position` (60×140) already clears both gates, so no existing fixture needs adjusting. Expected new total ≈ 2324 / 0 fail; the packet must report the actual number so a drift is visible. |
| **`bun lint` fails on `check-semantic-colors.ts`** | Low | Every color class used is a registered `@theme inline` token: `success`, `error`, `warning`, `text-subtle`, `text`, `text-muted`, `surface-raised`, `border-strong`. None appears in the script's raw-palette alternation (which lists only Tailwind's default families plus `black`/`white`/`darkBlue-*`). No hex, no arbitrary color value anywhere in the diff. |
| **Biome import/lint churn in `EventDetailsSection.tsx`** — the `AttendeeResponseStatus` type import goes unused after the deletion | Low | The plan explicitly deletes line 4 alongside lines 12–17 and 19–20. The packet must run `bun lint` and let biome place the new `@web/common/styles/…` import in its own group. |
| **Ring clipping at the card edge** — `ring-*` is an outside box-shadow and the card is `overflow-hidden` | Low | Accepted, same as the existing title clipping. The `ATTENDEE_BADGE_MIN_WIDTH` budget reserves the card's `pr-0.75` so the last circle's 2px ring stays inside. |
| **Zod v4 enum introspection in the Module-A test** — `AttendeeResponseStatusSchema.options` may not exist on the v4 surface | Low | Documented fallback: `Object.keys(AttendeeResponseStatusSchema.enum)`. The packet should try `.options` first and switch if the type-check fails; either way the test file, not production code, is affected. |

---

## 10. Explicit non-goals

This plan does **not**:

1. Touch `packages/core/**` — no schema widening, no new field, no `photoUrl`, no organizer
   on the card path. `AttendeeResponseStatus` / `Attendee` are type-only imports.
2. Touch `packages/web/src/common/types/web.event.types.ts` or any `event.view-model.ts` —
   `attendees` already reaches both cards.
3. Touch `packages/web/src/grid/grid.constants.ts` or `packages/web/src/index.css` — both are
   outside the allowlist; see ADR-3.
4. Change any exported prop type. `TimedEventCardProps` and `AllDayEventCardProps` are
   byte-identical after this run (AC-10).
5. Mark the organizer or reorder attendees organizer-first — the card path carries no
   organizer data (Gate-1 decision 4).
6. Share the form's `MAX_VISIBLE_ATTENDEES = 6` with the grid cap (Gate-1 decision 2); the
   two remain independent constants in independent modules.
7. Fetch, cache, or store avatar **images**. Initials only. The requirements' "photo if the
   model already carries a URL" path is not implemented, because the model carries none and
   an unreachable branch is dead code.
8. Add a hover card, popover, click handler, focus target, or `title` tooltip on the badge.
9. Add a feature flag or staged rollout.
10. Restyle `EventDetailsSection`'s attendee list, its `+N more` button, or its organizer
    marking.
11. Change any grid layout, sizing, positioning, drag, resize, or hook code. The one layout
    arithmetic change (`lineClamp` reservation) is a no-op on the no-attendee path.
12. Add an npm dependency — `package.json` is outside the allowlist (NFR-4).
13. Edit any AI-assistant config (`AGENTS.md`, `.cursor/**`, `.claude/**`) — read-only.

---

## 11. Sequencing — packet order

Dependencies are strict; a later packet will not type-check without its predecessor.

| Order | Packet | Depends on | Notes |
|---|---|---|---|
| **1** | Module A: `attendee-status.styles.ts` + `attendee-status.styles.test.ts` | — | Foundational. Nothing else compiles without `ATTENDEE_STATUS_RING`. Run `bun test:web` after this packet; it is independently green. |
| **2** | Module E: `EventDetailsSection.tsx` edit | 1 | Deliberately **before** the badge, so the "lift and reuse" is proven green on its own and any output regression is attributed to this packet alone rather than tangled with new UI. |
| **3** | `attendee-badge.constants.ts` | — | Independent of 1–2; may be merged into packet 4 if the codegen prefers fewer packets, but keeping it separate keeps ADR-3's rationale in its own diff. |
| **4** | Module B: `EventAttendeeBadge.tsx` + `EventAttendeeBadge.test.tsx` | 1, 3 | The badge is fully testable in isolation before either card is touched. |
| **5** | Module C: `TimedEventCard.tsx` edit | 3, 4 | Includes the `lineClamp` reservation. |
| **6** | Module D: `AllDayEventCard.tsx` edit | 3, 4 | Independent of 5; different gate, different mount point. Do not merge with 5. |
| **7** | Module F: `EventCard.test.tsx` append | 5, 6 | Must come last — it asserts integrated behavior on both cards. |
| **8** | Verification | 1–7 | `bun lint` (expect exit 0, AC-7), `bun test:web` (expect ≥ 2298 pass / 0 fail, AC-8), `git diff --stat` (expect only the 9 allowlisted paths, AC-9), and the AC-6 `grep`. |

**Framework-owned wiring:** none. This is a React component tree with no module registry,
no router, and no DI container — components are imported directly by their consumers. There
is no barrel file to update under `grid/components/` (both cards import
`./EventRepeatIcon` relatively today, and the badge follows the same pattern).

---

## 12. Off-limits reminders

- `packages/web/src/grid/grid.constants.ts` is **one directory above** the allowlist
  (`packages/web/src/grid/`, not `grid/components/`). It is tempting to append the badge
  constants there — do not. ADR-3 exists for exactly this trap.
- `packages/web/src/index.css` is off-limits. Every token this plan uses (`--color-success`,
  `--color-warning`, `--color-error`, `--color-text-subtle`, `--color-text`,
  `--color-text-muted`, `--color-surface-raised`, `--color-border-strong`) is **already**
  registered in the `@theme inline` block at lines 102–130. No new token is needed; if a
  packet finds itself wanting one, that is a plan defect — pick an existing token.
- `packages/core/src/types/event-attendance.contracts.ts` is import-only. Type-only imports
  are fine; a schema edit is not.
- `packages/web/src/common/types/web.event.types.ts` is import-only for the same reason.
- `package.json` is outside the allowlist — no dependency can be added even if a packet
  believes it needs one (NFR-4).
- `.cursor/rules/**`, `AGENTS.md`, `.claude/**` are read-only; they are the authority this
  plan defers to, not a surface to edit.
