# Delta Requirements: Attendee Avatar Badge on Grid Event Cards

> Run `20260830-232142-feature-extend-attendee-avatar-badge` · intent `feature-extend` ·
> policy `flash-agsdk-only` (single-tier: gemini-3.7-flash Antigravity worker) · auth `estimated`.
> Authored by the flash worker (packet `tp_req_001`), integrated by the orchestrator.

## Delta summary
This delta specification extends Compass web grid event cards (`TimedEventCard` and `AllDayEventCard`) to display an attendee avatar badge summarizing attendees and their RSVP statuses using the existing RSVP status color tokens and labels from `EventDetailsSection`.

The module-private `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` in `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` are extracted into a single shared web module. A new `AttendeeBadge` component is introduced in `packages/web/src/grid/components/` to render visual status indicators for events with attendees. When an event has no attendees, cards render identically to their current implementation with no badge element and zero layout shift. This is a client-side visual extension with no backend, synchronization, or data contract modifications.

## In scope
1. Extract `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` from `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` into a single shared module with unit test coverage.
2. Update `EventDetailsSection.tsx` to consume the extracted status module, preserving byte-identical rendered output and behavior.
3. Create a new `AttendeeBadge` component in `packages/web/src/grid/components/AttendeeBadge.tsx` that renders attendee status indicators using the shared color and label definitions.
4. Integrate `AttendeeBadge` into `TimedEventCard.tsx` when `event.attendees` contains one or more attendees.
5. Integrate `AttendeeBadge` into `AllDayEventCard.tsx` when `event.attendees` contains one or more attendees.
6. Maintain exact baseline rendering (no badge element, no DOM changes, no layout shift) for timed and all-day cards when `event.attendees` is empty or undefined.
7. Add comprehensive unit tests covering the shared status module, `AttendeeBadge` rendering across all response statuses, and badge presence/absence on both event card types in `EventCard.test.tsx`.

## Out of scope
1. No modifications to attendee fetching, synchronisation, API endpoints, or database storage.
2. No changes to `packages/core`, `packages/backend`, `packages/sync`, or repository `scripts`.
3. No interactive RSVP workflows, click actions, or mutation controls on grid event cards.
4. No redesign or markup changes to `EventDetailsSection` beyond importing the extracted constants.
5. No avatar image fetching, gravatar lookups, or profile photo network requests; attendee badges use initials and status dot styling with existing design system tokens.

## Functional requirements
- **FR-1 (Shared Status Module Extraction)**: The system shall extract `ATTENDEE_STATUS_DOT` (mapping `AttendeeResponseStatus` values `accepted`, `declined`, `tentative`, `needsAction` to Tailwind classes `bg-success`, `bg-error`, `bg-warning`, `bg-text-subtle`) and `attendeeStatusLabel` (mapping `needsAction` to `"hasn't responded"` and other statuses to their raw string values) into one shared module.
  - *Shared Module Recommendation*: `packages/web/src/common/styles/attendee-status.ts` (out of the three allowlisted options: `packages/web/src/common/utils/attendee/**`, `packages/web/src/common/styles/attendee-status.ts`, `packages/web/src/events/attendance/**`) because `ATTENDEE_STATUS_DOT` defines Tailwind CSS color tokens and `attendeeStatusLabel` provides presentation text, aligning directly with the existing styling utilities in `common/styles/`. The design phase makes the final determination.
- **FR-2 (EventDetailsSection Consumption)**: `EventDetailsSection` shall import `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` from the shared module. Rendered markup, CSS classes, `aria-label` attributes, and tooltip titles must remain byte-identical to previous behavior.
- **FR-3 (AttendeeBadge Component)**: A new component `AttendeeBadge` shall be created in `packages/web/src/grid/components/AttendeeBadge.tsx`. It shall accept an array of attendees (type `Attendee[]`) and render attendee status indicators utilizing `ATTENDEE_STATUS_DOT` for visual styling and `attendeeStatusLabel` for accessible names.
- **FR-4 (TimedEventCard Badge Integration)**: `TimedEventCard` shall render `AttendeeBadge` when `event.attendees` contains at least one attendee (`attendees.length > 0`). The badge must integrate into the card content layout without obstructing time labels, repeat indicators, or resize handles.
- **FR-5 (AllDayEventCard Badge Integration)**: `AllDayEventCard` shall render `AttendeeBadge` when `event.attendees` contains at least one attendee (`attendees.length > 0`), coexisting with title truncation and repeat indicators.
- **FR-6 (Zero-Attendee No-Op)**: When `event.attendees` is `undefined`, `null`, or an empty array (`[]`), neither `TimedEventCard` nor `AllDayEventCard` shall render the `AttendeeBadge` or any wrapper element. Rendered DOM and geometry shall match baseline behavior exactly.

## Non-functional requirements
This is a client-side rendering change with no new data flow, PII inventory, or role matrix alterations.
- **NFR-1 (Accessibility - Non-Color-Only Signals)**: Color must never be the sole indicator of attendee status. Every rendered badge indicator must expose an accessible textual label (via `aria-label` or accessible text) conveying the attendee name and textual RSVP status.
- **NFR-2 (Visual Stability and Zero Layout Shift)**: Cards without attendees must exhibit zero layout shift, maintaining pixel-identical positioning and dimensions compared to baseline.
- **NFR-3 (Zero New Runtime Dependencies)**: The implementation must not introduce any new npm dependencies or runtime packages.
- **NFR-4 (Biome Linting and Formatting)**: All new and modified files must adhere to project formatting standards and pass Biome validation with zero diagnostic warnings or errors.

## Affected files
| Path | Type | Change Description |
| :--- | :--- | :--- |
| `packages/web/src/common/styles/attendee-status.ts` | New | Extracted `ATTENDEE_STATUS_DOT` mapping and `attendeeStatusLabel` helper function. |
| `packages/web/src/common/styles/attendee-status.test.ts` | New | Unit tests verifying status dot classes and label string mappings for all statuses. |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | Existing | Replace local constants with imports from shared `attendee-status.ts` module. |
| `packages/web/src/grid/components/AttendeeBadge.tsx` | New | Presentational attendee badge component for grid event cards. |
| `packages/web/src/grid/components/AttendeeBadge.test.tsx` | New | Unit tests for `AttendeeBadge` covering rendering, status colors, and accessible text. |
| `packages/web/src/grid/components/TimedEventCard.tsx` | Existing | Conditionally render `AttendeeBadge` when `event.attendees` is populated. |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | Existing | Conditionally render `AttendeeBadge` when `event.attendees` is populated. |
| `packages/web/src/grid/components/EventCard.test.tsx` | Existing | Add unit test assertions for badge rendering and zero-attendee regression tests on both card types. |

## Acceptance criteria
1. Unit tests in `packages/web/src/common/styles/attendee-status.test.ts` pass, verifying all 4 response statuses (`accepted`, `declined`, `tentative`, `needsAction`) map to expected Tailwind classes and label strings.
2. `EventDetailsSection` produces byte-identical rendered output and all existing tests in `packages/web/src/views/Forms/EventForm/EventForm.test.tsx` pass without modification.
3. `AttendeeBadge.test.tsx` verifies badge rendering with accessible status text and correct CSS dot classes for single attendee, multiple attendees, and all response statuses.
4. `EventCard.test.tsx` verifies that `TimedEventCard` renders `AttendeeBadge` when `attendees` array is non-empty.
5. `EventCard.test.tsx` verifies that `AllDayEventCard` renders `AttendeeBadge` when `attendees` array is non-empty.
6. `EventCard.test.tsx` verifies that neither `TimedEventCard` nor `AllDayEventCard` renders any badge markup when `attendees` is undefined or empty (`[]`).
7. Running `bun test:web` passes with no regressions across the test suite.
8. Running Biome checks passes with zero errors on all touched and created files.

## Open questions for HITL
None
