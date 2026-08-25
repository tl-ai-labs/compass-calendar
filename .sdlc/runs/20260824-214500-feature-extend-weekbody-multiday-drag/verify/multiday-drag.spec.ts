/**
 * Manual-verification pass for the multi-day all-day drag feature.
 *
 * This is NOT part of the repo's test suite — it lives under .sdlc/ and exists
 * to exercise the gesture in a real browser, which unit tests cannot do. It is
 * driven by playwright.verify.config.ts in this directory.
 */
import { expect, type Page, test } from "@playwright/test";
import {
  createEventTitle,
  fillTitleAndSaveEventForm,
  prepareCalendarPage,
} from "../../../../e2e/utils/event-test-utils";

const SHOTS = `${__dirname}/shots`;

/** x-centre of each visible day column, derived from the day-label titles. */
const dayColumnCentres = async (page: Page): Promise<number[]> => {
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll("#weekGridScroller [title]")]
      .filter((n): n is HTMLElement => n instanceof HTMLElement)
      .filter((n) => /^\d{8}$/.test(n.title))
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, title: n.title };
      })
      .sort((a, b) => a.x - b.x),
  );
  return boxes.map((b) => b.x);
};

const allDayRowY = async (page: Page): Promise<number> => {
  const box = await page.locator("#allDayRow").boundingBox();
  if (!box) throw new Error("#allDayRow not visible");
  return box.y + box.height / 2;
};

const formVisible = (page: Page) => page.getByRole("form");

/** Width of the saved all-day bar, in day-columns. */
const barWidthInColumns = async (page: Page, title: string) => {
  const bar = page.getByRole("button", { name: title }).last();
  await bar.waitFor({ state: "visible" });
  const box = await bar.boundingBox();
  const centres = await dayColumnCentres(page);
  const colWidth = centres[1] - centres[0];
  if (!box || !colWidth) throw new Error("could not measure bar");
  return box.width / colWidth;
};

test.describe("multi-day all-day drag", () => {
  test.beforeEach(async ({ page }) => {
    await prepareCalendarPage(page);
  });

  test("A: forward drag across 3 columns creates a 3-day spanning event", async ({
    page,
  }) => {
    const centres = await dayColumnCentres(page);
    const y = await allDayRowY(page);
    const title = createEventTitle("Fwd3");

    await page.mouse.move(centres[1], y);
    await page.mouse.down();
    await page.mouse.move(centres[2], y, { steps: 10 });
    await page.mouse.move(centres[3], y, { steps: 10 });
    await page.screenshot({ path: `${SHOTS}/A1-preview-mid-drag.png` });
    await page.mouse.up();

    await expect(formVisible(page)).toBeVisible();
    await fillTitleAndSaveEventForm(page, title);
    await page.screenshot({ path: `${SHOTS}/A2-saved.png` });

    const cols = await barWidthInColumns(page, title);
    console.log(`A: bar spans ${cols.toFixed(2)} columns (expect ~3)`);
    expect(cols).toBeGreaterThan(2.5);
    expect(cols).toBeLessThan(3.5);
  });

  test("B: reverse drag right-to-left yields the same 3-day span", async ({
    page,
  }) => {
    const centres = await dayColumnCentres(page);
    const y = await allDayRowY(page);
    const title = createEventTitle("Rev3");

    await page.mouse.move(centres[3], y);
    await page.mouse.down();
    await page.mouse.move(centres[2], y, { steps: 10 });
    await page.mouse.move(centres[1], y, { steps: 10 });
    await page.screenshot({ path: `${SHOTS}/B1-preview-reverse.png` });
    await page.mouse.up();

    await expect(formVisible(page)).toBeVisible();
    await fillTitleAndSaveEventForm(page, title);

    const cols = await barWidthInColumns(page, title);
    console.log(`B: bar spans ${cols.toFixed(2)} columns (expect ~3)`);
    expect(cols).toBeGreaterThan(2.5);
    expect(cols).toBeLessThan(3.5);
  });

  test("C: plain click still creates a one-day event", async ({ page }) => {
    const centres = await dayColumnCentres(page);
    const y = await allDayRowY(page);
    const title = createEventTitle("Click1");

    await page.mouse.move(centres[2], y);
    await page.mouse.down();
    await page.mouse.up();

    await expect(formVisible(page)).toBeVisible();
    await fillTitleAndSaveEventForm(page, title);
    await page.screenshot({ path: `${SHOTS}/C1-single-day.png` });

    const cols = await barWidthInColumns(page, title);
    console.log(`C: bar spans ${cols.toFixed(2)} columns (expect ~1)`);
    expect(cols).toBeLessThan(1.5);
  });

  test("D: Escape mid-drag cancels, no form and no event", async ({ page }) => {
    const centres = await dayColumnCentres(page);
    const y = await allDayRowY(page);

    await page.mouse.move(centres[1], y);
    await page.mouse.down();
    await page.mouse.move(centres[3], y, { steps: 10 });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${SHOTS}/D1-after-escape.png` });
    await page.mouse.up();

    await expect(formVisible(page)).toHaveCount(0);
  });

  test("E: press-and-hold without moving defers the form to mouseup", async ({
    page,
  }) => {
    const centres = await dayColumnCentres(page);
    const y = await allDayRowY(page);

    await page.mouse.move(centres[2], y);
    await page.mouse.down();
    await page.waitForTimeout(600);

    const formCountWhileHeld = await formVisible(page).count();
    await page.screenshot({ path: `${SHOTS}/E1-held-no-move.png` });
    console.log(
      `E: forms visible while held (D-1(c) says 0, old behaviour was 1): ${formCountWhileHeld}`,
    );

    await page.mouse.up();
    await expect(formVisible(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/E2-after-release.png` });

    // Recorded as an observation, not a hard failure: this IS the accepted
    // D-1(c) behaviour change, and the point of this run is to see it.
    expect(formCountWhileHeld).toBe(0);
  });
});
