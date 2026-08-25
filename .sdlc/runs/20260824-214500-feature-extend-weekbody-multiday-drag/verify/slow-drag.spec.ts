/**
 * Human-paced reproduction attempt.
 *
 * The fast synthetic drag in multiday-drag.spec.ts passes. The user reports the
 * gesture does NOT span days with a real mouse. The main difference is timing:
 * a real drag takes hundreds of ms and emits many small moves, which gives the
 * store-backed preview time to re-render (and possibly open the editor) mid-drag.
 */
import { expect, type Page, test } from "@playwright/test";
import { prepareCalendarPage } from "../../../../e2e/utils/event-test-utils";

const SHOTS = `${__dirname}/shots`;

const dayColumnCentres = async (page: Page): Promise<number[]> => {
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll("#weekGridScroller [title]")]
      .filter((n): n is HTMLElement => n instanceof HTMLElement)
      .filter((n) => /^\d{8}$/.test(n.title))
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2 };
      })
      .sort((a, b) => a.x - b.x),
  );
  return boxes.map((b) => b.x);
};

const allDayRowY = async (page: Page) => {
  const box = await page.locator("#allDayRow").boundingBox();
  if (!box) throw new Error("#allDayRow not visible");
  return box.y + box.height / 2;
};

/** Read the live draft's schedule straight out of the store-rendered preview. */
const previewSpan = async (page: Page) => {
  return page.evaluate(() => {
    const row = document.querySelector("#allDayRow");
    if (!row) return null;
    const bars = [...row.querySelectorAll("[role='button']")].map((b) => {
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width) };
    });
    return bars;
  });
};

test("F: human-paced drag across 3 columns, with pauses", async ({ page }) => {
  await prepareCalendarPage(page);
  const centres = await dayColumnCentres(page);
  const y = await allDayRowY(page);

  await page.mouse.move(centres[1], y);
  await page.mouse.down();

  // Creep across the row the way a hand does: many small moves, with time
  // between them for React to re-render the preview.
  const startX = centres[1];
  const endX = centres[3];
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(25);
    if (i === Math.floor(steps / 2)) {
      console.log(
        "F: mid-drag preview bars =",
        JSON.stringify(await previewSpan(page)),
      );
      console.log(
        "F: forms open mid-drag =",
        await page.getByRole("form").count(),
      );
    }
  }

  console.log(
    "F: end-of-drag preview bars =",
    JSON.stringify(await previewSpan(page)),
  );
  console.log(
    "F: forms open at end of drag =",
    await page.getByRole("form").count(),
  );
  await page.screenshot({ path: `${SHOTS}/F1-slow-drag-before-release.png` });

  await page.mouse.up();
  await page.screenshot({ path: `${SHOTS}/F2-slow-drag-after-release.png` });

  const colWidth = centres[1] - centres[0];
  const bars = await previewSpan(page);
  const widest = bars?.length ? Math.max(...bars.map((b) => b.w)) : 0;
  console.log(
    `F: widest bar after release = ${widest}px = ${(widest / colWidth).toFixed(2)} columns (expect ~3)`,
  );
  expect(widest / colWidth).toBeGreaterThan(2.5);
});

test("G: Escape mid-drag, checked properly (waits before asserting)", async ({
  page,
}) => {
  await prepareCalendarPage(page);
  const centres = await dayColumnCentres(page);
  const y = await allDayRowY(page);

  await page.mouse.move(centres[1], y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(centres[1] + ((centres[3] - centres[1]) * i) / 12, y);
    await page.waitForTimeout(25);
  }

  console.log(
    "G: preview before Escape =",
    JSON.stringify(await previewSpan(page)),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  console.log(
    "G: preview after Escape =",
    JSON.stringify(await previewSpan(page)),
  );

  await page.mouse.up();
  // Give the form a real chance to appear before claiming it did not.
  await page.waitForTimeout(1000);
  const forms = await page.getByRole("form").count();
  console.log(`G: forms open 1s after release (want 0) = ${forms}`);
  await page.screenshot({ path: `${SHOTS}/G1-escape-then-release.png` });
  expect(forms).toBe(0);
});
