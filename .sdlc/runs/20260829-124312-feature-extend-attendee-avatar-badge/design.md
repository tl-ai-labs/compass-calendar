# Design — feature-extend — Attendee avatar badge on grid event cards

**Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
**Mode:** brownfield · **Intent:** feature-extend · **Phase:** 2 (architecture_design)
**Anchor commit:** `2d81253a` · **Spec:** `requirements.md` (approved, Gate 1 resolved)

This document is the complete instruction set for the codegen phase. Everything named
here — file paths, symbol names, numeric constants, class strings, JSX shape — is
prescriptive. Where a value is copied from an existing file it is marked **verbatim**
and must not be "improved".

## Blockers

None. Every functional and non-functional requirement is satisfiable inside the frozen
allowlist. Two requirements needed a design workaround rather than a file edit; both are
resolved below and neither is a blocker:

- New constants cannot go in `grid.constants.ts` (not in the allowlist). They live in
  `EventAttendeeBadge.tsx`, which is. See §3.
- New CSS tokens cannot go in `index.css` (not in the allowlist). The badge needs no new
  token: status color comes from the existing `bg-success` / `bg-error` / `bg-warning` /
  `bg-text-subtle` tokens, and the avatar disc is painted with an inline hex derived from
  the card fill at runtime (no class, so nothing to declare). See §10.

---

## 1. File inventory

Absolute-from-repo-root. "Allowlist" column cites the authorizing entry:
**A1** = `packages/web/src/grid/components/**`,
**A2** = `packages/web/src/common/styles/**`,
**A3** = `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`.

| # | Path | State | Purpose | Allowlist |
|---|---|---|---|---|
| 1 | `packages/web/src/common/styles/attendee-status.ts` | **NEW** | Canonical `AttendeeResponseStatus → semantic bg token` map + status→prose helper (FR-1, FR-3, FR-4). | A2 |
| 2 | `packages/web/src/common/styles/attendee-status.test.ts` | **NEW** | AC-10 (four-member value check) + AC-11 (exhaustiveness against `AttendeeResponseStatusSchema.options`). | A2 |
| 3 | `packages/web/src/grid/components/EventAttendeeBadge.tsx` | **NEW** | The badge component **and** every new numeric constant this feature introduces (FR-5…FR-12). | A1 |
| 4 | `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` | **NEW** | Component-level tests: cap arithmetic, `@`-freedom, `Guest` fallback, empty/undefined null-render, inertness attributes. | A1 |
| 5 | `packages/web/src/grid/components/TimedEventCard.tsx` | **MODIFIED** | Adds `showAttendeeBadge` gate, one badge JSX line, and one term in the `getLineClamp` argument (FR-13, FR-18). | A1 |
| 6 | `packages/web/src/grid/components/AllDayEventCard.tsx` | **MODIFIED** | Adds `showAttendeeBadge` gate and one badge JSX line inside the existing title row (FR-14). | A1 |
| 7 | `packages/web/src/grid/components/EventCard.test.tsx` | **MODIFIED** | Appends card-integration tests (AC-4, AC-5, AC-6) + two regression tests. Existing tests are **not** edited. | A1 |
| 8 | `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | **MODIFIED** | Deletes L12–20 local definitions, adds one import. Nothing else (FR-19, FR-20). | A3 |

**Total: 4 new, 4 modified. No deletions.**

### Files I would touch if the allowlist permitted, and the workaround used instead

| Wanted | Why | Workaround actually used |
|---|---|---|
| `packages/web/src/grid/grid.constants.ts` | The five new layout constants belong next to `MIN_EVENT_WIDTH_FOR_TIME_LABEL`. | All five are `export const`s at the top of `EventAttendeeBadge.tsx` (§3). Both cards import them from `./EventAttendeeBadge`. The cards keep **importing** the existing constants from `@web/grid/grid.constants` read-only. |
| `packages/web/src/common/utils/grid/grid.util.ts` | `getLineClamp` could take an optional `reservedHeight` argument. | The caller subtracts `ATTENDEE_BADGE_LINE_HEIGHT` before calling; `getLineClamp` is untouched (§7). |
| `packages/web/src/common/styles/colors.ts` | A `lightColors.success/warning/error/textSubtle` set would allow JS-side contrast math on the status colors. | Not needed after the §10 decision (status color never sits under text). Also `theme-css.test.ts` (outside the allowlist) guards that file's parity — editing it is a trap. |
| `packages/web/src/views/Forms/EventForm/EventForm.test.tsx` | Nothing. It is the FR-20 regression guard and **must stay byte-identical**. | Symbol names in the shared module are chosen so `EventDetailsSection`'s JSX body needs zero edits (§2). |

---

## 2. The shared status module

**File:** `packages/web/src/common/styles/attendee-status.ts` (NEW, A2)

Full intended content:

```ts
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/**
 * The single canonical RSVP-status → semantic background token mapping. Both
 * the event form's attendee dots and the grid card's attendee badge read it,
 * so the two surfaces cannot drift into disagreeing about what "declined"
 * looks like. Typed as a total Record so adding a member to the core enum is
 * a compile error here rather than an `undefined` class at runtime.
 */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

/**
 * Prose for a status, for the accessible/tooltip text that keeps the color
 * from being the only signal. "needsAction" is the only member whose enum
 * spelling is not readable English.
 */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
```

Hard constraints on this file:

- The four map values are **verbatim** from `EventDetailsSection.tsx` L13–16, including
  key order (`accepted`, `declined`, `tentative`, `needsAction`). Key order is not
  semantically load-bearing but preserving it makes the diff reviewable as a pure move.
- `attendeeStatusLabel`'s body is **verbatim** from `EventDetailsSection.tsx` L20.
- Both symbol names are **verbatim** from the source file. Do **not** rename
  `ATTENDEE_STATUS_DOT` to something badge-flavored. The name is the reason
  `EventDetailsSection`'s JSX body (L86, L76) needs zero character changes, which is the
  cheapest possible guarantee of FR-20. The badge uses the map as a ring rather than a
  dot; the slight name mismatch is deliberate and costs nothing.
- No `default` export. No other exports. `MAX_VISIBLE_ATTENDEES` does **not** move here —
  the form's `6` and the grid's `3` stay separate per Gate 1 Q1.

### FR-2 — compile-time exhaustiveness

The `: Record<AttendeeResponseStatus, string>` annotation is the entire mechanism. If a
fifth member is added to `AttendeeResponseStatusSchema` in `packages/core`, TypeScript
raises `TS2741: Property '<new>' is missing in type '{ accepted: …; }'` at this
declaration. `bun run type-check:web-tests` (AC-3) is the gate that catches it. Do not
add an index signature, `satisfies` without an annotation, or `as Record<…>` — any of
those defeats the check.

### AC-11 — runtime exhaustiveness

`packages/web/src/common/styles/attendee-status.test.ts` imports the **value**
`AttendeeResponseStatusSchema` from `@core/types/event-attendance.contracts` and iterates
`AttendeeResponseStatusSchema.options` (zod v4 exposes `.options` as a readonly tuple of
the literal strings; `Object.values(AttendeeResponseStatusSchema.enum)` is the fallback if
`.options` is not present at runtime — prefer `.options` and only fall back if the type
check rejects it).

```ts
for (const status of AttendeeResponseStatusSchema.options) {
  expect(ATTENDEE_STATUS_DOT[status]).toBeDefined();
  expect(typeof attendeeStatusLabel(status)).toBe("string");
}
expect(Object.keys(ATTENDEE_STATUS_DOT)).toHaveLength(
  AttendeeResponseStatusSchema.options.length,
);
```

The length assertion is what makes this a real guard in both directions: it fails on a
core-enum addition (missing key) *and* on a stale key left behind after a removal.

### FR-4 — one definition

After edit #8, a grep for `"bg-text-subtle"` under `packages/web/src` returns
`attendee-status.ts` only. `EventDetailsSection.tsx` will contain neither the literal nor
the word `needsAction`.

---

## 3. The badge component

**File:** `packages/web/src/grid/components/EventAttendeeBadge.tsx` (NEW, A1)

### 3.1 Constants — all five live in this file

This is the entirety of the "new constant" surface for the feature. `grid.constants.ts` is
not in the allowlist, so nothing goes there; the cards import these five from
`./EventAttendeeBadge` and continue to import the pre-existing constants from
`@web/grid/grid.constants` read-only.

```ts
/** Grid cards are far narrower than the form panel (which shows 6), so three
 *  elements is the most that reads as a row rather than a smear. */
export const MAX_VISIBLE_ATTENDEES = 3;

/** Rendered height of the badge row, in px. TimedEventCard subtracts this from
 *  the height it hands getLineClamp, the same way it already subtracts
 *  GRID_EVENT_TIME_LABEL_LINE_HEIGHT, so the badge takes its row from the
 *  title's clamp instead of pushing the card past its clipped edge. Must equal
 *  the avatar box size (size-4 = 16px); the row has no extra leading. */
export const ATTENDEE_BADGE_LINE_HEIGHT = 16;

/** One title line (16) + the time label (13) + the badge row (16) + the slack
 *  getLineClamp reserves (7) = 52. Below this the badge would eat the last
 *  title line, so it is suppressed instead. Comfortably above
 *  COMPACT_EVENT_MAX_HEIGHT (15), so a compact card never shows a badge. */
export const MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE = 52;

/** At this width the content box is 90 - 5 (pl-1.25) - 3 (pr-0.75) = 82px. A
 *  full badge is 3 * 16 + 2 * 2 (gap-0.5) = 52px and EventRepeatIcon reserves
 *  ~14px at the right edge; 52 + 14 = 66 < 82, so the two can never collide. */
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 90;

/** Wider than the timed gate: the all-day badge shares one horizontal row with
 *  the title, so it has to leave the title something to truncate into. */
export const MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE = 120;
```

**Fixture check (mandatory).** `EventCard.test.tsx`'s default `position` is
`{ height: 60, left: 10, top: 20, width: 140 }`.
`60 >= 52` ✅ · `140 >= 90` ✅ · `140 >= 120` ✅.
**The badge renders at the default 60×140 fixture on both cards.** New badge tests use the
existing shared `position` object unchanged; only the two negative size-gate tests pass a
custom `position`.

### 3.2 Props

```ts
import { type Attendee } from "@core/types/event-attendance.contracts";

interface EventAttendeeBadgeProps {
  /** Exactly GridEvent["attendees"]: z.array(AttendeeSchema).readonly()
   *  .optional() infers `readonly Attendee[] | undefined`. Declared as a
   *  required key that accepts undefined so exactOptionalPropertyTypes cannot
   *  bite at the call site. No cast anywhere (NFR-3). */
  attendees: readonly Attendee[] | undefined;
  /** The card's resolved fill, passed in the way EventRepeatIcon takes it, so
   *  the badge never calls useEventPalette itself and cannot disagree with the
   *  card about what state (past / hover / draft) the fill is in. */
  baseColor: string;
  className?: string;
}
```

`readonly Attendee[]` supports `.length` and `.slice()` (which returns a mutable
`Attendee[]`); nothing in the badge mutates the input. **No `as`, no spread-to-copy, no
`[...attendees]`.**

### 3.3 Derivation

```ts
const avatarCount =
  attendees.length > MAX_VISIBLE_ATTENDEES
    ? MAX_VISIBLE_ATTENDEES - 1
    : attendees.length;
const overflowCount = attendees.length - avatarCount; // 0 when nothing hidden
const visible = attendees.slice(0, avatarCount);
```

Cap truth table — assert these exact rows:

| `attendees.length` | avatars | chip | `N` | total elements |
|---|---|---|---|---|
| 0 | — | — | — | component returns `null` |
| 1 | 1 | no | — | 1 |
| 2 | 2 | no | — | 2 |
| 3 | 3 | **no** | — | 3 |
| 4 | 2 | yes | 2 | 3 |
| 6 (= cap + 3, AC-7) | 2 | yes | **4** | 3 |
| 50 | 2 | yes | 48 | 3 |

Invariant: `avatars + (chip ? 1 : 0) <= MAX_VISIBLE_ATTENDEES` for every input, and
`avatars + N === attendees.length` whenever a chip renders. The `>` (not `>=`) in the
comparison is the off-by-one: with `>=`, `length === 3` would render `2 avatars + "+1"`,
which is strictly worse than showing all three. Test length 3 and length 4 adjacently.

### 3.4 Monogram derivation (FR-8) — cannot read `email`

```ts
/** A monogram is a single letter or digit. Anything else — punctuation, an
 *  emoji, whitespace-only, or null — falls back to the person glyph. That is
 *  what makes FR-10 airtight: no attendee-supplied character that is not
 *  \p{L} or \p{N} can ever reach the DOM, so "@" cannot, even from a
 *  displayName that looks like an email address. */
const MONOGRAM_CHARACTER = /^[\p{L}\p{N}]$/u;

const monogramFor = (displayName: string | null): string | null => {
  const trimmed = displayName?.trim() ?? "";
  // Destructuring a string uses the string iterator, which yields a whole code
  // point — charAt(0) would split a surrogate pair into a lone half.
  const [first = ""] = trimmed;
  return MONOGRAM_CHARACTER.test(first) ? first.toUpperCase() : null;
};
```

**Proof it can never read `attendee.email`:** `monogramFor`'s only parameter is typed
`string | null` and every call site is `monogramFor(attendee.displayName)`. The token
`.email` appears exactly once in the whole file — as the React `key` (§5). A reviewer
verifies this with a single grep of `EventAttendeeBadge.tsx` for `email`: one hit,
inside `key={…}`.

`AttendeeSchema` already applies `.trim().min(1)`, so `trimmed` is normally non-empty;
the `?? ""` / `= ""` defaults exist because the badge is handed data from a `GridEvent`
that may have been assembled without re-validating, and a lone-surrogate or empty
monogram would render an invisible avatar.

### 3.5 The person glyph (FR-8, Gate 1 Q3)

`UserIcon` from `@phosphor-icons/react`. **Verified present** in the installed package:
`packages/web/node_modules/@phosphor-icons/react@2.1.10/dist/csr/User.d.ts` exports
`{ I as UserIcon }` (the bare `User` export is deprecated — do not use it).
`EventDetailsSection` already imports `UsersIcon` (plural) from the same package, so the
dependency and the import style are established.

Rendered as `<UserIcon aria-hidden="true" size={8} weight="fill" />` inside the 12px inner
disc, with `color` inherited from the disc's inline `color` (phosphor icons default to
`currentColor`). `aria-hidden` matches `EventRepeatIcon`'s treatment of a decorative glyph.

**How `Guest` reaches assistive tech — SUPERSEDED at Gate 3 pass 1 (ruling A).** This
section previously claimed the avatar's `title` attribute carried
`` `${attendee.displayName ?? "Guest"}, ${attendeeStatusLabel(status)}` `` to AT. That was
incorrect for the two reasons set out in section 8: `pointer-events-none` prevents any
hover hit-test, and `role="img"` on the root makes the subtree an a11y leaf whose
descendant attributes are never announced. The `title` was removed entirely in RF-01.

**Current behaviour:** `Guest` does not reach assistive tech, because it is no longer
rendered at all. A null `displayName` produces the neutral person glyph and empty text,
and nothing else. Per-attendee identity is deliberately never announced (FR-10). The
accessible channel is the group label on the root — e.g. `"1 guest: 1 no response"` —
which conveys count and per-status breakdown without naming anyone. AC-9 is re-scoped
accordingly and is asserted via the glyph-present / empty-text pair plus the group label,
not via `getByTitle`.

### 3.6 Element structure

```tsx
if (!attendees || attendees.length === 0) return null;

const discColor = darken(baseColor, 30);          // same tint EventRepeatIcon uses
const discTextColor = theme.getContrastText(discColor);

return (
  // biome-ignore lint/a11y/useSemanticElements: A decorative avatar row is an
  // image for a11y purposes, not an <img> with a src.
  <span
    aria-label={groupLabel}
    className={cn(
      "pointer-events-none flex h-4 shrink-0 select-none items-center gap-0.5",
      className,
    )}
    data-testid="event-attendee-badge"
    role="img"
  >
    {visible.map((attendee) => {
      const monogram = monogramFor(attendee.displayName);
      return (
        <span
          key={attendee.email}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full p-0.5",
            ATTENDEE_STATUS_DOT[attendee.responseStatus],
          )}
          data-testid="event-attendee-avatar"
        >
          <span
            className="flex size-full items-center justify-center rounded-full text-[8px] leading-none"
            style={{ backgroundColor: discColor, color: discTextColor }}
          >
            {monogram ?? <UserIcon aria-hidden="true" size={8} weight="fill" />}
          </span>
        </span>
      );
    })}
    {overflowCount > 0 && (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] leading-none"
        data-testid="event-attendee-overflow"
        style={{ backgroundColor: discColor, color: discTextColor }}
        title={`${overflowCount} more`}
      >
        {`+${overflowCount}`}
      </span>
    )}
  </span>
);
```

Notes the implementer must not "clean up":

- The overflow chip's text is a **template literal**, not `+{overflowCount}`. The latter
  produces two text nodes; `getByText("+4")` still matches via `textContent`, but the
  single node keeps the DOM snapshot honest and avoids RTL normalization surprises.
- The outer avatar span carries the status `bg-*` class **and** `p-0.5`; the padding is
  what turns the background into a 2px ring around the inner disc. Removing the padding
  turns it into a solid status-colored disc under 8px text, which fails contrast (§10).
- `size-full` on the inner disc, not `size-3`. It must track the outer box minus padding.
- No `key` on the overflow chip (single static element).
- Export as a named const arrow component: `export const EventAttendeeBadge = ({ … }: EventAttendeeBadgeProps) => { … }`.
  No `forwardRef`, no `React.memo` (§11).

Imports for this file, in Biome's order (node/npm, then `@core/*`, then `@web/*`, then
relative):

```ts
import { UserIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { ATTENDEE_STATUS_DOT, attendeeStatusLabel } from "@web/common/styles/attendee-status";
import { darken } from "@web/common/styles/color.utils";
import { theme } from "@web/common/styles/theme";
```

(If Biome reorders these on `bun lint`, accept Biome's output — it is the authority.)

---

## 4. The accessible label (FR-10)

**Exact template, on the badge root only:**

```ts
const acceptedCount = countAccepted(attendees);
const groupLabel = `${attendees.length} ${
  attendees.length === 1 ? "guest" : "guests"
}, ${acceptedCount} accepted`;
```

with

```ts
const countAccepted = (attendees: readonly Attendee[]): number => {
  let accepted = 0;
  for (const attendee of attendees) {
    if (attendee.responseStatus === "accepted") accepted += 1;
  }
  return accepted;
};
```

Examples: `1 guest, 0 accepted` · `3 guests, 2 accepted` · `50 guests, 12 accepted`.

**Why no input can put an `@` in it.** The template has exactly four interpolation sites
and all four are numbers or fixed literals:

1. `attendees.length` — a `number`.
2. `"guest"` / `"guests"` — string literals in this file.
3. `", "` and `" accepted"` — string literals in this file.
4. `acceptedCount` — a `number` produced by an integer accumulator.

No attendee-derived *string* is interpolated. `attendee.email` is never read here.
`attendee.displayName` is never read here. Therefore the label is `@`-free by
construction, independent of input — including the "displayName that looks like an email"
case, which cannot reach this string at all.

**The `displayName`-contains-`@` case — REWRITTEN at Gate 3 pass 2 (RF-04 completion).**

The original text here said the per-avatar `title` "**does** interpolate `displayName`" and
instructed: *"The AC-8 test must be written against the all-null fixture as specified; do
not broaden it to arbitrary displayNames."* Both statements are now **wrong and actively
dangerous** — as written they tell a future implementer to put `displayName` back into a
DOM attribute and to delete the test that prevents it. The security reviewer caught this on
pass 2. Corrected:

- *Rendered text:* the monogram regex `/^[\p{L}\p{N}]$/u` (§3.4) rejects `@`, so
  `displayName: "@lice"` renders the person glyph, not `@`. **Note the precise invariant:**
  one attendee-supplied code point *does* reach the DOM — the uppercased monogram. What
  holds is that it is whitelisted to `\p{L}`/`\p{N}`, so `@` specifically cannot appear. Do
  not restate this as "no attendee-supplied text reaches the DOM"; that absolute is false
  and would mislead the next reader.
- *Attributes:* there is **no** per-avatar `title` any more, and no other attribute
  interpolates `displayName`. RF-01 deleted both `title` attributes. The only surviving read
  of `displayName` in the component is `monogramFor(attendee.displayName)`, and the only
  read of `email` is the React `key`.
- *The AC-8 test SHOULD be broadened*, and now is. `EventAttendeeBadge.test.tsx` carries
  "keeps @ out of the DOM when a display name looks like an email", which renders
  `displayName: "victim@corp.com"` and asserts no `@` in `textContent` **and** no `@` in any
  attribute of any element in the subtree. That test is the regression lock for MEDIUM-1/2.
  Do not delete or narrow it.

**`role="img"` and name computation.** The root carries `role="img"` plus `aria-label`,
which makes it a leaf in the accessibility tree — descendants are not announced, so the
group summary is the only thing a screen reader hears, and per-avatar titles cannot leak
into the announcement. It is queryable as `getByRole("img", { name: "3 guests, 2 accepted" })`.
The `biome-ignore lint/a11y/useSemanticElements` comment is required and follows the exact
house pattern already used on both cards for `role="button"`.

**`email` as the React `key`.** Yes — `key={attendee.email}`. React consumes `key`
internally for reconciliation; it is never written to the DOM as an attribute, never
serialized, and never appears in `outerHTML`. That is what makes it the one permitted use
of the PII field (requirements §5 says so explicitly). Attendee lists are unique by email
upstream (`AttendeeSchema` keyed by address in the provider mapping), so no duplicate-key
warning. Do **not** substitute `key={index}` "for safety" — that breaks reconciliation on
list reorder and gains nothing.

---

## 5. Size gating (Gate 1 Q2 = yes)

### TimedEventCard

Insert immediately after the existing `showTimeLabel` block (L122–126), before the
`lineClamp` `useMemo`:

```ts
const attendeeCount = event.attendees?.length ?? 0;
const showAttendeeBadge =
  attendeeCount > 0 &&
  position.height >= MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE &&
  position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE;
```

That is `attendeeCount > 0 && position.height >= 52 && position.width >= 90`.
`COMPACT_EVENT_MAX_HEIGHT` (15) is not referenced directly — 52 already excludes every
compact card, and adding a redundant `!isCompactEvent` term would be dead code.

**Including `attendeeCount > 0` in the card-level gate is not optional.** It is what makes
FR-16 and FR-18 hold simultaneously: with no attendees the flag is `false`, so both the
JSX and the `lineClamp` arithmetic collapse to their anchor-commit behavior.

### AllDayEventCard

Insert immediately after the existing `showRepeatIcon` (L76–77):

```ts
const attendeeCount = event.attendees?.length ?? 0;
const showAttendeeBadge =
  attendeeCount > 0 && position.width >= MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE;
```

That is `attendeeCount > 0 && position.width >= 120`. **No height term** — the all-day row
is a fixed `EVENT_ALLDAY_HEIGHT = 20`, so height carries no information here. The 16px
badge fits inside 20px with 4px to spare.

### Fixture confirmation

| Card | Gate | Default fixture (60×140) | Result |
|---|---|---|---|
| Timed | `h >= 52 && w >= 90` | 60 ≥ 52, 140 ≥ 90 | **renders** |
| All-day | `w >= 120` | 140 ≥ 120 | **renders** |

New positive badge tests reuse the shared `position` verbatim. Only two tests supply a
custom position: `{ ...position, height: 40 }` (timed, below the height gate) and
`{ ...position, width: 100 }` (all-day, below the all-day width gate).

---

## 6. Layout (FR-18) — the highest-risk decision

### TimedEventCard: the badge is a third flex row, not absolutely positioned

**Rejected:** absolute positioning. `EventRepeatIcon` already owns
`absolute right-1 bottom-0.5`, and the badge is up to 52px wide — the only place it fits
absolutely is bottom-left, where it would overlay the time label (which sits at the bottom
of the flex column with `zIndex: ZIndex.LAYER_3`). Resolving that collision means either
moving the repeat icon (a visible change to a shipped feature with its own tests at
`EventCard.test.tsx` L268–343) or hiding the time label when attendees exist (a behavior
regression). Neither is acceptable. Flow layout has no collision to resolve.

**Placement:** the badge is the **last child** of the content `<div>` (the one with
`className="flex flex-col flex-wrap items-start"`, `style={{ color: contentColor }}`, and
`EVENT_CONTENT_ATTRIBUTE`), i.e. immediately after the closing `)}` of the
`{!event.isAllDay && ( … )}` fragment at L361, still inside the content div that closes at
L362:

```tsx
        )}
        {showAttendeeBadge && (
          <EventAttendeeBadge attendees={event.attendees} baseColor={bgColor} />
        )}
      </div>
      {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
```

Last-child placement means the existing children keep their exact DOM order and indices;
nothing before the badge moves. The two resize-handle divs inside that fragment are
`position: absolute`, so document order relative to the badge is visually irrelevant.

**Line-clamp arithmetic.** Replace the `useMemo` at L131–139 with:

```ts
  const lineClamp = useMemo(
    () =>
      getLineClamp(
        position.height -
          (showTimeLabel ? GRID_EVENT_TIME_LABEL_LINE_HEIGHT : 0) -
          (showAttendeeBadge ? ATTENDEE_BADGE_LINE_HEIGHT : 0),
      ),
    [position.height, showAttendeeBadge, showTimeLabel],
  );
```

`ATTENDEE_BADGE_LINE_HEIGHT` is imported from `./EventAttendeeBadge`, **not** added to
`grid.constants.ts` (not in the allowlist) and **not** threaded through `getLineClamp`
(`grid.util.ts` is not in the allowlist either).

Equivalence proof for the no-badge path — the anchor expression is
`showTimeLabel ? position.height - GRID_EVENT_TIME_LABEL_LINE_HEIGHT : position.height`.
With `showAttendeeBadge === false` the new expression is
`position.height - (showTimeLabel ? 13 : 0) - 0`, which is numerically identical for both
branches. **Every existing `EventCard.test.tsx` line-clamp assertion is therefore
unaffected**, including L128 `expect(title.style.webkitLineClamp).toBe("3")` at
height 60 (`getLineClamp(47)` → `max(1, round(40/16)) = max(1, 3) = 3`) and L147
`toBe("1")` at height 15.

With a badge at height 60: `getLineClamp(60 - 13 - 16) = getLineClamp(31) = max(1, round(24/16)) = max(1, 2) = 2`.
Content stack = 2×16 + 13 + 16 = 61px against a 60px card — the same 1px overhang the
anchor already has (48 + 13 = 61), clipped identically by the card's `overflow-hidden`.
No new overflow class of behavior is introduced.

`getLineClamp` clamps at `Math.max(1, …)`, so even a pathological height cannot produce 0
or a negative clamp.

### AllDayEventCard: the badge joins the existing title row

The badge becomes the **second child** of the `flex min-w-0 items-center` row (L187–200),
directly after the title `<span>`:

```tsx
      <div
        className={cn("flex min-w-0 items-center", {
          // Reserve room so a long title truncates before the bottom-right icon.
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
          <EventAttendeeBadge
            attendees={event.attendees}
            baseColor={bgColor}
            className="ml-1"
          />
        )}
      </div>
```

The row's `cn(...)` call, its `pr-3.5` condition, and the title span are **unchanged**.
The badge root's `shrink-0` plus the title's existing `min-w-0 truncate` (default
`flex-shrink: 1`) mean the title yields space to the badge and truncates — the badge is
never squeezed. The existing `pr-3.5` reserve when `showRepeatIcon` is true keeps the badge
clear of `EventRepeatIcon`'s `absolute right-1 bottom-0.5` with no new logic. `ml-1` (4px)
separates the badge from the title's trailing ` `.

This is the only use of the badge's `className` prop; `TimedEventCard` passes none.

---

## 7. FR-16 — byte-identical output when `attendees` is absent or empty

**The idiom is `{cond && <X />}` and nothing else.** Concretely:

- `{showAttendeeBadge && <EventAttendeeBadge … />}` on both cards. When
  `showAttendeeBadge` is `false`, the expression evaluates to `false`, which React renders
  as nothing: no element, no text node, no comment node.
- **Forbidden alternatives**, each of which breaks byte-identity or readability:
  `{showAttendeeBadge ? <X /> : null}` (equivalent output but gratuitously different from
  the file's existing `&&` idiom at L314, L327, L329, L363); any always-rendered wrapper
  such as `<span className="…">{showAttendeeBadge && …}</span>` (emits an element
  unconditionally — hard fail); `{showAttendeeBadge && " "}`; and any `{" "}` spacer added
  around the new line.

**Whitespace.** JSX strips whitespace-only text that contains a newline, so putting the new
expression on its own indented line adds no text node. Do not put the badge expression on
the same line as a sibling element with a space between them.

**Two independent guards.** `showAttendeeBadge` is `false` when `attendeeCount === 0`
(card level), *and* `EventAttendeeBadge` returns `null` when `attendees` is `undefined` or
empty (component level, FR-5). Either alone satisfies FR-16; both are required — the card
gate is what keeps the `lineClamp` arithmetic identical, and the component gate is what
makes the component safe to unit-test in isolation.

**Nothing else in either card changes.** No class string is touched. No `aria-label`
construction is touched (FR-17 — the badge's label lives on the badge; `accessibleLabel`
at `TimedEventCard` L265 and `AllDayEventCard` L138 keeps its exact current inputs).
`TimedEventCardProps` and `AllDayEventCardProps` are not edited at all (FR-15, AC-14) —
the badge reads `event.attendees` and `position`, both already present.

Verification for the reviewer: `git diff 2d81253a -- packages/web/src/grid/components/TimedEventCard.tsx`
should show exactly four hunks — the import line, the `showAttendeeBadge` block, the
`useMemo` body + deps, and the badge JSX line. `AllDayEventCard.tsx` should show three.

---

## 8. FR-12 — inertness

On the badge root:

- `className` includes **`pointer-events-none`** — the same mechanism `EventRepeatIcon`
  uses (`"pointer-events-none absolute right-1 bottom-0.5"`). Pointer events pass straight
  through to the card, so `onEventMouseDown`, the drag/resize interaction layer's
  `data-week-interaction-*` hit-testing, and the resize handles all behave exactly as
  before. The badge cannot become an unintended drag target.
- `className` includes **`select-none`**, matching the cards' own `select-none`, so a
  drag-select over a card cannot start a text selection on a monogram.
- **No `tabIndex`** anywhere in the file. `<span>` is not natively focusable and
  `role="img"` adds no tab stop, so the card's `tabIndex={0}` remains the only stop —
  keyboard navigation counts are unchanged.
- **No `onMouseDown`, `onClick`, `onKeyDown`, `onPointerDown`, or any other handler** in
  `EventAttendeeBadge.tsx`. There is therefore no `e.stopPropagation()` and no
  `e.preventDefault()` in the file. Grep for `stopPropagation` in
  `EventAttendeeBadge.tsx`: zero hits. This is a review checkpoint.
- No `data-calendar-event-*` attribute, no `data-week-interaction-*` attribute. The badge
  is invisible to the interaction layer's attribute lookups.

**Accepted trade-off (CORRECTED at Gate 3 pass 1 — RF-01/RF-04).** The original text
here claimed the per-avatar `title` "stays in the DOM and is still exposed to assistive
technology … so NFR-5's non-color signal and AC-9 both hold." **That was wrong**, and both
the senior and security reviewers independently caught it. Two independent mechanisms
closed that channel:

1. `pointer-events-none` is an inherited CSS property and no descendant overrides it, so
   the browser never hit-tests any element in the badge subtree. The native tooltip
   `title` exists to produce is therefore unreachable — not merely degraded.
2. The root carries `role="img"` with an `aria-label`, which makes the subtree an
   accessibility leaf. Descendant `title` attributes are never announced.

So the `title` was announced by nobody and hoverable by nobody, while still holding
`displayName` — which directory syncs frequently set to the attendee's email address — in
the DOM of an always-visible, commonly screen-shared surface. It bought nothing and cost
PII exposure.

**Resolution (RF-01):** both the per-avatar and overflow-chip `title` attributes were
deleted outright. The design now states plainly:

- **The status ring is decorative for sighted users.** Hue is the only visual status cue.
  This is an accepted trade-off at 16px, taken deliberately rather than claimed away.
- **The accessible status channel is the group `aria-label` on the badge root**, which now
  carries the full per-status breakdown — `"3 guests: 2 accepted, 1 declined"` — omitting
  zero-count statuses. This is what satisfies NFR-5's non-colour signal; it is strictly
  more information than the old per-avatar `title` ever delivered to AT.
- **Identity placeholders are group-level only** (Gate 3 ruling A). "Guest" is no longer a
  rendered string anywhere. A null `displayName` renders the neutral person glyph with no
  text, and AC-9 is re-scoped to assert exactly that. No attendee-supplied text reaches
  the DOM at all — `attendee.email` is used solely as a React key.

FR-12's "must not capture pointer events" is explicit and still outranks a hover tooltip on
a card whose entire surface is a drag target; the difference is that we no longer pretend
the tooltip's payload survives elsewhere.

---

## 9. NFR-6 — contrast on a dynamic fill

**The status color is never placed underneath text.** This is the load-bearing decision and
it is forced by the palette, not by taste. Working from `index.css`:

| Token | dark-abyss | light-beach |
|---|---|---|
| `--success` | `#78AE88` (light) | `#57876A` (mid-dark) |
| `--warning` | `#C2A578` (light) | `#9C7D45` (mid-dark) |
| `--error` | `#C17E70` (light) | `#AD6553` (mid-dark) |
| `--text-subtle` | `#4E5A66` (**dark**) | `#948B74` (mid) |

Within a single theme the four status colors straddle the mid-tone dead zone: in
dark-abyss, `--text-subtle` needs light text while `--warning` needs dark text. No single
token contrasts with all four, and `lightColors` in `common/styles/colors.ts` carries only
4 roles (no `success`/`warning`/`error`/`textSubtle`), so per-theme JS contrast math on the
status hexes is not available without editing a file guarded by the out-of-allowlist
`theme-css.test.ts`. **Therefore a monogram on a status-colored disc cannot be made
AA-legible and is rejected.**

**What is built instead:**

- The status token (`ATTENDEE_STATUS_DOT[status]`, FR-7 — no literal color class in the
  badge) is the background of the **outer** span, which `p-0.5` reduces to a 2px ring
  around the disc. The ring's neighbor is the card fill, exactly the situation
  `EventRepeatIcon`'s `darken(baseColor, 30)` glyph already lives in and which
  `EventDetailsSection`'s dots live in on the form panel. Ring contrast is a decorative
  signal, and NFR-5 is satisfied independently by the `title` text and the root label — so
  status is never conveyed by color alone.
- The **monogram** sits on `discColor = darken(baseColor, 30)` — the identical helper and
  amount `EventRepeatIcon` uses, from `@web/common/styles/color.utils` — with
  `color: theme.getContrastText(discColor)` from `@web/common/styles/theme`. Both come from
  the `baseColor` **prop**, so the badge tracks the card's per-state fill (draft, past
  darken/brighten, hover, resizing) automatically. The badge **never calls
  `useEventPalette`**; the parent already resolved the fill and passes it, matching
  `<EventRepeatIcon baseColor={bgColor} />` at `TimedEventCard` L363 and
  `AllDayEventCard` L201.
- Worked example, dark-abyss default fill `#82A0B2` → `darken(…, 30)` ≈ `#375065` →
  `getContrastText` picks `colors.text` `#C6D0D9` at ≈5.3:1. Light-beach `#454442` →
  ≈ near-black → picks `lightColors.onAccent` `#F6F3EA`, comfortably above 4.5:1.
  `getContrastText` always returns whichever of the theme's two candidates has the higher
  measured `readability`, so an arbitrary provider `colorHex` gets the best available
  choice — the same guarantee the card title itself has, and no weaker.

**No new semantic token is introduced** (`index.css` is out of the allowlist and does not
need editing), and **no raw Tailwind palette class appears anywhere** — the only colors in
the badge are the four shared-map tokens and two runtime hex strings in inline `style`,
neither of which the `check-semantic-colors.ts` regexes can match (they match
`(bg|text|border|ring|outline|…)-<palette-name>` and `--color-<palette-name>` only).
NFR-1 and NFR-2 hold by construction.

---

## 10. NFR-7 — render cost

- **O(cap) rendering.** `attendees.slice(0, avatarCount)` allocates one array of at most
  2–3 entries and the map produces at most 3 elements. No formatting, no `toLocaleString`,
  no `Intl`, no sort, no per-attendee label for hidden attendees.
- **One O(n) integer scan.** `countAccepted` walks the full list once with a single
  numeric accumulator and **zero allocation** — no `.filter()` intermediate array, no
  closure per element. NFR-7 forbids "O(n) *formatting* over the full list"; an
  allocation-free integer count is what the requirement's own example label
  ("3 guests, 2 accepted") demands, and it is cheaper than the `.slice()` that sits beside
  it. `.filter(a => a.responseStatus === "accepted").length` is **rejected** for the array
  allocation.
- **Two tinycolor calls per badge render** (`darken`, then `readability` twice inside
  `getContrastText`). This is the identical per-render cost `EventRepeatIcon` and the
  card's own `contentColor` already pay, on the same hot path, and is O(1).
- **No memoization-defeating props.** The card passes `attendees={event.attendees}` (a
  stable reference off the event object — no `?? []`, no spread) and `baseColor={bgColor}`
  (a primitive string). Neither creates a fresh object identity per render, so any
  `React.memo` upstream of the cards keeps working.
- **`useMemo` inside the badge is over-engineering and must not be added.** The memo
  bookkeeping (dependency array allocation + comparison) costs more than a 3-element slice
  and two hex computations, and hooks would make the component non-trivially harder to
  test. `React.memo` on the badge is likewise rejected — `EventRepeatIcon`, the direct
  precedent on the same hot path, is a plain function component. The one `useMemo` this
  change touches is the card's **existing** `lineClamp` memo, which gains one dependency.

---

## 11. Test plan

### AC → test mapping

| AC | Test name | File | Notes |
|---|---|---|---|
| 1 (`bun test:web` ≥ 2298 pass / 0 fail) | — | — | Suite-level gate. The 8 new tests below take the count to ≥ 2306. |
| 2 (`bun lint` exit 0) | — | — | Pipeline gate. `check-semantic-colors.ts` runs first; see §9. |
| 3 (`type-check:web-tests` exit 0) | — | — | Pipeline gate; also the FR-2 enforcement mechanism. |
| 4 | `renders the attendee badge on a timed event with attendees` | `EventCard.test.tsx` | Default `position`. `getByRole("img", { name: "2 guests, 1 accepted" })`. |
| 5 | `renders the attendee badge on an all-day event with attendees` | `EventCard.test.tsx` | Default `position`, `isAllDay: true`. |
| 6 | `renders no attendee badge when an event has no attendees` | `EventCard.test.tsx` | Four `render` calls in one test (timed/all-day × `undefined`/`[]`), each asserting `queryByTestId("event-attendee-badge")` is `null`. Use separate `render` calls with cleanup between via distinct `screen` queries, or `rerender`. |
| 7 | `caps the row at MAX_VISIBLE_ATTENDEES elements and counts the overflow` | `EventAttendeeBadge.test.tsx` | 6 attendees (= `MAX_VISIBLE_ATTENDEES + 3`). Assert `getAllByTestId("event-attendee-avatar")` has length 2, `getAllByTestId("event-attendee-overflow")` has length 1, and `getByTestId("event-attendee-overflow")` has text `"+4"`. |
| 8 | `never renders an @ anywhere when every displayName is null` | `EventAttendeeBadge.test.tsx` | 3 attendees, all `displayName: null`, emails all containing `@`. Assert `container.textContent` has no `@`, and every `title`/`aria-label` in `container.querySelectorAll("[title], [aria-label]")` has no `@`. |
| 9 | `renders the neutral glyph and no text for an attendee with no display name` | `EventAttendeeBadge.test.tsx` | **SUPERSEDED by Gate 3 ruling A.** Was `getByTitle("Guest, hasn't responded")`; the `title` no longer exists. Now: `getByTestId("event-attendee-avatar")`, assert it contains an `svg` (the person glyph) and `textContent === ""`, plus assert the group label `getByRole("img", { name: "1 guest: 1 no response" })`. "Guest" is no longer a rendered string anywhere. Note the aggregate noun is "no response", not `attendeeStatusLabel`'s per-attendee "hasn't responded" — see RF-05 / `ATTENDEE_STATUS_COUNT_NOUN`. |
| 10 | `maps every response status to its semantic token` | `attendee-status.test.ts` | Four explicit assertions: `accepted → "bg-success"`, `declined → "bg-error"`, `tentative → "bg-warning"`, `needsAction → "bg-text-subtle"`. |
| 11 | `is exhaustive over AttendeeResponseStatusSchema` | `attendee-status.test.ts` | Iterates `.options`; plus the key-count equality assertion (§2). |
| 12 | **covered by an existing, untouched test** | `EventForm.test.tsx` L1444–1484 `"shows attendees with RSVP status and marks the organizer"` | **No new test is written for AC-12, and not one character of `EventForm.test.tsx` may change.** Its `getByText("2 guests")` and `getByLabelText("guest@example.com, declined")` assertions are the FR-20 guard. That file is outside the write allowlist. |
| 13 (`git diff --stat` within allowlist) | — | — | Process gate at close-out; the §1 inventory is the expected diff. |
| 14 (`*CardProps` textually unchanged) | — | — | Guaranteed by not editing either interface. No test needed; a reviewer diffs L60–83 of `TimedEventCard.tsx` and L34–52 of `AllDayEventCard.tsx` and expects zero hunks. |

### Additional tests beyond the ACs (both in `EventCard.test.tsx`)

| Test name | Why |
|---|---|
| `hides the attendee badge on a short timed event` | Size gate, negative case. `position: { ...position, height: 40 }` with 2 attendees → `queryByTestId("event-attendee-badge")` is `null`. Guards Gate 1 Q2. |
| `keeps the timed title line clamp unchanged when an event has no attendees` | The single highest-value regression test. Renders the long-title event with no attendees at the default `position` and asserts `webkitLineClamp === "3"`, then renders the same event **with** 2 attendees and asserts `"2"`. Locks §6's arithmetic in both directions. |

### Fixture conventions

- `EventCard.test.tsx` extends its existing `createEvent` helper by passing
  `attendees: [...]` through `overrides` — the helper already spreads `overrides` and casts
  to `GridEvent`, so **no edit to `createEvent` is needed**. Do not modify lines 20–45.
- `EventAttendeeBadge.test.tsx` defines its own local
  `const attendee = (overrides: Partial<Attendee> = {}): Attendee => ({ email: "a@example.com", displayName: "Ada", responseStatus: "needsAction", ...overrides })`
  and always passes `baseColor="#82A0B2"`.
- All new tests use `bun:test` (`describe`/`it`/`expect`) with
  `@testing-library/react` + the `import "@testing-library/jest-dom"` side-effect import,
  matching `EventCard.test.tsx` L1–18 exactly.
- New tests are **appended** inside the existing `describe("EventCard", …)` block in
  `EventCard.test.tsx`, after the last test (L574). Nothing above is reordered or edited.

---

## 12. ADRs for the contested decisions

### ADR-1 — Status color is a ring around the avatar, never the avatar's fill

**Context.** FR-7 requires the avatar's status color to come from the shared `bg-*` map.
FR-8 requires a monogram on the avatar. NFR-6 requires legibility across a dynamic card
fill. The four status tokens straddle the mid-tone dead zone within a single theme
(`--text-subtle` `#4E5A66` vs `--warning` `#C2A578` in dark-abyss), so no fixed text token
reads on all four, and `lightColors` lacks the hexes needed to compute per-status contrast
in JS.
**Decision.** The `bg-*` status class goes on an outer `p-0.5 rounded-full` span, which
renders as a 2px ring. The monogram sits on an inner disc painted `darken(baseColor, 30)`
with `theme.getContrastText(discColor)` text.
**Alternative rejected.** Status color as the disc fill with a fixed `text-background` or
`text-on-accent` monogram. Measured: `#06090F` on `#4E5A66` is 2.8:1 and `#F3EEE2` on
`#57876A` is 3.6:1 — both fail AA at 8px. Also rejected: adding
`success/warning/error/textSubtle` to `lightColors` so `getContrastText` could take the
status hex — `common/styles/**` is writable, but `theme-css.test.ts` (not writable) guards
that file's parity and the change would be a much larger blast radius than the feature
warrants.
**Consequences.** Two nested spans per avatar instead of one. The status signal is thinner
than the form's 10px dot, which is why the `title` text and the root `aria-label` (not the
ring) are the load-bearing status signals for NFR-5. The monogram's contrast is guaranteed
by the same helper the card title already trusts.

### ADR-2 — The badge is a flow-layout third row on the timed card, and the line clamp pays for it

**Context.** `TimedEventCard`'s content is a vertical flex column whose title clamp is
computed from `position.height`. `EventRepeatIcon` already owns the absolute bottom-right
corner. FR-18 forbids breaking the clamp or pushing the time label past the clipped edge.
**Decision.** Render the badge as the last flex child and subtract
`ATTENDEE_BADGE_LINE_HEIGHT` (16) from `getLineClamp`'s input, but **only when the badge
actually renders**.
**Alternative rejected.** Absolute positioning at bottom-left. It overlays the time label
(`ZIndex.LAYER_3`), and the only collision-free variants require either relocating
`EventRepeatIcon` (breaking `EventCard.test.tsx` L268–343, which asserts `right-1` /
`bottom-0.5`) or suppressing the time label when attendees exist (a behavior regression on
every meeting).
**Consequences.** A 60px card with attendees clamps its title to 2 lines instead of 3 — an
intentional, visible trade. Because the subtraction is gated on `showAttendeeBadge`, which
includes `attendeeCount > 0`, every existing clamp assertion is numerically unchanged. The
constant must live in `EventAttendeeBadge.tsx` since `grid.constants.ts` is out of the
allowlist, which is slightly odd placement but keeps all five new constants in one file.

### ADR-3 — Monogram characters are restricted to `\p{L}` / `\p{N}`; anything else becomes the person glyph

**Context.** FR-10 demands no `@` "under any input", and explicitly names the case where a
`displayName` itself looks like an email. A naive `displayName.charAt(0)` on
`"@lice"` renders `@`; on an emoji name it renders a lone surrogate.
**Decision.** `monogramFor` returns a monogram only when the first code point matches
`/^[\p{L}\p{N}]$/u`; otherwise it returns `null` and the avatar renders `UserIcon`.
**Alternative rejected.** Stripping/replacing `@` specifically. That is a denylist — it
handles the one character the requirement names and lets `#`, `+`, `<`, and broken
surrogates through. A letter/digit allowlist is total, and it collapses the null case and
the junk case into a single well-tested path.
**Consequences.** A user named `"++Ops"` gets a person glyph instead of `+`, which is
correct (a `+` monogram would be indistinguishable from the overflow chip). The
`@`-freedom of rendered text becomes a property of the regex rather than a property of the
test fixtures.

### ADR-4 — The group label carries an accepted count, at the cost of one O(n) integer scan

**Context.** FR-10's example label is "3 guests, 2 accepted"; NFR-7 says derivation must be
O(cap), not O(n) over the full list.
**Decision.** Build the label from `attendees.length` and an accepted count computed by a
single allocation-free `for` loop.
**Alternative rejected.** A label of just "3 guests", which is strictly O(cap). It drops
the only status information a screen-reader user would get from the badge and makes the
badge announce less than the form's existing "3 guests" row already does — the badge would
add nothing for AT users. Also rejected: `.filter(...).length`, for the intermediate array.
**Consequences.** The badge is O(n) in integer comparisons for a list that is realistically
tens of entries, on a component that already pays two tinycolor conversions. NFR-7's actual
target — per-attendee *string* work — remains at zero beyond the ≤3 rendered avatars. This
is documented in the code comment above `countAccepted` so a future reader does not
"optimize" it into a filter.

---

## 13. Risk register (ranked)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Line-clamp regression.** The `useMemo` rewrite changes `webkitLineClamp` for events with **no** attendees, breaking `EventCard.test.tsx` L128 (`toBe("3")`) and L147 (`toBe("1")`). | Medium | Suite red; AC-1 fails | The `attendeeCount > 0` term in `showAttendeeBadge` makes the subtracted term exactly `0` on the anchor path; §6 carries the algebraic equivalence proof. A dedicated new test asserts `"3"` (no attendees) and `"2"` (with attendees) side by side. **Run `bun test:web -- EventCard` immediately after editing `TimedEventCard.tsx`, before touching anything else.** |
| **R2** | **Cap off-by-one (FR-9).** Using `>=` instead of `>`, or `slice(0, MAX_VISIBLE_ATTENDEES)` when overflowing, produces 3 avatars + a chip (4 elements) or a `+1` chip at exactly 3 attendees. | High | AC-7 fails; visual overflow on narrow cards | The §3.3 truth table is normative and must be reproduced as test cases at lengths 1, 2, **3**, 4, and 6. The length-3 case (avatars = 3, chip absent) is the one that catches `>=`. The invariant `avatars + N === attendees.length` is asserted at length 6. |
| **R3** | **FR-20 byte-identity break in `EventDetailsSection`.** Renaming a symbol, reformatting the JSX, or "tidying" the `?? attendee.email` fallback while the file is open. | Medium | `EventForm.test.tsx` L1472–1483 fails; that file is unfixable (outside the allowlist) | The shared module exports the **same two names** so the JSX body needs zero edits. The permitted diff is exactly: delete L12–20, add one import. **The `const name = attendee.displayName ?? attendee.email;` on L70 stays — it is deliberate form-panel behavior and must not follow the map into shared code** (requirements §5). |
| **R4** | **`check-semantic-colors.ts` hard-exit.** Any `bg-*`/`text-*` with a Tailwind palette word in the new files kills `bun lint` before Biome even runs. | Low | AC-2 fails | Badge colors are: four tokens from the shared map, and two runtime hex strings in inline `style` (invisible to the regex). No `text-white`, no `bg-black/20`, no `ring-slate-…`. `text-[8px]` is a size, not a color, and matches nothing. |
| **R5** | **Repeat-icon collision on the timed card.** A 3-avatar badge overlapping `absolute right-1 bottom-0.5`. | Low | Visual defect, no test catches it | `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 90` with the §3.1 arithmetic (52px badge + 14px icon reserve = 66px < 82px content box at the gate width). Flagged for the manual post-run visual check alongside the light/dark verification. |
| **R6** | **Biome a11y failure on `role="img"`** (`lint/a11y/useSemanticElements`). | Medium | AC-2 fails | The `// biome-ignore lint/a11y/useSemanticElements: …` comment is written into §3.6 and is the same pattern both cards already use for `role="button"`. If Biome flags something else instead, take Biome's suggestion — do **not** switch to `role="group"`, which would expose the avatar subtree to AT and reopen the FR-10 surface. |
| **R7** | **Pointer capture breaks drag/resize.** A stray handler or a missing `pointer-events-none`. | Low | Interaction regression, not covered by the badge tests | `pointer-events-none` on the root; grep `EventAttendeeBadge.tsx` for `stopPropagation`/`onMouse`/`onClick`/`tabIndex` and expect zero hits. The existing `EventCard.test.tsx` L52–98 mousedown test still passes because the badge never becomes the event target. |
| **R8** | **Arbitrary Tailwind class typo** (`size-4.5`, `p-[1.5px]`, a non-existent spacing step) silently producing no style in the real build while jsdom tests pass anyway. | Low | Invisible visual defect | Only classes with existing repo precedent or plain scale steps are specified: `size-4`, `size-full`, `p-0.5`, `gap-0.5`, `ml-1`, `h-4`, `rounded-full`, `leading-none`, plus the single arbitrary `text-[8px]`. Nothing else. |
| **R9** | **Duplicate React keys** if a provider ever sends the same email twice. | Very low | Console warning only | Accepted. `key={attendee.email}` is the requirement-sanctioned use (§5 of requirements); index keys are not an improvement. |

---

## 14. Sequencing

Packets must execute in this order; each step's tests should be green before the next
begins.

1. **`packages/web/src/common/styles/attendee-status.ts`** — nothing else compiles without
   it. Ship with `attendee-status.test.ts` (AC-10, AC-11) in the same packet.
2. **`packages/web/src/grid/components/EventAttendeeBadge.tsx`** — imports #1; owns all
   five constants that #3 and #4 need. Ship with `EventAttendeeBadge.test.tsx`
   (AC-7, AC-8, AC-9) in the same packet.
3. **`TimedEventCard.tsx`** — imports #2. Highest-risk edit (R1). Run
   `bun test:web` scoped to `EventCard.test.tsx` immediately.
4. **`AllDayEventCard.tsx`** — imports #2. Independent of #3; can be paired with it.
5. **`EventCard.test.tsx`** — appends AC-4, AC-5, AC-6 and the two regression tests. Must
   follow #3 and #4.
6. **`EventDetailsSection.tsx`** — the FR-19 refactor. Deliberately **last**: it is the
   only edit whose regression guard (`EventForm.test.tsx`) is outside the allowlist and
   therefore unfixable, so it should land against an otherwise-green suite where a failure
   can only have one cause. Depends on #1 only.

Full-suite verification (`bun test:web`, `bun lint`, `bun run type-check:web-tests`) after
step 6, then the manual light/dark + narrow-card visual check called out in requirements
§2.6.
