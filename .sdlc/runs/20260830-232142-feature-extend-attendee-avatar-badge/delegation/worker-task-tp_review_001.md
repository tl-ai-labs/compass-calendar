## Task tp_review_001 — senior_code_review / code_review
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Act as senior reviewer for this brownfield feature-extend. DO NOT EDIT ANY FILE — return findings as JSON only. Read the six changed files listed below in the repo. Verdict must be `approve` or `request_changes`. Judge the CODE against the ORIGINAL acceptance criteria, NOT against the change plan — the plan was knowingly approved with defects and your job is to say where code+plan fall short of the ACs. ORIGINAL ACs: (AC-1) shared status module has unit tests; (AC-2) EventDetailsSection imports the constants and its rendered output is unchanged; (AC-3) events with no attendees render BYTE-FOR-BYTE as before — no badge node, no layout shift, no new wrapper, no changed class string; (AC-4) new unit tests cover the shared module, the badge component per response status plus the empty case, and badge presence in both cards; (AC-5) bun test:web passes with no pre-existing tests modified; (AC-6) Biome check clean on all touched files. Also assess: whether the 5 appended tests actually PROVE what they claim or merely pass; whether placing the badge inside TimedEventCard's `!event.isAllDay` fragment is correct; whether role="group" nested inside a role="button" card is exposed to assistive tech at all; and whether anything regressed. For EACH finding give id (R-1..), severity (blocker|major|minor|info), file, what, why_it_matters, and fix_suggestion. Be concrete and cite line-level evidence. Do not invent problems to seem thorough; explicitly list what is correct under `credit`. State for each of AC-1..AC-6 whether it is MET or NOT MET with one line of evidence.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### VERIFIED_FACTS
_Included because: Measurements the orchestrator already took. Trust these; do not re-run them._

```
bun type-check: exit 0.
bun test:web AFTER change: 2303 pass / 0 fail / 302 files, exit 0. BEFORE change baseline: 2298 pass / 0 fail / 302 files. So +5 tests, +0 files, 0 failures, no pre-existing test modified (git diff shows 218 pure insertions at the end of EventCard.test.tsx).
biome check on the 6 touched files: EXIT 1. All diagnostics are in AttendeeBadge.tsx and nowhere else: 1 FORMAT error (the summaryLabel .map arrow must break onto its own line); lint/nursery/useSortedClasses FIXABLE at 37:9, 50:15, 59:21; lint/a11y/useSemanticElements warning at 34:7 on the role=\"group\" div. The other 5 files are clean.
NO new test FILE was created: there is no attendee-status.test.ts and no AttendeeBadge.test.tsx anywhere in the repo.
.gitignore was NOT modified this run and .sdlc/ is still untracked.
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: New component, the only file with lint diagnostics._

```
import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { ATTENDEE_STATUS_DOT, attendeeStatusLabel } from "@web/common/styles/attendee-status";

const MAX_BADGE_ATTENDEES = 3;

export interface AttendeeBadgeProps {
  attendees?: readonly Attendee[] | null;
  className?: string;
}

export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) {
    return null;
  }
  const visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES);
  const overflowCount = attendees.length - visibleAttendees.length;
  const summaryLabel = `Attendees: ${attendees.map((a) => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`;
  return (
    <div role="group" aria-label={summaryLabel} className={cn("inline-flex items-center gap-0.5 shrink-0 select-none", className)}>
      {visibleAttendees.map((attendee) => {
        const name = attendee.displayName ?? attendee.email;
        const statusText = attendeeStatusLabel(attendee.responseStatus);
        return (<span key={attendee.email} aria-hidden="true" title={`${name}: ${statusText}`} className={cn("size-1.5 rounded-full ring-1 ring-background/60 shrink-0", ATTENDEE_STATUS_DOT[attendee.responseStatus])} />);
      })}
      {overflowCount > 0 && (<span aria-hidden="true" className="text-[9px] font-medium leading-none opacity-80 pl-0.5">+{overflowCount}</span>)}
    </div>
  );
};
```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: Diff. NOTE the unconditional gap-1._

```
-        className={cn("flex min-w-0 items-center", {
+        className={cn("flex min-w-0 items-center gap-1", {
           "pr-3.5": showRepeatIcon,
         })}
 ...
           {event.title}
           {" "}
         </span>
+        {event.attendees && event.attendees.length > 0 && (
+          <AttendeeBadge attendees={event.attendees} />
+        )}
       </div>
+import { AttendeeBadge } from "./AttendeeBadge";
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Diff. NOTE the badge sits INSIDE the {!event.isAllDay && (<>...</>)} fragment._

```
+import { AttendeeBadge } from "./AttendeeBadge";
 ...
         <span style={titleStyle}>{event.title}</span>
         {!event.isAllDay && (
           <>
             {showTimeLabel && (<span ...>{timeRange}</span>)}
+            {event.attendees && event.attendees.length > 0 && (
+              <AttendeeBadge attendees={event.attendees} />
+            )}
             <div ... EVENT_RESIZE_HANDLE_ATTRIBUTE startDate ... />
             <div ... EVENT_RESIZE_HANDLE_ATTRIBUTE endDate ... />
           </>
         )}
The card root is <div role="button" tabIndex={0} aria-label={accessibleLabel} ...>. The badge is a descendant of it. showTimeLabel is gated on MIN_EVENT_HEIGHT_FOR_TIME_LABEL and MIN_EVENT_WIDTH_FOR_TIME_LABEL; the badge has NO such gate. The card root is overflow-hidden.
```

#### packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
_Included because: Diff: pure extraction._

```
-import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";
+import {
+  ATTENDEE_STATUS_DOT,
+  attendeeStatusLabel,
+} from "@web/common/styles/attendee-status";
 ...
-const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = { accepted: "bg-success", declined: "bg-error", tentative: "bg-warning", needsAction: "bg-text-subtle" };
-const attendeeStatusLabel = (status: AttendeeResponseStatus): string => status === "needsAction" ? "hasn't responded" : status;
 const MAX_VISIBLE_ATTENDEES = 6;
No other line changed; all JSX identical.
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: The 5 appended tests. Judge whether they PROVE the ACs or merely pass._

```
describe("EventCard attendee badge", () => {
  it("renders no badge when the event has no attendees") — renders Timed with attendees:undefined then attendees:[], and AllDay with the same two, asserting container.querySelector('[role="group"]') is null each time. It does NOT compare innerHTML against a no-badge baseline and does NOT assert anything about className strings.
  it("renders a status dot per attendee with the shared colour mapping") — 2 attendees accepted+declined; asserts badge.querySelectorAll("span[title]") has length 2, dots[0].className contains bg-success with title "Alice: accepted", dots[1] bg-error "Bob: declined".
  it("caps the dots at three and shows an overflow count") — 5 attendees all accepted; asserts 3 span[title], badge.textContent contains "+2", aria-label contains all five display names.
  it("exposes the attendee summary as an accessible group label") — 1 needsAction attendee; asserts badge has attribute role="group", aria-label startsWith "Attendees: ", and contains "hasn't responded". It queries via container.querySelector('[role="group"]'), i.e. the DOM attribute, NOT via getByRole which would consult the accessibility tree.
  it("does not block card interaction") — 1 attendee; fireEvent.mouseDown(screen.getByRole("button")) i.e. on the CARD ROOT, then expects onEventMouseDown called once. It never dispatches an event on the badge itself.
});
No test renders AttendeeBadge directly. No test covers tentative or needsAction dot colours. No test asserts badge presence on AllDayEventCard with attendees present.
```
### Acceptance criteria
- verdict is approve or request_changes
- all six ACs are assessed with evidence
- findings cite specific files
- credit is non-empty and names things that are genuinely correct
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": [
        "approve",
        "request_changes"
      ]
    },
    "ac_assessment": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ac": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": [
              "MET",
              "NOT MET",
              "PARTIAL"
            ]
          },
          "evidence": {
            "type": "string"
          }
        },
        "required": [
          "ac",
          "status",
          "evidence"
        ]
      }
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "severity": {
            "type": "string",
            "enum": [
              "blocker",
              "major",
              "minor",
              "info"
            ]
          },
          "file": {
            "type": "string"
          },
          "what": {
            "type": "string"
          },
          "why_it_matters": {
            "type": "string"
          },
          "fix_suggestion": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "severity",
          "file",
          "what",
          "why_it_matters",
          "fix_suggestion"
        ]
      }
    },
    "credit": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "verdict",
    "ac_assessment",
    "findings",
    "credit"
  ]
}
```