## Task tp_docs_001 — docs / doc_addition
Module: readme
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Insert one new '## Weekly view interactions' section into README.md strictly between the existing '## Features' section and the '## Tech stack' heading. The edit must be strictly additive, leaving all pre-existing lines unmodified. The section must cover ONLY two topics: (1) recurring events (Day, Week, Month, and Year frequencies, and editing or deleting a single occurrence versus the whole series); and (2) event colors (11 fixed options). Include a relative link to docs/frontend/week-drag-interaction.md without duplicating or editing that file. Write in plain, user-facing language matching the README voice, with no internal file, component, or function names. Do NOT mention multi-day drag-select or creation, do NOT mention hourly, minutely, or secondly recurrence, and do NOT mention custom or arbitrary hex colors. Modify no file other than README.md.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### README.md
_Included because: Insertion context and house style sample between '## Features' and '## Tech stack'. Pre-existing lines must not be modified._

```
## Features

Cool things you can do with in Compass

- Find the perfect slot for an event with your keyboard: `SHIFT` + `↑` `↓` `←` `→`
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
```
### Acceptance criteria
- File README.md contains a single new ## Weekly view interactions section positioned between ## Features and ## Tech stack.
- The section covers recurring events with Day/Week/Month/Year frequencies and single instance vs. whole series edit/delete choices.
- The section covers event colors with 11 fixed color options.
- The section contains a working markdown link to docs/frontend/week-drag-interaction.md.
- The section makes no mention of multi-day drag-select or creation.
- The section makes no claim of hourly/minutely recurrence or custom hex colors.
- The copy contains no internal component, function, or source code file names.
- Pre-existing lines in README.md are completely unmodified.
- bun lint passes without errors.
- No files outside README.md are modified during the doc addition.
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
      },
      "description": "Array of file paths written or modified."
    },
    "summary": {
      "type": "string",
      "description": "Summary of the changes made."
    }
  },
  "required": [
    "files_written",
    "summary"
  ]
}
```