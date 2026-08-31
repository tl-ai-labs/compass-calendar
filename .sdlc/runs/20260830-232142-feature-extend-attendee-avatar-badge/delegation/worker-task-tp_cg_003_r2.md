## Task tp_cg_003_r2 — codegen / new_file_add
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
WRITE THE FILE packages/web/src/grid/components/AttendeeBadge.tsx in the repo, reproducing the approved skeleton EXACTLY. Work quickly and do not explore the repository beyond the three files quoted below — the network is unstable and a long session will be killed. Imports: `cn` from "classnames"; `{ type Attendee }` from "@core/types/event-attendance.contracts"; `{ ATTENDEE_STATUS_DOT, attendeeStatusLabel }` from "@web/common/styles/attendee-status" (that file already exists). Module const `MAX_BADGE_ATTENDEES = 3`. Export interface AttendeeBadgeProps { attendees?: readonly Attendee[] | null; className?: string }. Export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => { if (!attendees || attendees.length === 0) return null; ... }. Compute visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES); overflowCount = attendees.length - visibleAttendees.length; summaryLabel = `Attendees: ${attendees.map(a => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`. Container: <div role="group" aria-label={summaryLabel} className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}>. Each visible attendee renders <span key={attendee.email} aria-hidden="true" title={`${name}: ${statusText}`} className={cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus])} /> where name = attendee.displayName ?? attendee.email and statusText = attendeeStatusLabel(attendee.responseStatus). When overflowCount > 0 append <span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5">+{overflowCount}</span>. Add a short TSDoc comment above the component explaining it summarises RSVP state on grid cards and shares its colour mapping with the event form's attendee list. IMPORTANT CONSTRAINTS: this is an approved design being reproduced verbatim for a policy-comparison record — do NOT improve it, do NOT add extra props, do NOT change role="group", do NOT add images or avatars or initials, do NOT fetch anything. Match repo Biome style: double quotes, semicolons, two-space indent. DO NOT create a test file. DO NOT modify any other file. NOTE: two previous attempts at this packet died from network timeouts before doing any work; the file does not exist yet, so create it fresh.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260830-232142-feature-extend-attendee-avatar-badge/change_plan.md
_Included because: The approved TSX skeleton to reproduce verbatim._

```
MAX_BADGE_ATTENDEES = 3. Props { attendees?: readonly Attendee[] | null; className?: string }. Early return null when !attendees || attendees.length === 0. Container cn("inline-flex items-center gap-0.5 shrink-0 select-none", className) with role="group" and aria-label={summaryLabel}. Dots cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus]), key={attendee.email}, aria-hidden="true", title={`${name}: ${statusText}`}. Overflow span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5" rendering +{overflowCount}.
```

#### packages/web/src/common/styles/attendee-status.ts
_Included because: The already-created shared module. Do not re-read it from disk; this is its full content._

```
// Shared by the event form's attendee list and the grid attendee badge, so there is one source of truth.

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

#### packages/web/src/grid/components/EventRepeatIcon.tsx
_Included because: Sibling component showing the conventions to match. Do not re-read it from disk; this is its full content._

```
import { darken } from "@web/common/styles/color.utils";
import { RepeatIcon } from "@web/components/Icons/Repeat";

interface Props {
  baseColor: string;
}

/**
 * The recurrence indicator shared by the timed and all-day grid cards: a small
 * repeat glyph pinned to the card's bottom-right ...
 */
export const EventRepeatIcon = ({ baseColor }: Props) => (
  <RepeatIcon aria-hidden="true" className="pointer-events-none absolute right-1 bottom-0.5" color={darken(baseColor, 30)} size={10} weight="bold" />
);
```
### Acceptance criteria
- AttendeeBadge returns null when attendees is undefined, null, or an empty array
- container has role="group" and aria-label starting with 'Attendees: '
- renders at most 3 dot spans, each aria-hidden with a title and the ATTENDEE_STATUS_DOT class for its status
- renders a +N overflow span only when attendees.length > 3
- no avatar image, no network call, no new dependency
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