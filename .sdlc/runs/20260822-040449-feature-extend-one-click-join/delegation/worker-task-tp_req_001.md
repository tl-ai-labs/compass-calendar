## Task tp_req_001 — requirements_analysis / existing_file_edit
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA requirements doc for a brownfield feature-extend in this repo. Read (do not modify) packages/web/src/grid/components/TimedEventCard.tsx, AllDayEventCard.tsx, EventRepeatIcon.tsx, EventCard.test.tsx, packages/core/src/types/event-attendance.contracts.ts (ConferenceSchema), packages/web/src/common/types/web.event.types.ts, and packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx (existing join-link precedent). Feature: a small icon-only one-click 'join' affordance on both grid event cards, shown only when event.conference?.url exists, opening the meeting without selecting/dragging/opening the card underneath. Write the file at .sdlc/runs/20260822-040449-feature-extend-one-click-join/requirements.md with sections: In scope (numbered, testable); Out of scope (numbered); Functional requirements (FR-1..); Non-functional requirements (NFR-1..); Delta impact table (file, existing behavior, change); Security considerations (URL-scheme validation, tabnabbing, PostHog autocapture of the URL); Acceptance criteria (numbered, executable as tests); Open questions. Only these four paths may ever be written by this run: TimedEventCard.tsx, AllDayEventCard.tsx, EventJoinIcon.tsx (new), EventCard.test.tsx, all under packages/web/src/grid/components/. Do NOT edit any source file in this task - write only the markdown artifact. Return JSON {artifact_path, summary, open_questions}.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260822-040449-feature-extend-one-click-join/intent_brief.md
_Included because: Confirmed Gate-0 scope, goal, acceptance criteria and non-goals for this run._

```
# Intent Brief - feature-extend - One-click join icon on event cards

## Goal
Add a small icon-only one-click 'join' affordance to TimedEventCard and AllDayEventCard that appears only when the event has a conference URL, and opens the meeting in one click without selecting the event underneath.

## Files in scope
- packages/web/src/grid/components/TimedEventCard.tsx
- packages/web/src/grid/components/AllDayEventCard.tsx
- packages/web/src/grid/components/EventJoinIcon.tsx (new)
- packages/web/src/grid/components/EventCard.test.tsx (extended)

## Files off-limits
- Everything outside packages/web/src/grid/components/
- Consumers of these cards (AllDayEvent.tsx, GridDraft.tsx, GridEvent.tsx, DayCalendarEventCards.tsx)
- Other event surfaces with unvalidated-href patterns (UpNextCard.tsx, EventDetailsSection.tsx, UpNextBanner.tsx) - deferred as a separate class of follow-up

## Acceptance criteria
- Icon renders only when the event has a conference URL, and only for safe http(s) URLs (defense-in-depth against javascript:/data:/vbscript: schemes reaching the href)
- Click/mousedown/keydown on the icon stop propagation so it never triggers card selection/drag/open
- TimedEventCard gates the icon on a minimum card width/height so it never renders on cards too small to host it cleanly, and coexists with the existing repeat icon (offset, no overlap)
- AllDayEventCard wires the same icon (fixed row height needs no size gate)
- Conference URL is excluded from PostHog autocapture (ph-no-capture or equivalent)
- Regression tests cover render/hide thresholds, click-to-open, propagation stopping, all-day padding permutations, z-index, and hostile URL-scheme rejection (with a positive control)
- Additive change: existing props and behavior for events without a conference link are unchanged

## Non-goals
- Fixing the unvalidated-href pattern elsewhere
- Any change to how conference links are parsed/stored upstream of ConferenceSchema.url

```
### Acceptance criteria
- requirements.md exists at the stated artifact_path
- Contains In scope, Out of scope, FR-n, NFR-n, delta impact table, security considerations, acceptance criteria, open questions
- Acceptance criteria are phrased so each maps to a testable assertion
- No source file under packages/ was modified by this task
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
    "summary": {
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
    "artifact_path",
    "summary"
  ]
}
```