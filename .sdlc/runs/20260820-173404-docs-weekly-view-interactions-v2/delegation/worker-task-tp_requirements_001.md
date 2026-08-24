## Task tp_requirements_001 — requirements_analysis / docs_requirements
Module: readme
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a SCOPED docs requirements document to .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/requirements.md for a docs-only brownfield run. This run adds ONE new '## Weekly view interactions' section to root README.md, inserted between the existing '## Features' and '## Tech stack' headings. Audience: end users; plain language; NO internal file, component, or function names in the README copy. Content covers ONLY two topics: (1) recurring events - creating a recurring series with Day/Week/Month/Year frequencies, and the choice between editing/deleting a whole series vs a single occurrence; (2) event colors - 11 fixed color options for tagging events. Must NOT claim hourly/minutely recurrence, must NOT claim custom/arbitrary hex colors, and must NOT mention multi-day drag-select as a working feature (it is not implemented at this commit). Section must link to docs/frontend/week-drag-interaction.md for implementation detail, without duplicating or editing that file. Sections required: In scope (numbered, testable); Out of scope (numbered); Functional requirements (FR-1..); Non-functional requirements (NFR-1..); Accuracy constraints (facts the copy must respect, each with its source of truth); Acceptance criteria (numbered, checkable); Open questions for HITL (or 'None'). Omit PII inventory and role matrix - a README edit has neither; state that explicitly in one line. Write ONLY that one file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/intent_brief.md
_Included because: The confirmed intent brief: goal, scope, non-goals, acceptance criteria._

```
# Intent Brief - docs - Weekly view interactions README section

## Context
Compass's weekly grid view supports several end-user interactions that aren't currently summarized anywhere in the root README.md: recurring events and event colors. (Multi-day select was originally in scope but discovery found it is not yet implemented at this commit - useAllDayDraftCreation.ts still hardcodes a 1-day draft; four prior runs targeted it but none landed. It is excluded from this run - see Non-goals.) A developer-facing doc, docs/frontend/week-drag-interaction.md, already covers drag mechanics in implementation detail and should be linked rather than duplicated.

Audience: end users of the calendar app - plain description of what they can do, not implementation detail.

## Goal
Add one new '## Weekly view interactions' section to root README.md describing, for end users:
- Recurring events - creating a recurring series (Day/Week/Month/Year frequencies), and the series-vs-single-instance choice when editing or deleting an occurrence.
- Event colors - the 11 available color options for tagging events.
Link to docs/frontend/week-drag-interaction.md for readers who want interaction/drag implementation detail rather than restating it.

## Task type
doc_addition

## Files in scope
- README.md (new section only, inserted between existing '## Features' and '## Tech stack' headings)

## Files off-limits
- Everything else, including docs/frontend/week-drag-interaction.md (link to it, don't edit it)
- All existing AI-config files detected by discovery
- .sdlc/**, node_modules/**, dist/**, build/**, .next/**, .git/**

## Acceptance criteria
- README.md gains exactly one new ##-level section titled 'Weekly view interactions', positioned between '## Features' and '## Tech stack'.
- Section covers recurring events and event colors only - no mention of multi-day select as a working feature.
- Recurring-events copy accurately reflects Day/Week/Month/Year-only frequencies and the series/instance edit-delete distinction; does not claim hourly/minutely/secondly recurrence.
- Event-colors copy accurately reflects the 11 fixed color slots; does not claim support for arbitrary/custom hex colors (provider colorHex is read-only in Compass).
- Section links to docs/frontend/week-drag-interaction.md rather than duplicating its content.
- bun lint passes (README-only change; no test-suite impact expected).

## Non-goals
- Documenting multi-day select - not implemented at this commit.
- Editing docs/frontend/week-drag-interaction.md or any other existing doc.
- Any code changes - this is a docs-only run.
```

#### .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/baseline.json#docs_intent_findings
_Included because: Verified facts from discovery - the source of truth for every claim the README copy may make._

```
recurring_events: UI entry RecurrenceSection; frequencies = [Day, Week, Month, Year] only; library = rrule; supporting files include useRecurrence.ts, FreqSelect.tsx, WeekDays.tsx, EndsOnDate.tsx, ConvertToStandaloneDialog.tsx, recurrence-scope.toast.tsx, useDeleteEvent.ts, EventRepeatIcon.tsx (a repeat icon marks recurring events in the grid). Editing or deleting one occurrence prompts a series-vs-this-instance choice; converting a single occurrence to a standalone event is supported.

event_colors: 11 fixed slots = lavender, mint, plum, coral, gold, orange, blue, slate, indigo, green, red. Contract: packages/core/src/types/event-color.contracts.ts EventColorSlotSchema, maps 1:1 onto Google's legacy 11 event colors. provider colorHex is READ-ONLY - Compass's picker only ever writes `color`, never colorHex. So NO custom/arbitrary hex colors.

multi_day (ACCURACY RISK, high): at HEAD 4189de13 the all-day row has NO multi-day drag-create; useAllDayDraftCreation.ts creates a fixed 1-day draft. Multi-day spans arise only by RESIZING an existing all-day event or a multi-day TIMED event rendering as an all-day bar. Docs must NOT claim drag-to-select-multiple-days on creation. Four prior runs targeted this; none landed. EXCLUDED from this run entirely.
```

#### README.md
_Included because: Insertion context - the existing headings and the house voice/tone the new section must match._

```
# Compass Calendar

A simple calendar that helps you manage your time.

## Why try compass?

### You'll get more done
- The **first-class shortcuts** will make it a breeze to stay on top of your schedule.
- The **minimal UI** will help you focus on what matters: your events.
- The **Google Calendar two-way sync** will ensure you don't miss anything.

### You'll get less done
...

### It'll be around for the long-term
...

## Features

Cool things you can do with in Compass

- Find the perfect slot for an event with your keyboard: `SHIFT` + arrow keys
- Do everything from the cmd palette
- Edit events smoothly
- Google Calendar sync

Things you can't do in Compass (yet):

- See attendees, reminders, locations, and meeting links
- See your Outlook events

## Tech stack

- **Frontend**: React, Zustand, TanStack, Tailwind
- **Backend**: Node, Express, MongoDB
- **Testing**: Bun, React Testing Library, Playwright

[Line numbers: '## Features' is line 23, '## Tech stack' is line 37.]
```
### Acceptance criteria
- File .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/requirements.md exists and is valid markdown
- Contains sections: In scope, Out of scope, Functional requirements, Non-functional requirements, Accuracy constraints, Acceptance criteria, Open questions for HITL
- Out of scope explicitly names multi-day select as not-implemented and excluded
- Accuracy constraints name Day/Week/Month/Year-only frequencies and the 11 fixed color slots with no custom hex support
- States that PII inventory and role matrix are not applicable to a README-only change
- No files other than requirements.md are created or modified
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