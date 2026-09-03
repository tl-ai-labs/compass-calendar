## Task tp_ts_011 — tests / test_add
Module: e2e-allday
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW file e2e/allday/event-join.spec.ts. Read e2e/allday/event-smoke.spec.ts, e2e/timed/event-join.spec.ts (the sibling spec just written — mirror its structure) and e2e/utils/event-test-utils.ts first.

Same two-test shape as the timed sibling, with these differences:

- kind: "allDay". Dates are DATE-ONLY "YYYY-MM-DD" and the END IS EXCLUSIVE (end must be strictly after start). Use today = new Date().toISOString().slice(0,10) and tomorrow = the next UTC day, so start=today, end=tomorrow.
- Locators scoped to `page.locator("#allDayRow")` instead of #mainGrid.
- Use expectAllDayEventVisible(page, title) for the visibility wait.
- Put the conference-free CONTROL event on a DIFFERENT day (start=tomorrow, end=day-after) so a horizontal drag has somewhere to land.
- TEST 2 is drag-to-move ONLY. Do NOT exercise all-day resize: the handle is 4.5px wide on the edge of a 20px chip and is the flakiest pointer target in the app. Drag HORIZONTALLY (vary x, keep y roughly constant) since the all-day row lays out along the x axis. Poll getSavedEventsByTitle for a changed startDate.

CRITICAL — DO NOT call expectNoAxeViolations in this spec, and do NOT import ../utils/axe-assertion at all. This is a deliberate decision: a 24px join control overlapping a 20px-tall all-day chip fails axe's target-size rule (WCAG 2.5.8), the rule DOES run under that helper, and the helper is read-only so the rule cannot be excluded. Add a short comment at the top of the file recording exactly that, and noting the timed sibling keeps its scan so nested-interactive is still guarded for the shared EventJoinIcon component.

HARD RULES:
- EVERY locator must be filtered by an accessible name unique to this spec (createEventTitle gives unique titles). Demo events are present in every run, so a bare getByRole("link") or unfiltered toHaveCount(0) WILL be wrong.
- NEVER drag the conference-bearing card — a known local-mode bug destroys `conference` on any move, the icon would vanish, and the spec would misreport a pre-existing bug as a failure of this feature. All AC-4 assertions use the conference-free control event only.
- Write ONLY e2e/allday/event-join.spec.ts. Do not create, modify or delete any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### e2e/allday/event-smoke.spec.ts
_Included because: all-day spec conventions_

```

```

#### e2e/timed/event-join.spec.ts
_Included because: sibling spec to mirror_

```

```

#### e2e/utils/event-test-utils.ts
_Included because: helpers incl. seedEventWithConference and expectAllDayEventVisible_

```

```
### Acceptance criteria
- NO expectNoAxeViolations call and no axe-assertion import
- all-day resize not exercised
- conference-bearing card never dragged
- end date strictly after start (exclusive)
- every locator name-filtered
- only e2e/allday/event-join.spec.ts written
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