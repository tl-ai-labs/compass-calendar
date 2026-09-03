import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../utils/axe-assertion";
import {
  createEventTitle,
  expectTimedEventVisible,
  getSavedEventsByTitle,
  openEventForEditingWithMouse,
  prepareCalendarPage,
  seedEventWithConference,
} from "../utils/event-test-utils";

/**
 * A one-hour slot at `hour` LOCAL time today, as UTC instants.
 *
 * Local, not UTC, for two reasons that bite together:
 *
 * 1. playwright.config.ts sets no `use.timezoneId`, so the browser inherits the
 *    host timezone and the grid lays out in local time. (The `Etc/UTC` in
 *    e2e/compass.playwright.yaml is app runtime config, not the browser's.)
 *    A hardcoded `...T10:00:00.000Z` therefore lands in a different column —
 *    and on a different day, once the local and UTC dates disagree.
 * 2. The demo seed occupies today 09:00-09:30, 10:00-11:00, 12:00-13:00,
 *    14:00-14:30, 15:00-15:30 and 17:00-18:00 LOCAL, and it is re-seeded on
 *    every run because prepareCalendarPage empties the store. Seeding at 10:00Z
 *    collided with demo "Try Compass" whenever the host ran at UTC, producing a
 *    four-card fanned deck in which a neighbouring card paints over this card's
 *    join anchor (equal z-index, later in DOM order — deliberate product
 *    behaviour). `toBeVisible()` ignores occlusion, so the spec sailed past the
 *    assertions and failed at `.click()` with "element intercepts pointer
 *    events", reading like a feature bug rather than a fixture collision.
 *
 * Callers must therefore pick hours the demo seed leaves free — 11, 13 and 16 —
 * and must not overlap each other, so every card keeps the full column width.
 */
const todayLocalSlot = (hour: number) => {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 1, 0, 0, 0);

  return { start: start.toISOString(), end: end.toISOString() };
};

test("joins a timed conference event without opening the detail panel", async ({
  page,
}) => {
  await prepareCalendarPage(page);

  const joinTitle = createEventTitle("Join Timed");
  const blockedTitle = createEventTitle("Blocked Timed");
  const controlTitle = createEventTitle("Control Timed");

  const conferenceUrl = new URL("/e2e-join-target", page.url()).toString();

  await seedEventWithConference(page, {
    title: joinTitle,
    kind: "timed",
    ...todayLocalSlot(11),
    conferenceUrl,
  });

  await seedEventWithConference(page, {
    title: blockedTitle,
    kind: "timed",
    ...todayLocalSlot(13),
    conferenceUrl: "javascript:alert(1)",
  });

  await seedEventWithConference(page, {
    title: controlTitle,
    kind: "timed",
    ...todayLocalSlot(16),
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectTimedEventVisible(page, joinTitle);

  const grid = page.locator("#mainGrid");
  const joinLink = grid.getByRole("link", { name: `Join ${joinTitle}` });

  await expect(joinLink).toBeVisible();
  await expect(joinLink).toHaveAttribute("target", "_blank");
  await expect(joinLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(joinLink).toHaveAttribute("href", conferenceUrl);

  // Assert the CARD is on the grid before asserting its join link is absent.
  // Without the card assertion these pass identically when the event never
  // rendered at all — a seeding-shape mistake would read as "the scheme guard
  // works", which is the failure mode this pair exists to rule out.
  await expect(grid.getByRole("button", { name: blockedTitle })).toBeVisible();
  await expect(
    grid.getByRole("link", { name: `Join ${blockedTitle}` }),
  ).toHaveCount(0);

  await expect(grid.getByRole("button", { name: controlTitle })).toBeVisible();
  await expect(
    grid.getByRole("link", { name: `Join ${controlTitle}` }),
  ).toHaveCount(0);

  await expectNoAxeViolations(page, {
    include: "#mainGrid",
    checkpoint: "timed grid with join control",
  });

  const [joined] = await Promise.all([
    page.context().waitForEvent("page"),
    joinLink.click(),
  ]);
  await joined.waitForURL(conferenceUrl);
  await joined.close();
  await expect(page.getByRole("form").getByPlaceholder("Title")).toBeHidden();
});

test("leaves click, drag-to-move and resize working on a conference-free timed event", async ({
  page,
}) => {
  await prepareCalendarPage(page);

  const { start: originalStart, end: originalEnd } = todayLocalSlot(11);
  const controlTitle = createEventTitle("Control Timed");

  await seedEventWithConference(page, {
    title: controlTitle,
    kind: "timed",
    start: originalStart,
    end: originalEnd,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectTimedEventVisible(page, controlTitle);

  await openEventForEditingWithMouse(page, controlTitle);
  await expect(page.getByRole("form").getByPlaceholder("Title")).toHaveValue(
    controlTitle,
  );
  await page.keyboard.press("Escape");

  const card = page
    .locator("#mainGrid")
    .getByRole("button", { name: controlTitle });
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) {
    throw new Error("Expected event card to be visible for dragging.");
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY + 20, { steps: 5 });
  await page.mouse.move(centerX, centerY + 40, { steps: 5 });
  await page.mouse.move(centerX, centerY + 60, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(
      async () =>
        (await getSavedEventsByTitle(page, controlTitle))[0]?.startDate,
    )
    .not.toBe(originalStart);

  const movedEvents = await getSavedEventsByTitle(page, controlTitle);
  const movedStart = movedEvents[0]?.startDate;
  const movedEnd = movedEvents[0]?.endDate;

  await card.scrollIntoViewIfNeeded();
  const resizeBox = await card.boundingBox();
  if (!resizeBox) {
    throw new Error("Expected event card to be visible for resizing.");
  }

  const resizeX = resizeBox.x + resizeBox.width / 2;
  const resizeBottomY = resizeBox.y + resizeBox.height - 2;

  await page.mouse.move(resizeX, resizeBottomY);
  await page.mouse.down();
  await page.mouse.move(resizeX, resizeBottomY + 20, { steps: 5 });
  await page.mouse.move(resizeX, resizeBottomY + 40, { steps: 5 });
  await page.mouse.move(resizeX, resizeBottomY + 60, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(
      async () => (await getSavedEventsByTitle(page, controlTitle))[0]?.endDate,
    )
    .not.toBe(movedEnd);
  await expect
    .poll(
      async () =>
        (await getSavedEventsByTitle(page, controlTitle))[0]?.startDate,
    )
    .toBe(movedStart);
});
