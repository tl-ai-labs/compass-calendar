# DELTA Change Plan: Grid Attendee Badge (`grid-attendee-badge`)

> Run `20260830-232142-feature-extend-attendee-avatar-badge` · intent `feature-extend` ·
> policy `flash-agsdk-only` · authored by the flash worker (packet `tp_design_001`).
>
> **Integration note.** The worker returned two concatenated JSON objects, the first truncated
> mid-sentence in D-5. The second object was complete and is what this document reproduces.
> No re-dispatch was paid for. See "Orchestrator review" at the foot of this file for the
> defects the orchestrator found against the approved requirements — those are NOT the worker's
> text and are flagged for the Gate 2 decision.

## Decisions

### D-1: Shared Module Home (D-a)
- **Decision**: Put the shared attendee status styling and label mapping in `packages/web/src/common/styles/attendee-status.ts`.
- **Rationale**: The mappings define Tailwind design system token classes (`bg-success`, `bg-error`, `bg-warning`, `bg-text-subtle`) alongside color tokens, aligning with `packages/web/src/common/styles/theme.util.ts`. This allows both form views (`EventDetailsSection.tsx`) and grid components (`AttendeeBadge.tsx`) to import them without cross-domain layering violations or circular dependencies.
- **Rejected Alternatives**:
  - `packages/web/src/common/utils/attendee/**`: Unnecessary subdirectory nesting for two small styling primitives.
  - `packages/web/src/events/attendance/**`: Couples UI display tokens with the backend sync/draft data adapters.

### D-2: Exported Module API (D-b)
- **Decision**: Export the exact types, dictionary, and label helper function:
  ```typescript
  import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

  export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
    accepted: "bg-success",
    declined: "bg-error",
    tentative: "bg-warning",
    needsAction: "bg-text-subtle",
  };

  export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
    status === "needsAction" ? "hasn't responded" : status;
  ```
- **Rationale**: Preserves 100% byte-for-byte and behavioral compatibility with `EventDetailsSection.tsx`.
- **Rejected Alternatives**: Returning JSX nodes directly or altering string labels, which would break existing form row markup.

### D-3: Badge Visual Rendering & Overflow Treatment (D-c)
- **Decision**: Render a compact horizontal cluster of micro status dots (`size-1.5` / `6px` diameter) with `ring-1 ring-background/60`, capped at `MAX_BADGE_ATTENDEES = 3`. If `attendees.length > 3`, render 3 dots followed by an overflow text pill `+{count}` (`text-[9px] font-medium leading-none`).
- **Rationale**: Grid events can be as short as 15 minutes (`height: 15px-18px`) and narrow (`width: 40px`). Initials circles (16px–20px) cause severe vertical/horizontal overflow and line-clamp clipping. Micro status dots convey RSVP distribution in under 8px height and 36px width. Theme tokens only; zero network requests or image tags.
- **Rejected Alternatives**:
  - *Initials avatars*: Overflows compact event heights and clips event titles.
  - *Guest count text only*: Obscures individual RSVP status breakdown (accepted vs declined vs tentative).

### D-4: Arbitrary Background Contrast Protection (D-c & Constraints)
- **Decision**: Apply `ring-1 ring-background/60` and `shrink-0` to each rendered dot.
- **Rationale**: Event cards have arbitrary background fills (custom hex or Google slot palettes). A `bg-success` dot on a green event card or a `bg-text-subtle` dot on a slate event card would lack contrast without a background halo ring.
- **Rejected Alternatives**: Unbordered bare dots.

### D-5: DOM Placement & Collision Avoidance (D-d)
- **Decision**:
  - **`TimedEventCard.tsx`**: Render `<AttendeeBadge attendees={event.attendees} />` inside the content wrapper `<div className="flex flex-col flex-wrap items-start" {...{[EVENT_CONTENT_ATTRIBUTE]: "true"}}>`, positioned after the time label and before the resize handles.
  - **`AllDayEventCard.tsx`**: Render `<AttendeeBadge attendees={event.attendees} />` inline inside `<div className={cn("flex min-w-0 items-center gap-1", { "pr-3.5": showRepeatIcon })}>`, immediately following the title `<span>`.
- **Rationale**: Placing the badge inside `EVENT_CONTENT_ATTRIBUTE` maintains grid drag/click hit-testing. Keeping handles and `EventRepeatIcon` at `ZIndex.LAYER_4` and `absolute right-1 bottom-0.5` prevents pointer interception and visual collision.
- **Rejected Alternatives**: Absolute positioning, which risks overlapping the repeat icon or edge-focus shadows.

### D-6: Zero-Attendee DOM Tree Invariance (D-e)
- **Decision**: `AttendeeBadge` returns `null` immediately when `!attendees || attendees.length === 0`. In parent cards, conditional rendering `{event.attendees && event.attendees.length > 0 && <AttendeeBadge attendees={event.attendees} />}` is used.
- **Rationale**: Guarantees that when an event has no attendees (`undefined`, `null`, or `[]`), zero wrapper elements or DOM nodes are emitted, producing an identical DOM tree and geometry to baseline.
- **Rejected Alternatives**: Rendering `<div className="hidden" />` or empty containers.

### D-7: Accessibility Contract (D-f)
- **Decision**: The badge container has `aria-label="Attendees: <list of Name (Status)>"` with `role="group"`. Individual dots have `aria-hidden="true"` and `title="<Name>: <Status>"` for mouse tooltip inspection.
- **Rationale**: Adheres to NFR-1 (color is never the only signal). Screen readers receive a structured text summary, while sighted mouse users get hover tooltips.
- **Rejected Alternatives**: Relying solely on dot colors without textual `aria-label`.

---

## Component Contract

### AttendeeBadge Props

| Prop | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `attendees` | `readonly Attendee[] \| undefined \| null` | Yes | List of attendees with email, displayName, and responseStatus |
| `className` | `string` | No | Optional utility classes for layout adjustment |

### TSX Skeleton

```tsx
import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { ATTENDEE_STATUS_DOT, attendeeStatusLabel } from "@web/common/styles/attendee-status";

const MAX_BADGE_ATTENDEES = 3;

export interface AttendeeBadgeProps {
  attendees?: readonly Attendee[] | null;
  className?: string;
}

export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) return null;

  const visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES);
  const overflowCount = attendees.length - visibleAttendees.length;
  const summaryLabel = `Attendees: ${attendees.map(a => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`;

  return (
    <div
      role="group"
      aria-label={summaryLabel}
      className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}
    >
      {visibleAttendees.map((attendee) => {
        const name = attendee.displayName ?? attendee.email;
        const statusText = attendeeStatusLabel(attendee.responseStatus);
        return (
          <span
            key={attendee.email}
            aria-hidden="true"
            title={`${name}: ${statusText}`}
            className={cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus])}
          />
        );
      })}
      {overflowCount > 0 && (
        <span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5">
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
```

---

## Per-file Change List

| File Path | Kind | Precise Change | Risk |
| :--- | :--- | :--- | :--- |
| `packages/web/src/common/styles/attendee-status.ts` | new | Export `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel`. | Low |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | edit | Replace local constants with imports from `common/styles/attendee-status`. | Low |
| `packages/web/src/grid/components/AttendeeBadge.tsx` | new | Implement `AttendeeBadge` component with 3-dot cap, overflow counter, and contrast ring. | Low |
| `packages/web/src/grid/components/TimedEventCard.tsx` | edit | Render `AttendeeBadge` conditionally within the `EVENT_CONTENT_ATTRIBUTE` container. | Medium |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | edit | Render `AttendeeBadge` inline with the title text row. | Low |
| `packages/web/src/grid/components/EventCard.test.tsx` | edit | Add test cases verifying badge rendering, overflow, zero-attendee DOM invariance, and a11y labels. | Low |

---

## Constraints and Collision Analysis

1. **Timed Event Card Line-Clamp & Dimensions**: In `TimedEventCard.tsx`, `lineClamp` is computed based on height. Placing `AttendeeBadge` inline as a flex child with `size-1.5` prevents line wrapping disruption. For compact cards (`height <= 24px`), badge stays within flow without overflowing card bounds.
2. **Grid Drag & Click Hit-Testing (`EVENT_CONTENT_ATTRIBUTE`)**: Rendered inside `<div {...{[EVENT_CONTENT_ATTRIBUTE]: "true"}}>`. Clicks and mousedowns on the badge bubble directly into the card's drag and selection listeners.
3. **EventRepeatIcon Coexistence**: `EventRepeatIcon` is pinned `absolute right-1 bottom-0.5`. In `AllDayEventCard`, `pr-3.5` ensures the title and badge truncate before touching the repeat icon.
4. **Resize Handles**: Resize handles are absolute transparent overlays (`ZIndex.LAYER_4`, height `4.5px` top/bottom or width `4.5px` left/right). The badge remains in standard flow and never intercepts pointer events on the card edges.
5. **Background Color Contrast**: The `ring-1 ring-background/60` border guarantees dot visibility whether the card has a light, dark, pastel, or vibrant saturated fill.

---

## Test Plan

Tests will use `bun:test` and `@testing-library/react` in `packages/web/src/grid/components/EventCard.test.tsx`:

1. **Zero-Attendee DOM Invariance**: Render `TimedEventCard` and `AllDayEventCard` with `attendees: undefined` and `attendees: []`. Verify `container.querySelector('[role="group"]')` is null and DOM output matches baseline snapshot.
2. **Badge Rendering & Status Dots**: Render event with 2 attendees (`accepted`, `declined`). Verify 2 dots render with `bg-success` and `bg-error` classes and correct tooltip titles.
3. **Overflow Handling**: Render event with 5 attendees. Verify exactly 3 dots are rendered, along with `+2` text element, and group `aria-label` includes all 5 names and statuses.
4. **Accessibility Contract**: Verify group `role="group"` and comprehensive `aria-label="Attendees: ..."` presence.
5. **Interaction & Resize Non-Interference**: Fire mousedown on card with badge; verify `onEventMouseDown` and scaler `onScalerMouseDown` trigger normally.

---

## Rollout Risk

- **Visual Truncation on Ultra-Narrow Cards**: For columns narrower than 40px, long titles truncate earlier due to badge presence. Handled gracefully via CSS `truncate` and `min-w-0`.
- **Suite Blind Spots**: Pixel-level visual overlap on exotic browser zoom levels cannot be fully asserted in JSDOM; covered by unit test DOM checks and fixed height constraints.

---

## Allowlist Pressure

- **none**: All changes stay strictly within the allowed workspace files.

---

## Orchestrator review (not authored by the flash worker)

Facts the orchestrator verified against the repo before Gate 2:

- **VERIFIED OK** — `--color-background` is a real Tailwind 4 theme token (`@theme inline` block, `packages/web/src/index.css:103`, `--color-background: var(--background)`), so `ring-background/60` in D-4 resolves to a real utility rather than a dead class. `ring-accent`, `ring-error` etc. are already used elsewhere in the web package, so the pattern is idiomatic.
- **VERIFIED OK** — D-5's claim about `EventRepeatIcon` is accurate: it is `pointer-events-none absolute right-1 bottom-0.5`, size 10, `aria-hidden`.

Defects the orchestrator found, for the Gate 2 ruling:

- **C-1 (breaks AC-3, blocking).** D-5 changes `AllDayEventCard`'s title row from `"flex min-w-0 items-center"` to `"flex min-w-0 items-center gap-1"` **unconditionally**. That class string is emitted for every all-day card, including those with no attendees, so the zero-attendee DOM is no longer byte-identical to baseline. FR-6/AC-3 require identity. Fix: apply the gap only when the badge renders, or put the spacing on the badge itself (it already carries `gap-0.5` internally and could take `ml-1`).
- **C-2 (misses AC-1 and AC-3, blocking).** The per-file change list omits `packages/web/src/common/styles/attendee-status.test.ts` and `packages/web/src/grid/components/AttendeeBadge.test.tsx`, and the Test Plan folds every case into `EventCard.test.tsx`. Approved AC-1 requires tests in the shared-module test file and AC-3 requires an `AttendeeBadge.test.tsx`. Both paths are allowlisted (`attendee-status.test.ts` is named explicitly in the write contract; `AttendeeBadge.test.tsx` falls under `grid/components/**`), so this is an omission, not a scope problem. The truncated first JSON object *did* list both files — they were lost in the malformed second emission.
- **C-3 (a11y contract is likely inert, major).** D-7 puts `role="group"` + `aria-label` **inside** a container that is itself `role="button"` (both cards' roots). Under the ARIA presentational-children rule, descendants of a `button` are not exposed as independent structure, so the group's label will in most screen readers never be announced — leaving colour as the only signal and defeating NFR-1. The alternative (appending an attendee summary to the card's own `accessibleLabel`) changes the card's accessible name, which the existing 575-line `EventCard.test.tsx` queries against repeatedly (`getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM" })`) — so it has a real regression cost that the plan never weighs. This needs a ruling.
- **C-4 (test plan uses a pattern the repo does not have, minor).** Test Plan item 1 says "DOM output matches baseline snapshot". There is no `toMatchSnapshot`/`toMatchInlineSnapshot` anywhere in `packages/web/src`. Introducing snapshots here would be a new convention; comparing `container.innerHTML` between a baseline render and an attendee-less render achieves the same proof with existing idioms.
- **C-5 (unstated behaviour, minor).** `TimedEventCard` gates its time label and repeat icon on explicit height/width constants, but the plan proposes no gate for the badge. Because the card root is `overflow-hidden` and the content wrapper is a flex column, on short events the badge will simply be clipped out of view rather than suppressed. That may be acceptable, but it is a silent divergence from the card's own established gating convention and is not called out under Rollout Risk.
