## Task tp_doc_002 — docs / doc_addition
Module: docs-readme
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Add EXACTLY ONE line to README.md: a pointer bullet to the new docs/frontend/weekly-view-interactions.md page, appended as the last bullet of the '## Resources' section, matching the surrounding bullet format exactly.

The Resources bullets follow the shape:  - **Label**: [link text](url)

ABSOLUTE CONSTRAINTS:
- Exactly one line is ADDED. Zero lines are removed. Zero existing lines are modified — not reflowed, not reworded, not re-indented, not reordered.
- `git diff -- README.md` must show a single +line and nothing else.
- Do not restructure, retitle, or reformat any section. Do not touch the Features, Tech stack or Getting started sections.
- Preserve the trailing newline at end of file.
- Write ONLY README.md. Touch no other path. Do not create or modify any other file.

The current README.md is supplied in full below.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### README.md
_Included because: The full current file. The single added bullet must match the surrounding style exactly and change nothing else._

```
# Compass Calendar

A simple calendar that helps you manage your time.

## Why try compass?

### You'll get more done

- The **first-class shortcuts** will make it a breeze to stay on top of your schedule.
- The **minimal UI** will help you focus on what matters: your events.
- The **Google Calendar two-way sync** will ensure you don't miss anything.

### You'll get less done

- The [**life view**](https://www.compasscalendar.com/life?utm_source=github&utm_medium=referral&utm_campaign=readme) shows your existance as a grid of dots. Seeing how few you have left may make you pause before scheduling more busy work.
- The absense of AI automation will keep unnecessary work out of your schedule.

### It'll be around for the long-term

- **We're bootstrapped.** While VC-backed teams think in terms of months and funding rounds, we think in terms of decades and profit. We don't need to make $1B in 5 years or sell your data to an acquirer. As long as we keep users like you happy, we'll be fine.
- **We have a plan.** Our long-term [vision](https://alpaca-ty.notion.site/about-us) will keep us busy for generations. Our practical roadmap and focus on profitability will keep our feet on the ground along the way.

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

## Getting started

| Option | Description | Instructions |
| --- | --- | --- |
| **1. Try Compass web** | Use Compass now (no signup required). | [compasscalendar.com](https://www.compasscalendar.com?utm_source=github&utm_medium=referral&utm_campaign=readme) |
| **2. Run Compass locally** | Run Compass on your machine. | `bun install`<br><br>`cp compass.example.yaml compass.yaml` <br><br>`bun run dev:web`<br><br>`bun run dev:backend`<br><br>Open [http://localhost:9080](http://localhost:9080). |
| **3. Self-host Compass** | Run Compass on your server. | See [the self-hosting guide](./docs/self-hosting/README.md). |

## Resources

- **Docsite**: [docs.compasscalendar.com](https://docs.compasscalendar.com/docs)
- **Changelog**: [compasscalendar.com](https://changelog.compasscalendar.com)
- **Handbook**: [notion.site](https://alpaca-ty.notion.site/Compass-Handbook-26b237bde8f4805c9a56de6db3a7993d?utm_source=github&utm_medium=referral&utm_campaign=readme)
- **Twitter**: [@CompassCalendar](https://x.com/CompassCalendar)
- **LinkedIn**: [Compass Calendar](https://www.linkedin.com/company/compass-calendar)

```

#### FACTS/new-page.md
_Included because: What the new page is, so the bullet describes it accurately._

```
The new page is docs/frontend/weekly-view-interactions.md — a contributor-facing reference for the week view's interaction model: all-day and multi-day selection, recurring events, and event colors. Sibling pages already in docs/frontend/: week-drag-interaction.md, frontend-runtime-flow.md, responsive-layout.md, event-caching.md.
```
### Acceptance criteria
- README.md gains exactly one line.
- No existing line in README.md is modified, removed, reordered or reflowed.
- The added line links to docs/frontend/weekly-view-interactions.md.
- The added line matches the formatting of the bullets around it.
- No file other than README.md is written.
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "content"
  ]
}
```