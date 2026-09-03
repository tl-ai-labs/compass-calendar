# Discovery — 20260903-070719-feature-extend-weekbody-multiday-drag

- **Mode:** refresh → helper decision `incremental`
- **Baseline:** `.sdlc/baseline/current.json`, built 2026-08-20T04:32:08Z at `4189de1`
- **Current HEAD:** `2d81253a` on branch `CMP-101/opus-plus-flash-v37-sdk`
- **Delta since baseline:** 2 commits / 9 files — **all 9 under `.sdlc/`**. No stack manifest changed, no new AI-config path appeared.
- **Intent:** `feature-extend` — *add multi-day drag-to-select on the week view body that creates a spanning event across the dragged day range*

Groups 3, 4 and 6 were re-verified despite the delta being `.sdlc`-only and came back unchanged. The git block and the intent-scoped source survey were re-done from scratch.

> Timebox note: Tier-1 groups finished well inside budget. The task-specific source survey below is deliberately deeper than Tier 1 and accounts for most of the elapsed time.

---

## Git state

Clean apart from `.sdlc/`: `.sdlc/pre-check-status.json` and `.sdlc/project.json` are modified, `.sdlc/local/` is untracked. **No user source file is dirty.**

`.gitignore` does **not** cover `.sdlc/` — it only ignores `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. `git check-ignore` confirms `.sdlc/runs/**` is **not** ignored on this branch.

**HEAD sits on `CMP-101/opus-plus-flash-v37-sdk`, a pre-existing arm branch — not a branch cut for this run.** Gate 0 should confirm or cut a fresh one.

## Directory topology

Bun + Lerna monorepo. Top level: `.agents`, `.claude`, `.codex`, `.cursor`, `.github`, `docs`, `e2e`, `packages`, `patches`, `self-host`. Workspaces are `packages/*`: `web`, `backend`, `core`, `sync`, `scripts`.

## Detected stacks

TypeScript everywhere, Bun `1.3.14` runtime, pinned `typescript@7.0.2`, Biome for lint/format, `bun:test` + Testing Library for unit tests, Playwright for e2e. `packages/web` is React + Zustand + TanStack Query/Router + Tailwind 4.

No pre-authored adapter matches. The learned profile at `.sdlc/baseline/stack-profile.md` (built 2026-08-22) is **reused, not rebuilt** — no manifest changed and only 2 ledger runs have elapsed against a bound of 10.

## Test command

Proposed: **`bun run test:web`** (source: `package.json#scripts.test:web` + `AGENTS.md`, which explicitly says to avoid defaulting to `bun test` and use the focused package test). The whole intent lives in `packages/web`. `bun test` additionally needs a Mongo env for backend/sync/scripts.

Supporting gates: `bun run type-check`, `bun run lint`.

## Detected AI/agent setup

`.claude/`, `.cursor/rules/` (4 `.mdc` files), `.cursor/hooks/format-after-edit.ts`, `.codex/`, `.agents/skills/`, `AGENTS.md`. Absent: `CLAUDE.md`, `.cursorrules`, `.mcp.json` (gitignored), `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml`.

## Env keys

No `.env*` file exists on disk (repo-wide `*.env*` ignore). Runtime config is `compass.yaml` (gitignored) with `compass.example.yaml` as the tracked template. Names referenced in code (**names only, no values read**): `API_BASEURL`, `COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Monorepo / submodules / LFS

Lerna + Bun workspaces, 5 packages, aliases `@web/* -> packages/web/src/*` and `@core/* -> packages/core/src/*`. No submodules. No Git-LFS.

## Regulated-repo signals

One low-signal hit: `SECURITY.md` at repo root. No HIPAA/PCI/SOC2/GDPR docs, no compliance CODEOWNERS. **No regulated-repo warning required.**

---

## Task-specific survey

### 1. Who owns the week-body grid and the day-column layout

`WeekBody` does not exist — **zero** matches for the identifier across every `.ts`/`.tsx` file in `packages/`. The week body is a composition:

| Concern | File | Lines |
|---|---|---|
| Week body composition (all-day + timed + overlays) | `packages/web/src/views/Week/components/Grid/Grid.tsx` | 105-155 |
| All-day row container / behaviour | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | 35-86 |
| Timed body container / behaviour | `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.tsx` | 37-79 |
| Presentational grid shell (both rows) | `packages/web/src/grid/components/EventGrid.tsx` | 39-129 |
| **All-day day columns (actual DOM)** | `packages/web/src/grid/components/AllDayGridRow.tsx` | 55-125 |
| Timed day columns (actual DOM) | `packages/web/src/grid/components/TimedGrid.tsx` | — |
| x→day-index geometry | `packages/web/src/grid/hooks/useGridCoordinates.ts` | 15-34 |
| Week-side date calcs wrapper | `packages/web/src/views/Week/hooks/grid/useDateCalcs.ts` | 21-32 |

Note the layering: `views/Week/**` are behaviour containers; the pixels live in the shared `packages/web/src/grid/**` module, which the Day view also consumes.

### 2. Where pointer/drag interaction is handled

`useGridEventDraftHandlers.ts` is a **red herring for this job**. It is 53 lines and has no pointer logic at all — it only maps an existing card back to a `GridEventDraft` for keyboard-edit and read-only-open (`useGridEventDraftHandlers.ts:28-50`). It calls `editGridEventDraft` and `draftActions.startGridDraft`, nothing else.

The real pointer surfaces:

- **Draft creation on empty space (timed):** `packages/web/src/grid/hooks/useTimedDraftCreation.ts:34-227` — real gesture: `window` `mousemove`/`mouseup`/`blur` capture listeners (218-220), 4 px threshold, live store preview on every move, cancel-on-blur, unmount cleanup (43-47).
- **Draft creation on empty space (all-day):** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:32-65` — **no gesture at all**, mousedown-only.
- **Dragging/resizing an existing draft:** `views/Week/components/Draft/grid/hooks/useGridMouseMove.ts` and `useGridMouseUp.ts`, mounted by `Draft.tsx:23-24`.
- **Dragging/resizing a saved event:** the interaction engine under `packages/web/src/grid/interaction/**` and `views/Week/interaction/**` (`math/all-day.drag.ts`, `math/cross-row.drag.ts`, `math/drag-column.ts`).
- **Gesture eligibility helpers:** `packages/web/src/interaction/interaction.pointer.ts` (`isEligibleInteractionPointerDown`, `hasExceededInteractionMoveThreshold`) and thresholds in `packages/web/src/interaction/interaction.constants.ts`.

### 3. Does single-day drag-to-create already exist? — **the key finding**

**Yes, for timed events; no, for all-day.**

`packages/web/src/grid/hooks/useTimedDraftCreation.ts` is a complete single-day drag-to-create, and it is single-day *by explicit clamp*:

```ts
// useTimedDraftCreation.ts:104-117
const isSameDayDrag = pointerDate.isSame(start, "day");
const isUpwardDrag = isSameDayDrag && pointerDate.isBefore(start);
...
if (isUpwardDrag) { resolvedStartDate = pointerDate; resolvedEndDate = start; }
else if (isSameDayDrag) { resolvedEndDate = pointerDate.isBefore(minimumEndDate) ? minimumEndDate : pointerDate; }
```

Drag the pointer off the origin day and **neither** branch fires — start and end stay at the 30-minute default. Cross-day is deliberately swallowed.

The all-day row, which is where a "spanning event across the dragged day range" belongs, has **no drag path whatsoever**:

```ts
// useAllDayDraftCreation.ts:48-51
const startDate = getStartDate(event.clientX, event.clientY);
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

One mousedown, a hardcoded +1 day, immediate `onCreateGridDraft`. The existing test file even names it: *"creates a one-day all-day draft and stops the opening press"* (`useAllDayDraftCreation.test.tsx:60`).

**So: the single-day path to extend is `useTimedDraftCreation.ts` as the gesture *template*, and `useAllDayDraftCreation.ts` as the code that actually changes.**

### 4. How a multi-day spanning event is represented and rendered

Representation is `GridScheduleDraft` with `kind: "allDay"` and an **exclusive** end, built by `allDayGridSchedule(start, end)` at `events/grid-event-draft.adapter.ts:202-211` (local-midnight `Date`s, with an in-file comment explaining why `new Date("YYYY-MM-DD")` is wrong here). Schedule swaps go through `replaceGridDraftSchedule` (`:160-169`).

Rendering already handles spans:

- `grid/layout/event.position.ts:101-140` `getAllDayEventPosition` — `left` from `startIndex`, `width` summed across `startIndex..endIndex`.
- `:146-171` `getVisibleAllDaySpan` — converts the exclusive end to an inclusive last day and clamps to the visible window.
- `grid/layout/all-day-draft.position.ts:45-86` `positionAllDayDraftEvent` — injects the live draft into the row-packing pass so it gets a row.
- Live draft chip: `views/Week/components/Draft/Draft.tsx:76-85` → `grid/GridDraft.tsx:143-163` renders `AllDayEventMemo` when `isDraftRenderedInAllDayRow(draft)`.
- Saved chips: `views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` → `AllDayEvent.tsx:48-52`.
- Range helpers: `views/Week/util/week-window.util.ts` (`isAllDayEventInVisibleDays`, same exclusive→inclusive conversion), `grid/utils/allDayEventOnDay.util.ts`, `common/utils/event/event-nudge.util.ts` (`timedMultiDayToAllDayDates`).

**Consequence for the plan: no rendering work is required.** Feed a >1-day `allDay` schedule into the store and a spanning bar draws itself. The job is the gesture plus the day-range math.

### 5. State management for creating a draft

Zustand store `packages/web/src/events/stores/draft.store.ts`.

- `draftActions.startGridDraft({activity, draft})` — `:66-97`. Sets `isDrafting`, derives `eventType` from `schedule.kind`, forces `isFormOpen: false`.
- `draftActions.setGridDraft(draft)` — `:104-127`. The per-mousemove preview write; reuses the `status` object when unchanged specifically because drag-creation calls it on every move.
- `draftActions.discard()` — `:63-64`.
- `draftActions.setFormOpen(bool)` — `:132-145`.
- Activity `"creating"` (`:9-10`) is the documented state for a live drag-create; `GridDraft.tsx:59` reads it to pick `motionMode`.

`useTimedDraftCreation.ts:143-156` is the exact pattern to copy: first move → `startGridDraft({activity:"creating"})`, subsequent moves → `setGridDraft`, mouseup → the caller's `onFinish` (which for Week is `startGridDraft({activity:"gridClick"})`, opening the form).

Week-local draft plumbing: `views/Week/components/Draft/context/DraftProvider.tsx`, `hooks/state/useDraftState.ts`, `hooks/actions/useDraftActions.ts`.

### 6. Test command and nearby tests

`bun run test:web`. Existing tests in the blast radius:

`grid/hooks/useAllDayDraftCreation.test.tsx`, `grid/components/AllDayGridRow.test.tsx`, `grid/components/EventGrid.test.tsx`, `grid/hooks/useGridCoordinates.test.tsx`, `grid/layout/all-day-draft.position.test.ts`, `grid/layout/event.position.test.ts`, `grid/interaction/math/all-day.interaction.test.ts`, `views/Week/components/Grid/MainGrid/MainGrid.test.tsx`, `views/Week/components/Draft/grid/GridDraft.test.tsx`, `views/Week/WeekView.render.test.tsx`, `events/stores/draft.store.test.ts`. Playwright specs in `e2e/allday/` are **not** covered by `bun run test:web`.

---

## Prior art — this intent has been run before

Four prior ledger runs carry this intent, all `accepted`, one per policy. Two produced commits that still exist on sibling branches:

| SHA | Date | Branch | Subject | Files |
|---|---|---|---|---|
| `7ff1dfb4` | 2026-08-20 | `CMP-101/opus-only` | feat(web): multi-day drag-to-select on WeekBody all-day row | 11 |
| `4e0c12b9` | 2026-08-25 | `CMP-101/opus-plus-sonnet` | feat(web): multi-day drag-to-create in the Week all-day row | 8 |

**Neither is an ancestor of `2d81253a`**, so the feature really is absent from this tree. Their diffstats converge on nearly the same file set, which is strong evidence for the allowlist below. Note `7ff1dfb4`'s title says "WeekBody" even though no such component exists — the name is aspirational, not a real path.

## Coexistence risks

- **Cursor rules detected.** `.cursor/rules/` holds 4 `.mdc` files including `web-styles` and `web-testing`. The plugin will never touch them, but they encode the conventions codegen must match.
- **Cursor *and* Codex format-after-edit hooks are active.** `.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`. Files this plugin writes may be reformatted by Biome out of band, which can make byte-identity checks fail.
- **`.sdlc/` not gitignored.** Run artifacts under `.sdlc/` (packets, backups, telemetry) are untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist.
- **Repo-wide `*.mjs` ignore.** Any `.mjs` emitted into user source would be silently untracked.
- **No custom `.mcp.json`** (gitignored and absent) and **no repo-local `routing-policy.yaml`** — the shipped policy applies.
- **Branch hygiene.** HEAD is on an existing arm branch, not a branch cut for this run.

## Proposed off-limits

`.git/**`, `.sdlc/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`, `compass.yaml`, `compass.example.yaml`, `self-host/**`, `.playwright-compass.yaml`, `*.env*`, `node_modules/**`, `build/**`, `buildcache/**`, `packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`, `package.json`, `packages/*/package.json`, `patches/**`, `biome.json`, `.github/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`.

Intent-scoped additions (nothing outside `packages/web` should move for this job): `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`, `packages/core/**`, `e2e/**`.

## Proposed edit allowlist

Core:

1. `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — turn the mousedown handler into a gesture
2. `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
3. `packages/web/src/grid/interaction/math/all-day.create.ts` *(new)* — pure day-range resolution
4. `packages/web/src/grid/interaction/math/all-day.create.test.ts` *(new)*
5. `packages/web/src/interaction/interaction.constants.ts` — add the all-day move threshold
6. `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — pass the day-at-point resolver
7. `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` *(new)*
8. `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new, optional)* — Week-side wrapper mirroring `useTimedGridDraftCreation.ts`
9. `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` *(new, optional)*
10. `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx` — harness touch-up (both prior arms needed this)
11. `docs/frontend/week-drag-interaction.md` — doc the interaction

Stretch, only with explicit Gate 0 approval:

- `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx` — only if the shared hook's signature changes non-optionally
- `packages/web/src/grid/layout/event.position.ts` — only if a span edge case surfaces
- `packages/web/src/events/grid-event-draft.adapter.ts` — only if `allDayGridSchedule` needs an ordering guard
- `.gitignore` — to add `.sdlc/`

## Blast radius warning

`useAllDayDraftCreation` is shared by **both** views:

- Week: `views/Week/components/Grid/AllDayRow/AllDayRow.tsx:58-61`
- Day: `views/Day/components/Calendar/DayCalendarGrid.tsx:331-334`

In the Day view the columns are **calendars on one date**, not days — a horizontal multi-day drag is meaningless and would create garbage schedules. Any change must be opt-in (an extra option, or a day-at-point resolver the Day view does not supply) so the Day view keeps the click-only behaviour. This is the single highest-risk decision in the job and should be settled at Gate 2, not left to codegen.
