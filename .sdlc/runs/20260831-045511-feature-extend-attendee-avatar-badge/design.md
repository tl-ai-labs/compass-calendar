# Design — feature-extend — Attendee status badge on Week grid event cards

- **Run:** `20260831-045511-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield / `feature-extend` (delta design)
- **Inputs:** `requirements.md` (Gate 1 approved), `intent_brief.md` (Gate 0 approved)
- **Baseline:** `CMP-105/opus-only-v5` @ `2d81253a`
- **Test command:** `bun test:web` (repo root)
- **Write contract:** frozen/strict — `packages/web/src/grid/**`,
  `packages/web/src/views/Week/components/Event/**`,
  `packages/web/src/views/Forms/EventForm/**`,
  `packages/web/src/common/types/web.event.types.ts`,
  `packages/web/src/events/queries/event.view-model.ts`

Every path in this document is inside that allowlist. No escalation is required (see §14).

---

## 1. Summary

Three new files and four edited files add a compact RSVP-status badge to Week grid event cards.
A new React-free util module, `packages/web/src/grid/components/attendee-status.util.ts`, becomes
the single definition site for `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` (moved verbatim out
of `EventDetailsSection.tsx`) and adds the deterministic worst-case aggregate rule plus the
label/count formatters the cards need. A new presentational component,
`packages/web/src/grid/components/AttendeeBadge.tsx`, renders one aggregate dot plus the guest
count and is consumed by both `TimedEventCard` (absolutely positioned top-right, mirroring
`EventRepeatIcon`'s bottom-right) and `AllDayEventCard` (in-flow, `shrink-0`, after the truncating
title). Three exported size-gate constants land in `grid.constants.ts`. `EventDetailsSection.tsx`
gets an import swap and nothing else — same element tree, same class strings, same labels.

What does **not** change: attendee fetch/storage/sync, `@core` contracts, `GridEvent`'s schema,
the event view-model, `GridEvent.tsx` (no prop plumbing — the whole `event` is already passed),
`EventRepeatIcon`, `calendar-accent.util.ts`, the memo comparator, Month view, the mini-calendar,
and every existing test assertion. Cards for events with `attendees: undefined` or `[]` render
byte-identically to today.

---

## 2. Gate 2 decisions

### D-1 (Q-1) Badge shape: one aggregate dot + the guest count

**Decision.** The badge is a single `<span>` containing one 8px status dot
(`size-2 shrink-0 rounded-full <ATTENDEE_STATUS_DOT[status]>`) followed by the guest count as
10px text, capped at `9+`. No per-attendee dot row, no initials, no image.

**Rationale.** A grid card is routinely ~140px wide and already spends its bottom-right corner on
`EventRepeatIcon` and its bottom row on the time label. A capped dot row (3 dots + "+N") costs
~46px of horizontal room versus ~22px for one dot + count, and it buys resolution the user cannot
act on — there is no hover card or click target this run (§2.2 out of scope), so a row of dots
answers "how many of each" without letting the user find out *who*. One dot answers the actual
question the grid asks ("does this meeting have a problem?") in a third of the space. The count
carries the "does this have guests at all" signal that the brief's goal statement names first.

**Rejected alternative.** Capped dot row (max 3 + "+N"). Rejected on horizontal budget and on the
fact that a multi-dot row multiplies the color-only-signal surface: each dot would need its own
accessible text, which either bloats the card's `aria-label` or forces the nested-label shape D-3
rejects.

**Blast radius if overruled.** Contained. `AttendeeBadge.tsx` becomes a `.map` over a sliced
attendee array; `aggregateAttendeeStatus` stays (the dot row still needs a sort-free ordering) but
gains a sibling `attendeeStatusCounts(attendees)`; `ATTENDEE_BADGE_TITLE_RESERVE_PX` and the two
timed width/height gates need re-tuning upward (est. 56 → ~96 width). Roughly +40 LOC in the badge
file, +25 in the util, +30 in tests. No card-structure change: the mount points in §5 are
shape-agnostic.

### D-2 (Q-2) Aggregate rule: worst-case precedence `declined > needsAction > tentative > accepted`

**Decision.** `aggregateAttendeeStatus` reduces over the attendee list with a private severity map
(`declined: 3, needsAction: 2, tentative: 1, accepted: 0`) and returns the highest-severity status,
or `null` for `undefined` / `[]`. Non-mutating (`reduce`, no `sort`/`reverse` — R-6), O(n), no
allocation.

**Rationale.** Worst-case precedence has one property the other candidates lack: it is *provable
from the output*. Because `accepted` is the floor, `aggregate === "accepted"` holds if and only if
every attendee accepted, and `aggregate === "declined"` holds if and only if at least one declined.
That equivalence is what lets §7's accessible text make a true claim ("all accepted", "at least one
declined") without listing anybody, which is the load-bearing constraint under D-5. Ranking
`needsAction` above `tentative` is deliberate: a non-response is a scheduling risk (the meeting may
not happen), a tentative is an answered maybe.

**Rejected alternatives.** (b) Organizer tri-state — collapses `needsAction` and `tentative` into
one "some pending" bucket, which loses the distinction the color palette already encodes
(`bg-text-subtle` vs `bg-warning`) and forces a fifth color decision. (c) Current user's own RSVP —
requires a "which attendee am I" signal that does not exist on `GridEvent` (no user email on the
entity), so it needs view-model plumbing this run has ruled out; also the wrong signal for a grid
scan, since the user already knows their own RSVP.

**Blast radius if overruled.** Small and local. Only the private `ATTENDEE_STATUS_SEVERITY` map and
`ATTENDEE_AGGREGATE_LABEL` change; the function signature, both cards, and every render path are
untouched. The util test's precedence block (§9) is rewritten. Est. 15 LOC + 30 test LOC. Note that
option (c) is *not* small — it needs `event.view-model.ts` and `web.event.types.ts` edits and
breaks NFR-3's reference-equality assumption.

### D-3 (Q-3) A11y placement: fold RSVP text into the card root's existing `accessibleLabel`

**Decision.** The card root's `aria-label` gains an attendee suffix (`, 3 guests, at least one
declined`). The badge element itself carries `aria-hidden="true"` in full — dot and count — plus a
mouse-only `title` matching the suffix text. No `aria-label` on the badge, no `role`.

**Rationale.** The card root is the only focusable element on the card (`role="button"`,
`tabIndex={0}`); a nested `aria-label` on a non-focusable, non-semantic `<span>` inside a labelled
button is not part of the button's accessible name computation and is skipped outright by several
screen readers in browse mode. Folding into the root gives one announcement in one pass and matches
exactly how this card already carries the two other non-text signals: the recurring prefix and the
`calendarAccentAccessibleSuffix`. `EventDetailsSection`'s nested-label pattern is right *there*
because each attendee row is its own list item with its own text — a shape the card does not have.

**Sub-decision (deliberate, argued).** The suffix is gated on **attendee presence only**, not on
the size gate and not on `isPlaceholder`. The badge *node* is gated on all three. This deliberately
decouples the accessible text from the pixel gate, and it follows an existing in-file precedent:
`recurringPrefix` is applied to the label unconditionally while `showRepeatIcon` is gated on width
and duration (`TimedEventCard.tsx:116-120` vs `:251`). A screen-reader user gets the same
information on a 15-minute sliver as on a 2-hour block, which is the correct behavior — RSVP state
is not a function of pixel height. Consequence to accept: AC-4's "renders no badge" test must
assert against the badge *node*, not against the accessible name (§9 specifies exactly that).

**Rejected alternative.** `aria-label` on the badge group with `aria-hidden` dots. Rejected on the
non-focusable-nested-label problem above and because it produces two announcements for one card.

**Blast radius if overruled.** Moderate. `attendeeSummaryLabel` moves from the label string into
`AttendeeBadge`'s props; `aria-hidden` comes off the badge root and goes onto the inner dot only;
both cards lose their `attendeeSuffix` line. Every §9 accessible-name assertion is rewritten from
`getByRole("button", { name: ... })` to `getByLabelText(...)`. Est. 20 LOC + 60 test LOC.

### D-4 (Q-4) All-day cards: in scope

**Decision.** `AllDayEventCard` renders the same `AttendeeBadge` from the same shared module, gated
on `position.width >= MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE` only (the strip is a fixed
`EVENT_ALLDAY_HEIGHT = 20`, so a height gate is dead code).

**Rationale.** B-1/B-2 apply to all-day events identically — a multi-day offsite with three
declines is exactly the case a user wants to catch at a glance. The incremental cost is one import,
one boolean, and one JSX node, because the badge component and the aggregate rule already exist for
the timed path. Dropping all-day would ship an inconsistency the user notices on day one and would
leave a second card type to retrofit later at higher cost.

**Rejected alternative.** Timed-only, all-day deferred. Rejected: it saves ~14 production LOC and
~60 test LOC while creating a visible product inconsistency and a guaranteed follow-up run.

**Blast radius if overruled.** Delete two rows from §10's table (`AllDayEventCard.tsx` edit, the
all-day test block) and `MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE` from `grid.constants.ts`. Nothing
else moves. Est. −14 production LOC, −60 test LOC.

### D-5 (Q-5) PII: hold the line — no attendee names or emails on the grid card, including the `aria-label` and the `title`

**Decision.** Nothing derived from `attendee.email` or `attendee.displayName` reaches the DOM on a
grid card. The card renders only `attendees.length` and the aggregate `responseStatus`. This holds
for the visible badge, the card's `aria-label`, and the badge's `title`. `EventDetailsSection`
keeps rendering names — it is unchanged and remains the deliberate open.

**Rationale.** The Week grid is a screenshare-and-screenshot surface in a way the event form is
not: the form is opened deliberately, one event at a time, by a user who has chosen to look at it;
the grid is on screen for the whole workday and lands in every demo, every recording, and every
support screenshot. Rendering "ahab@pequod.com declined" 40 times across a week turns a
per-event disclosure into a bulk one. Aggregate counts and statuses carry the actionable signal
with no identifier attached. This also disposes of initials for free (§2.3 of requirements):
initials are derived from `displayName`, so they are the same disclosure at lower resolution.

**Rejected alternative.** Names in the accessible label only ("invisible to screenshots"). Rejected
on two grounds: an `aria-label` is plain-text DOM, fully readable in a screenshare of dev tools and
fully captured by any accessibility-tree scrape; and it would give screen-reader users a strictly
larger disclosure than sighted users get, which is a discrimination-by-modality bug, not a feature.

**Blast radius if overruled.** Contained but requires re-deciding D-1's shape. `attendeeSummaryLabel`
would take the attendee objects rather than `(status, count)`, and the badge's `title` and the
card's suffix would grow unboundedly with attendee count (a 40-person meeting yields a
1,200-character `aria-label`), which in turn forces a cap decision and a "and 34 others" tail. Est.
+30 util LOC, +40 test LOC, and requirements §5 must be reopened.

### Q-6 Branch — already confirmed by the user; not re-raised.

---

## 3. Module boundaries

### New files (exact paths, exact exported symbols)

| Path | Kind | Exports |
|---|---|---|
| `packages/web/src/grid/components/attendee-status.util.ts` | pure TS, no React | `AttendeeResponseStatus` (type re-export), `AttendeeStatusLike` (type), `ATTENDEE_STATUS_DOT`, `ATTENDEE_AGGREGATE_LABEL`, `ATTENDEE_COUNT_DISPLAY_MAX`, `attendeeStatusLabel`, `aggregateAttendeeStatus`, `attendeeSummaryLabel`, `attendeeCountLabel` |
| `packages/web/src/grid/components/attendee-status.util.test.ts` | `bun:test` unit test | — |
| `packages/web/src/grid/components/AttendeeBadge.tsx` | React presentational | `ATTENDEE_BADGE_ATTRIBUTE`, `AttendeeBadge` |

### Why `packages/web/src/grid/components/`

The util is React-free and view-agnostic, so on pure layering grounds its ideal home is
`packages/web/src/common/` — something like `common/utils/event/attendee-status.util.ts`, a
neutral leaf that both `grid/` and `views/Forms/` could depend on without either depending on the
other. **That path is outside the frozen write contract**, so it is not available this run. Of the
two legal homes, `grid/components/` is clearly right and `views/Forms/EventForm/` is clearly wrong:
putting it in the form would make the grid — the app's hottest render path — import from a form
view module, which is the worse direction by every measure (the grid would inherit the form's
future dependencies, and a form refactor would ripple into card rendering).

`grid/components/` also has the exact precedent this file should follow: `calendar-accent.util.ts`
lives there, is pure, is imported by both cards, and is unit-tested by a sibling
`calendar-accent.util.test.ts`. The new util is the same species of thing.

**On the form importing `@web/grid/...`.** `EventDetailsSection.tsx` will import from
`@web/grid/components/attendee-status.util`, which reads backwards at first glance — a form
reaching into the grid. Three things make it acceptable rather than merely tolerated. First, it
creates no cycle: `packages/web/src/grid/**` imports nothing from `views/Forms/**` today and this
change adds no such edge, so the dependency graph stays a DAG with `grid/` strictly below `views/`.
Second, the imported surface is two frozen constants and a pure string function with no React, no
store, and no DOM — importing it costs the form nothing at runtime and cannot drag grid rendering
code into the form bundle. Third, `grid/` is already the de facto home of shared *event-card*
vocabulary in this repo (`grid.constants.ts` is imported by `common/utils/grid/grid.util.ts`
today — the same "backwards" edge already exists and is load-bearing), so this is the established
shape rather than a new one. The cleaner long-term home is `common/`; that move is recorded as a
follow-up in §12/R-13 and is a pure path change with no behavior implication.

### Not created

No new module under `views/Week/components/Event/**`. `GridEvent.tsx` passes the whole `event`
object down (B-9) and the badge derives from `event.attendees` inside the card, so there is nothing
to plumb.

---

## 4. The shared module's full public API

`packages/web/src/grid/components/attendee-status.util.ts`

```ts
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/** Re-exported so grid consumers import RSVP vocabulary from one place (FR-3).
 *  This does not redeclare or widen the enum - it is @core's type, verbatim. */
export type { AttendeeResponseStatus };

/** The minimum shape the RSVP helpers need. GridEvent's
 *  `readonly Attendee[] | undefined` satisfies it structurally, so no cast and
 *  no @core value import is required at the call site (FR-16). */
export type AttendeeStatusLike = {
  readonly responseStatus: AttendeeResponseStatus;
};

/** Semantic fill token per RSVP status. Byte-identical to the literals that
 *  lived in EventDetailsSection.tsx:12-17 - these are Tailwind class names and
 *  any drift is a silent style break (FR-1). */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

/** Human text for a single attendee's RSVP. Moved verbatim from
 *  EventDetailsSection.tsx:19-20 (FR-2). */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

/** Worst-case precedence: declined > needsAction > tentative > accepted.
 *  Private - callers depend on the ordering through aggregateAttendeeStatus,
 *  not on the numbers. */
const ATTENDEE_STATUS_SEVERITY: Record<AttendeeResponseStatus, number> = {
  declined: 3,
  needsAction: 2,
  tentative: 1,
  accepted: 0,
};

/** The single RSVP status that represents a whole attendee list (FR-5, FR-9).
 *  Returns null when there is nothing to summarize, which is what both cards
 *  gate their badge on. Non-mutating and allocation-free: reduce, never sort,
 *  so a `readonly` attendee array is safe (R-6). */
export function aggregateAttendeeStatus(
  attendees: readonly AttendeeStatusLike[] | undefined,
): AttendeeResponseStatus | null {
  if (!attendees || attendees.length === 0) return null;
  return attendees.reduce<AttendeeResponseStatus>(
    (worst, attendee) =>
      ATTENDEE_STATUS_SEVERITY[attendee.responseStatus] >
      ATTENDEE_STATUS_SEVERITY[worst]
        ? attendee.responseStatus
        : worst,
    "accepted",
  );
}

/** Wording for an aggregate over 2+ attendees. Each phrase is exactly true
 *  under the precedence above: `accepted` is the severity floor, so the
 *  aggregate is `accepted` iff every attendee accepted, and any other value
 *  means at least one attendee is in that state. Names and emails are
 *  deliberately absent - the grid card never carries attendee PII (D-5). */
export const ATTENDEE_AGGREGATE_LABEL: Record<AttendeeResponseStatus, string> =
  {
    accepted: "all accepted",
    declined: "at least one declined",
    needsAction: "at least one hasn't responded",
    tentative: "at least one tentative",
  };

/** Accessible summary folded into each card's aria-label (D-3) and used as the
 *  badge's mouse title. A single attendee gets the form's own wording, since
 *  "at least one" is stilted when there is exactly one; 2+ get the aggregate
 *  wording. `count` is `attendees.length` verbatim, so the card and the form
 *  can never disagree about the guest count (R-5). */
export function attendeeSummaryLabel(
  status: AttendeeResponseStatus,
  count: number,
): string {
  const statusText =
    count === 1 ? attendeeStatusLabel(status) : ATTENDEE_AGGREGATE_LABEL[status];
  return `${count} ${count === 1 ? "guest" : "guests"}, ${statusText}`;
}

/** Above this the badge shows "9+" instead of the digits, so the badge's
 *  rendered width is bounded at two glyphs and the title reserve in
 *  grid.constants.ts stays correct. The aria-label always announces the true
 *  count. */
export const ATTENDEE_COUNT_DISPLAY_MAX = 9;

export function attendeeCountLabel(count: number): string {
  return count > ATTENDEE_COUNT_DISPLAY_MAX
    ? `${ATTENDEE_COUNT_DISPLAY_MAX}+`
    : `${count}`;
}
```

`packages/web/src/grid/components/AttendeeBadge.tsx`

```tsx
import cn from "classnames";
import { type CSSProperties } from "react";
import {
  type AttendeeResponseStatus,
  ATTENDEE_STATUS_DOT,
  attendeeCountLabel,
  attendeeSummaryLabel,
} from "@web/grid/components/attendee-status.util";

/** Stable DOM hook for tests and for future interaction work, in the same
 *  shape as EVENT_RESIZE_HANDLE_ATTRIBUTE / EVENT_TIME_LABEL_ATTRIBUTE. */
export const ATTENDEE_BADGE_ATTRIBUTE = "data-attendee-badge";

interface Props {
  /** Placement classes supplied by the host card; the two cards mount the
   *  badge differently (absolute vs in-flow) because their content wrappers
   *  are a column and a row respectively. */
  className?: string;
  /** attendees.length, verbatim (R-5). Rendered capped at 9+. */
  count: number;
  status: AttendeeResponseStatus;
  /** The host card's already-computed contrast text color. */
  style?: CSSProperties;
}

/**
 * The attendee indicator shared by the timed and all-day grid cards: one dot
 * colored by the worst-case aggregate RSVP status plus the guest count.
 * Decorative in full - the RSVP state is announced through each card's
 * aria-label (A9), so the whole badge is aria-hidden and `title` is a
 * mouse-only affordance matching EventDetailsSection's dot. Carries no
 * attendee name or email by design (see design.md D-5).
 */
export const AttendeeBadge = ({ className, count, status, style }: Props) => (
  <span
    aria-hidden="true"
    {...{ [ATTENDEE_BADGE_ATTRIBUTE]: "true" }}
    className={cn(
      "pointer-events-none flex shrink-0 items-center gap-0.5 text-[10px] leading-none",
      className,
    )}
    style={style}
    title={attendeeSummaryLabel(status, count)}
  >
    <span
      className={`size-2 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[status]}`}
    />
    {attendeeCountLabel(count)}
  </span>
);
```

Dot sizing note: the form uses `size-2.5` (10px) because it sits in a 6-row list with generous
line height. The card uses `size-2` (8px) — a 10px dot on a 20px all-day strip reads as a bullet,
not a status. FR-1 freezes the *color* literals, not the geometry, so this is in bounds.
`pointer-events-none` is what keeps the badge out of the card's `mousedown` path (FR-13).

---

## 5. Render plan per card

### 5.1 `TimedEventCard.tsx`

**Derivation** — added immediately after the existing `showTimeLabel` block (line ~126), before the
`lineClamp` `useMemo`:

```tsx
const attendeeStatus = aggregateAttendeeStatus(event.attendees);
const attendeeCount = event.attendees?.length ?? 0;
const showAttendeeBadge =
  attendeeStatus !== null &&
  !isPlaceholder &&
  position.height >= MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE &&
  position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE;
```

No hook, no memo, no store read, no context — one O(n) reduce over an array already in memory
(NFR-2), derived from `event` alone (NFR-3). `attendeeStatus` narrows to non-null in every use
below, so no `!` and no cast (FR-16).

**Label** — the `accessibleLabel` expression at line ~265 gains one term:

```tsx
const attendeeSuffix =
  attendeeStatus === null
    ? ""
    : `, ${attendeeSummaryLabel(attendeeStatus, attendeeCount)}`;
const accessibleLabel =
  (calendarIdentity
    ? `${samplePrefix}${baseAccessibleLabel}${calendarAccentAccessibleSuffix(calendarIdentity)}`
    : `${samplePrefix}${baseAccessibleLabel}`) +
  attendeeSuffix +
  edgeFocusSuffix;
```

For an event with no attendees the suffix is `""` and the string is byte-identical to today, so
every existing name assertion in `EventCard.test.tsx` passes unmodified (AC-2).

**JSX mount point** — as a sibling of the content wrapper, immediately *before* the existing
`{showRepeatIcon && <EventRepeatIcon .../>}` line (i.e. between the closing `</div>` of the content
wrapper at line ~362 and line ~363):

```tsx
{showAttendeeBadge && attendeeStatus !== null && (
  <AttendeeBadge
    className="absolute top-0.5 right-1"
    count={attendeeCount}
    status={attendeeStatus}
    style={{ color: contentColor }}
  />
)}
{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
```

(The redundant-looking `attendeeStatus !== null` is what narrows the union for the `status` prop
without a non-null assertion; `showAttendeeBadge` alone does not narrow.)

**Why this mount point, concretely:**

- **`overflow-hidden` root.** The card root is `absolute ... overflow-hidden` and is therefore the
  containing block for the badge's `absolute`. `top-0.5 right-1` (2px / 4px) puts a 12px-tall,
  ≤22px-wide badge fully inside the clip rect for any card that passes the height gate (22px) and
  the width gate (56px). Nothing to eat.
- **`EventRepeatIcon` collision.** The repeat icon is pinned `right-1 bottom-0.5`. The badge takes
  the opposite corner, `top-0.5 right-1`. A recurring event with attendees renders both with a
  clear vertical gap on any card ≥ 22px tall (12px badge + 10px glyph = 22px worst case, and the
  gate is exactly 22 — at the gate boundary they touch but do not overlap; above it they separate).
- **Line-clamp / title.** The badge is out of flow, so it contributes nothing to the content
  wrapper's height and `getLineClamp(...)` is called with the same arguments as today. The title
  gets horizontal room reserved by an inline `paddingRight` on `titleStyle` (below), never by a
  padding on the wrapper.
- **Time label row (FR-10, the explicit hazard).** The reserve is placed on the **title span only**,
  not on the shared content wrapper. A wrapper-level `pr-7` would inset the time label too, and at
  the label's own gate width of 90px the 11px `white-space: nowrap` "9 - 10 AM" string (~55px)
  would be clipped by the `overflow-hidden` root — exactly the failure FR-10 warns about. Scoping
  the reserve to the title leaves the label's row byte-identical.
- **Resize handles (FR-13).** The two handle divs live *inside* the content wrapper with
  `position: absolute; zIndex: ZIndex.LAYER_4`. The badge is a later DOM sibling with no `z-index`
  (auto), so LAYER_4 wins the stacking contest and the handles stay on top. The badge is also
  `pointer-events-none`, so it cannot receive `mousedown` at all and it never stops propagation.
  It is outside the `EVENT_CONTENT_ATTRIBUTE` subtree, so content-hit-testing in
  `grid/interaction/` sees no new node.

**Title reserve** — in `titleStyle` (line ~208):

```tsx
const titleStyle: CSSProperties = {
  ...
  WebkitLineClamp: lineClamp,
  paddingRight: showAttendeeBadge ? ATTENDEE_BADGE_TITLE_RESERVE_PX : undefined,
};
```

`padding-right` on the `-webkit-box` title shrinks its content width, so a long title wraps and
clamps earlier — "the title may truncate earlier" (FR-10) — while the clamp line count, the font
sizes, and the label row are untouched. `undefined` when the badge is hidden means the emitted
style object is identical to today's for a card without attendees.

### 5.2 `AllDayEventCard.tsx`

**Derivation** — added after the existing `showRepeatIcon` line (~77):

```tsx
const attendeeStatus = aggregateAttendeeStatus(event.attendees);
const attendeeCount = event.attendees?.length ?? 0;
const showAttendeeBadge =
  attendeeStatus !== null &&
  !isPlaceholder &&
  position.width >= MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE;
```

**Label** — same shape as the timed card, appended to the existing `accessibleLabel` expression
(line ~138) between the calendar branch and `edgeFocusSuffix`.

**JSX mount point** — in-flow, as the last child of the existing content wrapper, immediately after
the title `<span>` (line ~199):

```tsx
<div
  className={cn("flex min-w-0 items-center", {
    "pr-3.5": showRepeatIcon,
  })}
>
  <span className="relative min-w-0 truncate text-xs" style={{ color: titleColor }}>
    {event.title}
    {" "}
  </span>
  {showAttendeeBadge && attendeeStatus !== null && (
    <AttendeeBadge
      className="ml-1"
      count={attendeeCount}
      status={attendeeStatus}
      style={{ color: titleColor }}
    />
  )}
</div>
```

**Why in-flow here and absolute on the timed card.** The all-day content wrapper is a
`flex min-w-0 items-center` **row**; a `shrink-0` flex item at its end is the native way to reserve
room, and it makes FR-15 structural rather than arithmetic — the title span already carries
`min-w-0 truncate`, so it truncates against whatever the badge leaves rather than overlapping it.
No `pr-*` needs to be added for the badge, and the existing `pr-3.5` repeat-icon reserve keeps the
in-flow badge clear of the absolutely-positioned glyph at `right-1 bottom-0.5`. The timed wrapper is
a `flex flex-col` **column**, where an in-flow badge becomes a third row and pushes the time label
past the clipped edge — the exact FR-10 failure — hence the absolute mount there. The className prop
is what lets one component serve both.

Class-string change on the all-day content wrapper: **none**. Only a new child node.

**Resize handles / interaction.** The all-day handles are siblings of the content wrapper with
`zIndex: LAYER_4`; the badge is nested one level deeper in a `z-index: auto` subtree and is
`pointer-events-none`. The wrapper has no click handler; `onMouseDown` is on the card root and the
badge cannot intercept it.

---

## 6. Size-gate design

**Placement: `packages/web/src/grid/grid.constants.ts`, all three.**

The repo's existing split is not arbitrary. `REPEAT_ICON_MIN_WIDTH` is card-local because it is
card-local in value too — it is `40` in `TimedEventCard` and `60` in `AllDayEventCard`, two
unrelated numbers that happen to share a name, and its tests hardcode `30` and `140` rather than
importing anything. `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` / `MIN_EVENT_WIDTH_FOR_TIME_LABEL` live in
`grid.constants.ts` because they are exported, layout-vocabulary numbers.

AC-4 decides it: *"the threshold is a named exported constant, asserted by importing it rather than
hardcoding a pixel value in the test."* The badge gates must be importable from a test, and
`EventCard.test.tsx` already imports `COMPACT_EVENT_MAX_HEIGHT` and friends from
`@web/grid/grid.constants` — adding to that import statement is a two-token change, whereas
exporting a bare constant out of a `forwardRef` component module would be a new pattern in this
codebase. `grid.constants.ts` it is.

```ts
// Attendee badge: 12px tall in the card's top-right corner. Above
// COMPACT_EVENT_MAX_HEIGHT so a 15-minute sliver never carries it (a sliver
// has room for one cramped title line and nothing else), and below the ~31px
// a 30-minute event renders at, so an ordinary half-hour meeting does.
export const MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE = 22;
// The badge is ~22px wide plus a 4px right offset; below this the title has
// no usable room left. Lower than MIN_EVENT_WIDTH_FOR_TIME_LABEL on purpose -
// on a narrow card the attendee signal is worth more than the time label,
// which the user can infer from the card's vertical position.
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 56;
// All-day strips are a fixed EVENT_ALLDAY_HEIGHT tall, so width is the only
// meaningful gate. Higher than the timed card's because the all-day badge is
// in-flow and takes its room directly out of a single-line truncating title.
export const MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE = 72;
// Horizontal room the timed title reserves for the badge: badge (~22px) plus
// its right-1 offset (4px), rounded up to the 4px spacing step. Applied to the
// title span only - applying it to the content wrapper would inset the time
// label too and clip it at MIN_EVENT_WIDTH_FOR_TIME_LABEL.
export const ATTENDEE_BADGE_TITLE_RESERVE_PX = 28;
```

**Boolean expression per card**

| Card | Expression |
|---|---|
| `TimedEventCard` | `attendeeStatus !== null && !isPlaceholder && position.height >= MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE && position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` |
| `AllDayEventCard` | `attendeeStatus !== null && !isPlaceholder && position.width >= MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE` |

**FR-12 rulings.** `placeholder` → suppressed, matching `showRepeatIcon`: a placeholder is a drag
ghost at 0.5 opacity, and stacking a status dot on a ghost reads as a rendering artifact.
`draft` → **shown**, also matching `showRepeatIcon`, whose in-file comment states the principle
("the draft preview should reflect the future reality"). A draft normally has no attendees so this
is defensive, but a draft cloned from an event with guests should preview them.

**Why rendered height, not duration, for the timed gate.** `showRepeatIcon` gates on *duration*
because its 15-minute threshold is a semantic statement about events and because the same
15-minute event lays out at two different pixel heights depending on render path. The badge's
constraint is genuinely spatial — "is there room in the top-right corner" — so it must read the
same `position.height` the corner is measured in. FR-11's hard requirement (a 15-minute event must
not show the badge) is satisfied either way: `COMPACT_EVENT_MAX_HEIGHT = 15 < 22`.

---

## 7. Accessibility design

**Template — timed card** (existing terms in roman, new term in bold):

```
{samplePrefix}{recurringPrefix}Timed event: {title}, {timeRange}{calendarSuffix}**{attendeeSuffix}**{edgeFocusSuffix}
```

**Template — all-day card:**

```
{recurringPrefix}{samplePrefix}All-day event: {title}{calendarSuffix}**{attendeeSuffix}**{edgeFocusSuffix}
```

where

```
attendeeSuffix = ""                                             when attendees is undefined or []
attendeeSuffix = ", " + attendeeSummaryLabel(status, count)     otherwise
```

**Worked examples**

| Event | Accessible name |
|---|---|
| Timed, "Planning block", 9–10 AM, attendees `[accepted, declined, needsAction]` | `Timed event: Planning block, 9 - 10 AM, 3 guests, at least one declined` |
| Same, plus Work calendar identity | `Timed event: Planning block, 9 - 10 AM, Work calendar, 3 guests, at least one declined` |
| Timed, one attendee, `needsAction` | `Timed event: Planning block, 9 - 10 AM, 1 guest, hasn't responded` |
| Timed, 12 attendees, all `accepted` (badge shows `9+`) | `Timed event: Planning block, 9 - 10 AM, 12 guests, all accepted` |
| Timed, attendees `[accepted, tentative]`, height 21 (below gate — no badge node) | `Timed event: Planning block, 9 - 10 AM, 2 guests, at least one tentative` |
| Timed, `attendees: []` | `Timed event: Planning block, 9 - 10 AM` (unchanged) |
| All-day, "Conference", attendees `[accepted, accepted]` | `All-day event: Conference, 2 guests, all accepted` |
| All-day, edge-focus on endDate, 1 declined attendee | `All-day event: Conference, 1 guest, declined, editing end date` |

**`aria-hidden` inventory.** The `AttendeeBadge` root span carries `aria-hidden="true"`, which hides
the dot and the count glyph together — there is no announceable text inside the badge at all, so
there is no double-announcement and no orphaned label on a non-focusable node. The badge's `title`
is a mouse-only affordance mirroring `EventDetailsSection`'s dot (`title={statusText}`); per NFR-1
it is explicitly *not* the a11y mechanism. The existing `aria-hidden` nodes (calendar accent bar,
resize handles, repeat icon) are untouched.

**Color is never the only signal (A9 / NFR-1).** The dot's hue is duplicated as words in the card's
accessible name for every card that has attendees, including cards too small to draw the dot.

**No PII in the accessible layer (D-5).** `attendeeSummaryLabel` takes `(status, count)` — it is
structurally incapable of emitting a name or an email, which is the point of that signature.

---

## 8. Extraction plan for `EventDetailsSection.tsx`

Minimal, surgical, render-neutral. Exactly two deletions and one insertion; the JSX body is not
touched at any byte.

**Delete** line 4 — the `AttendeeResponseStatus` type import. It is used *only* by the two
declarations being moved (verified: lines 12 and 19 are its only references in the file), so leaving
it would be an unused import and Biome/`tsc` would flag it.

```ts
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";
```

**Delete** lines 12–21 — the two declarations and the blank line that follows them:

```ts
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
```

`const MAX_VISIBLE_ATTENDEES = 6;` (line 22) **stays** — it is form-layout policy, not RSVP
vocabulary, and FR-7 pins its behavior.

**Insert** after the `@core/types/event.contracts` import (which becomes line 3), matching the
repo's external → `@core` → `@web` ordering and Biome's 80-column wrap:

```ts
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "@web/grid/components/attendee-status.util";
```

**Resulting head of file (exact):**

```ts
import { UsersIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type EventContent } from "@core/types/event.contracts";
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "@web/grid/components/attendee-status.util";

type EventDetails = Extract<EventContent, { kind: "details" }>;

interface EventDetailsSectionProps {
  details: Pick<EventDetails, "organizer" | "attendees" | "conference">;
}

const MAX_VISIBLE_ATTENDEES = 6;
```

**Net diff: −11 / +5, all above line 24.** Both identifiers keep their exact names, so lines 76 and
86 (`attendeeStatusLabel(attendee.responseStatus)` and
`${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`) are unchanged. The rendered element tree, class
strings, `aria-label`, `title`, and the "+N more" behavior are bit-for-bit what they are today —
AC-5's "zero assertion edits" is satisfied by construction, not by luck. Codegen must not reflow,
re-sort, or reformat anything below line 24 of this file (R-1); the packet should be reviewed with
`git diff` and rejected if it exceeds ~16 changed lines.

---

## 9. Test plan

### 9.1 `packages/web/src/grid/components/attendee-status.util.test.ts` (new)

Conventions copied from `calendar-accent.util.test.ts`: module import first from the relative
`"./attendee-status.util"`, then `import { describe, expect, it } from "bun:test";`. No DOM, no
Testing Library, no `jest-dom`.

Local fixture helper: `const guest = (responseStatus: AttendeeResponseStatus) => ({ responseStatus });`

| `describe` | `it` | Asserts |
|---|---|---|
| `ATTENDEE_STATUS_DOT` | "maps every RSVP status to its semantic fill token" | `toEqual({ accepted: "bg-success", declined: "bg-error", tentative: "bg-warning", needsAction: "bg-text-subtle" })` — all four entries, byte-exact (FR-1, AC-6) |
| `attendeeStatusLabel` | "spells out the unanswered state" | `attendeeStatusLabel("needsAction")` → `"hasn't responded"` |
| | "passes answered statuses through verbatim" | `accepted` → `"accepted"`, `declined` → `"declined"`, `tentative` → `"tentative"` (both branches, AC-6) |
| `aggregateAttendeeStatus` | "has nothing to summarize for a missing attendee list" | `aggregateAttendeeStatus(undefined)` → `null` |
| | "has nothing to summarize for an empty attendee list" | `aggregateAttendeeStatus([])` → `null` |
| | "returns the only attendee's status" | four assertions, one per enum member |
| | "ranks a decline above every other response" | `[accepted, tentative, needsAction, declined]` → `"declined"`; also `[declined, accepted]` (first position) |
| | "ranks a missing response above a tentative one" | `[accepted, tentative, needsAction]` → `"needsAction"` |
| | "ranks a tentative response above an acceptance" | `[accepted, tentative, accepted]` → `"tentative"` |
| | "reports acceptance only when every attendee accepted" | `[accepted, accepted, accepted]` → `"accepted"` |
| | "is order-independent for ties" | `[declined, declined]` → `"declined"`; `[declined, needsAction]` and `[needsAction, declined]` both → `"declined"` |
| | "does not mutate or reorder the caller's array" | build `const list = [guest("accepted"), guest("declined")]`, snapshot `[...list]`, call, `expect(list).toEqual(snapshot)` (R-6) |
| | "accepts a readonly attendee array" | call with a `readonly` array literal typed `readonly AttendeeStatusLike[]`; compile-time coverage of `GridEvent.attendees`' `readonly` (R-6, NFR-5) |
| `attendeeSummaryLabel` | "uses the form's own wording for a single guest" | `("accepted", 1)` → `"1 guest, accepted"`; `("needsAction", 1)` → `"1 guest, hasn't responded"` |
| | "uses aggregate wording for multiple guests" | `("declined", 3)` → `"3 guests, at least one declined"`; `("accepted", 2)` → `"2 guests, all accepted"`; `("needsAction", 4)` → `"4 guests, at least one hasn't responded"`; `("tentative", 2)` → `"2 guests, at least one tentative"` |
| | "never contains an attendee name or email" | the `(status, count)` signature makes this structural; assert none of the four outputs matches `/@/` (D-5 regression guard) |
| `attendeeCountLabel` | "renders small counts as digits" | `1` → `"1"`, `9` → `"9"` |
| | "caps large counts so the badge stays two glyphs wide" | `10` → `"9+"`, `42` → `"9+"` |

### 9.2 `packages/web/src/grid/components/EventCard.test.tsx` (edit — append)

New imports added to the existing statements: `MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE`,
`MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE`, `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` onto the existing
`@web/grid/grid.constants` import; a new
`import { ATTENDEE_BADGE_ATTRIBUTE } from "./AttendeeBadge";` and
`import { ATTENDEE_STATUS_DOT } from "./attendee-status.util";`.

New local fixture helper beside `createEvent` (NFR-7 — no second fixture style):

```tsx
const createAttendee = (
  responseStatus: AttendeeResponseStatus,
  email = `guest-${responseStatus}@compass.test`,
) => ({ email, displayName: null, responseStatus });
```

Badge lookup helper: `const badgeIn = (container: HTMLElement) => container.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`);`
— mirrors the existing `document.querySelectorAll("[data-calendar-event-resize-handle]")` idiom.

All timed cases use `startDate: "2099-01-15T09:00:00.000Z"` / `endDate: "2099-01-15T10:00:00.000Z"`
so the time label renders and the accessible name matches the existing suite's format.

**Accessible-name assertions (AC-3 — this is the assertion shape, not a class check).** Every
positive a11y case queries the card with
`screen.getByRole("button", { name: "<exact full label>" })` and asserts the returned element is in
the document. `getByRole`'s `name` option matches the computed accessible name, so a card whose dot
color is right but whose label is missing the RSVP words fails. **No test asserts a Tailwind class
as evidence of accessibility.** The one class assertion in the suite (below) exists solely to prove
AC-1's single-source-of-truth claim and reads its expected value by importing
`ATTENDEE_STATUS_DOT`, never by hardcoding `"bg-error"`.

| # | `it` | Card | Asserts |
|---|---|---|---|
| T1 | "announces the guest count and aggregate RSVP on a timed card" | Timed | attendees `[accepted, declined, needsAction]`; `getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM, 3 guests, at least one declined" })` is in the document (AC-3, D-2, D-3) |
| T2 | "colors the timed attendee dot from the shared status module" | Timed | attendees `[declined]`; `badgeIn(container)` is not null, has `aria-hidden="true"`, and its first child span's class contains `ATTENDEE_STATUS_DOT.declined` **imported from the util** (AC-1) |
| T3 | "leaves a timed card without attendees exactly as it was" | Timed | `attendees: undefined`; `badgeIn(container)` is null and `getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM" })` resolves (AC-2) |
| T4 | "leaves a timed card with an empty attendee list exactly as it was" | Timed | `attendees: []`; same two assertions as T3 (AC-2 — the `[]` half) |
| T5 | "hides the attendee badge on a card too short for it" | Timed | attendees `[declined]`, `position.height = MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE - 1` (imported, AC-4); `badgeIn(container)` is null, and the accessible name still ends `3 guests…`-style — documents D-3's deliberate decoupling |
| T6 | "hides the attendee badge on a card too narrow for it" | Timed | `position.width = MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE - 1` (imported); `badgeIn(container)` is null (AC-4) |
| T7 | "hides the attendee badge on a drag placeholder" | Timed | `displayMode="placeholder"`, full-size position, attendees `[accepted]`; badge null (FR-12) |
| T8 | "shows the attendee badge on a draft card" | Timed | `displayMode="draft"`, attendees `[accepted]`; badge not null (FR-12) |
| T9 | "caps the displayed guest count while announcing the true one" | Timed | 12 attendees (11 accepted + 1 tentative); badge `textContent` is `"9+"`, accessible name contains `"12 guests, at least one tentative"` |
| T10 | "reserves title room for the timed attendee badge" | Timed | attendees `[accepted]`; `getByText("Planning block").style.paddingRight` is `"28px"`; and in T3's no-attendee render it is `""` (FR-10) |
| A1 | "announces the guest count and aggregate RSVP on an all-day card" | All-day | `isAllDay: true`, title "Conference", attendees `[accepted, accepted]`; `getByRole("button", { name: "All-day event: Conference, 2 guests, all accepted" })` (AC-3, AC-6) |
| A2 | "renders the all-day attendee badge beside a truncating title" | All-day | attendees `[needsAction]`; badge not null with `ATTENDEE_STATUS_DOT.needsAction` on its dot; the title span still has class `truncate` (FR-15) |
| A3 | "leaves an all-day card without attendees exactly as it was" | All-day | `attendees: undefined`; badge null, name `"All-day event: Conference"` (AC-2) |
| A4 | "hides the all-day attendee badge below the width gate" | All-day | `position.width = MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE - 1` (imported); badge null (AC-4) |
| A5 | "hides the all-day attendee badge on a placeholder" | All-day | `isPlaceholder`; badge null (FR-12) |

### 9.3 Untouched test files

`EventForm.test.tsx` and every other EventForm test: **zero edits** (AC-5). No new EventForm test is
added — the extraction is behavior-preserving and the util's own test covers the moved logic.
`calendar-accent.util.test.ts`: untouched.

---

## 10. File-by-file change table

One row = one file = one packet-sized unit of work.

| # | Path | Action | Change | FR / AC | Est. LOC |
|---|---|---|---|---|---|
| 1 | `packages/web/src/grid/components/attendee-status.util.ts` | **new** | Pure module: type re-export, `AttendeeStatusLike`, `ATTENDEE_STATUS_DOT`, `attendeeStatusLabel`, private severity map, `aggregateAttendeeStatus`, `ATTENDEE_AGGREGATE_LABEL`, `attendeeSummaryLabel`, `ATTENDEE_COUNT_DISPLAY_MAX`, `attendeeCountLabel` | FR-1…FR-5, FR-16 | ~75 |
| 2 | `packages/web/src/grid/grid.constants.ts` | edit | Append 3 exported size gates + `ATTENDEE_BADGE_TITLE_RESERVE_PX`, each with its rationale comment | FR-11, FR-14, AC-4 | +14 |
| 3 | `packages/web/src/grid/components/AttendeeBadge.tsx` | **new** | `ATTENDEE_BADGE_ATTRIBUTE` + `AttendeeBadge` presentational component (dot + capped count, `aria-hidden`, `pointer-events-none`, `title`) | FR-9, FR-13, NFR-1, NFR-4 | ~48 |
| 4 | `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | edit | Delete the `@core` type import (line 4) and lines 12–21; insert the `@web/grid/components/attendee-status.util` import. JSX untouched | FR-6, FR-7, AC-5, R-1 | −11 / +5 |
| 5 | `packages/web/src/grid/components/TimedEventCard.tsx` | edit | 2 imports; `attendeeStatus` / `attendeeCount` / `showAttendeeBadge` derivation; `attendeeSuffix` in `accessibleLabel`; `paddingRight` in `titleStyle`; `<AttendeeBadge>` before `{showRepeatIcon && …}` | FR-8…FR-13, AC-1, AC-3, AC-4 | +18 |
| 6 | `packages/web/src/grid/components/AllDayEventCard.tsx` | edit | 2 imports; same derivation with the width-only gate; `attendeeSuffix` in `accessibleLabel`; in-flow `<AttendeeBadge className="ml-1">` after the title span | FR-14, FR-15, AC-1, AC-3, AC-4 | +16 |
| 7 | `packages/web/src/grid/components/attendee-status.util.test.ts` | **new** | §9.1 — 5 `describe` blocks, 18 `it` cases | AC-6 | ~135 |
| 8 | `packages/web/src/grid/components/EventCard.test.tsx` | edit | §9.2 — 3 import edits, `createAttendee` + `badgeIn` helpers, 15 appended cases. **No existing assertion is modified** | AC-1…AC-4, AC-6 | +215 |

**Total: 3 new files, 5 edited files, ~526 LOC added / ~11 removed.**
Production code ~176 LOC; tests ~350 LOC.

Every path is inside the frozen allowlist (`packages/web/src/grid/**` for rows 1,2,3,5,6,7,8;
`packages/web/src/views/Forms/EventForm/**` for row 4).

---

## 11. Dependency / sequencing

```
1 attendee-status.util.ts ──┬── 3 AttendeeBadge.tsx ──┬── 5 TimedEventCard.tsx ──┐
                            │                          └── 6 AllDayEventCard.tsx ─┤
                            ├── 4 EventDetailsSection.tsx (import swap)           │
                            └── 7 attendee-status.util.test.ts                    │
2 grid.constants.ts ────────────────────────────────────┴─────────────────────────┴── 8 EventCard.test.tsx
```

- **Wave A (parallel, no dependencies):** row 1 (util), row 2 (constants).
- **Wave B (needs row 1):** row 3 (badge component), row 4 (form import swap), row 7 (util test).
  Row 4 is independent of everything else and can land first after row 1 — landing it early makes
  AC-5's "zero assertion edits" verifiable in isolation, before the card diffs muddy `git diff`.
- **Wave C (needs rows 1, 2, 3):** row 5 (timed card), row 6 (all-day card). Independent of each
  other.
- **Wave D (needs rows 2, 3, 5, 6):** row 8 (component tests). Must be last — it imports the gate
  constants, the badge attribute, and the status map, and it renders both cards.

**Hard ordering rules for the packet planner.** Row 1 before rows 3, 4, 7. Row 2 before rows 5, 6,
8. Row 3 before rows 5, 6, 8. Rows 5 and 6 before row 8. No packet may write row 4 in the same unit
as any other file — R-1 requires that diff to be inspectable on its own.

**Test-baseline dependency.** Capture the `bun test:web` pass/fail baseline before Wave A (AC-6
requires "no new failures vs. the pre-run baseline", which is unmeasurable after the fact).

---

## 12. Risks & mitigations

Requirements R-1…R-6 carry forward unchanged. The design adds:

| # | Risk | Mitigation |
|---|---|---|
| R-7 | A wrapper-level right padding would inset the time label and let `overflow-hidden` clip "9 - 10 AM" at the label's own 90px gate width. | Design-level fix already applied: the reserve is `paddingRight` on the **title span**, never on the content wrapper (§5.1). T10 asserts the reserve lands on the title element specifically. |
| R-8 | On a card at exactly `MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE` (22px) the top-right badge (12px) and the bottom-right repeat glyph (10px) touch. | 22px is the floor, not the typical case; a 30-minute event renders ~31px. Accepted as a boundary cosmetic. If Gate 3 rejects it, raise the height gate to 26 — a one-line constant change with no structural impact. |
| R-9 | A reviewer reads AC-4 as "the too-small card announces nothing" and flags the still-present RSVP text in the `aria-label` as a bug. | D-3's sub-decision documents the intent and cites the in-repo `recurringPrefix` precedent; test T5 asserts the behavior explicitly so it is a specified outcome rather than an accident. |
| R-10 | The badge shows `9+` while the label announces `12`, and a reviewer calls it a mismatch. | Deliberate and documented (`attendeeCountLabel` doc comment): the glyph is width-bounded, the announcement is exact. T9 pins both halves in one test. |
| R-11 | Codegen "helpfully" reformats or re-sorts `EventDetailsSection.tsx` below line 24, breaking AC-5. | §8 specifies the exact resulting import block and the exact deleted line ranges; row 4 ships as its own packet; review rejects a diff over ~16 lines in that file. |
| R-12 | `attendeeStatus` is `AttendeeResponseStatus \| null` and codegen reaches for `!` or `as` to pass it to the badge's `status` prop, violating FR-16. | §5's JSX includes the `showAttendeeBadge && attendeeStatus !== null &&` guard specifically to narrow the union. FR-16 is a review checkpoint on rows 5 and 6. |
| R-13 | `views/Forms/EventForm` importing from `@web/grid/components` calcifies as an accepted layering direction. | Documented as a write-contract-forced compromise in §3 with the target home named (`packages/web/src/common/utils/event/attendee-status.util.ts`). Follow-up ticket to move it in a run whose contract includes `common/`; the move is a path change with zero behavior implication. |
| R-14 | Two 8px dots (`bg-warning` on a `bg-warning`-ish event fill) fall below 3:1 non-text contrast on some calendar colors. | The four tokens are the same ones the form already ships against a `bg-surface-overlay`; on a card they sit on the event fill. Mitigated by the count text carried beside the dot (a second, text-shaped signal) and by the accessible name. Flagged for the Gate 3 browser check rather than automated here. |

---

## 13. Explicitly NOT changing

| Path / thing | Why not |
|---|---|
| `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx` | B-9: it already passes the whole `event` object to `TimedEventCard`. A dedicated `attendees` prop would duplicate state that is already there and would break NFR-3's reference-equality assumption in the memo comparator. In the allowlist; zero packets planned. |
| `packages/web/src/common/types/web.event.types.ts` | B-1: `attendees: z.array(AttendeeSchema).readonly().optional()` exists at line 87. Nothing to widen. In the allowlist; zero packets planned. |
| `packages/web/src/events/queries/event.view-model.ts` | B-2: `attendees: details?.attendees` is already populated at line 92. In the allowlist; zero packets planned. |
| `packages/core/src/types/event-attendance.contracts.ts` | Off-limits, and correct as-is — the util re-exports `AttendeeResponseStatus` rather than redeclaring it (FR-3). |
| `packages/web/src/grid/components/EventRepeatIcon.tsx` | The badge is a peer, not a variant. Sharing a wrapper would couple two independent gates and two independent corners for no gain. |
| `packages/web/src/grid/components/calendar-accent.util.ts` | Precedent for the new util's shape; no reason to touch it. |
| `packages/web/src/views/Forms/EventForm/EventForm.test.tsx` and the rest of the EventForm suite | AC-5 requires zero assertion edits. The extraction is behavior-preserving, so a green run with no diff on these files *is* the evidence. |
| `packages/web/src/common/utils/grid/grid.util.ts` (`getLineClamp`) | The badge is out of flow on the timed card and in-flow on a fixed-height strip on the all-day card, so no clamp arithmetic changes. |
| `packages/web/src/grid/interaction/dom.ts` | `ATTENDEE_BADGE_ATTRIBUTE` lives with the badge because the badge is `pointer-events-none` and is not an interaction target; adding it to the interaction DOM vocabulary would imply otherwise. |
| Month view, mini-calendar, `BusyPeriodBlock`, draft overlays | Out of scope (§2.4). Busy-projection events carry no `details`, so `attendees` is `undefined` and FR-8 renders nothing there anyway. |
| `package.json` / any dependency | `classnames`, Tailwind 4 tokens, and `bun:test` cover everything (§2.7). |
| Any `__snapshots__` directory | None exists under `packages/web/src` (B-10). |

---

## 14. Escalations

**None.** Every file this design requires is inside the frozen write-contract allowlist, and no
planned change needs a write to `packages/core/**`, `packages/backend/**`, `packages/sync/**`,
`packages/scripts/**`, any AI-config path, or any `__snapshots__` directory.

One item is worth the user's attention but is **not** a request to widen the contract: the shared
util's ideal home on pure layering grounds is `packages/web/src/common/`, which is outside the
contract, so it lands in `packages/web/src/grid/components/` instead (§3, R-13). That is a defensible
home with a direct in-repo precedent (`calendar-accent.util.ts`), not a workaround that leaves
anything broken. The relocation is recorded as a follow-up.
