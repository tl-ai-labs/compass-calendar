## Task tp_cg_001 — codegen / new_file_add
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
WRITE THE FILE packages/web/src/common/styles/attendee-status.ts in the repo. Create it with exactly this content and nothing more: import the type AttendeeResponseStatus from "@core/types/event-attendance.contracts"; export a const ATTENDEE_STATUS_DOT typed Record<AttendeeResponseStatus, string> mapping accepted->"bg-success", declined->"bg-error", tentative->"bg-warning", needsAction->"bg-text-subtle"; export a const attendeeStatusLabel = (status: AttendeeResponseStatus): string => status === "needsAction" ? "hasn't responded" : status. Values must match the originals in EventDetailsSection.tsx CHARACTER FOR CHARACTER — do not rename, reorder the object keys, or reword the label. Add a short file-level comment saying these are shared by the event form's attendee list and the grid attendee badge, so there is one source of truth. Match the repo's Biome style: double quotes, semicolons, two-space indent, trailing commas in multiline literals. DO NOT create any test file. DO NOT modify any other file. Touch exactly this one path.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: The two definitions being extracted, verbatim. Values must not drift._

```
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
```
### Acceptance criteria
- packages/web/src/common/styles/attendee-status.ts exists and exports ATTENDEE_STATUS_DOT and attendeeStatusLabel
- ATTENDEE_STATUS_DOT maps accepted to bg-success, declined to bg-error, tentative to bg-warning, needsAction to bg-text-subtle
- attendeeStatusLabel returns "hasn't responded" for needsAction and the raw status otherwise
- no other file in the repository is created or modified
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