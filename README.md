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

## Weekly view interactions

- **Drag across days**: Move events between day columns or stretch all-day events across multiple days. Dragging near the grid edge pages the view so you can keep moving seamlessly. See [the week drag guide](./docs/frontend/week-drag-interaction.md).
- **Recurring events**: Create repeating schedules with ease. Editing or deleting an occurrence applies right away, with a toast letting you expand the change to "This and Following" or "All". See [the recurring events walkthrough](./docs/acceptance/recurring-events.md).
- **Event colors**: Choose from 11 colors or keep the "Calendar default". Your selection is saved on the event and colors the event's card in the grid.

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
