## Task tp_cg_003_r1 — codegen / new_file_add
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
WRITE THE FILE packages/web/src/grid/components/AttendeeBadge.tsx in the repo, reproducing the approved skeleton EXACTLY. Imports: `cn` from "classnames"; `{ type Attendee }` from "@core/types/event-attendance.contracts"; `{ ATTENDEE_STATUS_DOT, attendeeStatusLabel }` from "@web/common/styles/attendee-status" (that file already exists). Module const `MAX_BADGE_ATTENDEES = 3`. Export interface AttendeeBadgeProps { attendees?: readonly Attendee[] | null; className?: string }. Export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => { if (!attendees || attendees.length === 0) return null; ... }. Compute visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES); overflowCount = attendees.length - visibleAttendees.length; summaryLabel = `Attendees: ${attendees.map(a => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`. Container: <div role="group" aria-label={summaryLabel} className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}>. Each visible attendee renders <span key={attendee.email} aria-hidden="true" title={`${name}: ${statusText}`} className={cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus])} /> where name = attendee.displayName ?? attendee.email and statusText = attendeeStatusLabel(attendee.responseStatus). When overflowCount > 0 append <span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5">+{overflowCount}</span>. Add a short TSDoc comment above the component explaining it summarises RSVP state on grid cards and shares its colour mapping with the event form's attendee list. IMPORTANT CONSTRAINTS: this is an approved design being reproduced verbatim for a policy-comparison record — do NOT improve it, do NOT add extra props, do NOT change role="group" to something else, do NOT add a tooltip library, do NOT add images or avatars or initials, do NOT fetch anything. Match repo Biome style (double quotes, semicolons, two-space indent) and sort Tailwind classes the way Biome's useSortedClasses expects if that rule is enabled. DO NOT create a test file for this component. DO NOT modify any other file. NOTE: a previous attempt at this exact packet died from a network timeout before doing any work; the file does not exist yet, so create it fresh.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260830-232142-feature-extend-attendee-avatar-badge/change_plan.md
_Included because: The approved TSX skeleton to reproduce verbatim._

```
MAX_BADGE_ATTENDEES = 3. Props { attendees?: readonly Attendee[] | null; className?: string }. Early return null when !attendees || attendees.length === 0. Container cn("inline-flex items-center gap-0.5 shrink-0 select-none", className) with role="group" and aria-label={summaryLabel}. Dots cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus]), key={attendee.email}, aria-hidden="true", title={`${name}: ${statusText}`}. Overflow span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5" rendering +{overflowCount}.
```

#### packages/core/src/types/event-attendance.contracts.ts
_Included because: Attendee shape; displayName is nullable so the ?? fallback to email is required._

```
export type AttendeeResponseStatus = "needsAction" | "accepted" | "declined" | "tentative";
export type Attendee = { email: string; displayName: string | null; responseStatus: AttendeeResponseStatus };
```

#### packages/web/src/grid/components/EventRepeatIcon.tsx
_Included because: Sibling component showing the file conventions to match: named export, arrow component, TSDoc comment, props interface._

```
import { darken } from "@web/common/styles/color.utils";
import { RepeatIcon } from "@web/components/Icons/Repeat";

interface Props {
  baseColor: string;
}

/**
 * The recurrence indicator shared by the timed and all-day grid cards ...
 */
export const EventRepeatIcon = ({ baseColor }: Props) => (...);
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