## Task tp_cg_002 — codegen / existing_file_edit
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT THE FILE packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx in the repo. This is a pure extraction with ZERO behaviour change. Do exactly four things and nothing else: (1) delete the local `const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {...}` block; (2) delete the local `const attendeeStatusLabel = ...` arrow function; (3) add `import { ATTENDEE_STATUS_DOT, attendeeStatusLabel } from "@web/common/styles/attendee-status";` — the file packages/web/src/common/styles/attendee-status.ts already exists and exports both; (4) delete the now-unused `import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";` line, because after step 1 and 2 nothing in this file references that type — leaving it will fail Biome's unused-import rule. Place the new import so the file still satisfies the repo's Biome import-ordering rule (run the repo's biome check on this file and fix ONLY ordering/format diagnostics you introduced). KEEP `const MAX_VISIBLE_ATTENDEES = 6;`. The component body and every line of JSX — the <li> aria-label expression, the dot <span> with aria-hidden/title/className, the truncate span, the '+N more' button, the early `if (!conference && !hasAttendees) return null;` — must remain BYTE-FOR-BYTE identical. Do not reformat, do not reflow, do not touch the doc comment. DO NOT create a test file. DO NOT modify any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: Edit target: the imports at the top, the two consts at lines 12-20, and MAX_VISIBLE_ATTENDEES at line 22 which stays._

```
import { UsersIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type EventContent } from "@core/types/event.contracts";
import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

type EventDetails = Extract<EventContent, { kind: "details" }>;

interface EventDetailsSectionProps {
  details: Pick<EventDetails, "organizer" | "attendees" | "conference">;
}

const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

const MAX_VISIBLE_ATTENDEES = 6;
// ... doc comment and component follow; all of it must stay identical.
```

#### packages/web/src/common/styles/attendee-status.ts
_Included because: The already-created shared module to import from._

```
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {...};
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string => ...;
```
### Acceptance criteria
- ATTENDEE_STATUS_DOT and attendeeStatusLabel are imported from @web/common/styles/attendee-status
- both local definitions are gone
- the unused AttendeeResponseStatus type import is gone
- MAX_VISIBLE_ATTENDEES = 6 is retained
- every line of JSX is byte-for-byte unchanged
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
    }
  },
  "required": [
    "artifact_path",
    "written",
    "summary"
  ]
}
```