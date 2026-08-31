## Task tp_cg_006 — tests / test_add
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/components/EventCard.test.tsx by APPENDING a new `describe("EventCard attendee badge", () => { ... })` block at the END of the file, after the existing top-level describe("EventCard") block closes. Do NOT modify, reorder, rename or delete a single existing test. Read the existing file to reuse its `createEvent` factory and `position` const — if they are scoped inside the existing describe, define your own local equivalents inside your new describe instead of moving theirs. Use bun:test (describe/it/expect/mock) + @testing-library/react + "@testing-library/jest-dom", matching the imports already at the top of the file; add any missing named import to the EXISTING import statements rather than adding duplicate import lines. Build attendees as an array of { email, displayName, responseStatus }. Write exactly these five tests: (1) 'renders no badge when the event has no attendees' — for BOTH TimedEventCard and AllDayEventCard, render with attendees undefined and again with attendees: [], and assert container.querySelector('[role=\"group\"]') is null each time. (2) 'renders a status dot per attendee with the shared colour mapping' — a timed event with two attendees, one accepted and one declined; assert the group contains two dot spans, one whose className contains 'bg-success' and one 'bg-error', and that their title attributes are `${name}: accepted` and `${name}: declined`. (3) 'caps the dots at three and shows an overflow count' — a timed event with five attendees; assert exactly 3 dot spans render, that text '+2' is present, and that the group's aria-label names all five attendees. (4) 'exposes the attendee summary as an accessible group label' — assert the badge container has role=\"group\" and an aria-label starting with 'Attendees: ', and that needsAction is rendered in the label as \"hasn't responded\". (5) 'does not block card interaction' — render a TimedEventCard with attendees and an onEventMouseDown mock, fireEvent.mouseDown on the card, and assert the mock was called. Query the badge with container.querySelector('[role=\"group\"]'), NOT getByRole('group'), because the badge sits inside a role=\"button\" card and may not be exposed as a group in the accessibility tree. Required props: TimedEventCard needs displayMode=\"saved\" motionMode=\"idle\" position; AllDayEventCard needs isPlaceholder={false} position. Use future dates like 2099-01-15 to avoid past-event styling. Match repo Biome style. DO NOT create any new file. DO NOT modify any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Existing harness to reuse. 575 lines; the factory and position live at module scope ABOVE describe("EventCard")._

```
import { fireEvent, render, screen } from "@testing-library/react";
import { getEventPalette } from "@web/common/styles/theme.util";
import { type GridEvent } from "@web/common/types/web.event.types";
import { COMPACT_EVENT_MAX_HEIGHT, ... } from "@web/grid/grid.constants";
import { initialEdgeFocusState, useEdgeFocusStore } from "@web/grid/shortcuts/edge-focus.store";
import { afterEach, describe, expect, it, mock } from "bun:test";
import "@testing-library/jest-dom";

import { AllDayEventCard } from "./AllDayEventCard";
import { TimedEventCard } from "./TimedEventCard";

const createEvent = (overrides: Partial<GridEvent> = {}): GridEvent =>
  ({
    _id: "event-1",
    endDate: "2024-01-15T10:00:00.000Z",
    isAllDay: false,
    position: { dragOffset: { x: 0, y: 0 }, horizontalOrder: 0, initialX: null, initialY: null, isOverlapping: false, totalEventsInGroup: 1, widthMultiplier: 1 },
    recurrence: undefined,
    startDate: "2024-01-15T09:00:00.000Z",
    title: "Planning block",
    ...overrides,
  }) as GridEvent;

const position = { height: 60, left: 10, top: 20, width: 140 };

describe("EventCard", () => {
  afterEach(() => { useEdgeFocusStore.setState(initialEdgeFocusState, true); });
  ... 560 lines of existing tests, ending with the all-day edge-focus test ...
});
<-- append your new describe AFTER this closing brace
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: The component under test, as actually written._

```
const MAX_BADGE_ATTENDEES = 3;
export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) return null;
  const visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES);
  const overflowCount = attendees.length - visibleAttendees.length;
  const summaryLabel = `Attendees: ${attendees.map((a) => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`;
  return (<div role="group" aria-label={summaryLabel} className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}>
    {visibleAttendees.map((attendee) => { const name = attendee.displayName ?? attendee.email; const statusText = attendeeStatusLabel(attendee.responseStatus); return (<span key={attendee.email} aria-hidden="true" title={`${name}: ${statusText}`} className={cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus])} />); })}
    {overflowCount > 0 && (<span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5">+{overflowCount}</span>)}
  </div>);
};
// attendeeStatusLabel: needsAction -> "hasn't responded", else the raw status string.
// ATTENDEE_STATUS_DOT: accepted->bg-success, declined->bg-error, tentative->bg-warning, needsAction->bg-text-subtle
```
### Acceptance criteria
- a new describe block is appended; no existing test is modified or removed
- zero-attendee case asserts a null [role=group] query for both card types, with attendees undefined and []
- two-attendee case asserts bg-success and bg-error dot classes and the title tooltips
- five-attendee case asserts exactly 3 dots plus '+2' and a summary label naming all five
- a test asserts role=group and an aria-label starting with 'Attendees: '
- a test asserts onEventMouseDown still fires with a badge present
- no other file is created or modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "written": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    },
    "tests_added": {
      "type": "number"
    }
  },
  "required": [
    "artifact_path",
    "written",
    "summary",
    "tests_added"
  ]
}
```