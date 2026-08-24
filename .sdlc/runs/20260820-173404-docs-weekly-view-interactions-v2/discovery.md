# Discovery — 20260820-173404-docs-weekly-view-interactions-v2

**Mode:** refresh · **Decision:** `cached` · **Scan cost:** ~0s (no re-scan)

Using the cached baseline from `.sdlc/baseline/current.json` (built `2026-08-20T04:32:08Z`, ~13 hours old, **0 commits behind**). `discovery-refresh.mjs` reported `cached` because git HEAD is unchanged at `4189de13` and no stack manifest mtime moved since the baseline was built; `.sdlc/policy.yaml` is unchanged too. The full Tier 1 read groups were therefore **not** re-run — `baseline.json` for this run is a verbatim copy of the living baseline, with only `run_id`, `mode`, `refresh`, `git.branch`, and the intent-scoped sections updated. The one run-time difference from the baseline is the branch: the baseline was captured on `main`, this run is on `CMP-102/flash-agsdk-only` at the identical commit. Working tree is clean apart from untracked `.sdlc/` and `.hook-logs/`.

## Carried forward from the cached baseline

- **Stack:** Bun 1.3.14 / Node >=24 / TypeScript 7.0.2 monorepo (`lerna` + bun workspaces, `packages/*`): `@compass/web` (React 18, Zustand, TanStack Router/Query, Tailwind 4), `@compass/backend` (Express, SuperTokens, MongoDB), `@compass/core`, `@compass/sync`, `@compass/scripts`.
- **Test command (proposed):** `bun test:web`. `AGENTS.md` explicitly says *"avoid defaulting to `bun test`; use the focused package test first."* Gate 0 confirms. For a README-only change, `bun lint` is the more relevant gate than any package test suite.
- **AI/agent configs:** `.claude/`, `.cursor/rules/` (4 `.mdc` files), `.cursor/hooks.json`, `.codex/`, `.agents/skills/`, `AGENTS.md`. All default to off-limits.
- **Off-limits:** unchanged from the baseline's `off_limits_proposed`.

## Coexistence risks (unchanged, re-surfaced for Gate 0)

- Cursor **and** Codex format-on-edit hooks are active; Biome may reformat files this run writes, including Markdown.
- `.gitignore` does **not** cover `.sdlc/` — run artifacts are untracked but visible to `git add -A`. Gate 0 should offer to add `.gitignore` to this run's allowlist.
- `.gitignore` carries a repo-wide `*.mjs` rule.
- No repo-local `routing-policy.yaml`; the shipped policy applies. Note this run is a re-run of the same topic under a different model policy (prior run `20260820-164209-docs-weekly-view-interactions`).

## Regulated-repo signals

`SECURITY.md` at repo root only. This is a standard OSS security-policy file, not a compliance-obligation marker. `regulated_repo_warning_required: false` — no Gate 0 warning needed.

## Intent scope — docs: "Weekly view interactions" in README.md

**Write surface: `README.md` only.** Everything below is reference-only reading.

`README.md` runs 55 lines: `## Features` (line 23) is followed by `## Tech stack` (line 37). A new `## Weekly view interactions` section fits naturally between them. Note `## Features` already carries a *"Things you can't do in Compass (yet)"* list — the same honesty convention should apply to the new section.

Prior art worth reading before writing: **`docs/frontend/week-drag-interaction.md`** (112 lines) already documents the week drag interaction model for a developer audience. The README section should be user-facing and link to it rather than duplicate it.

### Accuracy risk — "multi-day select" (HIGH)

**Drag-to-create a multi-day all-day event does not exist at this commit.** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` creates a fixed one-day draft on mousedown:

```ts
const startDate = getStartDate(event.clientX, event.clientY);
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

Four prior runs (`20260819-212923`, `20260819-233904`, `20260820-004405`, `20260820-091709`) targeted multi-day drag-create, but HEAD is unchanged, so **none of that work landed**. Documenting it would ship a false claim.

What multi-day behavior *does* exist today:

- **Resize** an existing all-day event across day columns from either edge — `packages/web/src/grid/interaction/math/all-day.resize.ts`, wired via `packages/web/src/views/Week/interaction/adapter/interactions/all-day.resize.ts`.
- **Drag** an all-day event across days — `packages/web/src/grid/interaction/math/all-day.drag.ts`.
- **Multi-day timed events** render as a bar in the all-day row via the `isTimedMultiDayDisplay` flag — `packages/web/src/common/types/web.event.types.ts`, `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`, `packages/web/src/common/utils/event/event-nudge.util.ts` (`isTimedEventMultiDay`, `timedMultiDayToAllDayDates`).

Week-view container components: `packages/web/src/views/Week/WeekView.tsx` → `components/Grid/Grid.tsx` → `AllDayRow/AllDayRow.tsx`, `MainGrid/`, plus `interaction/WeekInteractionCoordinator.tsx`.

### Recurring events

UI lives at `packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/`. Backed by the `rrule` library. Frequencies are **Day / Week / Month / Year** (`constants/recurrence.constants.ts` — `FREQUENCY_MAP`, `FREQUENCY_OPTIONS`, `WEEKDAY_RRULE_MAP`); hourly/minutely/secondly are deliberately excluded from the type.

Supporting pieces: `useRecurrence/useRecurrence.ts`, `components/FreqSelect.tsx`, `components/WeekDays.tsx` + `WeekDay.tsx`, `components/RecurrenceIntervalSelect.tsx`, `components/EndsOnDate.tsx`, `components/RecurrenceToggle.tsx`. Editing/deleting a series prompts for scope via `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx` and `packages/web/src/views/Forms/hooks/useDeleteEvent.ts`; a single instance can be detached via `ConvertToStandaloneDialog.tsx`. Recurring events show a repeat glyph — `packages/web/src/grid/components/EventRepeatIcon.tsx`.

### Event colors

Canonical contract: `packages/core/src/types/event-color.contracts.ts`. Eleven Compass-owned slots, which the file's own comment describes as mapping 1:1 onto Google's legacy 11 event colors:

`lavender, mint, plum, coral, gold, orange, blue, slate, indigo, green, red`

Two nuances worth getting right in prose:

1. `color` is nullable on write commands so `null` clears a color tag (`withColor`).
2. `colorHex` — a provider-assigned custom color, e.g. Google's post-June-2026 event labels — is **read-only**. Compass's own picker only ever writes `color`, never `colorHex`. Do not describe Compass as supporting arbitrary custom hex colors.

Rendering/theme: `packages/web/src/common/styles/colors.ts`, `theme.util.ts`, `color.utils.ts`, and `packages/web/src/grid/utils/allDayColumnTint.util.ts`.

## Notes

- Targeted intent-scoped reads (week view, recurrence, colors) were performed on top of the cached baseline because the cached `intent_scope` belonged to a different intent. These were read-only greps and file reads; no group 1-9 re-scan occurred.
- No `stack-profile.md` refresh triggered: HEAD unchanged, no `--refresh-profile`, and the docs intent needs no codegen conventions.
