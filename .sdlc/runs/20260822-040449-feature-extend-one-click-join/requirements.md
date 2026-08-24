# Requirements: One-Click Join Affordance on Grid Event Cards

## In Scope
1. **New Component `EventJoinIcon` (`packages/web/src/grid/components/EventJoinIcon.tsx`)**:
   - Reusable join affordance icon component for grid event cards.
   - Validates conference URL scheme (allowing only `http:` and `https:`).
   - Renders an accessible, focusable link/button with `rel="noopener noreferrer"`, `target="_blank"`, and `ph-no-capture` class to prevent PostHog autocapture.
   - Stops event propagation for `click`, `mouseDown`, and `keyDown` events to avoid triggering underlying card actions (drag, resize, select, open).
   - Applies styling and theme-compatible contrast consistent with `EventRepeatIcon`.

2. **Timed Event Card Integration (`packages/web/src/grid/components/TimedEventCard.tsx`)**:
   - Render `EventJoinIcon` when `event.conference?.url` is present and valid.
   - Gate rendering on minimum dimensional thresholds (width and height/duration) so the icon never renders on cards too small to host it cleanly.
   - Coexist cleanly with `EventRepeatIcon` when an event is both recurring and has a conference link, avoiding visual overlap.

3. **All-Day Event Card Integration (`packages/web/src/grid/components/AllDayEventCard.tsx`)**:
   - Render `EventJoinIcon` when `event.conference?.url` is present and valid.
   - Adjust title container padding dynamically so text truncation reserves space for both `EventJoinIcon` and `EventRepeatIcon` when present (handling permutations: neither, repeat only, join only, both).

4. **Regression & Unit Test Suite (`packages/web/src/grid/components/EventCard.test.tsx`)**:
   - Unit and integration tests covering positive and negative rendering cases, URL validation / hostile scheme rejection, size threshold gating, event propagation isolation, tabnabbing protection, and PostHog privacy masking.

---

## Out of Scope
1. Any modification outside `packages/web/src/grid/components/` (e.g., `packages/core/`, consumers under `packages/web/src/views/`, `packages/web/src/components/Sidebar/`).
2. Modifications to upstream schemas or contracts (`ConferenceSchema`, `GridEvent`, sync adapters, database models).
3. Changes to other UI surfaces containing conference links (`UpNextCard.tsx`, `UpNextBanner.tsx`, `EventDetailsSection.tsx`), which are deferred to separate tasks.
4. Changes to card consumer components (`AllDayEvent.tsx`, `GridDraft.tsx`, `GridEvent.tsx`, `DayCalendarEventCards.tsx`).
5. Merging or rebasing the prior experimental branch `CMP-103/opus-plus-flash-v37`.

---

## Functional Requirements

- **FR-1: URL-Gated Rendering**
  The join icon must render if and only if `event.conference?.url` is defined, non-empty, and satisfies safe URL scheme validation.
- **FR-2: Safe URL Scheme Validation**
  The join affordance must parse and validate the URL protocol, strictly permitting only `http:` and `https:`. Hostile or unsupported protocols (`javascript:`, `data:`, `vbscript:`, `file:`, relative paths) must be rejected and prevent rendering.
- **FR-3: TimedEventCard Dimensional Gating**
  In `TimedEventCard`, the join icon must only render when card dimensions satisfy minimum width and height (or duration) thresholds to prevent visual overlap or clipping in compact layouts.
- **FR-4: AllDayEventCard Integration**
  In `AllDayEventCard`, the join icon must render for all valid conference-bearing events without a height gate (given fixed row height), while respecting card width boundaries.
- **FR-5: Icon Layout & Repeat Coexistence**
  When an event is both recurring and has a conference URL:
  - In `TimedEventCard`, the join icon and `EventRepeatIcon` must be positioned without visual collision or overlap.
  - In `AllDayEventCard`, right padding on the title container must adapt dynamically to allocate room for zero, one, or both icons.
- **FR-6: Event Propagation Isolation**
  Interactions on the join icon (`onClick`, `onMouseDown`, `onKeyDown`) must stop propagation (`stopPropagation`) and prevent default where appropriate, ensuring clicking/activating the icon never triggers:
  - Event card selection (`onEventMouseDown` / `onEventKeyDown`)
  - Event drag or resize initialization (`onScalerMouseDown`)
  - Opening the event details modal or firing parent keyboard shortcuts.
- **FR-7: External Navigation & Tab Safety**
  Clicking the join icon must open the conference URL in a new browser tab/window with `target="_blank"` and `rel="noopener noreferrer"`.
- **FR-8: Accessibility**
  The join icon must provide an informative accessible name via `aria-label` (e.g., `"Join meeting: <title>"`) and maintain standard keyboard accessibility without disrupting the card's assistive technology announcements.

---

## Non-Functional Requirements

- **NFR-1: Privacy & Analytics Exclusion**
  The join affordance DOM element must include the `ph-no-capture` class (and/or relevant PostHog masking attributes) to prevent meeting URLs (which may contain access tokens, passwords, or PII) from being recorded in PostHog autocapture or session replays.
- **NFR-2: Zero Performance Overhead**
  The join icon must be a lightweight functional component without side effects, external API requests, or unnecessary re-renders. URL validation should be resilient and efficient.
- **NFR-3: Strict Additive Compatibility**
  The changes must be fully additive: existing props, interaction contracts, and visual styling for events without conference links must remain completely unchanged.
- **NFR-4: Security & Defenses**
  Provide defense-in-depth against DOM XSS (safe protocol whitelisting) and reverse tabnabbing (`rel="noopener noreferrer"`).
- **NFR-5: Testability & Coverage**
  All edge cases—including hostile URL protocols with positive controls, dimension gates, layout permutations, and propagation stopping—must be covered by automated tests in `EventCard.test.tsx`.

---

## Delta Impact Table

| File | Existing Behavior | Delta / Proposed Change |
| :--- | :--- | :--- |
| `packages/web/src/grid/components/EventJoinIcon.tsx` | *Does not exist* | Create new component rendering a safe `<a>` or button join affordance with URL scheme validation (`http:`, `https:`), `rel="noopener noreferrer"`, `target="_blank"`, `ph-no-capture`, propagation suppression, and accessible labeling. |
| `packages/web/src/grid/components/TimedEventCard.tsx` | Displays event details, time label, resize handles, and optional `EventRepeatIcon`. Has no conference join action. | Add `EventJoinIcon` rendering gated on valid `event.conference?.url` and card dimensions. Adjust positioning/offsets so it coexists cleanly alongside `EventRepeatIcon` without overlapping. |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | Displays event title, resize handles, and optional `EventRepeatIcon` with static `pr-3.5` padding. Has no conference join action. | Add `EventJoinIcon` rendering for events with valid conference URLs. Dynamically compute title container right-padding based on presence of repeat icon and join icon. |
| `packages/web/src/grid/components/EventCard.test.tsx` | Tests rendering, styling, resize handles, keyboard events, and repeat icons for timed and all-day cards. | Extend test suite to verify join icon rendering, hostile scheme rejection (positive & negative controls), dimensional gating, propagation stopping on click/keydown, tabnabbing attributes, and PostHog capture exclusion. |

---

## Security Considerations

1. **URL Scheme Validation & DOM XSS Prevention**:
   - `ConferenceSchema.url` uses `z.url()` upstream, but conference URLs synced from third parties may contain malicious schemes (`javascript:`, `data:`, `vbscript:`).
   - `EventJoinIcon` implements strict client-side defense-in-depth scheme validation, allowing only `http:` and `https:` schemes via `new URL()` validation or regex whitelist. Any other scheme suppresses icon rendering.
2. **Reverse Tabnabbing Mitigation**:
   - All links opening conference URLs in new tabs must include `rel="noopener noreferrer"` alongside `target="_blank"` to prevent the target window from accessing `window.opener`.
3. **Telemetry & Autocapture Leakage Prevention**:
   - Conference URLs frequently embed room PINs, meeting passwords, personal room names, or authentication tokens.
   - The join link element must include the `ph-no-capture` class to instruct PostHog autocapture and session replay tools to ignore the link and its URL attribute.

---

## Acceptance Criteria

1. **AC-1 (Render Valid Link)**: When `event.conference.url` is a valid `https://` or `http://` URL and card dimensions meet minimum criteria, `EventJoinIcon` renders inside `TimedEventCard` and `AllDayEventCard`.
2. **AC-2 (Hostile Scheme Rejection)**: When `event.conference.url` contains `javascript:`, `data:`, `vbscript:`, or invalid schemes, `EventJoinIcon` does not render. (A positive control test confirms valid `https://` URLs render under identical conditions).
3. **AC-3 (Missing Conference URL)**: When `event.conference` is null, undefined, or has an empty string URL, `EventJoinIcon` does not render.
4. **AC-4 (Timed Size Gate - Height/Duration)**: In `TimedEventCard`, when the event duration or rendered height is below the minimum threshold, `EventJoinIcon` does not render.
5. **AC-5 (Timed Size Gate - Width)**: In `TimedEventCard`, when card width is below the minimum threshold, `EventJoinIcon` does not render.
6. **AC-6 (Repeat Icon & Join Icon Coexistence in TimedEventCard)**: When a timed event is both recurring and has a conference URL, both icons render without overlapping or colliding.
7. **AC-7 (All-Day Title Padding Permutations)**: In `AllDayEventCard`, title container right-padding correctly reserves space for:
   - Neither icon present (default/no extra padding)
   - Repeat icon only
   - Join icon only
   - Both repeat icon and join icon present
8. **AC-8 (Event Propagation Isolation - Mouse)**: Clicking or triggering `mouseDown` on `EventJoinIcon` does not call `onEventMouseDown` or `onScalerMouseDown` on the parent card.
9. **AC-9 (Event Propagation Isolation - Keyboard)**: Pressing `Enter` or `Space` while focused on `EventJoinIcon` does not trigger `onEventKeyDown` or bubble to parent container keyboard listeners.
10. **AC-10 (Tabnabbing & Privacy Attributes)**: The rendered join link has `target="_blank"`, `rel="noopener noreferrer"`, and `className` containing `ph-no-capture`.
11. **AC-11 (Accessibility Label)**: The join icon has an accessible `aria-label` describing the action (e.g. including "Join meeting").

---

## Open Questions

1. **Icon Component Choice**:
   - Should `EventJoinIcon` import `VideoCameraIcon` from `@phosphor-icons/react` (as in `UpNextCard`), or create a custom SVG wrapper?
2. **Exact Dimensional Thresholds for TimedEventCard**:
   - Should the minimum width threshold for `EventJoinIcon` match `REPEAT_ICON_MIN_WIDTH = 40` or be higher (e.g., `60px` or dynamically scaling when both repeat and join icons are rendered)?
