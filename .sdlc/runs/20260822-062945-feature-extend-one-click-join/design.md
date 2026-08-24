# Delta Design — CMP-103 — One-click join icon on event cards

**Run:** `20260822-062945-feature-extend-one-click-join`
**Intent:** `feature-extend` (brownfield delta design)
**Gate:** 2 (architecture)
**Upstream:** `requirements.md` (approved at Gate 1), `intent_brief.md`, `.sdlc/baseline/current.json`

This is a **delta design**. It describes only what changes. Everything not named here is unchanged.

---

## 0. Verified baseline (re-confirmed at Gate 2, not assumed)

| Fact | Evidence read this run |
|---|---|
| `GridEvent.conference` exists | `packages/web/src/common/types/web.event.types.ts:88` — `conference: ConferenceSchema.nullable().optional()` |
| `Conference = { url, label }` | `packages/core/src/types/event-attendance.contracts.ts:31-35` — `url: z.url()`, `label: z.string().trim().min(1).max(256).nullable()` |
| One-click-join precedent | `packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:31-32` — `window.open(conferenceUrl, "_blank", "noopener,noreferrer")` |
| Sibling icon precedent | `packages/web/src/grid/components/EventRepeatIcon.tsx` — `aria-hidden`, `pointer-events-none absolute right-1 bottom-0.5`, `darken(baseColor, 30)`, `size={10}`, `weight="bold"` |
| Repeat gating (timed) | `TimedEventCard.tsx:57-58,116-120` — `REPEAT_ICON_MIN_DURATION_MINUTES = 15`, `REPEAT_ICON_MIN_WIDTH = 40` |
| Repeat gating (all-day) | `AllDayEventCard.tsx:32,76-77` — `REPEAT_ICON_MIN_WIDTH = 60` |
| All-day title reserve | `AllDayEventCard.tsx:188-191` — `cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon })` |
| `EventCard.test.tsx` is existing | 575 lines, `describe("EventCard")`, imports `mock` from `bun:test`, has `createEvent(overrides)` (line 20) and `position` (line 40) |
| **PostHog autocapture is ON** | `packages/web/src/auth/posthog/posthog.bootstrap.ts:24-46` — `posthog.init` never sets `autocapture: false` (posthog-js defaults to `true`), and `filterPosthogDeadClick` is registered in `before_send`, which only exists because `$dead_click` autocapture is live |
| **The drag engine is pointer-driven** | `packages/web/src/interaction/interaction.engine.ts:126-157,192-229` + `interaction.adapter.types.ts:24` — `getTarget(event: PointerEvent)`; `handlePointerDown` opens a `pending` session, `handlePointerUp` on a `pending` session returns `{ type: "click" }` |
| Target resolution is by DOM ancestry | `packages/web/src/grid/interaction/view-event-registry.ts:50-66` — `element.closest("[data-week-interaction-event-id], [data-day-interaction-event-id]")` |
| No `Icons/VideoCamera.tsx` wrapper exists | Path absent on disk |

**Consequence:** no upstream plumbing. Pure 3-source-file delta plus a test append plus `.gitignore`.

**New consequence discovered this run (see ADR-5):** because the interaction engine resolves its target
with `closest()` from the pointer's `event.target`, a `pointerdown` anywhere inside the card — including on
a new join button — resolves to the card and starts a `pending` session. On `pointerup` that session returns
`{ type: "click" }`, which is how the grid opens an event. **`onClick` / `onMouseDown` propagation stopping
does not touch that path**, because the engine's "click" is synthesised from pointerup, not from a DOM
`click` event. This raises the FR-4 handler set beyond what requirements §3 assumed.

---

## 1. Delta summary

| File | Kind | What changes | Why |
|---|---|---|---|
| `packages/web/src/grid/components/EventJoinIcon.tsx` | **new** | Presentational `<button>` + glyph; exports `EventJoinIcon` and `isSafeConferenceUrl` | FR-1..FR-6, D1, D3 |
| `packages/web/src/grid/components/TimedEventCard.tsx` | **edit** (`patch_apply`) | 3 constants, 1 import line, 3 derived consts, 1 JSX block | FR-7..FR-10 |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | **edit** (`patch_apply`) | 2 constants, 1 import line, 3 derived consts, title-row padding ladder, 1 JSX block | FR-11..FR-13 |
| `packages/web/src/grid/components/EventCard.test.tsx` | **edit** (`existing_file_edit`, append-only) | 2 import-line edits, 1 module-scope const, `afterEach` extension, 1 helper, 18 appended `it(...)` cases | AC-1..AC-7, NFR-1 |
| `.gitignore` | **edit** (`patch_apply`) | Append `.sdlc/` under `# DIRS #` | AC-10 |

**Not edited, deliberately:** `EventRepeatIcon.tsx` (the repeat glyph keeps `right-1 bottom-0.5` unchanged —
the join icon is the one that moves), `grid.constants.ts`, `event.view-model.ts`, and all five off-limits
consumer surfaces.

---

## 2. Component contract — `EventJoinIcon`

**Path:** `packages/web/src/grid/components/EventJoinIcon.tsx`

### 2.1 Exported guard (D3)

```ts
/**
 * Render-time protocol guard for an event-supplied conference URL.
 *
 * `ConferenceSchema` validates with `z.url()` at the contract boundary, but a
 * grid card renders whatever reached it — a cached IndexedDB row written by an
 * older schema, a hand-seeded demo event, a future contract relaxation. A
 * `javascript:` or `data:` URL that slipped through must never become a
 * clickable control, so the protocol is re-checked at the point of render.
 *
 * `new URL()` strips leading/trailing C0-control-and-space per WHATWG, so a
 * padded `"  javascript:alert(1)  "` is parsed as `javascript:` and rejected
 * rather than throwing and accidentally looking like a different failure.
 */
export const isSafeConferenceUrl = (
  url: string | null | undefined,
): url is string => {
  if (!url) return false;

  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};
```

**Where it lives and why:** exported from `EventJoinIcon.tsx`, not a new util module. The write contract
allows exactly five paths; a `conference.util.ts` would require reopening Gate 0. Colocation is also the
correct call on its merits — the guard's only three consumers are this component and the two cards'
`showJoinIcon` gates, and it is part of the join affordance's contract, not general-purpose URL handling.
The domain-scoped name (`isSafeConferenceUrl`, not `isSafeHttpUrl`) signals that scope and discourages
unrelated reuse that would eventually justify a move.

**Why a type predicate:** `url is string` is what buys NFR-2. The cards narrow through it with a plain
ternary, so neither card needs a non-null assertion or an `any`.

### 2.2 Props

```ts
interface Props {
  baseColor: string;
  label: string | null;
  offsetForRepeatIcon?: boolean;
  url: string;
}
```

| Prop | Type | Required | Rationale |
|---|---|---|---|
| `baseColor` | `string` | yes | Named and typed identically to `EventRepeatIcon`'s only prop, and both cards already pass `bgColor` (the post-past/hover-resolved fill) into it. Reusing the exact name means the two sibling icons can't drift on how they tint. |
| `label` | `string \| null` | yes | Source of the accessible name. Required (not optional) so a card can never forget to pass it and silently degrade every event to the generic name — `null` is the explicit "no provider label" value, matching `ConferenceSchema`'s own `.nullable()`. |
| `offsetForRepeatIcon` | `boolean` (default `false`) | no | Selects the horizontal slot. Named after the cause rather than the effect (`shifted`/`slot`) because the call site reads `offsetForRepeatIcon={showRepeatIcon}` — a one-token, self-evident line. Optional with a `false` default so the common case (no repeat icon) needs no prop. |
| `url` | `string` | yes | The `window.open` target. Non-nullable: the cards do the `isSafeConferenceUrl` narrowing, so this component never re-validates and never renders a dead control. |

**Deliberately absent props:** no `onJoin` callback (FR-3 fixes the behaviour to `window.open`; a callback
would invite a consumer to route the URL somewhere loggable, violating PII-1), no `size`/`className`
escape hatch (the two call sites must stay identical; divergence is the failure mode `EventRepeatIcon`'s
docblock already warns about), and no `event` object (passing the whole `GridEvent` would put the title
and attendee list in reach of a presentational component that has no business with them).

### 2.3 Accessible name — `label`, not `title` (decided)

```ts
// A provider entry-point label is normally a product name ("Google Meet",
// "Zoom"). Some providers emit the meeting address as the label instead
// ("meet.google.com/abc-defg-hij", "https://zoom.us/j/123"). A slash is the
// reliable discriminator: no product name contains one, every URL-shaped
// string does. Rejecting those keeps the medium-sensitivity meeting URL out of
// the DOM entirely, per PII-2.
const providerLabel = label && !label.includes("/") ? label : null;
const accessibleName = providerLabel ? `Join ${providerLabel}` : "Join video call";
```

**Justification against FR-5 and the §5 PII table:**

1. **PII.** §5 rates `conference.label` **Low** ("Safe to use in the accessible name") and `event.title`
   **Medium**. `aria-label` is a DOM attribute; PostHog autocapture serialises element attributes as
   `attr__aria-label`. Choosing the Low-sensitivity field is the strictly safer of the two, and it is what
   the approved PII table already sanctions. (The `ph-no-capture` class of ADR-4 is the belt; this is the
   braces.)
2. **Redundancy.** The button is a descendant of a `role="button"` whose `aria-label` already contains the
   title (`"Timed event: Planning block, 9 - 10 AM"`). A screen-reader user reaches the join control
   *through* the card, so the title has just been announced. Repeating it produces
   "Planning block … Join Planning block" and adds zero information. The provider name is the one fact not
   announced anywhere else on the card.
3. **FR-5 literal compliance.** FR-5 specifies "`Join <label>` falling back to `Join video call`". This is
   that, plus the URL-shaped-label rejection which FR-5 did not anticipate.
4. **Distinctness (FR-5's "distinct from the card's").** `/join/i` never matches a card name, so the test
   queries are unambiguous by construction.

**No truncation.** `label` is capped at 256 chars by `ConferenceSchema` and is a short product name in
practice. Truncating an accessible name mid-word is worse for AT than a long one.

### 2.4 Full component shape

```tsx
import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { darken } from "@web/common/styles/color.utils";

const JOIN_ICON_SIZE = 12;

export const isSafeConferenceUrl = (/* §2.1 */) => { /* … */ };

interface Props { /* §2.2 */ }

export const EventJoinIcon = ({
  baseColor,
  label,
  offsetForRepeatIcon = false,
  url,
}: Props) => {
  const providerLabel = label && !label.includes("/") ? label : null;

  return (
    <button
      aria-label={providerLabel ? `Join ${providerLabel}` : "Join video call"}
      className={cn(
        "c-focus-ring absolute bottom-0.5 inline-flex items-center justify-center rounded-xs ph-no-capture",
        offsetForRepeatIcon ? "right-4" : "right-1",
      )}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(e: KeyboardEvent) => {
        // Enter and Space activate this button natively; the card's own
        // onKeyDown treats both as "open the event form" and calls
        // preventDefault(). Left to bubble, that would open the form *and*
        // cancel this button's Space activation. Note there is deliberately
        // no preventDefault() here — on a native button it would suppress
        // the click the browser generates on Space keyup.
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
      onPointerDown={(e: PointerEvent) => e.stopPropagation()}
      type="button"
    >
      <VideoCameraIcon
        aria-hidden="true"
        color={darken(baseColor, 30)}
        size={JOIN_ICON_SIZE}
        weight="bold"
      />
    </button>
  );
};
```

Notes the codegen must preserve:

- **`type="button"`** — mandatory. The default is `"submit"`; `UpNextBanner`'s two buttons set it explicitly
  and this matches.
- **No `pointer-events-none`.** `EventRepeatIcon` has it; this must not.
- **No padding on the button.** The box is exactly `JOIN_ICON_SIZE` square, so `right-1 bottom-0.5` places
  the *glyph* at the same insets the repeat glyph uses. Adding padding would push the glyph inward and
  break the geometry the all-day padding ladder (§3.3) is derived from.
- **`c-focus-ring`** is the repo's existing interactive focus utility (`UpNextBanner.tsx:80,91`). It is used
  instead of the card's `eventFocusOutlineClass` because this is an ordinary button, not a grid edge-focus
  target.
- **Glyph import.** `VideoCameraIcon` comes straight from `@phosphor-icons/react`; there is no
  `@web/components/Icons/VideoCamera.tsx` wrapper and the write contract forbids creating one. See Gate 2
  open question **Q-A**.

---

## 3. Exact integration points

### 3.1 `TimedEventCard.tsx`

**Import** — insert immediately *above* the existing `import { EventRepeatIcon } from "./EventRepeatIcon";`
(line 49). `./EventJoinIcon` sorts before `./EventRepeatIcon`, so this is also the Biome-correct position:

```ts
import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";
```

**Constants** — append to the existing constant block after line 58, keeping the existing comment intact:

```ts
// Mirrors REPEAT_ICON_MIN_DURATION_MINUTES for the same reason: duration is
// stable across the two layout paths a 15-minute event can take, rendered
// pixel height is not. 15 is GRID_TIME_STEP and the minimum event length, so
// this gate is intentionally permissive today; it exists so the join gate is
// structurally identical to the repeat gate and the two cannot drift.
const JOIN_ICON_MIN_DURATION_MINUTES = 15;
// Same slot, same 4px inset as the repeat icon, so the same width floor.
const JOIN_ICON_MIN_WIDTH = 40;
// REPEAT_ICON_MIN_WIDTH + 24: the second glyph's 12px box plus the 12px the
// join icon shifts left to clear it. Below this the two icons eat more than a
// third of the card and the title has nowhere to go.
const JOIN_WITH_REPEAT_MIN_WIDTH = 64;
```

**Derived state** — insert immediately after the `showRepeatIcon` assignment (after line 120). Order
matters: the width gate reads `showRepeatIcon`.

```ts
const conferenceUrl = event.conference?.url;
const joinUrl = isSafeConferenceUrl(conferenceUrl) ? conferenceUrl : null;
const showJoinIcon =
  joinUrl !== null &&
  !isPlaceholder &&
  durationMinutes >= JOIN_ICON_MIN_DURATION_MINUTES &&
  position.width >=
    (showRepeatIcon ? JOIN_WITH_REPEAT_MIN_WIDTH : JOIN_ICON_MIN_WIDTH);
```

**JSX** — insert immediately after the existing
`{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}` (line 363), as the last child of the root div:

```tsx
{showJoinIcon && joinUrl && (
  <EventJoinIcon
    baseColor={bgColor}
    label={event.conference?.label ?? null}
    offsetForRepeatIcon={showRepeatIcon}
    url={joinUrl}
  />
)}
```

`joinUrl &&` is not redundant with `showJoinIcon`: it is what narrows `joinUrl` from `string | null` to
`string` at the JSX site without relying on TypeScript's aliased-condition analysis holding through the
four-operand `showJoinIcon` expression under TS 7.0.2. Keep both, in that order.

**Placement rationale (DOM order).** After the repeat icon: a single-line insertion at an identical anchor
in both files (a clean `patch_apply` hunk), no stacking consequence (the two never overlap — see §3.3
geometry), and no reading-order consequence (the repeat glyph is `aria-hidden`, so it contributes nothing
to the a11y tree). Being the last child also makes the join button the last focusable descendant, so tab
order is card → join → next card, which is the order a user expects.

### 3.2 `AllDayEventCard.tsx`

**Import** — immediately above `import { EventRepeatIcon } from "./EventRepeatIcon";` (line 30):

```ts
import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";
```

**Constants** — after line 32 (`const REPEAT_ICON_MIN_WIDTH = 60;`):

```ts
const JOIN_ICON_MIN_WIDTH = 60;
const JOIN_WITH_REPEAT_MIN_WIDTH = 84;
```

Same derivation as the timed card (`+24`). These are module-local duplicates of the timed card's names with
different values — exactly the shape `REPEAT_ICON_MIN_WIDTH` already has (40 here, 60 there). Do **not**
hoist them to `grid.constants.ts`: that file is outside the write contract, and the existing repeat
constants establish that per-card width floors are a per-card concern.

**No duration gate** on this card. All-day events have no meaningful minute duration, and `showRepeatIcon`
here has no duration term either (line 76-77).

**Derived state** — immediately after the `showRepeatIcon` assignment (after line 77):

```ts
const conferenceUrl = event.conference?.url;
const joinUrl = isSafeConferenceUrl(conferenceUrl) ? conferenceUrl : null;
const showJoinIcon =
  joinUrl !== null &&
  !isPlaceholder &&
  position.width >=
    (showRepeatIcon ? JOIN_WITH_REPEAT_MIN_WIDTH : JOIN_ICON_MIN_WIDTH);
```

**Title-row padding ladder** — replace the `cn(...)` at lines 188-191:

```tsx
<div
  className={cn("flex min-w-0 items-center", {
    // Reserve exactly the horizontal band the bottom-right icons occupy, so a
    // long title truncates before them instead of running underneath.
    // Geometry: repeat = 10px glyph at right-1 (4px) -> 4..14px.
    //           join   = 12px glyph at right-1 (4px) -> 4..16px,
    //                    or at right-4 (16px) -> 16..28px when both render.
    "pr-3.5": showRepeatIcon && !showJoinIcon,
    "pr-4": showJoinIcon && !showRepeatIcon,
    "pr-7": showRepeatIcon && showJoinIcon,
  })}
>
```

**JSX** — immediately after `{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}` (line 201), before
the two resize handles:

```tsx
{showJoinIcon && joinUrl && (
  <EventJoinIcon
    baseColor={bgColor}
    label={event.conference?.label ?? null}
    offsetForRepeatIcon={showRepeatIcon}
    url={joinUrl}
  />
)}
```

### 3.3 Every constant introduced, with its number and justification

| Constant | File | Value | Justification |
|---|---|---|---|
| `JOIN_ICON_SIZE` | `EventJoinIcon.tsx` | `12` | **See §3.4.** |
| `JOIN_ICON_MIN_DURATION_MINUTES` | `TimedEventCard.tsx` | `15` | Mirrors `REPEAT_ICON_MIN_DURATION_MINUTES`. `GRID_TIME_STEP = 15` is the grid's minimum event length, so every timed event passes — intentionally permissive, present for structural symmetry and as the seam for any future tightening. |
| `JOIN_ICON_MIN_WIDTH` | `TimedEventCard.tsx` | `40` | Identical to `REPEAT_ICON_MIN_WIDTH`: same corner, same 4px inset, so the same floor. |
| `JOIN_WITH_REPEAT_MIN_WIDTH` | `TimedEventCard.tsx` | `64` | `40 + 24` = repeat floor + (12px second glyph + 12px shift step). |
| `JOIN_ICON_MIN_WIDTH` | `AllDayEventCard.tsx` | `60` | Identical to that card's `REPEAT_ICON_MIN_WIDTH`, same reasoning. |
| `JOIN_WITH_REPEAT_MIN_WIDTH` | `AllDayEventCard.tsx` | `84` | `60 + 24`, same derivation. Leaves 56px of title at the floor, comparable to the 46px the repeat-only case leaves at its own floor. |

**Tailwind class values chosen (D2 tie-breaks):**

| Choice | v37 | flash | **This design** | Why |
|---|---|---|---|---|
| Shifted horizontal inset | `right-4` | `right-4.5` | **`right-4`** | AGENTS.md: "Prefer canonical Tailwind scale utilities over arbitrary values when an equivalent exists." `4.5` is not a default scale step; `4` is. 16px also clears the repeat glyph's 14px extent with a 2px gap, so the extra 2px of `right-4.5` buys nothing. |
| All-day padding ladder | `pr-3.5`/`pr-4.5`/`pr-7.5` | `pr-3.5`/`pr-7` | **`pr-3.5`/`pr-4`/`pr-7`** | Each value is the *exact* geometric requirement **and** a canonical scale step: repeat-only needs 14px = `pr-3.5` (unchanged from today, which is what keeps FR-14 intact), join-only needs 16px = `pr-4`, both need 28px = `pr-7`. v37's `pr-4.5`/`pr-7.5` over-reserve by 2px *and* are off-scale; flash's two-rung ladder under-reserves the join-only case by 2px. |

### 3.4 Glyph size — `12` (decided)

`EventRepeatIcon` uses `10`; v37 used `12`; flash used `10`. **`12`.**

1. **It is an interactive control, not a decorative mark.** WCAG 2.2 SC 2.5.8 (Target Size, Minimum) asks
   for 24×24 CSS px. A 20px-tall all-day card physically cannot host that, so the criterion is met via its
   *Equivalent* exception (the same join action is reachable from the event detail view and from
   `UpNextBanner`'s `V` shortcut) — but within that constraint, larger is strictly better, and 12 is the
   largest that fits the 15px compact timed card and the 20px all-day card with the existing `bottom-0.5`
   inset.
2. **The glyph has more internal detail than `Repeat`.** `VideoCamera` is a rounded body plus a lens plus a
   protruding wedge; `Repeat` is two arrows. At 10px `weight="bold"` the camera's internal negative space
   closes up. This matters more than usual here because ADR-2 binds the tint to `darken(baseColor, 30)`,
   which is a low-contrast fill — size is the only remaining legibility lever.
3. **Differentiating it from the repeat mark is a feature.** A user should be able to tell the actionable
   glyph from the decorative one at a glance; a 2px size delta plus a distinct silhouette does that.
4. **It makes the padding ladder land on canonical scale steps** (16px = `pr-4`, 28px = `pr-7`). At size 10
   the join-only case needs 14px and the both-case 26px, and 26px has no canonical utility.

---

## 4. Accessibility decision record

**Accessible name.** `Join <label>` / `Join video call` on the `<button>` via `aria-label`; the SVG carries
`aria-hidden="true"` so the glyph contributes nothing and the button's name is the only announced text.
Never `aria-hidden` on the button itself — unlike `EventRepeatIcon`, whose state *is* already in the card's
`aria-label`, a join action is announced nowhere else (FR-5).

**Keyboard model.**

| Key | Native button behaviour | What we do | Why |
|---|---|---|---|
| `Enter` | `keydown` → synthesised `click` on the same keydown | `stopPropagation()` on keydown | Without it the card's `onKeyDown` also fires → `onEventKeyDown` opens the event form on top of the new tab (AC-5). |
| `Space` | `keydown` (sets active flag) → `click` on `keyup` | `stopPropagation()` on keydown, **no `preventDefault()`** | `preventDefault()` on a button's Space keydown cancels the keyup activation — it would silently break Space. Space does not scroll here because a focused button consumes it; the card's `preventDefault()` is what we must keep away, and `stopPropagation` does that. |
| Tab | focusable by default | nothing | The button becomes the last focusable descendant of the card. Tab order: card → join → next card. |
| Arrows / other | — | not stopped | Grid navigation shortcuts must keep working while focus sits on the join button. |

No `onKeyUp` handler is bound: neither card listens for keyup, and no global `useAppShortcutUp` binding uses
`Enter` or `Space` (the registered ones are `N`, `V`, `Escape`).

**Focus-visible.** `c-focus-ring`, the repo's shared interactive focus utility (`UpNextBanner.tsx:80,91`).
Not the card's `eventFocusOutlineClass`, which is coupled to the grid's edge-focus state machine.

**Contrast.** `darken(baseColor, 30)` is bound by D2 for cross-run consistency. Honest consequence: because
the join icon is a UI component rather than decoration, **WCAG 1.4.11 (Non-text Contrast, 3:1)** applies to
it where it does not apply to the decorative repeat glyph, and a 30-point HSL lightness drop lands near
2.8:1 against a mid-lightness fill. Mitigations already in the design: `weight="bold"`, `size={12}` (§3.4),
a `c-focus-ring` that is high-contrast on focus, and an accessible name that carries the full affordance for
AT users. Flagged as non-blocking follow-up **Q-C**.

**`role="button"` nesting under D1 — resolved, not merely tolerated.** Both cards' roots are
`<div role="button" tabIndex={0}>` with a standing
`biome-ignore lint/a11y/useSemanticElements` comment. Under ARIA's *presentational children* rule, the
descendants of a `button` role are exposed as a flat text string, so a nested interactive element is not
reliably reachable — this is the limitation the prior anchor-based attempt documented and accepted.
Choosing a `<button>` over an `<a href>` **does not by itself remove the nesting**, but it does remove the
part that was actually unsafe: an `<a href>` inside a `role="button"` is a nested *link*, which some AT
stacks flatten into the parent's name and others expose as a phantom link with the meeting URL as its
accessible description. A `<button>` with no `href` has no URL in the a11y tree at all, so the worst case
degrades to "the control is not announced" rather than "the meeting URL is announced". Combined with the
Equivalent-path exception (event detail view, `UpNextBanner` `V`), the residual limitation is: on AT that
strictly enforces presentational children, the join button is not individually reachable. Documented,
accepted, unchanged from the status quo the cards already carry.

---

## 5. ADRs

### ADR-1 — `<button>` + `window.open`, not `<a href>`

- **Context.** The control must open a third-party meeting URL in a new tab from inside a card that is
  already `role="button"`. `UpNextBanner.tsx:31-32` establishes `window.open(url, "_blank", "noopener,noreferrer")`
  as the repo's join mechanism. Both prior CMP-103 attempts used an anchor.
- **Decision.** A native `<button type="button">` whose `onClick` calls
  `window.open(url, "_blank", "noopener,noreferrer")`. No `href` anywhere. Bound by D1.
- **Alternatives.** (a) `<a href={url} target="_blank" rel="noopener noreferrer">` — free middle-click and
  "open in new tab", correct link semantics, but puts the medium-sensitivity URL into a DOM attribute
  (§5 PII-2 tolerates it, but only grudgingly) and nests a link inside `role="button"`. (b) A `div` with
  `role="button"` — reintroduces the exact `useSemanticElements` smell the repo already apologises for, and
  we would have to hand-roll Enter/Space.
- **Consequences.** (+) The meeting URL never enters the DOM, which makes the PII-2 assertion in the test
  plan (`container.innerHTML` does not contain the URL) actually achievable. (+) Matches `UpNextBanner`
  exactly, so there is one join mechanism in the codebase. (+) Resolves the nested-interactive-*anchor*
  concern per §4. (−) **Middle-click and "Open link in new tab" are lost** — a user who wants the meeting in
  a background tab or a different window must copy it out of the event detail view instead. (−) `noopener`
  is now carried by a string literal rather than an HTML attribute, so it is only enforced by the test in
  AC-3; that test is therefore load-bearing for NFR-4 and must not be weakened to a partial match.

### ADR-2 — Bottom-right slot; join shifts left to `right-4` when the repeat icon shares the corner

- **Context.** `EventRepeatIcon` owns `absolute right-1 bottom-0.5`. Both prior attempts independently
  converged on pinning the join control bottom-right and shifting *it* (not the repeat icon) left when both
  render. The user wants consistency across the three policy-comparison runs.
- **Decision.** Join control at `absolute bottom-0.5`, `right-1` alone / `right-4` when `showRepeatIcon`.
  `EventRepeatIcon` is not edited. Glyph `VideoCameraIcon`, `size={12}`, `weight="bold"`,
  `color={darken(baseColor, 30)}`, `aria-hidden="true"`. All-day title reserve steps
  `pr-3.5` → `pr-4` → `pr-7`. Width gates 40/64 (timed) and 60/84 (all-day), plus a 15-minute duration floor
  on the timed card. Bound by D2; the four open tie-breaks resolved in §3.3/§3.4.
- **Alternatives.** Top-right (collides with nothing but reads as a status badge, not an action, and the
  timed card's compact mode has no top margin); left of the repeat icon *by moving the repeat icon* (edits
  `EventRepeatIcon.tsx`, widening the delta and changing every existing recurring card); reusing
  `REPEAT_ICON_MIN_WIDTH` alone for both gates (flash) — rejected because two icons need roughly twice the
  horizontal reserve, and at a 60px all-day card `pr-7` would consume 47% of the width.
- **Consequences.** (+) Geometry is exact: 4..14px (repeat), 16..28px (join), 2px gap, no overlap, no
  z-index needed. (+) Every Tailwind value is a canonical scale step, satisfying the AGENTS.md rule.
  (+) The repeat-only branch keeps the literal string `pr-3.5`, which is what makes FR-14 provable.
  (−) Two more module-local width constants per card; accepted as the established per-card pattern.
  (−) The 15-minute duration floor is a no-op today and a reviewer may read it as dead weight; the inline
  comment says so explicitly.

### ADR-3 — Render-time `isSafeConferenceUrl` guard, exported from the component file

- **Context.** `ConferenceSchema` validates `z.url()` at the contract boundary, but cards render whatever
  reached them, including rows rehydrated from Dexie/IndexedDB written under an older schema. `z.url()`
  historically accepts any parseable URL, so a `javascript:` value is not categorically excluded upstream.
- **Decision.** A `url is string` type-predicate guard that parses with `new URL()` and admits only `http:`
  and `https:`. Exported from `EventJoinIcon.tsx` and imported by both cards for their `showJoinIcon` gates,
  so a rejected URL produces **no control at all** rather than a control that no-ops.
- **Alternatives.** A shared `packages/web/src/common/utils/url.util.ts` — outside the frozen write contract
  and would require reopening Gate 0. Guarding only inside the component (rendering an inert button) —
  leaves a focusable, announced control that does nothing. Trusting the schema — the failure mode is a
  one-click XSS-adjacent navigation.
- **Consequences.** (+) `new URL()` strips leading/trailing whitespace per WHATWG, so `"  javascript:… "`
  is parsed and rejected rather than throwing; both the padded and unpadded forms are covered by one branch.
  (+) The type predicate is what removes the need for a non-null assertion in both cards (NFR-2).
  (−) Two exports from one component file. Acceptable: not a barrel (AGENTS.md forbids `index.ts`, not
  multiple named exports), and both are imported, so `knip` stays quiet. (−) A relative-protocol or
  scheme-less string (`meet.google.com/abc`) is rejected as unparseable; correct, since `window.open` would
  resolve it against the Compass origin.

### ADR-4 — Keep `ph-no-capture` (PostHog autocapture is confirmed present)

- **Context.** D4 asked for verification rather than assumption. `posthog.bootstrap.ts:24-46` calls
  `posthog.init` **without** `autocapture: false`; posthog-js defaults autocapture to `true`. Independently,
  `filterPosthogDeadClick` is registered in `before_send` and exists solely to suppress false `$dead_click`
  events — a feature that only produces events when autocapture is live. Autocapture is on in production.
- **Decision.** `ph-no-capture` stays on the join button's className.
- **Alternatives.** Drop it (only valid if autocapture were off — it is not). Rely on `mask_all_element_attributes`
  (not set, and it is a global setting outside this delta's scope).
- **Consequences.** (+) posthog-js skips autocapture for an element carrying `ph-no-capture` (or any
  ancestor with it), so neither the button's attributes nor its text reach `$autocapture`. Because ADR-1
  keeps the URL out of the DOM entirely, this is defence in depth over an already-clean surface — it
  protects the `aria-label` (which does carry the provider label) and any future attribute added here.
  (+) **Second, non-obvious benefit:** a join click opens a new tab and mutates nothing in the DOM, which is
  precisely the signature PostHog's dead-click heuristic scores as dead. The existing
  `filterPosthogDeadClick` would *not* rescue it — that filter only drops the sub-50ms timestamp-inversion
  case, and a join click has no subsequent mutation at all. Without `ph-no-capture`, every successful join
  would be reported as a dead click and pollute the exact metric that filter was written to clean up.
  (−) Join clicks are invisible to product analytics. Correct per PII-1 ("No new logging, telemetry, or
  network call may be introduced by this feature"); a deliberate join-count metric is a separate ticket.

### ADR-5 — Propagation: stop `pointerdown`, `mousedown`, `click`, and Enter/Space `keydown`

- **Context.** FR-4 names this the highest-risk behaviour. Reading the interaction layer this run turned up
  a path requirements §3 did not anticipate. `TimedEventCard` binds React `onMouseDown` → `onEventMouseDown`
  (starts a drag) and `AllDayEventCard` binds React `onMouseDown` → `onEventMouseDown`; both bind
  `onKeyDown` → `onEventKeyDown` (opens the event form). **Separately**, `interaction.engine.ts` is
  pointer-driven: `handlePointerDown` calls `adapter.getTarget(event: PointerEvent)`, which resolves the
  card by `element.closest("[data-week-interaction-event-id]")` from `event.target`. A join button is a
  descendant of the card, so `closest()` finds the card and a `pending` session opens. On `pointerup`,
  `handlePointerUp` on a `pending` session returns `{ type: "click" }` — which is how the grid opens an
  event. **That path is not reachable by stopping `click` or `mousedown`**, because the engine's "click" is
  synthesised from pointerup, never from a DOM `click`. A hold past `INTERACTION_HOLD_DELAY_MS` would
  likewise promote to `motion` and start dragging the card from the join button.
- **Decision.** Four handlers on the button, exactly:
  1. `onPointerDown` → `stopPropagation()` — the **only** lever that prevents the engine's
     `pending → {type:"click"}` open and the hold-to-drag promotion.
  2. `onMouseDown` → `stopPropagation()` — prevents the cards' own React `onEventMouseDown` (AC-4).
  3. `onClick` → `stopPropagation()` then `window.open(...)` — the action (AC-3), and keeps the click off
     any ancestor click handler.
  4. `onKeyDown` → `stopPropagation()` for `Enter` and `" "` only, **without** `preventDefault()` (AC-5,
     and see §4 for why `preventDefault` would break Space).
- **Alternatives.** Only `mousedown` + `click` (what requirements §3 assumed) — leaves the pointer-engine
  path wide open. Adding an ignore-check inside the interaction adapter — the correct long-term fix, but
  `packages/web/src/grid/interaction/*` is outside the write contract. A native capture-phase listener via
  `ref` — bulletproof against a native `pointerdown` bound below the React root, but a large amount of
  imperative code in a presentational component.
- **Consequences.** (+) Covers both the React-handler path and the pointer-engine path with two one-line
  handlers. (+) React's `stopPropagation` calls through to the native event, so a listener at
  `window`/`document` level (where the engine binds its cancellation events) is also blocked. (−) **Residual
  risk:** if the grid binds `pointerdown` as a *native* listener on a container that sits between the card
  and the React root container, React's synthetic `onPointerDown` fires too late to stop it. The engine
  self-binds only cancellation events at window/document, so the `pointerdown` binding is a caller concern
  this delta could not pin down without reading outside scope. Mitigation is manual verification, not
  scope-widening — see §7 R-1 and Gate 2 open question **Q-B**. (−) `fireEvent.mouseDown` in jsdom does not
  dispatch `pointerdown`, so the automated suite cannot cover handler 1; it is verified by hand.

---

## 6. Test plan — appended to `EventCard.test.tsx`

**Append-only. The existing 575 lines are preserved verbatim.** Task type `existing_file_edit` with a
diff-preview mini-gate before the write (per requirements Q1). Rewriting the file destroys 20 existing tests
and fails AC-7.

### 6.1 Header edits (the only non-append changes)

1. Extend the RTL import (line 1) to add `waitFor`? — **no.** Only one import line changes:
   ```ts
   import userEvent from "@testing-library/user-event";
   ```
   inserted after line 1's `@testing-library/react` import. Needed for the one keyboard-activation case
   (§6.3, T-11) — `fireEvent.keyDown` does **not** synthesise the browser's keydown→click sequence, so a
   `fireEvent`-only test cannot prove that Enter actually activates the button. `user-event` v14 does
   dispatch the click, and AGENTS.md explicitly prefers it. Every other new case keeps the file's existing
   `fireEvent` style.
2. Module-scope constant and `window.open` capture, added just below the existing `position` object
   (line 45):
   ```ts
   const CONFERENCE = { label: "Google Meet", url: "https://meet.google.com/abc-defg-hij" };

   // Captured before any test replaces it; restored in afterEach per the
   // repo's "restore replaced globals in teardown" convention.
   const originalWindowOpen = window.open;

   const stubWindowOpen = () => {
     const open = mock(() => null);
     window.open = open as unknown as typeof window.open;
     return open;
   };
   ```
3. Extend the **existing** `afterEach` (lines 48-50) — add one line, do not replace the block:
   ```ts
   afterEach(() => {
     useEdgeFocusStore.setState(initialEdgeFocusState, true);
     window.open = originalWindowOpen;
   });
   ```

`createEvent` needs **no** change: `conference` is on `GridEventSchema`, so `Partial<GridEvent>` accepts
`conference: CONFERENCE` and the factory's `as GridEvent` cast covers the rest.

### 6.2 Query strategy

The card root is also `role="button"`, so every join query disambiguates by name:
`screen.getByRole("button", { name: /join/i })`. No card `aria-label` contains "join", so this is
unambiguous by construction. Class assertions are made on the role-queried element
(`joinButton.className`), never via `container.querySelector` — a strict improvement over the file's
existing `container.querySelector('svg[class*="right-1"]')` repeat-icon assertions, which are kept as-is.

### 6.3 Cases to append (inside the existing `describe("EventCard")`, after the last test at line 574)

| # | Test name | Asserts | AC / FR |
|---|---|---|---|
| T-1 | renders a join control on a timed event with a conference link | `getByRole("button", { name: "Join Google Meet" })` is in the document | AC-1 |
| T-2 | renders no join control on a timed event without a conference link | `queryByRole("button", { name: /join/i })` is `null` | AC-1, FR-14 |
| T-3 | renders a join control on an all-day event with a conference link | as T-1 with `AllDayEventCard` + `isAllDay: true` | AC-2 |
| T-4 | renders no join control on an all-day event without a conference link | as T-2 | AC-2 |
| T-5 | opens the conference link in a new tab with noopener and noreferrer | `stubWindowOpen()`; `fireEvent.click(joinButton)`; `open` called **exactly once**; `calls[0][0] === CONFERENCE.url`; `calls[0][1] === "_blank"`; `calls[0][2]` contains `"noopener"` **and** `"noreferrer"` | AC-3, NFR-4 |
| T-6 | does not start a timed card interaction when the join control is clicked | `onEventMouseDown` mock; `fireEvent.mouseDown(joinButton)` then `fireEvent.click(joinButton)`; `onEventMouseDown` not called | AC-4, FR-4 |
| T-7 | does not start an all-day card interaction when the join control is clicked | as T-6 with `AllDayEventCard` | AC-4, FR-4 |
| T-8 | keeps join keyboard activation off the timed card's key handler | `onEventKeyDown` mock; `fireEvent.keyDown(joinButton, { key: "Enter" })` and `{ key: " " }`; `onEventKeyDown` not called | AC-5, FR-6 |
| T-9 | keeps join keyboard activation off the all-day card's key handler | as T-8 | AC-5, FR-6 |
| T-10 | does not reach a parent shortcut listener from the join control | wrap in `<div onKeyDown={onParentKeyDown}>` (mirrors the file's existing pattern at lines 227-238); Enter on `joinButton`; parent not called | AC-5 |
| T-11 | activates the join control with Enter from the keyboard | `userEvent.setup()`; `joinButton.focus()`; `await user.keyboard("{Enter}")`; `window.open` called once with the URL | FR-6 |
| T-12 | renders no join control on a timed placeholder | `displayMode="placeholder"` with `conference`; query is `null` | AC-6, FR-8 |
| T-13 | renders no join control on an all-day placeholder | `isPlaceholder` with `conference`; query is `null` | AC-6, FR-12 |
| T-14 | renders no join control for a non-http conference link | three renders: `"javascript:alert(1)"`, `"  javascript:alert(1)  "`, `"data:text/html,<h1>x</h1>"`; each query is `null` | D3, FR-1 |
| T-15 | falls back to a generic join name without a provider label | `label: null` → `getByRole("button", { name: "Join video call" })` | FR-5 |
| T-16 | does not put a URL-shaped conference label in the accessible name | `label: "meet.google.com/abc-defg-hij"` → name is `"Join video call"` | FR-5, PII-2 |
| T-17 | shifts the join control left when the repeat icon shares the corner | recurring + conference: `joinButton.className` contains `"right-4"`; non-recurring: contains `"right-1"` and not `"right-4"` | FR-10 |
| T-18 | hides the join control on a card too narrow for it | timed `width: 30` → `null`; timed recurring `width: 50` → repeat svg still present but join query `null` (50 ≥ 40 but < 64); all-day `width: 50` → `null` | FR-9 |
| T-19 | steps the all-day title reserve up as icons are added | plain: title row `className` is exactly `"flex min-w-0 items-center"`; repeat-only: has `pr-3.5`; join-only: has `pr-4`; both: has `pr-7` | FR-13, FR-14 |
| T-20 | keeps the conference URL out of the DOM and out of autocapture | `joinButton` has class `ph-no-capture`; `expect(container.innerHTML).not.toContain(CONFERENCE.url)` | ADR-1, ADR-4, PII-2 |
| T-21 | renders no join control for a busy event | `createEvent({ isBusy: true })` (no `conference`) → query is `null` | §6 role matrix |

Title row for T-19 is reached semantically: `screen.getByText("Conference").parentElement`.

### 6.4 What the suite deliberately does **not** cover

`onPointerDown` (ADR-5 handler 1). `fireEvent.mouseDown` does not dispatch `pointerdown`, and the
interaction engine is not mounted by these unit renders, so an automated assertion here would test the stub
rather than the behaviour. Covered by manual verification instead — see §7 R-1.

### 6.5 Expected count

21 new cases on a 2298 baseline → **≥ 2319** passing, 0 failing (AC-8). `bun type-check` and `bun lint`
clean (AC-9); note `bun type-check` runs `tsconfig.test.json` too, so the `window.open` cast in
`stubWindowOpen` must be `as unknown as typeof window.open`, not `as any` (NFR-2).

---

## 7. Risk register

| # | Risk | Likelihood | Mitigation in this plan |
|---|---|---|---|
| **R-1** | **Pointer-engine bypass.** If `pointerdown` is bound natively below the React root, `onPointerDown` stopPropagation fires too late and a join click still opens the event form (ADR-5 residual). | Medium | Handler 1 covers the React-bound and window-bound cases. **Mandatory manual check before merge:** `bun dev:web`, click a join icon on a real event with a Meet link, confirm exactly one new tab and **no** event form. If the form opens, this is out-of-contract — escalate to a new gate rather than editing `grid/interaction/*`. |
| **R-2** | **FR-14 regression** — non-conference events render differently. | Low | `showJoinIcon` is `false` whenever `joinUrl === null`, so no node renders. The all-day padding ladder's repeat-only branch keeps the literal `"pr-3.5"`, and the no-icon case emits no padding class at all. T-19 pins the plain-event title row to the exact string `"flex min-w-0 items-center"`; T-2/T-4 pin the absent node. |
| **R-3** | **`EventCard.test.tsx` destroyed** by a `new_file_add` packet. | Medium (it is what the intent brief asked for) | Packet type is forced to `existing_file_edit`, append-only, with a diff-preview mini-gate. AC-7 requires the diff to show additions plus import lines only. Requirements §0 already corrected the brief. |
| **R-4** | **Existing repeat-icon tests break.** Four tests query `container.querySelector('svg[class*="right-1"]')`. | Medium | The join glyph is also an `svg` and would match `right-1`. But: (a) `EventRepeatIcon` is not edited and keeps `right-1`; (b) the join **button** carries `right-1`, not the svg inside it — the svg has no positioning class at all, so `svg[class*="right-1"]` still matches only the repeat glyph; (c) none of those four tests supply a `conference`, so no join node exists in them. Verified against lines 268-343 and 419-438. |
| **R-5** | **Off-limits consumer files need edits.** | None | `EventJoinIcon` takes only props the cards already hold (`bgColor`, `event.conference`, `showRepeatIcon`, `position.width`). No card prop signature changes, so `UpNextCard.tsx`, `AllDayEvent.tsx`, `GridDraft.tsx`, `GridEvent.tsx`, `DayCalendarEventCards.tsx` compile untouched. |
| **R-6** | **Drag-ghost clone duplicates the button.** `createDraftEventClone(source)` deep-clones the card (`grid/interaction/dom.ts:71-99`), so a drag ghost carries a second `<button name="Join …">`. | Low | Visually correct (the ghost should look like the card). The clone is transient and `pointer-events` inert. No current or planned test performs a drag while querying `/join/i`. Noted so a future drag test does not query by role without scoping. |
| **R-7** | **Extra tab stops.** Every conference-bearing card adds a focusable element to the week grid. | Low | Required by FR-5; scoped to conference events only. Arrow keys and all non-Enter/Space keys still bubble to the card and to global shortcuts. |
| **R-8** | **Biome/Tailwind class reordering** by the repo's Cursor/Codex format-after-edit hooks rewrites the className strings. | Medium | Cosmetic only. Test assertions use `toContain`/`toHaveClass` on individual class names, never whole-string equality — except T-19's plain-event assertion, which pins a string the hooks have already normalised in `main`. |
| **R-9** | **`c-focus-ring` not defined** for grid-scoped CSS. | Low | Used by `UpNextBanner.tsx:80,91`, which is a globally-mounted component; the class is global. If it renders wrong, the fallback is the card's existing `focus-visible:outline-*` pattern — a one-line change inside `EventJoinIcon.tsx`, still in contract. |

---

## 8. Non-goals (restated from requirements §2)

1. **No change** to how conference links are detected, normalised or synced — not `packages/sync`, not
   `packages/core` contracts, not `event.view-model.ts`. The data is already on `GridEvent`.
2. **No change** to the five off-limits consumer surfaces: `UpNextCard.tsx`, `AllDayEvent.tsx`,
   `GridDraft.tsx`, `GridEvent.tsx`, `DayCalendarEventCards.tsx`.
3. **No card layout redesign** beyond placing one icon and stepping the all-day title reserve.
4. **No change** to `UpNextBanner`'s join behaviour or its `V` shortcut.
5. **No new dependency.** `@phosphor-icons/react`, `classnames`, `dayjs`, `@testing-library/user-event` are
   all already in `packages/web/package.json`. Zero `package.json` edits (NFR-6).
6. **No new logging, telemetry, or network call** (PII-1). `ph-no-capture` exists to *suppress* the one that
   autocapture would otherwise create.

---

## 9. Sequencing

Single dependency chain; three packets, strictly ordered.

1. **P1 — `EventJoinIcon.tsx`** (`new_file_add`). Must land first: both cards import `EventJoinIcon` **and**
   `isSafeConferenceUrl` from it, so neither card compiles before this exists.
2. **P2 — `TimedEventCard.tsx` + `AllDayEventCard.tsx`** (`patch_apply` ×2). Independent of each other;
   may run in either order or in parallel. Both depend on P1.
3. **P3 — `EventCard.test.tsx`** (`existing_file_edit`, append-only, diff-preview mini-gate). Depends on
   P1 and P2 — every case renders a card.
4. **P4 — `.gitignore`** (`patch_apply`). Independent of everything; may run at any point. Appends `.sdlc/`
   to the `# DIRS #` block after `test-results/`, removing and reordering nothing (AC-10).

Validation after P3: `bun test:web`, then `bun type-check`, then `bun lint`. Then the R-1 manual check.

---

## 10. Gate 2 open questions

| # | Question | Recommendation |
|---|---|---|
| **Q-A** | **No `@web/components/Icons/VideoCamera.tsx` wrapper exists**, and the write contract does not allow creating one. FR-2 asked for the glyph to come "from the existing Phosphor wrapper convention (`@web/components/Icons/*`)". | **Import `VideoCameraIcon` directly from `@phosphor-icons/react` in `EventJoinIcon.tsx`.** The wrapper's only effect is adding the `c-icon` class via `getInteractiveIconClassName`, whose hover-brightness behaviour targets toolbar icons; the join glyph gets its interactive affordance from the button's `c-focus-ring` and the card's hover fill, and its color is passed explicitly. Adding the wrapper file is a clean follow-up if convention parity is wanted — it does **not** need to block this ticket. Flagging because it is a literal deviation from FR-2. |
| **Q-B** | **Where is `pointerdown` bound?** ADR-5's residual risk. Resolving it needs a read of the grid's interaction wiring, which is outside this delta's scope. | Ship the four-handler set and gate merge on the R-1 manual check. If it fails, escalate for a scope extension — do **not** let codegen widen into `grid/interaction/*`. |
| **Q-C** | **WCAG 1.4.11 (3:1 non-text contrast)** likely not met by `darken(baseColor, 30)` on an interactive control (§4). D2 binds the tint, so this design keeps it. | Ship as bound. Log a follow-up to evaluate `theme.getContrastText(bgColor)` (already used for the card's title, guaranteed readable) for the join glyph specifically. Not a Gate 2 blocker. |
| **Q-D** | Requirements §7 lists AC-1..AC-10; this plan adds 21 tests, several beyond those ACs (T-14 URL safety, T-16 label sanitisation, T-20 PII). | Keep them — they pin ADR-3, ADR-4 and PII-2, which are the decisions most likely to be silently reverted by a future refactor. |
