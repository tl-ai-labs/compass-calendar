# Discovery — 20260824-214500-feature-extend-weekbody-multiday-drag

**Mode:** refresh · **Decision:** `cached` · **Generated:** 2026-08-24

## Refresh decision

`discovery-refresh.mjs` returned **`cached`**: git HEAD is unchanged from the living
baseline (`4189de1389d8a4644ae20d9c5a907f1d161b5496`, built 2026-08-20T04:32:08Z),
0 commits behind, no stack-manifest mtime changed, policy unchanged. The baseline is
4 days old but materially current, so no full Tier 1 re-scan was performed and
`.sdlc/baseline/current.json` was left untouched. `baseline.json` for this run is a
copy of the living baseline plus run-scoped additions.

Branch note: this run is on `CMP-101/opus-plus-sonnet`, cut from `main` at `4189de13`.
`git rev-list --count main..HEAD` = **0** and `git diff main...HEAD -- packages/` is
**empty** — the tree is byte-identical to main. The living baseline recorded
`branch: main` at the same SHA, which is why the cache hit is legitimate rather than
coincidental.

Working tree is dirty only in ways that do not touch product source: `.claude/settings.json`
modified, `.sdlc/` and `.hook-logs/` untracked.

## 1. Week view component tree

**The prior discovery was correct: there is no `WeekBody`.** The string `WeekBody`
does not appear in any `.ts`, `.tsx`, or `.json` file under source — every hit is
inside `.sdlc/` run artifacts. It is a name invented by earlier discovery passes.

The prior claim that "the week body is `views/Week/components/Grid/Grid.tsx`" is
**correct but incomplete** — `Grid.tsx` is a *composer*, not the body itself. It holds
no grid markup. It wires two render-prop containers around a shared presentational grid:

```
views/Week/WeekView.tsx
  └─ views/Week/components/Grid/Grid.tsx        ← composer (data + tinting, no markup)
       └─ AllDayRow            (render prop → onAllDayMouseDown, allDayEventsLayer)
            └─ MainGrid        (render prop → onTimedMouseDown, timedEventsLayer)
                 └─ EventGrid  (shared; actually renders both regions)
```

### (a) Timed grid body
- Week container: `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.tsx`
- Shared presentational: `packages/web/src/grid/components/TimedGrid.tsx`
- Event layer: `packages/web/src/views/Week/components/Grid/MainGrid/MainGridEvents.tsx`

### (b) All-day row
- Week container: `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`
- Shared presentational: `packages/web/src/grid/components/AllDayGridRow.tsx`
- Event layer: `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`

### (c) Day columns
**There is no per-day column component.** Both regions render columns as CSS grid
tracks from a `visibleDates: GridVisibleDate[]` prop:

- `TimedGrid.tsx` — `grid-cols-[repeat(var(--calendar-column-count),…)]`, `--calendar-column-count: visibleDates.length`
- `AllDayGridRow.tsx` — same pattern

Day identity is therefore **not** recoverable from the DOM tree; it is computed from
pointer x by `packages/web/src/grid/hooks/useGridCoordinates.ts`, wrapped for Week by
`packages/web/src/views/Week/hooks/grid/useDateCalcs.ts`. Crucially, `getDateByXY(x, y)`
already resolves an arbitrary x to the correct day — **the geometry layer is not
single-day-bound.** Both regions attach a *single* `onMouseDown` covering the whole
column area, so a cross-column gesture is already receiving the right events.

## 2. Drag-to-select / draft-creation machinery

Two separate hooks, both under the shared `packages/web/src/grid/hooks/` (not under
`views/Week/`), both consumed by Week *and* Day:

### Timed — `packages/web/src/grid/hooks/useTimedDraftCreation.ts`
Real drag lifecycle: window-level `mousemove`/`mouseup`/`blur`, a
`TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` dead zone, cancel-on-unmount, live preview
written to the draft store every move.

**It is explicitly single-day-bound at lines 104-117:**

```ts
const isSameDayDrag = pointerDate.isSame(start, "day");
const isUpwardDrag = isSameDayDrag && pointerDate.isBefore(start);

let resolvedStartDate = start;
let resolvedEndDate = defaultEndDate;

if (isUpwardDrag) {
  resolvedStartDate = pointerDate;
  resolvedEndDate = start;
} else if (isSameDayDrag) {
  resolvedEndDate = pointerDate.isBefore(minimumEndDate) ? minimumEndDate : pointerDate;
}
```

Both branches are gated on `isSameDayDrag`. When the pointer is in a different day
column, **neither** fires and the resolved range falls back to
`start … start + DRAFT_DURATION_MIN`. Cross-day movement is silently discarded.
This single predicate is the primary constraint the feature must lift.

Week wiring: `views/Week/hooks/grid/useTimedGridDraftCreation.ts` →
`MainGrid.tsx:49` → `onTimedMouseDown`.

### All-day — `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
**Click-only — no drag at all.** No `mousemove`/`mouseup` listeners are registered.
On mousedown it resolves the start date then hardcodes a one-day span (lines 48-51):

```ts
const startDate = getStartDate(event.clientX, event.clientY);
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

### State owner
`packages/web/src/events/stores/draft.store.ts` — `draftActions.startGridDraft({activity, draft})`,
`setGridDraft`, `discard`; activities include `"creating"` (drag in flight) and
`"gridClick"` (committed / form open). The store draft *is* the preview; both views
render straight from it.

### Already-built asset: multi-day rendering exists
The **render half of this feature is already implemented**. A timed draft whose range
crosses midnight is automatically promoted into the all-day row as a spanning bar:

- `common/utils/event/event-nudge.util.ts` → `isTimedEventMultiDay`, `shouldRenderTimedInAllDayRow`, `timedMultiDayToAllDayDates`
- `grid/layout/all-day-draft.position.ts` → `draftToAllDayRowGridEvent`, `positionAllDayDraftEvent`
- `isTimedMultiDayDisplay` flag on `GridEvent` (`common/types/web.event.types.ts:73`)

`Grid.tsx` already pipes the live draft through `positionAllDayDraftEvent` for column
tinting. So emitting a cross-day range from the gesture should light up existing
rendering with little new layout code.

### Blast radius
`useTimedDraftCreation` is shared with the Day view
(`views/Day/components/Calendar/useDayTimedDraftCreation.ts`). Day has one column, so
any widening must be a no-op there. Note also
`grid/interaction/commit/cross-row.commit.ts` documents a deliberate design stance that
a multi-day span *collapses* when converting all-day → timed — worth reconciling with
the new feature's semantics rather than contradicting silently.

## 3. Prior attempts — branch is clean

**Verified clean.** `git rev-list --count main..HEAD` = 0; `git diff main...HEAD -- packages/`
produces no output. None of the three prior attempts left code here.

The week view does **not** have multi-day drag. Current single-day behavior:

- **Timed grid:** mousedown opens a 30-minute (`DRAFT_DURATION_MIN`) draft. Dragging
  vertically *within the same day column* resizes it, floored at one `GRID_TIME_STEP`
  (15 min). Dragging upward past the origin inverts start/end. Dragging into another
  day column is ignored — the draft stays a 30-minute block on the origin day. Mouseup
  commits with `activity: "gridClick"`.
- **All-day row:** mousedown immediately creates a fixed exactly-one-day all-day draft
  on the clicked column and opens the form. No drag. A second mousedown while drafting
  discards the draft.

Prior run directories remain under `.sdlc/runs/` (four of them, 2026-08-19/20) but carry
no applied source changes.

## 4. Test command and baseline

**Proposed: `bun test:web`** — from `AGENTS.md` "Validation defaults" (Web: `bun test:web`)
and `package.json#scripts.test:web`. AGENTS.md explicitly warns against defaulting to the
full `bun test`. The intent touches `packages/web` only.

Both baselines were **executed, not assumed**, at HEAD `4189de13`:

| Scope | Command | Result |
|---|---|---|
| Full web | `bun test:web` | **2298 pass / 0 fail**, 302 files, 79.8s |
| Week + grid | `bun packages/scripts/src/testing/test-parallel.ts web -- packages/web/src/views/Week packages/web/src/grid` | **388 pass / 0 fail**, 54 files, 9.9s |

Green baseline, no pre-existing failures to disambiguate against.

**Gotcha for downstream phases:** bare `bun test <path>` from the repo root **fails**
(107 fail / 27 errors, `PORT is required when API_BASEURL is not configured`) because
`packages/web/bunfig.toml`'s preload (`src/__tests__/web.preload.ts`) is not applied
outside the package directory. Always route through `bun test:web` or the
`test-parallel.ts web --` runner with repo-root-relative paths. React `act(...)` warnings
are emitted on the green run and are pre-existing noise.

**Coverage gap:** there is **no** `useTimedDraftCreation.test.*`. The hook holding the
single-day clamp — the exact code this feature must change — has no unit test.
`useAllDayDraftCreation.test.tsx` does exist. Phase 7 should require new tests here.

## Coexistence risks (carried from cached baseline)

- Cursor **and** Codex format-on-edit hooks are active (`.cursor/hooks.json`,
  `.codex/hooks.json`); Biome may reformat plugin output out-of-band.
- `.gitignore` does **not** cover `.sdlc/` — run artifacts are visible to `git add -A`.
- `.gitignore` has a repo-wide `*.mjs` rule — any `.mjs` emitted into source is silently untracked.
- Cursor rules at `.cursor/rules/` include `web-styles.mdc` and `web-testing.mdc`, which
  encode conventions codegen must match.
- No repo-local `routing-policy.yaml`; no `.mcp.json` on disk.

## Proposed off-limits

Unchanged from the living baseline: `.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`,
`.agents/**`, `AGENTS.md`, `.mcp.json`, `compass.yaml`, `*.env*`, `node_modules/**`,
`build/**`, `buildcache/**`, `packages/*/build/**`, `bun.lock`, `patches/**`,
`playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`.
