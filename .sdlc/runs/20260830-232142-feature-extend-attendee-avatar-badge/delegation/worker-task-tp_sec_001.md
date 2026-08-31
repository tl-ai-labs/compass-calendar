## Task tp_sec_001 — security_review / changed_files_review
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review, scoped to the CHANGED FILES ONLY (feature-extend intent). DO NOT EDIT ANY FILE — return JSON. The change puts attendee identity data (display names and EMAIL ADDRESSES) onto calendar grid event cards for the first time. That is the central question: this data was previously only visible inside the event edit form, behind a click; it is now rendered on the always-visible week/day grid. Assess in this order: (1) PII EXPOSURE — attendee emails now appear in a `title` tooltip attribute and inside an `aria-label` on every card with attendees. Consider: shoulder-surfing / screen-sharing during meetings (a calendar grid is one of the most commonly screen-shared surfaces), the fact that displayName is nullable so the code falls back to the RAW EMAIL, and that the aria-label enumerates ALL attendees not just the 3 visible dots. Is that an acceptable exposure change, and does it need a Gate ruling? (2) INJECTION — attendee displayName and email are provider-sourced strings rendered into a title attribute and an aria-label. React escapes text, but assess whether anything here reaches dangerouslySetInnerHTML, a URL sink, or a CSS injection path via the className. (3) DoS / resource — the aria-label maps over ALL attendees with no cap while only 3 dots render; consider a 500-attendee invite on a grid re-rendering on every drag frame. (4) DEPENDENCIES — confirm no new runtime dependency was added; package.json and bun.lock are unchanged this run. (5) Anything else genuinely security-relevant in the diff. Distinguish clearly between findings INSIDE the frozen allowlist (fixable now) and advisory observations OUTSIDE it. Do not pad the list; if a category is clean, say so. Give each finding an id F-n, severity (blocker|major|minor|info), and a concrete fix.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: The new component. Note the title attribute and the uncapped aria-label map._

```
const MAX_BADGE_ATTENDEES = 3;
export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) return null;
  const visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES);
  const overflowCount = attendees.length - visibleAttendees.length;
  const summaryLabel = `Attendees: ${attendees.map((a) => `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`).join(", ")}`;
  return (
    <div role="group" aria-label={summaryLabel} className={cn("inline-flex shrink-0 select-none items-center gap-0.5", className)}>
      {visibleAttendees.map((attendee) => {
        const name = attendee.displayName ?? attendee.email;
        const statusText = attendeeStatusLabel(attendee.responseStatus);
        return (<span key={attendee.email} aria-hidden="true" title={`${name}: ${statusText}`} className={cn("size-1.5 shrink-0 rounded-full ring-1 ring-background/60", ATTENDEE_STATUS_DOT[attendee.responseStatus])} />);
      })}
      {overflowCount > 0 && (<span aria-hidden="true" className="pl-0.5 font-medium text-[9px] leading-none opacity-80">+{overflowCount}</span>)}
    </div>
  );
};
NOTE: summaryLabel maps over ALL attendees (uncapped); only visibleAttendees (max 3) render dots. displayName is `string | null` so `?? a.email` exposes the raw email when the provider supplies no display name.
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Insertion site 1. The badge is now on the always-visible week/day grid._

```
+import { AttendeeBadge } from "./AttendeeBadge";
... inside <div {...{[EVENT_CONTENT_ATTRIBUTE]: "true"}}> and inside the {!event.isAllDay && (<>...</>)} fragment, after the time label:
+            {event.attendees && event.attendees.length > 0 && (
+              <AttendeeBadge attendees={event.attendees} />
+            )}
Card root: <div role="button" tabIndex={0} aria-label={accessibleLabel} ...> where accessibleLabel is built from title/time/calendar only — it does NOT include attendees.
```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: Insertion site 2._

```
+import { AttendeeBadge } from "./AttendeeBadge";
-        className={cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon })}
+        className={cn("flex min-w-0 items-center gap-1", { "pr-3.5": showRepeatIcon })}
 ... after the title span:
+        {event.attendees && event.attendees.length > 0 && (
+          <AttendeeBadge attendees={event.attendees} />
+        )}
```

#### packages/web/src/common/styles/attendee-status.ts
_Included because: New shared module: pure constants, no logic._

```
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = { accepted: "bg-success", declined: "bg-error", tentative: "bg-warning", needsAction: "bg-text-subtle" };
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string => status === "needsAction" ? "hasn't responded" : status;
```

#### VERIFIED_FACTS
_Included because: Measurements already taken by the orchestrator. Trust these._

```
Changed files this run, complete list: packages/web/src/common/styles/attendee-status.ts (new), packages/web/src/grid/components/AttendeeBadge.tsx (new), packages/web/src/grid/components/TimedEventCard.tsx, packages/web/src/grid/components/AllDayEventCard.tsx, packages/web/src/grid/components/EventCard.test.tsx, packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx.
EventDetailsSection change is a pure constant extraction with zero JSX change.
package.json, bun.lock and every manifest are UNCHANGED this run. No dependency added or upgraded.
No backend, core, sync or scripts file was touched. The attendee data itself is unchanged — GridEvent already carried organizer and attendees before this run; nothing new is fetched, synced or stored.
bun test:web 2303 pass / 0 fail. bun type-check exit 0. biome check on the 6 files exit 0 (1 useSemanticElements warning, deliberately retained).
The frozen write-contract allowlist is: packages/web/src/grid/components/**, packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx, EventForm.test.tsx, packages/web/src/common/styles/attendee-status.ts(+.test.ts), packages/web/src/common/utils/attendee/**, packages/web/src/events/attendance/**, .gitignore. Everything else is OFF-LIMITS.
```
### Acceptance criteria
- the PII exposure change is assessed explicitly, not glossed
- each finding states whether it is inside or outside the frozen allowlist
- categories that are genuinely clean are named rather than padded with invented findings
- no finding proposes touching backend, core, sync or scripts
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
        "pass",
        "pass with notes",
        "fail"
      ]
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
          "category": {
            "type": "string"
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
          "fix": {
            "type": "string"
          },
          "inside_allowlist": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "severity",
          "category",
          "file",
          "what",
          "why_it_matters",
          "fix",
          "inside_allowlist"
        ]
      }
    },
    "pii_assessment": {
      "type": "string"
    },
    "clean_categories": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "required_before_signoff": {
      "type": "string"
    }
  },
  "required": [
    "verdict",
    "findings",
    "pii_assessment",
    "clean_categories",
    "required_before_signoff"
  ]
}
```