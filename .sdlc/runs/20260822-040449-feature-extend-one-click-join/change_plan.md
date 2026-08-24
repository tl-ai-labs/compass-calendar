# DELTA Change Plan: One-Click Join Affordance on Grid Event Cards

## Summary & Context

This design document outlines the implementation plan for adding a one-click conference join affordance (`EventJoinIcon`) to grid event cards (`TimedEventCard` and `AllDayEventCard`).

### Pre-decided Constraints
1. **Glyph Choice**: `VideoCameraIcon` from `@phosphor-icons/react`, wrapped in the repository's `packages/web/src/components/Icons/` wrapper pattern.
2. **Width Gate**: `TimedEventCard` and `AllDayEventCard` gate the join icon on the existing width threshold `REPEAT_ICON_MIN_WIDTH = 40` (timed) / `REPEAT_ICON_MIN_WIDTH = 60` (all-day).

---

## 1. Component Contract for `EventJoinIcon`

### Location
`packages/web/src/grid/components/EventJoinIcon.tsx`
(and icon wrapper at `packages/web/src/components/Icons/VideoCamera.tsx`)

### Element Choice: Native Anchor (`<a>`)
**Decision**: Use an `<a>` element with `href={url}`, `target="_blank"`, and `rel="noopener noreferrer"`.
**Rationale**:
- Native browser hyperlink semantics provide middle-click ("open in new tab"), right-click context menu ("copy link address"), keyboard activation, and browser status bar URL preview.
- To prevent activating card-level interactions (drag, resize handle, selection, or modal opening), the component intercepts and isolates events:
  - `onMouseDown`: calls `e.stopPropagation()`
  - `onClick`: calls `e.stopPropagation()`
  - `onKeyDown`: calls `e.stopPropagation()` for activation keys (`Enter`, `Space`)

### Props Interface
```typescript
export interface EventJoinIconProps {
  /** The validated conference URL to open */
  url: string;
  /** Title of the event for the accessible label */
  title?: string;
  /** Base background color of the parent card to compute readable contrast */
  baseColor: string;
  /** Offset class when coexisting with EventRepeatIcon (e.g. "right-4.5" vs "right-1") */
  className?: string;
}
```

### Exact Component Implementation
```tsx
import cn from "classnames";
import { type KeyboardEvent, type MouseEvent } from "react";
import { darken } from "@web/common/styles/color.utils";
import { VideoCameraIcon } from "@web/components/Icons/VideoCamera";

export interface EventJoinIconProps {
  url: string;
  title?: string;
  baseColor: string;
  className?: string;
}

export const EventJoinIcon = ({
  url,
  title,
  baseColor,
  className,
}: EventJoinIconProps) => {
  const accessibleLabel = title
    ? `Join meeting: ${title}`
    : "Join meeting";

  return (
    <a
      aria-label={accessibleLabel}
      className={cn(
        "ph-no-capture absolute bottom-0.5 z-10 flex items-center justify-center rounded-xs p-0.5 hover:opacity-80 focus-visible:outline-1 focus-visible:outline-(--event-focus-color)",
        className ?? "right-1",
      )}
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLAnchorElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      onMouseDown={(e: MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
      }}
    >
      <VideoCameraIcon
        aria-hidden="true"
        color={darken(baseColor, 30)}
        size={10}
        weight="bold"
      />
    </a>
  );
};
```

### Icon Wrapper: `packages/web/src/components/Icons/VideoCamera.tsx`
```tsx
import {
  type IconProps,
  VideoCameraIcon as PhosphorVideoCameraIcon,
} from "@phosphor-icons/react";
import { getInteractiveIconClassName } from "./icon.utils";

export const VideoCameraIcon = ({ className, ...props }: IconProps) => (
  <PhosphorVideoCameraIcon
    className={getInteractiveIconClassName(className)}
    {...props}
  />
);
```

### Positioning & Anti-Collision Strategy with `EventRepeatIcon`
- `EventRepeatIcon` is pinned at `absolute right-1 bottom-0.5` with `size={10}` (10px wide, 4px from right boundary).
- When `showRepeatIcon` is `true`, `EventJoinIcon` receives `className="right-4.5"` (18px from right edge), placing it cleanly adjacent to the repeat icon with a 4px gap without visual overlap.
- When `showRepeatIcon` is `false`, `EventJoinIcon` receives `className="right-1"` (4px from right edge).

---

## 2. URL Validation Helper: `isSafeConferenceUrl`

### Location
`packages/web/src/grid/components/event-join.util.ts` (or exported from `EventJoinIcon.tsx`)

### Exact Implementation
```typescript
/**
 * Strictly validates that a conference URL uses a safe web protocol (http or https).
 * Rejects hostile or invalid protocols like javascript:, data:, vbscript:, file:, and relative paths.
 */
export function isSafeConferenceUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
```

### Permitted Schemes
- `https:` (PASS)
- `http:` (PASS)
- All other schemes (`javascript:`, `data:`, `vbscript:`, `file:`, relative paths, malformed URLs) return `false`.

---

## 3. Exact Diff Plan per File

### 1. `packages/web/src/components/Icons/VideoCamera.tsx` (New File)
Wrap `@phosphor-icons/react`'s `VideoCameraIcon` using `getInteractiveIconClassName`.

### 2. `packages/web/src/grid/components/EventJoinIcon.tsx` (New File)
Implements `EventJoinIcon` and `isSafeConferenceUrl`.

### 3. `packages/web/src/grid/components/TimedEventCard.tsx`
- **Imports**:
  Add `import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";`.
- **Conditionals**:
  ```tsx
  const hasSafeConferenceUrl = isSafeConferenceUrl(event.conference?.url);
  const showJoinIcon =
    hasSafeConferenceUrl &&
    !isPlaceholder &&
    durationMinutes >= REPEAT_ICON_MIN_DURATION_MINUTES &&
    position.width >= REPEAT_ICON_MIN_WIDTH;
  ```
- **JSX Rendering**:
  ```tsx
  {showJoinIcon && (
    <EventJoinIcon
      baseColor={bgColor}
      className={showRepeatIcon ? "right-4.5" : "right-1"}
      title={event.title}
      url={event.conference!.url}
    />
  )}
  {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
  ```

### 4. `packages/web/src/grid/components/AllDayEventCard.tsx`
- **Imports**:
  Add `import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";`.
- **Conditionals**:
  ```tsx
  const hasSafeConferenceUrl = isSafeConferenceUrl(event.conference?.url);
  const showJoinIcon =
    hasSafeConferenceUrl &&
    !isPlaceholder &&
    position.width >= REPEAT_ICON_MIN_WIDTH;
  ```
- **Padding Permutation Table**:
  Title container right padding reserves space so truncating title text does not overlap bottom-right icons.

  | Repeat Icon Present | Join Icon Present | Class Applied | Reserved Width |
  | :--- | :--- | :--- | :--- |
  | `false` | `false` | `""` (no extra padding) | 0px |
  | `true` | `false` | `"pr-3.5"` | 14px (10px icon + 4px margin) |
  | `false` | `true` | `"pr-3.5"` | 14px (10px icon + 4px margin) |
  | `true` | `true` | `"pr-7"` | 28px (2x 10px icons + 8px margins) |

- **JSX Title Container**:
  ```tsx
  <div
    className={cn("flex min-w-0 items-center", {
      "pr-7": showRepeatIcon && showJoinIcon,
      "pr-3.5": (showRepeatIcon && !showJoinIcon) || (!showRepeatIcon && showJoinIcon),
    })}
  >
  ```
- **JSX Icon Rendering**:
  ```tsx
  {showJoinIcon && (
    <EventJoinIcon
      baseColor={bgColor}
      className={showRepeatIcon ? "right-4.5" : "right-1"}
      title={event.title}
      url={event.conference!.url}
    />
  )}
  {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
  ```

---

## 4. Test Plan Mapping (AC-1 through AC-11)

All tests are placed in `packages/web/src/grid/components/EventCard.test.tsx` within the existing `describe("EventCard", () => { ... })` suite, reusing the `createEvent` helper and `@testing-library/react`.

1. **AC-1 (Render Valid Link)**:
   - `describe("EventCard") -> it("renders join affordance for timed and all-day cards with valid conference url")`
   - **Assertion**: `expect(screen.getByRole("link", { name: /Join meeting/ })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij")` for both `TimedEventCard` and `AllDayEventCard`.
2. **AC-2 (Hostile Scheme Rejection)**:
   - `describe("EventCard") -> it("rejects hostile URL schemes (javascript:, data:, vbscript:, file:) and renders positive control")`
   - **Assertion**: For `javascript:alert(1)`, `data:text/html,...`, `vbscript:...`, `file:///etc/passwd`, `screen.queryByRole("link", { name: /Join meeting/ })` is `null`. Positive control with `https://` passes under identical test props.
3. **AC-3 (Missing Conference URL)**:
   - `describe("EventCard") -> it("does not render join affordance when conference is missing or has empty url")`
   - **Assertion**: When `conference: undefined`, `conference: null`, or `conference: { url: "" }`, `expect(screen.queryByRole("link")).toBeNull()`.
4. **AC-4 (Timed Size Gate - Height/Duration)**:
   - `describe("EventCard") -> it("hides join affordance on timed cards when duration is below REPEAT_ICON_MIN_DURATION_MINUTES")`
   - **Assertion**: Timed event with duration < 15 min (e.g. 10 min) does not render `screen.queryByRole("link")`.
5. **AC-5 (Timed Size Gate - Width)**:
   - `describe("EventCard") -> it("hides join affordance on timed cards narrower than REPEAT_ICON_MIN_WIDTH")`
   - **Assertion**: Timed event with `position.width = 30` (< 40) does not render `screen.queryByRole("link")`.
6. **AC-6 (Repeat Icon & Join Icon Coexistence in TimedEventCard)**:
   - `describe("EventCard") -> it("renders both repeat and join icons with non-overlapping offsets on recurring timed events with conference")`
   - **Assertion**: Both icons exist; repeat icon has class `right-1` and join icon has class `right-4.5`.
7. **AC-7 (All-Day Title Padding Permutations)**:
   - `describe("EventCard") -> it("applies dynamic title padding across all four icon combinations in all-day cards")`
   - **Assertion**: Verify title container class for:
     - neither: no `pr-3.5` or `pr-7`
     - repeat only: `pr-3.5`
     - join only: `pr-3.5`
     - both: `pr-7` and join icon offset `right-4.5`.
8. **AC-8 (Event Propagation Isolation - Mouse)**:
   - `describe("EventCard") -> it("prevents mouse down and click on join icon from triggering card selection or drag")`
   - **Assertion**: `fireEvent.mouseDown(joinLink)` and `fireEvent.click(joinLink)` do not call `onEventMouseDown` or `onScalerMouseDown`.
9. **AC-9 (Event Propagation Isolation - Keyboard)**:
   - `describe("EventCard") -> it("prevents Enter and Space keydown on join icon from triggering card activation or parent listeners")`
   - **Assertion**: `fireEvent.keyDown(joinLink, { key: "Enter" })` does not call `onEventKeyDown` or bubble to parent container's `onKeyDown`.
10. **AC-10 (Tabnabbing & Privacy Attributes)**:
    - `describe("EventCard") -> it("renders join link with rel='noopener noreferrer', target='_blank', and ph-no-capture class")`
    - **Assertion**: `expect(joinLink).toHaveAttribute("target", "_blank")`, `expect(joinLink).toHaveAttribute("rel", "noopener noreferrer")`, `expect(joinLink).toHaveClass("ph-no-capture")`.
11. **AC-11 (Accessibility Label)**:
    - `describe("EventCard") -> it("provides descriptive accessible name on the join link including event title")`
    - **Assertion**: `expect(screen.getByRole("link", { name: "Join meeting: Planning block" })).toBeInTheDocument()`.

---

## 5. Risks and Rejected Alternatives

### Rejected Alternatives
1. **Button with `window.open` instead of `<a>`**:
   - *Rejected*: A native `<a>` provides standard browser hyperlink ergonomics (hover URL preview, copy link address, open in tab/window via middle click) without manual JS popup handling.
2. **Dedicated Separate Width Constant for Join Icon**:
   - *Rejected*: Reusing `REPEAT_ICON_MIN_WIDTH = 40` keeps card width thresholds unified and predictable.
3. **Z-Index Layer Inflation**:
   - *Rejected*: Kept at `z-10` within card boundary so it sits above title text without leaking over modals or floating popovers.

### Identified Risks & Mitigations
1. **Title Truncation Collision**:
   - *Risk*: A title on a single-line timed or all-day card might collide with bottom-right icons.
   - *Mitigation*: In `AllDayEventCard`, dynamic `pr-3.5` / `pr-7` ensures truncation before the icons. In `TimedEventCard`, line clamping and padding reserve sufficient clearance.
2. **Accidental Card Selection During Join Click**:
   - *Risk*: Clicking the join link might trigger card selection or start drag.
   - *Mitigation*: Stop event propagation on both `mouseDown` and `click` on the join link element.
3. **PostHog URL Scraping**:
   - *Risk*: Conference URLs with meeting credentials leaked to telemetry.
   - *Mitigation*: Add `ph-no-capture` class to the join anchor tag.
