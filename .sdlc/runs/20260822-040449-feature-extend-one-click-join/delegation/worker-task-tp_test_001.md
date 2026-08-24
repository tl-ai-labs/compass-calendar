## Task tp_test_001 — tests / test_add
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
HARD CONSTRAINT, READ FIRST: Do NOT run git, rm, mv, or any cleanup/housekeeping shell command. Do not revert, stage, commit or clean anything. Only touch the single file packages/web/src/grid/components/EventCard.test.tsx. If you notice unrelated dirty state anywhere in the repo, IGNORE it. Running `bun test packages/web/src/grid/components/EventCard.test.tsx` to check your work is allowed and encouraged; mutating any other file is not. If a test you write fails because the SOURCE is wrong, do NOT edit the source - report it in your summary instead. TASK: EXTEND (do not rewrite) the existing 575-line EventCard.test.tsx. Read it first and reuse its existing harness exactly: the createEvent helper, the shared `position` object, bun:test imports, @testing-library/react, and the existing describe("EventCard") block. Also read EventJoinIcon.tsx, TimedEventCard.tsx and AllDayEventCard.tsx for actual behavior. Add a nested describe("join affordance") covering AC-1..AC-11: AC-1 renders a link with correct href and aria-label on BOTH cards for a valid https url; AC-2 hostile schemes javascript:, data:, vbscript:, file: render NO link, with an https positive control asserted under identical props; AC-3 no link when conference is undefined, null, or url is empty string; AC-4 timed card hides the link when duration < 15 minutes; AC-5 timed card hides the link when position.width < 40; AC-6 recurring timed event with a conference renders BOTH icons, join at right-4.5; AC-7 all-day title container padding across all four permutations (neither / repeat only / join only / both -> pr-7); AC-8 fireEvent.mouseDown and .click on the link do not invoke onEventMouseDown or onScalerMouseDown; AC-9 keyDown Enter and Space on the link do not invoke onEventKeyDown; AC-10 link has target=_blank, rel='noopener noreferrer' and class ph-no-capture; AC-11 accessible name includes the event title. Use mock() for callbacks per the file's existing convention. All pre-existing tests must remain untouched and passing.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- AC-1 valid https url renders a link with correct href and aria-label on both cards
- AC-2 javascript:, data:, vbscript: and file: schemes render no link, with an https positive control
- AC-3 undefined, null and empty-string conference urls render no link
- AC-4 timed card hides the link below 15 minutes duration
- AC-5 timed card hides the link below 40px width
- AC-6 recurring timed event with conference renders both icons without collision
- AC-7 all-day padding asserted for all four icon permutations
- AC-8 mouseDown and click on the link do not invoke card mouse callbacks
- AC-9 Enter and Space keyDown on the link do not invoke onEventKeyDown
- AC-10 link carries target=_blank, rel='noopener noreferrer' and ph-no-capture
- AC-11 accessible name includes the event title
- All pre-existing tests in the file are unchanged and still pass
- No file other than EventCard.test.tsx was created, modified or deleted
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    },
    "tests_added": {
      "type": "number"
    },
    "test_run_result": {
      "type": "string"
    }
  },
  "required": [
    "files_written",
    "summary"
  ]
}
```