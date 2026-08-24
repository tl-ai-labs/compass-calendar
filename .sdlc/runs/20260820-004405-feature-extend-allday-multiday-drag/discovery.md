# Discovery — run 20260819-233904-feature-extend-weekbody-multiday-drag

**Mode:** refresh → decision **`cached`**.
**Reason (from `discovery-refresh.mjs`):** git HEAD unchanged and no stack manifest mtime changed since baseline.

Using the cached baseline from **2026-08-20T04:32:08Z** (~2h old at scan time 2026-08-20T06:40:24Z), **0 commits behind** — `git_head_baseline` and `git_head_current` are both `4189de1389d8a4644ae20d9c5a907f1d161b5496`. No stack manifests changed, no new AI-config files, `.sdlc/policy.yaml` unchanged. Per spec, `baseline/current.json` was copied **verbatim** to `runs/<run-id>/baseline.json` (sha1 `c701f87d…` on both) and no re-scan of read groups 1–9 was performed. `.sdlc/baseline/*` was **not** modified.

## Branch-label drift (read before Gate 0)

The cached baseline records `git.branch: "main"` from the first-time scan. The current checkout is **`CMP-101/flash-agsdk-only`** at the **identical SHA `4189de1`**, so the working tree is byte-identical and the baseline stays valid — but any rollback anchor or branch-naming decision downstream must use the **live** branch `CMP-101/flash-agsdk-only`, not the `main` recorded in `baseline.json`. `discovery-refresh.mjs` compares HEAD SHA and manifest mtimes only; it does not detect branch renames at an equal SHA.

## Live git state (re-verified, not re-scanned)

- HEAD: `4189de1389d8a4644ae20d9c5a907f1d161b5496`
- Branch: `CMP-101/flash-agsdk-only`
- Tracked-file modifications: **none** (clean)
- Untracked: `.hook-logs/`, `.sdlc/`
- `gitignore_covers_sdlc`: **false** (unchanged from baseline)

## Prior-run absence confirmed

A prior run implemented this same feature on branch `CMP-101/opus-flash-v37`. That work is **not present** here. Greps for `multiDayDraft`, `useAllDayDraftDrag`, `allDayDraftCreationDrag`, "multi-day drag", "spanning draft" across `packages/web/src` and `docs` return zero hits. This is a deliberate clean re-run; treat the feature as unimplemented.

## Coexistence risks (carried from cached baseline, verbatim)

- Cursor rules at `.cursor/rules/` (4 `.mdc` files incl. `web-styles.mdc` and `web-testing.mdc`) — untouched by default, but they encode the conventions codegen must match.
- Cursor AND Codex format-on-edit hooks are active (`.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). AGENTS.md states formatting is handled by these repo-local hooks after agent edits. Files this plugin writes may be reformatted out-of-band by Biome.
- `.gitignore` does NOT cover `.sdlc/` — run artifacts are visible to `git add -A`. Gate 0 should offer to add `.gitignore` to this run's allowlist so the entry can be added. Note `.hook-logs/` is likewise untracked.
- `.gitignore` contains a repo-wide `*.mjs` rule — any `.mjs` the plugin emits into user source would be silently untracked.
- `.mcp.json` is gitignored and absent locally; no competing MCP servers registered.
- No repo-local `routing-policy.yaml` — shipped policy applies.

## Regulated-repo signals

One signal: `SECURITY.md` (kind `security-policy`). `regulated_repo_warning_required: false` — a standard OSS security policy, not a compliance-obligation marker. No HIPAA/PCI/SOC2/GDPR paths, no security/compliance CODEOWNERS entries.

## Intent scoping hints — Week-view multi-day drag-to-select

Scoping support only; **nothing was implemented and no source file was modified**. All paths relative to repo root.

### The gap

`useAllDayDraftCreation.ts` is **click-only**: on mousedown it reads one date via `getStartDate(clientX, clientY)` and hardcodes `endDate = dayjs(startDate).add(1, "day")`, then immediately opens the draft. There is no mousemove/mouseup gesture, no move threshold, no preview. By contrast `useTimedDraftCreation.ts` implements the full gesture (window-level `mousemove`/`mouseup`/`blur` listeners, `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` gate, live store-backed preview via `draftActions.startGridDraft`/`setGridDraft`, cancel-on-blur cleanup) — but its `resolveDraftForPointer` deliberately ignores cross-day movement (`isSameDayDrag` guard). `useTimedDraftCreation` is the structural template to mirror for the all-day row.

Also note: there is **no component named `WeekBody`**. The week-view body is composed by `Grid.tsx` as `AllDayRow` > `MainGrid` > `EventGrid`. The multi-day/all-day surface is the `AllDayRow` subtree.

### Primary targets (most likely to change)

- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — the click-only all-day draft creator; the core hook to extend into a drag gesture.
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — existing unit tests for that hook.
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — wires `useAllDayDraftCreation` to the row, supplies `getAllDayDraftStartDate` and `openAllDayDraft`; the mousedown handler entry point.
- `packages/web/src/grid/components/AllDayGridRow.tsx` — renders the all-day columns and attaches `onMouseDown`; owns `ID_ALLDAY_COLUMNS` and the column DOM geometry a drag must hit-test against.
- `packages/web/src/grid/components/AllDayGridRow.test.tsx` — tests for that row component.

### Reference implementation to mirror

- `packages/web/src/grid/hooks/useTimedDraftCreation.ts` — the working drag-create gesture (threshold, preview, commit, cancel); the pattern to follow.
- `packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts` — Week-view binding of the timed drag-create hook.
- `packages/web/src/interaction/interaction.pointer.ts` — `isEligibleInteractionPointerDown`, `hasExceededInteractionMoveThreshold`.
- `packages/web/src/interaction/interaction.constants.ts` — move thresholds; may need an all-day analogue of `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`.

### Date/geometry resolution

- `packages/web/src/views/Week/hooks/grid/useDateCalcs.ts` — `getDateByXY` / `getDateStrByXY`; converts pointer coords to a day, needed each mousemove to resolve the dragged end day.
- `packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts` — day-column layout cache stamping `{index,left,width,date}` per column.
- `packages/web/src/grid/interaction/math/drag-column.ts` — column-index drag math.
- `packages/web/src/grid/interaction/math/all-day.drag.ts` — existing all-day drag math (for moving saved all-day events).
- `packages/web/src/grid/interaction/math/all-day.resize.ts` — all-day resize math; closest existing analogue to "extend a span across days".
- `packages/web/src/grid/interaction/types/all-day-drag.types.ts`, `.../all-day-resize.types.ts` — the type shapes for those interactions.

### Draft model, schedule, and rendering

- `packages/web/src/events/grid-event-draft.adapter.ts` — `allDayGridSchedule(start,end)` (line ~202), `createGridEventDraft`, `replaceGridDraftSchedule`, `gridEventDraftToSchemaEvent`; where a multi-day span is expressed.
- `packages/web/src/events/event-draft.types.ts` — `GridEventDraft` type.
- `packages/web/src/events/stores/draft.store.ts` — `draftActions.startGridDraft` / `setGridDraft` / `discard`; the live preview channel during a drag.
- `packages/web/src/grid/layout/all-day-draft.position.ts` — `isDraftRenderedInAllDayRow`, `draftToAllDayRowGridEvent`, `positionAllDayDraftEvent`; how an all-day draft is positioned/spanned on screen.
- `packages/web/src/grid/layout/all-day-draft.position.test.ts` — tests for that positioning.
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`, `AllDayEvent.tsx` — all-day event layer rendering.
- `packages/web/src/grid/components/AllDayEventCard.tsx` — the card visual for an all-day/spanning event.
- `packages/web/src/grid/utils/allDayEventOnDay.util.ts` — per-day membership test for a spanning event.

### Commit path

- `packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts` — commits an all-day interaction result.
- `packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` — orchestrates week interactions; may need to know about a new gesture.
- `packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts`, `all-day.resize.ts`, `all-day.visible-range.ts` — week adapter's all-day interaction bindings.

### Tests likely to need updating or extending

- `packages/web/src/views/Week/interaction/adapter/week-interaction.all-day-drag.test.ts`
- `packages/web/src/views/Week/interaction/adapter/week-interaction.all-day-resize.test.ts`
- `packages/web/src/grid/interaction/math/all-day.interaction.test.ts`
- `e2e/allday/event-smoke.spec.ts` — the Playwright all-day creation smoke test; uses `openAllDayEventFormWithMouse` from `e2e/utils/event-test-utils`.

### Related context (read-only, likely no change)

- `docs/frontend/week-drag-interaction.md` — authoritative doc on how drag resolves the landing day; explains the layout-cache/column-date model. Should probably be updated if the gesture set grows.
- `packages/web/src/views/Week/components/Grid/Grid.tsx` — composes AllDayRow + MainGrid; the "week body".
- `packages/web/src/views/Day/components/Calendar/dayAllDayRows.util.ts` and `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts` — Day-view counterparts; touching shared `@web/grid/**` hooks affects Day view too.

### Scope caution

`packages/web/src/grid/**` is **shared between Week and Day views**. `useAllDayDraftCreation` is consumed by both surfaces, so a change there has Day-view blast radius. Gate 0 should decide whether the allowlist covers Day view or whether the change is confined behind a Week-only option.

## Validation

Per the cached baseline and `AGENTS.md#Validation-defaults`, the proposed test command is **`bun test:web`** (the intent touches `packages/web` only; AGENTS.md explicitly says "Avoid defaulting to `bun test`; use the focused package test first"). Alternatives: `bun type-check`, `bun lint`, `bun run verify` (diff-aware), `bun test:e2e` for the Playwright all-day spec. Gate 0 must confirm.
