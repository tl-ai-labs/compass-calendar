## Task tp_ts_010 — tests / test_add
Module: e2e-timed
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW file e2e/timed/event-join.spec.ts. Read e2e/timed/event-smoke.spec.ts, e2e/utils/event-test-utils.ts (note the new seedEventWithConference / SeededLocalEvent exports at the end) and e2e/utils/axe-assertion.ts first.

Two test() blocks.

TEST 1 — "joins a timed conference event without opening the detail panel":
1. `await prepareCalendarPage(page);` FIRST. It deletes the IndexedDB database, so seeding before it is thrown away.
2. Build three unique titles with createEventTitle(...) e.g. "Join Timed", "Blocked Timed", "Control Timed".
3. `const conferenceUrl = new URL("/e2e-join-target", page.url()).toString();` — same-origin so CI needs no outbound network.
4. Seed three TIMED events on today's UTC date, start 10:00 end 11:00 (build via `new Date().toISOString().slice(0,10)` + "T10:00:00.000Z"/"T11:00:00.000Z"; the browser runs at Etc/UTC): the join event with conferenceUrl; the blocked event with conferenceUrl "javascript:alert(1)"; the control event with NO conferenceUrl.
5. `await page.reload({ waitUntil: "domcontentloaded" });` then `await expectTimedEventVisible(page, joinTitle);`
6. `const grid = page.locator("#mainGrid");`
   - `const joinLink = grid.getByRole("link", { name: `Join ${joinTitle}` });` -> toBeVisible(); toHaveAttribute("target","_blank"); toHaveAttribute("rel","noopener noreferrer"); toHaveAttribute("href", conferenceUrl).
   - `await expect(grid.getByRole("link", { name: `Join ${blockedTitle}` })).toHaveCount(0);`
   - `await expect(grid.getByRole("link", { name: `Join ${controlTitle}` })).toHaveCount(0);`
7. `await expectNoAxeViolations(page, { include: "#mainGrid", checkpoint: "timed grid with join control" });`
8. Click and prove both halves of AC-3:
```
const [joined] = await Promise.all([
  page.context().waitForEvent("page"),
  joinLink.click(),
]);
await joined.waitForURL(conferenceUrl);
await joined.close();
await expect(page.getByRole("form").getByPlaceholder("Title")).toBeHidden();
```
Use context().waitForEvent("page") NOT page.on("popup") — rel=noopener severs the opener so the popup event may never fire.

TEST 2 — "leaves click, drag-to-move and resize working on a conference-free timed event":
1. prepareCalendarPage; seed ONE timed control event (NO conference) at 10:00-11:00 today; reload; expectTimedEventVisible.
2. Card-body click still opens the panel: `await openEventForEditingWithMouse(page, controlTitle);` then expect the form title input toHaveValue(controlTitle); then `await page.keyboard.press("Escape");`
3. Drag-to-move: locate the card via `page.locator("#mainGrid").getByRole("button", { name: controlTitle })`, scrollIntoViewIfNeeded(), boundingBox(), then page.mouse.move(centre) -> mouse.down() -> three mouse.move steps downward totalling roughly one hour of grid height, each with { steps: 5 } -> mouse.up(). Then `await expect.poll(async () => (await getSavedEventsByTitle(page, controlTitle))[0]?.startDate).not.toBe(originalStart);`
4. Resize: grab the bottom edge (box.y + box.height - 2), same multi-step drag downward, then poll that endDate changed while startDate did not.

HARD RULES:
- EVERY locator must be filtered by an accessible name unique to this spec. The demo seed puts other events on the grid in every run — including a conference-bearing "Morning standup" that renders its own join link — so a bare getByRole("link") or an unfiltered toHaveCount(0) WILL be wrong.
- NEVER drag or resize the conference-bearing card. A known local-mode bug destroys `conference` on any move/resize, the icon would vanish, and the spec would misreport a pre-existing bug as a failure of this feature. All AC-4 assertions use the conference-free control event only.
- Import expectNoAxeViolations from "../utils/axe-assertion" and do NOT modify that file.
- Write ONLY e2e/timed/event-join.spec.ts. Do not create, modify or delete any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### e2e/timed/event-smoke.spec.ts
_Included because: spec conventions to mirror_

```

```

#### e2e/utils/event-test-utils.ts
_Included because: helpers incl. new seedEventWithConference_

```

```

#### e2e/utils/axe-assertion.ts
_Included because: expectNoAxeViolations signature - READ ONLY_

```

```
### Acceptance criteria
- seeding happens after prepareCalendarPage and is followed by a reload
- conference-bearing card never dragged or resized
- every locator name-filtered to this spec's titles
- expectNoAxeViolations called with include #mainGrid
- only e2e/timed/event-join.spec.ts written
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