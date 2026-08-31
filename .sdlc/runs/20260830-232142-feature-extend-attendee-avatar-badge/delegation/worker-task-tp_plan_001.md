## Task tp_plan_001 — plan_task_packets / decomposition
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the APPROVED change plan into an ordered list of file-sized work units. DO NOT WRITE OR EDIT ANY FILE — return JSON only, exactly ONE JSON object, no prose before or after it. CRITICAL: the plan was approved AS-WRITTEN with five known defects deliberately left unfixed for a policy-comparison record. DO NOT fix, improve, or extend the plan. Plan EXACTLY the six files the plan's per-file change list names and NO others — in particular do NOT add attendee-status.test.ts and do NOT add AttendeeBadge.test.tsx, even though they look missing; their absence is defect C-2 and it must survive into codegen. Emit exactly six units in dependency order: (1) create packages/web/src/common/styles/attendee-status.ts; (2) edit packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx to import from it and delete the local copies; (3) create packages/web/src/grid/components/AttendeeBadge.tsx per the plan's TSX skeleton; (4) edit packages/web/src/grid/components/TimedEventCard.tsx; (5) edit packages/web/src/grid/components/AllDayEventCard.tsx; (6) edit packages/web/src/grid/components/EventCard.test.tsx to add the plan's five test-plan cases. For EACH unit give: `id` (tp_cg_001..tp_cg_006 style), `task_type` (new_file_add for creates, existing_file_edit for source edits, test_add for the test-file edit), `artifact_path` (repo-relative), `module`, `depends_on` (array of earlier ids), `instruction` (imperative, under 250 words, precise enough that a codegen worker needs no other context — name the exact classNames, constants, prop names and import specifiers from the plan), and `acceptance` (3-6 testable bullets). Reproduce the plan's decisions faithfully, INCLUDING the parts the orchestrator flagged as defective: unit 5 MUST specify adding `gap-1` to the AllDayEventCard title-row className exactly as the plan says, and unit 3 MUST specify role="group" with the summary aria-label exactly as the plan's skeleton says. Import alias notes: the web package uses @web/* for packages/web/src/* and @core/* for packages/core/src/*; within packages/web/src/grid/components a sibling import is written as ./AttendeeBadge (see how TimedEventCard imports ./EventRepeatIcon). Tests use bun:test (describe/it/expect/mock) plus @testing-library/react and "@testing-library/jest-dom", matching EventCard.test.tsx.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260830-232142-feature-extend-attendee-avatar-badge/change_plan.md
_Included because: The approved plan being decomposed. Approved as-written with known defects C-1..C-5 intentionally unfixed._

```
D-1 module home: packages/web/src/common/styles/attendee-status.ts.
D-2 exports: ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus,string> = {accepted:"bg-success",declined:"bg-error",tentative:"bg-warning",needsAction:"bg-text-subtle"} and attendeeStatusLabel = (status) => status==="needsAction" ? "hasn't responded" : status. Import type from @core/types/event-attendance.contracts.
D-3 badge: horizontal cluster of size-1.5 dots, ring-1 ring-background/60, MAX_BADGE_ATTENDEES = 3, overflow pill +{n} with text-[9px] font-medium leading-none.
D-5 placement: TimedEventCard — inside the content wrapper div carrying EVENT_CONTENT_ATTRIBUTE, after the time label. AllDayEventCard — inline inside the title flex row, immediately after the title span; that row's className becomes cn("flex min-w-0 items-center gap-1", { "pr-3.5": showRepeatIcon }).
D-6 zero-attendee: AttendeeBadge returns null when !attendees || attendees.length===0; parents guard with {event.attendees && event.attendees.length > 0 && <AttendeeBadge attendees={event.attendees} />}.
D-7 a11y: badge container role="group" aria-label={`Attendees: ${all.map(a=>`${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`}; each dot aria-hidden="true" title={`${name}: ${statusText}`}.
SKELETON: AttendeeBadgeProps { attendees?: readonly Attendee[] | null; className?: string }. Container className: cn("inline-flex items-center gap-0.5 shrink-0 select-none", className). Dot className: cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus]), key={attendee.email}. Overflow span: aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5".
PER-FILE LIST (exactly six): attendee-status.ts (new); EventDetailsSection.tsx (edit); AttendeeBadge.tsx (new); TimedEventCard.tsx (edit); AllDayEventCard.tsx (edit); EventCard.test.tsx (edit).
TEST PLAN (all five cases go in EventCard.test.tsx): 1 zero-attendee invariance for both cards with attendees undefined and []; 2 two attendees accepted+declined -> bg-success and bg-error dots with correct title tooltips; 3 five attendees -> exactly 3 dots plus '+2' and a group aria-label naming all five; 4 role=group and the Attendees: aria-label present; 5 mousedown on a card with a badge still fires onEventMouseDown and onScalerMouseDown.
```

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: Unit 2's edit target: the two consts to delete and the import to add. Nothing else may change._

```
import { UsersIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type EventContent } from "@core/types/event.contracts";
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";
// lines 12-20 define ATTENDEE_STATUS_DOT and attendeeStatusLabel locally; line 22 const MAX_VISIBLE_ATTENDEES = 6 STAYS.
// NOTE: after removing the two consts, the AttendeeResponseStatus type import becomes unused and must be dropped or biome will flag it.
// The JSX below (dot span + li aria-label) must not change by a single character.
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Unit 4's edit target._

```
// existing sibling import style: import { EventRepeatIcon } from "./EventRepeatIcon";
// content wrapper:
// <div className="flex flex-col flex-wrap items-start" style={{ color: contentColor }} {...{ [EVENT_CONTENT_ATTRIBUTE]: "true" }}>
//   <span style={titleStyle}>{event.title}</span>
//   {!event.isAllDay && (<> {showTimeLabel && <span ...>{timeRange}</span>} <div .../>startDate handle<div .../>endDate handle </>)}
// </div>
// {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: Unit 5's edit target. The gap-1 addition here is defect C-1 and is REQUIRED to be planned as the plan states._

```
// <div className={cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon })}>
//   <span className="relative min-w-0 truncate text-xs" style={{ color: titleColor }}>{event.title}{" "}</span>
// </div>
// {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}
// sibling import style: import { EventRepeatIcon } from "./EventRepeatIcon";
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Unit 6's edit target: existing harness the new cases must reuse, not replace._

```
import { fireEvent, render, screen } from "@testing-library/react";
import { type GridEvent } from "@web/common/types/web.event.types";
import { afterEach, describe, expect, it, mock } from "bun:test";
import "@testing-library/jest-dom";
import { AllDayEventCard } from "./AllDayEventCard";
import { TimedEventCard } from "./TimedEventCard";
const createEvent = (overrides: Partial<GridEvent> = {}): GridEvent => ({ _id: "event-1", endDate: "2024-01-15T10:00:00.000Z", isAllDay: false, position: {...}, startDate: "2024-01-15T09:00:00.000Z", title: "Planning block", ...overrides }) as GridEvent;
const position = { height: 60, left: 10, top: 20, width: 140 };
// 575 existing lines. AllDayEventCard requires an isPlaceholder prop; TimedEventCard requires displayMode and motionMode.
```
### Acceptance criteria
- exactly six units, no more and no fewer
- artifact_path values are exactly the six paths named in the plan
- no unit creates attendee-status.test.ts or AttendeeBadge.test.tsx
- unit for AllDayEventCard explicitly instructs adding gap-1 to the title-row className
- unit for AttendeeBadge explicitly instructs role=group plus the Attendees: summary aria-label
- output is a single JSON object and nothing else
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "units": {
      "type": "array",
      "minItems": 6,
      "maxItems": 6,
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "task_type": {
            "type": "string",
            "enum": [
              "new_file_add",
              "existing_file_edit",
              "test_add"
            ]
          },
          "artifact_path": {
            "type": "string"
          },
          "module": {
            "type": "string"
          },
          "depends_on": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "instruction": {
            "type": "string"
          },
          "acceptance": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "id",
          "task_type",
          "artifact_path",
          "module",
          "depends_on",
          "instruction",
          "acceptance"
        ]
      }
    }
  },
  "required": [
    "units"
  ]
}
```