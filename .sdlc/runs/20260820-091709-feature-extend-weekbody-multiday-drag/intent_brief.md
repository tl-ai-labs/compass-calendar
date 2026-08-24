# Intent Brief — feature-extend — Multi-day drag-to-create in the week all-day row

## Context

Compass's week view body is `views/Week/components/Grid/Grid.tsx`, which renders an
`AllDayRow` above a `MainGrid`. There is **no `WeekBody` component** — the user's original
wording ("drag-to-select on WeekBody") was re-anchored at interview time to the all-day row,
which is where a spanning multi-day event belongs.

Discovery (`discovery.md`, this run) found the two creation gestures live in the *shared*
grid layer, not under `views/Week`:

- `packages/web/src/grid/hooks/useTimedDraftCreation.ts` — the only real drag gesture today
  (window `mousemove`/`mouseup`/`blur`, 4px threshold, store-backed live preview). It
  deliberately clamps to the origin day via `isSameDayDrag`; horizontal drag is a no-op by
  design.
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — **click-only**, with a hard-coded
  one-day span (`dayjs(startDate).add(1, "day")`). No move/up listeners at all.

So drag-to-create across days does not exist. However multi-day *rendering*, *resize across
days*, and *move across days* already work: `grid/interaction/math/all-day.resize.ts` already
maps pointer-x to day index to date range (`getNearestDayColumn`, `resizeFromStart`,
`resizeFromEnd`). **This feature is reuse of existing math, not invention.**

Blast radius to decide at Gate 0: `useAllDayDraftCreation` is consumed by both
`AllDayRow.tsx` (week) and Day view's `DayCalendarGrid.tsx`. Adding the gesture inside the
shared hook changes behaviour for Day view too; an opt-in option or a sibling hook keeps Day
view out of the write set.

## Goal

Dragging horizontally across day columns in the week view's all-day row creates a **single
spanning event draft** — start = first dragged day, end = last dragged day — which the user
then confirms through the existing draft flow. A drag that stays within one day, or a plain
click, keeps producing exactly what it produces today.

## Files in scope

Primary (expected to change):
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`

Likely:
- `packages/web/src/grid/components/AllDayGridRow.tsx` (+ its test)
- `packages/web/src/events/grid-event-draft.adapter.ts`
- `packages/web/src/grid/interaction/layout.cache.ts`
- `packages/web/src/interaction/interaction.constants.ts`

Possible:
- `packages/web/src/views/Week/components/Grid/Grid.tsx`
- `packages/web/src/views/Week/components/Draft/Draft.tsx`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`
- `packages/web/src/views/Week/WeekView.render.test.tsx`
- `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx`
  (only if the shared-hook option is taken)
- `.gitignore` (only to add a `.sdlc/` entry, if approved at Gate 0)

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default` (`.env*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`), plus every AI config discovery detected
(`.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`), plus
`packages/backend/**`, `packages/sync/**`, `packages/core/**`, `e2e/**`,
`.github/workflows/**`, `bun.lock`, `patches/**`,
`packages/web/src/views/Week/interaction/adapter/**` (existing-event surface, distinct from
creation).

## Acceptance criteria

1. Press-drag across N day columns in the week all-day row creates one draft event whose
   start is the first dragged day and end is the last dragged day (N days inclusive).
2. Dragging right-to-left produces the same normalized range as left-to-right.
3. A drag that begins and ends in the same day column, and a plain click, behave exactly as
   they do today (one-day draft) — no change in observable behaviour.
4. The created draft goes through the existing draft/confirm flow; it is not committed on
   pointer-up.
5. Keyboard-place drafts (Tab edge-focus cycling, escape-discards-unused) still work.
6. A drag that ends outside the row, or is interrupted by `blur`, cleans up its listeners and
   leaves no orphan draft.
7. `bun test:web` finishes with 0 failures, and the new behaviour ships with its own tests.
8. No changes under `packages/backend`, `packages/sync`, or the core event schema.

## Non-goals

- Cross-day drag in the timed `MainGrid` (`isSameDayDrag` clamp stays as-is).
- Touch/pointer-event support beyond whatever the existing mouse-based gestures cover.
- Changes to how multi-day events render, resize, or move — that already works.
- Any backend, sync, or API/schema change.
- E2E (Playwright) coverage.

---

## Gate 0 — approved 2026-08-20

Confirmed as proposed above, with these decisions:

- **Shared-hook option (a).** The multi-day gesture is added to
  `useAllDayDraftCreation` behind an **additive opt-in** — Week's `AllDayRow` turns it on,
  Day view's `DayCalendarGrid` does not. `packages/web/src/views/Day/**` is therefore
  **off-limits** for this run; Day view behaviour must not change.
- **`.gitignore`** is allowlisted solely to add a `.sdlc/` entry.
- **Auth mode: `estimated`.** `ANTHROPIC_API_KEY` is unset, so `preflight_dispatch` halts
  under `vendor` for this policy. Every phase runs in-session; reported cost is an estimate.
- **Policy: `opus-only-v5`** (project default). Hard cost cap $50.
- **Test command: `bun test:web`.** Baseline 2298 pass / 0 fail / 302 files.
- **AI configs stay off-limits.** `.cursor/rules/web-styles.mdc` and `web-testing.mdc` are
  fed to codegen as **read-only convention inputs**.
- The frozen contract is `.sdlc/local/write-contract.json` (`active: true`, `strict: true`).
