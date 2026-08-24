# Discovery — run 20260820-091709-feature-extend-weekbody-multiday-drag

Mode: `refresh` → decision **`cached`**.

Using the cached baseline from `.sdlc/baseline/current.json`, built **2026-08-20T04:32:08Z**, **0 commits behind** (git HEAD `4189de1` at baseline time, `4189de1` now), no stack-manifest mtime changes, no `policy.yaml` change. No re-scan was performed; `baseline.json` for this run is a verbatim copy of the living baseline with run metadata, a branch-name correction, and a fresh `intent_scope` for this run's feature. The only material repo-state delta since the baseline is a second untracked directory, `.hook-logs/`.

## Branch note (important for this run)

The baseline was captured on `main`; the current branch is **`CMP-101/opus-only`**. Both point at the **same commit `4189de1389d8a4644ae20d9c5a907f1d161b5496`**, so the cached scan is valid. Two prior accepted runs implemented closely related work on `CMP-101/opus-flash-v37` and `CMP-101/flash-agsdk-only`; **none of that work is present on this branch**. Everything below describes the actual current-branch state.

## Summary carried from baseline

- **Stack** — Bun 1.3.14 / Node >=24 / TypeScript 7.0.2 monorepo (Lerna + Bun workspaces, `packages/*`). Frontend `@compass/web` is React 18 + Zustand + TanStack Router/Query + Tailwind 4, tested with Testing Library + MSW under `bun test`. Backend is Express + MongoDB + SuperTokens. Path aliases `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.
- **Proposed test command** — `bun test:web` (source: `AGENTS.md#Validation-defaults` + `package.json#scripts.test:web`). `AGENTS.md` explicitly says *"Avoid defaulting to `bun test`; use the focused package test first."* This intent is `packages/web`-only, so the scoped command is right. Companions: `bun type-check`, `bun lint`. **Gate 0 must confirm.**
- **Adapter** — no shipped adapter matches a React/Vite SPA on Bun; `generic.md` is the closest. Adaptive stack profile remains recommended.
- **Regulated signals** — only `SECURITY.md` (standard OSS policy file). No warning required.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| `.gitignore` does not cover `.sdlc/` | medium | Run artifacts (packets, backups, telemetry) are untracked but visible to `git add -A`. Gate 0 should offer to allowlist `.gitignore` so the plugin can add the entry. |
| `.gitignore` has repo-wide `*.mjs` and `*.env*` globs | medium | Any `.mjs` emitted into user source would be silently untracked. |
| Cursor + Codex format-on-edit hooks active | low | `.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`. Biome may reformat plugin output out-of-band. |
| `.hook-logs/` untracked (new since baseline) | low | Same `git add -A` exposure as `.sdlc/`. |
| Dirty tree | none | No tracked-file modifications. |
| Submodules / Git-LFS | none | Neither in use. |

## Detected AI/agent setup

`.claude/settings.json`, `.claude/launch.json`, `.cursor/rules/` (4 `.mdc` files: imports-and-packages, sync-package, **web-styles**, **web-testing**), `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`, `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/` (9 skills), `.agents/skills/chaos/agents/openai.yaml`, `AGENTS.md`.

Absent: `.mcp.json` (gitignored, not on disk), `CLAUDE.md`, `.cursorrules`, `.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/`. The plugin will never touch them, but `web-styles.mdc` and `web-testing.mdc` encode the conventions codegen must match — they should be fed to the packet planner as read-only context.
- **Cursor and Codex format-after-edit hooks are active.** `AGENTS.md` states formatting is handled by these repo-local hooks after agent edits, so files this plugin writes may be reformatted out-of-band by Biome. Do not treat post-write diffs as tampering.
- **No custom `.mcp.json`** — no competing MCP servers registered.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.
- **`.sdlc/` not gitignored.** Gate 0 should offer to add `.gitignore` (append) to this run's allowlist.

## Proposed off-limits

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`, `compass.yaml`, `.playwright-compass.yaml`, `*.env*`, `.env`, `.env.*`, `node_modules/**`, `build/**`, `buildcache/**`, `packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`, `patches/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`

Env keys: no `.env*` files on disk; config is `compass.yaml` (gitignored) with `compass.example.yaml` as the tracked template. Keys referenced in code (names only): `API_BASEURL`, `COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

---

# Intent addendum — the week-view drag/draft interaction surface

Scoped read of `packages/web/src/views/Week` plus the shared `packages/web/src/grid` primitives it depends on. This section is fresh for this run.

## There is no `WeekBody` component

The week-view body is composed by `views/Week/components/Grid/Grid.tsx`, which renders `AllDayRow` above `MainGrid` (which in turn renders `EventGrid`). Any brief phrased in terms of "WeekBody" must be re-anchored onto `Grid.tsx` / `AllDayRow` / `MainGrid`.

## Who owns pointer-drag-to-create today

Two separate creation paths, both living in the **shared** `packages/web/src/grid/hooks/` directory — not under `views/Week`:

**1. Timed grid — real drag gesture, deliberately single-day.**
`grid/hooks/useTimedDraftCreation.ts` is the only true drag-to-create in the codebase. It owns the full gesture lifecycle: `mousedown` → window-level `mousemove` / `mouseup` / `blur` listeners, a 4px move threshold (`TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`), live preview by writing the draft into the Zustand store on every move, and `cancel()` cleanup on unmount. It is wired into the week view through the thin `views/Week/hooks/grid/useTimedGridDraftCreation.ts` and consumed by `views/Week/components/Grid/MainGrid/MainGrid.tsx`. Crucially it **clamps every drag to the origin day**:

```ts
const isSameDayDrag = pointerDate.isSame(start, "day");
const isUpwardDrag = isSameDayDrag && pointerDate.isBefore(start);
...
} else if (isSameDayDrag) {
  resolvedEndDate = pointerDate.isBefore(minimumEndDate) ? minimumEndDate : pointerDate;
}
```

If the pointer leaves the origin day, neither branch fires and the draft silently keeps its default 30-minute schedule. Horizontal drag is currently a no-op by design.

**2. All-day row — click-only, hard-coded 1-day span.**
`grid/hooks/useAllDayDraftCreation.ts` is *not* a drag gesture at all. It returns a single `onMouseDown` handler that immediately computes:

```ts
const startDate = getStartDate(event.clientX, event.clientY);
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

…and opens the draft. There are no `mousemove` / `mouseup` listeners, no threshold, no preview. It is wired in by `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` (line 58) and rendered through `grid/components/AllDayGridRow.tsx`.

**Conclusion: multi-day drag-to-create does not exist on this branch.** The all-day row is the natural home for it and is the surface with the gap.

## What multi-day behaviour *does* already exist

Multi-day is only missing from *creation*. Everything downstream of a multi-day all-day event already works:

- **Rendering** — `AllDayEvents.tsx` / `AllDayGridRow.tsx` lay out all-day events spanning multiple day columns.
- **Resize across days** — `views/Week/interaction/adapter/interactions/all-day.resize.ts` delegates to `grid/interaction/math/all-day.resize.ts`, which already does day-index range math (`startDayIndex` / `endDayIndex`, `getNearestDayColumn(layout.dayColumns, pointer.x)`, `resizeFromStart` / `resizeFromEnd`, span-width computation).
- **Drag across days** — `all-day.drag.ts` moves an existing multi-day event.
- **Commit** — `interaction/adapter/commit/all-day.commit.ts` converts a day-index visual back into a persisted event.

So the pointer-x → day-index → date-range conversion this feature needs is **already solved and tested** for resize. The work is to reuse it at creation time rather than invent it.

`WeekInteractionCoordinator.tsx` (217 lines) owns the adapter for interactions on **existing** events and drafts (drag/resize commit wiring, layout cache, `PointerCaptureBoundary`). It does **not** participate in empty-grid creation. Unless the feature needs the layout cache during creation, the coordinator is context, not a target.

## Files a multi-day drag change would most likely touch

**Primary (near-certain):**
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — convert click-only into a threshold-gated drag gesture; replace the hard-coded `+1 day` with a pointer-derived end date.
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — existing unit tests assert the 1-day behaviour and will need extending.
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — wiring; today it passes a single `onMouseDown`, a drag gesture likely returns a `{ start… }` object like the timed hook does.

**Likely:**
- `packages/web/src/grid/components/AllDayGridRow.tsx` (+ its test) — may need to render the in-progress span preview.
- `packages/web/src/events/grid-event-draft.adapter.ts` — `allDayGridSchedule` / `replaceGridDraftSchedule` usage during live preview.
- `packages/web/src/grid/interaction/layout.cache.ts` — `getNearestDayColumn` is the reuse point for pointer-x → day index.
- `packages/web/src/interaction/interaction.constants.ts` — an all-day-specific move threshold may be needed. The file carries an explicit comment warning not to unify the two existing thresholds; a third constant is likelier than reusing either.

**Possible:**
- `views/Week/components/Grid/Grid.tsx`, `views/Week/components/Draft/Draft.tsx`, `views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`, `views/Week/WeekView.render.test.tsx`.

**Blast-radius warning — the shared hook is used by two views.**
`useAllDayDraftCreation` is imported by both `views/Week/components/Grid/AllDayRow/AllDayRow.tsx:13` and `views/Day/components/Calendar/DayCalendarGrid.tsx:39` (used at line 331). A signature or behaviour change ripples into the **Day view**, where multi-day drag is meaningless (one visible column). Gate 0 should decide between:
1. an additive opt-in option on the shared hook (Day view keeps click-only), or
2. a new sibling hook for span-drag, leaving the shared hook untouched.

Option 1 keeps `DayCalendarGrid.tsx` out of the write set; option 2 adds a new file. Either way `DayCalendarGrid.tsx` belongs on the read-only-context list so regressions there are noticed.

**Out of scope:** `views/Week/interaction/adapter/**` (existing-event drag/resize — a distinct surface from creation), `packages/backend/**`, `packages/sync/**`, `e2e/**`.

## Notes for the packet planner

- Mirror `useTimedDraftCreation`'s gesture lifecycle exactly — window-listener registration with `capture: true`, `isFinished` / `isCancelled` / `isPreviewStarted` flags, `blur` cancellation, `gestureRef.current?.cancel()` on unmount. It is the house pattern and it is already battle-tested.
- Live preview is done by writing the draft to the Zustand store (`draftActions.startGridDraft({ activity: "creating", draft })` then `draftActions.setGridDraft`), not by local component state. The comment in `useTimedDraftCreation` is explicit: *"The store draft is the preview: both views render it straight from the store while the gesture runs, so every move has to write it."*
- Reverse drag (right-to-left across days) must be handled; `grid/interaction/math/all-day.resize.ts#resizeFromStart` shows the established normalization.
- All-day end dates are exclusive (`start + 1 day` for a single-day event), formatted with `YEAR_MONTH_DAY_FORMAT`. Off-by-one on the exclusive end is the most likely correctness bug in this feature.
- `.cursor/rules/web-testing.mdc` and `web-styles.mdc` define this repo's test and style conventions and should be attached to codegen packets.
