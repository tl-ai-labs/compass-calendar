## Task tp_design_001 — architecture_design / delta_change_plan
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA change plan (change_plan.md) for the approved requirements. Brownfield feature-extend: plan only the delta. DO NOT WRITE OR EDIT ANY FILE — return markdown in the `document` field. Read for grounding: packages/web/src/grid/components/{TimedEventCard.tsx,AllDayEventCard.tsx,EventCard.test.tsx,EventRepeatIcon.tsx}, packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx, packages/web/src/common/styles/theme.util.ts. Required sections: '## Decisions' (numbered ADR-style D-1..D-n, each: decision / rationale / rejected alternative). You MUST decide these explicitly: (D-a) the ONE shared module home — pick from packages/web/src/common/styles/attendee-status.ts, packages/web/src/common/utils/attendee/**, packages/web/src/events/attendance/** and NOTHING else; (D-b) the exported API of that module (exact names, signatures, types) — it must serve BOTH EventDetailsSection's existing dot markup and the new badge with zero behaviour change; (D-c) THE OPEN QUESTION Gate 1 deliberately left to you: what the badge actually renders — bare status dots, initials circles, an attendee count, or a combination. The brief forbids avatar IMAGES and network fetches; you must use existing theme tokens only. Justify against the real constraints below and state a hard cap on rendered attendees plus the overflow treatment; (D-d) exact DOM placement in each card and why it cannot collide with existing chrome; (D-e) how the zero-attendee path is guaranteed to emit an IDENTICAL DOM tree to today (not merely 'a hidden badge'); (D-f) the a11y contract. '## Component contract' (AttendeeBadge props table + TSX skeleton, no full implementation). '## Per-file change list' (table: path, new|edit, precise change, risk). '## Constraints and collision analysis' (see below). '## Test plan' (which file gets which cases, using bun:test + @testing-library/react as EventCard.test.tsx already does). '## Rollout risk' (what could regress, what the suite would not catch). REAL CONSTRAINTS you must reason about, not restate: TimedEventCard cards can be tiny — height gates COMPACT_EVENT_MAX_HEIGHT and MIN_EVENT_HEIGHT_FOR_TIME_LABEL, width gates MIN_EVENT_WIDTH_FOR_TIME_LABEL and REPEAT_ICON_MIN_WIDTH=40; its content wrapper is `flex flex-col flex-wrap items-start` carrying an EVENT_CONTENT_ATTRIBUTE used by grid interaction hit-testing, the title uses -webkit-line-clamp computed from position.height, and EventRepeatIcon is absolutely positioned bottom-right. AllDayEventCard is a single truncating row that already reserves pr-3.5 when the repeat icon shows. Card text colour is per-card (theme.getContrastText(bgColor)) over a calendar-coloured fill, so a status dot using bg-success/bg-error/bg-warning/bg-text-subtle sits on an arbitrary background — say whether that is acceptable and what you do about it. Any new element must not break the resize handles or the drag hit-test. Stay strictly inside the allowlist; if the best design needs a file outside it, say so explicitly under '## Allowlist pressure' and propose an in-allowlist fallback.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260830-232142-feature-extend-attendee-avatar-badge/requirements.md
_Included because: Approved requirements this plan must satisfy._

```
FR-1 extract ATTENDEE_STATUS_DOT (accepted->bg-success, declined->bg-error, tentative->bg-warning, needsAction->bg-text-subtle) + attendeeStatusLabel (needsAction -> "hasn't responded", else the raw status string) into ONE shared module. FR-2 EventDetailsSection imports them; rendered markup/classes/aria-label/title byte-identical. FR-3 new AttendeeBadge in packages/web/src/grid/components/AttendeeBadge.tsx taking attendees, using ATTENDEE_STATUS_DOT for style and attendeeStatusLabel for accessible names. FR-4 TimedEventCard renders it when attendees.length>0, without obstructing time label, repeat icon or resize handles. FR-5 AllDayEventCard likewise, coexisting with title truncation and the repeat icon. FR-6 attendees undefined/null/[] -> NO badge and NO wrapper; DOM and geometry identical to baseline. NFR-1 colour is never the only signal; accessible text carries name + status. NFR-2 zero layout shift when no attendees. NFR-3 no new runtime deps. NFR-4 Biome clean. Gate 1 ruling: the avatar rendering style was deliberately LEFT OPEN for this design phase to resolve.
```

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: Source of the constants and the exact dot markup that must not change._

```
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};
const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
const MAX_VISIBLE_ATTENDEES = 6;
// per-attendee row:
// <li key={attendee.email} className="flex items-center gap-2" aria-label={`${name}, ${statusText}${isOrganizer ? ", organizer" : ""}`}>
//   <span aria-hidden title={statusText} className={`size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`} />
//   <span className="min-w-0 flex-1 truncate">{name}{isOrganizer && " (organizer)"}</span>
// </li>
// name = attendee.displayName ?? attendee.email; isOrganizer = organizer?.email === attendee.email
// component early-returns null when !conference && !hasAttendees; wrapper is bg-surface-overlay text-xs
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Insertion site 1 and its collision constraints._

```
// content wrapper (the ONLY non-absolute child):
// <div className="flex flex-col flex-wrap items-start" style={{ color: contentColor }} {...{ [EVENT_CONTENT_ATTRIBUTE]: "true" }}>
//   <span style={titleStyle}>{event.title}</span>
//   {!event.isAllDay && (<>
//      {showTimeLabel && <span className="relative" {...{[EVENT_TIME_LABEL_ATTRIBUTE]:"true"}} style={{...timeLabelStyle, zIndex: ZIndex.LAYER_3}}>{timeRange}</span>}
//      <div aria-hidden role="presentation" {...{[EVENT_RESIZE_HANDLE_ATTRIBUTE]:"startDate"}} style={scalerStyle({top:"-0.25px"})} .../>
//      <div aria-hidden role="presentation" {...{[EVENT_RESIZE_HANDLE_ATTRIBUTE]:"endDate"}} style={scalerStyle({bottom:"-0.25px"})} .../>
//   </>)}
// </div>
// {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
// root: absolute min-h-2.5 select-none overflow-hidden rounded-xs pr-0.75 pl-1.25, role=button, tabIndex 0, aria-label={accessibleLabel}
// gates: REPEAT_ICON_MIN_DURATION_MINUTES=15, REPEAT_ICON_MIN_WIDTH=40, COMPACT_EVENT_MAX_HEIGHT, MIN_EVENT_HEIGHT_FOR_TIME_LABEL, MIN_EVENT_WIDTH_FOR_TIME_LABEL
// lineClamp = getLineClamp(showTimeLabel ? position.height - GRID_EVENT_TIME_LABEL_LINE_HEIGHT : position.height)
// contentColor = theme.getContrastText(bgColor); calendarIdentity renders an absolute 3px left accent bar
```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: Insertion site 2 and its collision constraints._

```
// <div className={cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon })}>
//   <span className="relative min-w-0 truncate text-xs" style={{ color: titleColor }}>{event.title}{" "}</span>
// </div>
// {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
// then two absolute aria-hidden resize handles (left/right, 4.5px wide, ZIndex.LAYER_4)
// REPEAT_ICON_MIN_WIDTH=60; titleColor = theme.getContrastText(bgColor); root is overflow-hidden rounded-xs pr-0.75 pl-1.25 role=button
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Existing test conventions the new tests must match (bun:test, not vitest/jest)._

```
import { fireEvent, render, screen } from "@testing-library/react";
import { type GridEvent } from "@web/common/types/web.event.types";
import { initialEdgeFocusState, useEdgeFocusStore } from "@web/grid/shortcuts/edge-focus.store";
import { afterEach, describe, expect, it, mock } from "bun:test";
import "@testing-library/jest-dom";
import { AllDayEventCard } from "./AllDayEventCard";
import { TimedEventCard } from "./TimedEventCard";

const createEvent = (overrides: Partial<GridEvent> = {}): GridEvent => ({ _id: "event-1", endDate: "2024-01-15T10:00:00.000Z", isAllDay: false, position: {...}, recurrence: undefined, startDate: "2024-01-15T09:00:00.000Z", title: "Planning block", ...overrides }) as GridEvent;
const position = { height: 60, left: 10, top: 20, width: 140 };
describe("EventCard", () => { afterEach(() => { useEdgeFocusStore.setState(initialEdgeFocusState, true); }); ... });
// 575 lines, queries cards via screen.getByRole("button", { name: ... })
```

#### packages/core/src/types/event-attendance.contracts.ts
_Included because: Attendee/Organizer shape; note displayName is nullable._

```
export type AttendeeResponseStatus = "needsAction" | "accepted" | "declined" | "tentative";
export type Attendee = { email: string; displayName: string | null; responseStatus: AttendeeResponseStatus };
export type Organizer = { email: string; displayName: string | null };
// GridEvent: organizer?: Organizer | null; attendees?: readonly Attendee[]
```
### Acceptance criteria
- module_home is exactly one of the three allowlisted homes
- D-c commits to a concrete rendering with a stated attendee cap and overflow treatment, and uses no image or network fetch
- D-e explains how the zero-attendee DOM is identical, not merely visually hidden
- collision analysis addresses the timed card's line-clamp, EVENT_CONTENT_ATTRIBUTE hit-testing, absolutely-positioned EventRepeatIcon and both resize handles
- every path in files_to_change is inside the frozen allowlist, or is called out under allowlist_pressure
- test plan uses bun:test and @testing-library/react, matching EventCard.test.tsx
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "document": {
      "type": "string",
      "description": "The full change_plan.md markdown"
    },
    "module_home": {
      "type": "string",
      "description": "The single chosen shared-module path"
    },
    "badge_rendering_decision": {
      "type": "string",
      "description": "One-paragraph statement of what the badge renders and the attendee cap"
    },
    "files_to_change": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "kind": {
            "type": "string",
            "enum": [
              "new",
              "edit"
            ]
          },
          "change": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "kind",
          "change"
        ]
      }
    },
    "allowlist_pressure": {
      "type": "string",
      "description": "Any file the design wants that is outside the allowlist, or 'none'"
    }
  },
  "required": [
    "document",
    "module_home",
    "badge_rendering_decision",
    "files_to_change",
    "allowlist_pressure"
  ]
}
```