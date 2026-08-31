## Task tp_req_001 — requirements_analysis / delta_requirements
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write DELTA requirements markdown for adding an attendee avatar badge to the Compass web grid event cards. This is a brownfield feature-extend: describe only what CHANGES, not the whole app. Read these files in the repo for grounding: packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx, packages/web/src/grid/components/TimedEventCard.tsx, packages/web/src/grid/components/AllDayEventCard.tsx, packages/web/src/grid/components/EventCard.test.tsx. DO NOT WRITE OR EDIT ANY FILE — return the markdown in the `document` field only. Sections required, in order: '## Delta summary', '## In scope' (numbered), '## Out of scope' (numbered, from the brief's non-goals), '## Functional requirements' (FR-1..FR-n, each testable, covering: the shared status module extraction, EventDetailsSection consuming it with byte-identical rendered output, the new AttendeeBadge component, its use in both card components, and the zero-attendee no-op case), '## Non-functional requirements' (NFR-1.., covering a11y: colour is never the only signal so the badge needs accessible text; no layout shift on cards without attendees; no new runtime deps; Biome clean), '## Affected files' (table: path, existing|new, change), '## Acceptance criteria' (numbered, each verifiable by a unit test or a command), '## Open questions for HITL' (list, or 'None'). Note explicitly which of the three allowed shared-module homes you recommend and why, flagging that the design phase makes the final call. No PII inventory and no role matrix — this is a client-side rendering change with no new data flow; say so in one line under Non-functional.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: Holds the module-private ATTENDEE_STATUS_DOT + attendeeStatusLabel that must be extracted, and the dot markup the badge must match._

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
// renders per attendee:
// <li aria-label={`${name}, ${statusText}${isOrganizer ? ", organizer" : ""}`}>
//   <span aria-hidden title={statusText} className={`size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`} />
//   <span className="min-w-0 flex-1 truncate">{name}{isOrganizer && " (organizer)"}</span>
// </li>
// Early return: if (!conference && !hasAttendees) return null;
```

#### packages/core/src/types/event-attendance.contracts.ts
_Included because: Canonical attendee shape the badge consumes._

```
export type AttendeeResponseStatus = "needsAction" | "accepted" | "declined" | "tentative";
export type Attendee = { email: string; displayName: string | null; responseStatus: AttendeeResponseStatus };
export type Organizer = { email: string; displayName: string | null };
```

#### packages/web/src/common/types/web.event.types.ts
_Included because: GridEvent already carries the optional fields the badge reads._

```
const GridEventSchema = WebEventSchema.extend({
  organizer: OrganizerSchema.nullable().optional(),
  attendees: z.array(AttendeeSchema).readonly().optional(),
});
export type GridEvent = z.infer<typeof GridEventSchema>;
```

#### .sdlc/runs/20260830-232142-feature-extend-attendee-avatar-badge/intent_brief.md
_Included because: The confirmed brief: goal, allowlist, acceptance criteria, non-goals._

```
GOAL: Add an attendee avatar badge to both timed and all-day grid event cards, summarising who is attending, using the SAME RSVP-status colour/label styling as EventDetailsSection. Extract ATTENDEE_STATUS_DOT + attendeeStatusLabel into ONE shared module consumed by both. Cards with no attendees render exactly as today: no badge element, no layout shift.
ALLOWLIST: packages/web/src/grid/components/**; packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx; packages/web/src/views/Forms/EventForm/EventForm.test.tsx; ONE of packages/web/src/common/utils/attendee/**, packages/web/src/common/styles/attendee-status.ts(+.test.ts), packages/web/src/events/attendance/**; .gitignore.
OFF-LIMITS: everything else, incl. backend/core/sync/scripts packages and all AI-config dirs.
ACCEPTANCE: (1) both card types show the badge when >=1 attendee, colour mapping identical to EventDetailsSection; (2) constants live in exactly one shared module, EventDetailsSection imports them, rendered output unchanged; (3) zero-attendee cards render byte-for-byte as before; (4) new unit tests cover shared module, badge (each status + empty case), and badge presence in both cards; (5) `bun test:web` passes with no pre-existing tests modified except where extraction legitimately moves an import; (6) Biome clean on touched files.
NON-GOALS: no change to attendee fetch/sync/storage; no backend/core/sync/scripts changes; no RSVP interactions on the grid; no redesign of the EventDetailsSection attendee list beyond extraction; NO avatar images or profile-photo fetching — 'avatar badge' means initials/colour dots consistent with existing dot styling using existing theme tokens.
```
### Acceptance criteria
- document contains all nine required headings in order
- every FR is individually testable and scoped to the delta only
- recommended_module_home is one of the three allowlisted homes
- no requirement proposes touching backend, core, sync or scripts packages
- no requirement proposes avatar image fetching
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
      "description": "The full requirements.md markdown"
    },
    "recommended_module_home": {
      "type": "string"
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "document",
    "recommended_module_home",
    "open_questions"
  ]
}
```