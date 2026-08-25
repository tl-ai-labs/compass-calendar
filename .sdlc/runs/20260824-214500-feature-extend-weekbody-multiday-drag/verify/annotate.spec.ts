import { test } from "@playwright/test";
import { prepareCalendarPage } from "../../../../e2e/utils/event-test-utils";

test("annotate the two drag surfaces", async ({ page }) => {
  await prepareCalendarPage(page);

  await page.evaluate(() => {
    const mark = (
      sel: string,
      colour: string,
      label: string,
      labelTop: boolean,
    ) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "fixed",
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        border: `3px solid ${colour}`,
        background: `${colour}22`,
        zIndex: "99999",
        pointerEvents: "none",
      });
      const tag = document.createElement("div");
      tag.textContent = label;
      Object.assign(tag.style, {
        position: "fixed",
        left: `${r.x + 8}px`,
        top: labelTop ? `${r.y - 26}px` : `${r.y + 8}px`,
        font: "bold 15px system-ui, sans-serif",
        color: "#fff",
        background: colour,
        padding: "2px 8px",
        borderRadius: "4px",
        zIndex: "100000",
        pointerEvents: "none",
      });
      document.body.append(box, tag);
    };

    mark(
      "#allDayRow",
      "#22c55e",
      "ALL-DAY ROW - drag HERE (multi-day works)",
      true,
    );
    mark(
      "#mainGrid",
      "#ef4444",
      "TIMED GRID - same-day only, no Escape (unchanged)",
      false,
    );
  });

  await page.screenshot({
    path: `${__dirname}/shots/WHERE-to-drag.png`,
  });
});
