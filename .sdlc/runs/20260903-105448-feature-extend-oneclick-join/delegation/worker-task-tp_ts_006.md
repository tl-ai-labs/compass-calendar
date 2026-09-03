## Task tp_ts_006 — tests / test_add
Module: grid-components
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND new test cases to the EXISTING file packages/web/src/grid/components/EventCard.test.tsx, inside the existing `describe("EventCard", ...)` block, immediately before its closing `});`.

ABSOLUTE REQUIREMENT: the file currently contains 20 `it(` cases. Do NOT modify, reorder, rename, reformat or delete ANY of them. Do not touch the existing createEvent factory, the `position` const, or the afterEach. Your diff must be purely additive. After your edit the file must contain 33 `it(` cases.

Read these first: packages/web/src/grid/components/TimedEventCard.tsx and packages/web/src/grid/components/AllDayEventCard.tsx (the gates under test) and packages/web/src/grid/components/EventJoinIcon.tsx.

Context: both cards now render an EventJoinIcon as a SIBLING of the card root when the event has a conference URL whose scheme is http:/https:. Timed gates: not placeholder, motionMode === "idle", durationMinutes >= 30, position.width >= 60. All-day gates: not placeholder, position.width >= 60. Accessible name is `Join <title>`. createEvent already spreads Partial<GridEvent>, so pass conference: { url: "https://meet.example.com/x", label: "Google Meet" } directly.

Add exactly these 13 cases:
1. timed: renders the join link when a conference exists - getByRole("link", { name: "Join Planning block" }) resolves AND getByRole("button", { name: /Planning block/ }) still resolves the card.
2. timed: no conference -> queryByRole("link") is null.
3. timed: displayMode="placeholder" -> queryByRole("link") is null.
4. timed: motionMode="dragging" -> queryByRole("link") is null.
5. timed: position.width 30 -> queryByRole("link") is null.
6. timed: a 15-minute event (start/end 15 min apart) -> queryByRole("link") is null.
7. timed: displayMode="draft" -> link IS rendered.
8. timed: conference.url "javascript:alert(1)" -> queryByRole("link") is null.
9. timed: with both the repeat icon and the join icon showing, the existing repeat-icon locator container.querySelector('svg[class*="right-1"]') is still non-null.
10. all-day: present with a conference and absent without (name "Join Conference" - use title "Conference").
11. all-day: isPlaceholder -> queryByRole("link") is null.
12. all-day: position.width 30 -> queryByRole("link") is null.
13. all-day: when both glyphs show, the title row carries the pr-10 class.

HARD RULES:
- Every presence/absence assertion MUST use getByRole/queryByRole against the accessibility tree. NEVER getAttribute("role"), NEVER a CSS selector containing [role=. A previous attempt shipped role-attribute assertions that could not fail.
- Do NOT add axe to this file.
- Write ONLY packages/web/src/grid/components/EventCard.test.tsx. Do not create, modify or delete any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: file under edit - all 20 existing cases must survive byte-identical_

```

```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: timed gates under test_

```

```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: all-day gates under test_

```

```

#### packages/web/src/grid/components/EventJoinIcon.tsx
_Included because: accessible name and scheme guard behaviour_

```

```
### Acceptance criteria
- file contains 33 it( cases
- all 20 pre-existing cases unchanged
- zero getAttribute("role") and zero [role= selectors in added cases
- no axe import
- only EventCard.test.tsx written
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_content": {
      "type": "string"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "file_content"
  ]
}
```