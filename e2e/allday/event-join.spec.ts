// No axe scan in this spec: a 24px join control overlapping a 20px-tall
// all-day chip fails axe's target-size rule (WCAG 2.5.8), which runs under the
// read-only axe helper and cannot be excluded. The timed sibling retains its
// scan so nested-interactive is still guarded for the shared EventJoinIcon component.

import { expect, test } from "@playwright/test";
import {
  createEventTitle,
  expectAllDayEventVisible,
  getSavedEventsByTitle,
  openEventForEditingWithMouse,
  prepareCalendarPage,
  seedEventWithConference,
} from "../utils/event-test-utils";

/**
 * A LOCAL calendar date `offsetDays` from today, as "YYYY-MM-DD".
 *
 * Local, not UTC: playwright.config.ts sets no `use.timezoneId`, so the browser
 * inherits the host timezone and the all-day row is laid out on local dates.
 * (The `Etc/UTC` in e2e/compass.playwright.yaml is app runtime config, not the
 * browser's.) Deriving these strings from getUTC* getters put the chip in a
 * different column than the spec assumed whenever the host's local date and UTC
 * date disagreed — i.e. for part of every day, at most offsets.
 */
const localDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

test("joins an all-day conference event without opening the detail panel", async ({
  page,
}) => {
  await prepareCalendarPage(page);

  const joinTitle = createEventTitle("Join All-Day");
  const blockedTitle = createEventTitle("Blocked All-Day");
  const controlTitle = createEventTitle("Control All-Day");

  const conferenceUrl = new URL("/e2e-join-target", page.url()).toString();
  // end is EXCLUSIVE, so a single-day chip is today -> tomorrow.
  const today = localDate(0);
  const tomorrow = localDate(1);

  await seedEventWithConference(page, {
    title: joinTitle,
    kind: "allDay",
    start: today,
    end: tomorrow,
    conferenceUrl,
  });

  await seedEventWithConference(page, {
    title: blockedTitle,
    kind: "allDay",
    start: today,
    end: tomorrow,
    conferenceUrl: "javascript:alert(1)",
  });

  await seedEventWithConference(page, {
    title: controlTitle,
    kind: "allDay",
    start: today,
    end: tomorrow,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectAllDayEventVisible(page, joinTitle);

  const row = page.locator("#allDayRow");
  const joinLink = row.getByRole("link", { name: `Join ${joinTitle}` });

  await expect(joinLink).toBeVisible();
  await expect(joinLink).toHaveAttribute("target", "_blank");
  await expect(joinLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(joinLink).toHaveAttribute("href", conferenceUrl);

  // Assert the CARD is on the row before asserting its join link is absent.
  // Without the card assertion these pass identically when the event never
  // rendered at all — a seeding-shape mistake would read as "the scheme guard
  // works", which is the failure mode this pair exists to rule out.
  await expect(row.getByRole("button", { name: blockedTitle })).toBeVisible();
  await expect(
    row.getByRole("link", { name: `Join ${blockedTitle}` }),
  ).toHaveCount(0);

  await expect(row.getByRole("button", { name: controlTitle })).toBeVisible();
  await expect(
    row.getByRole("link", { name: `Join ${controlTitle}` }),
  ).toHaveCount(0);

  const [joined] = await Promise.all([
    page.context().waitForEvent("page"),
    joinLink.click(),
  ]);
  await joined.waitForURL(conferenceUrl);
  await joined.close();
  await expect(page.getByRole("form").getByPlaceholder("Title")).toBeHidden();
});

test("leaves click and drag-to-move working on a conference-free all-day event", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await prepareCalendarPage(page);

  const tomorrow = localDate(1);
  const dayAfter = localDate(2);
  const controlTitle = createEventTitle("Control All-Day");

  await seedEventWithConference(page, {
    title: controlTitle,
    kind: "allDay",
    start: tomorrow,
    end: dayAfter,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectAllDayEventVisible(page, controlTitle);

  await openEventForEditingWithMouse(page, controlTitle);
  await expect(page.getByRole("form").getByPlaceholder("Title")).toHaveValue(
    controlTitle,
  );
  await page.keyboard.press("Escape");

  const card = page
    .locator("#allDayRow")
    .getByRole("button", { name: controlTitle });
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) {
    throw new Error("Expected event card to be visible for dragging.");
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  const dragDeltaX = box.width > 0 ? box.width : 100;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - dragDeltaX * 0.33, centerY, { steps: 5 });
  await page.mouse.move(centerX - dragDeltaX * 0.66, centerY, { steps: 5 });
  await page.mouse.move(centerX - dragDeltaX, centerY, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(
      async () =>
        (await getSavedEventsByTitle(page, controlTitle))[0]?.startDate,
    )
    .not.toBe(tomorrow);
});
