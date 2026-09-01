# Discovery — 20260831-045511-feature-extend-attendee-avatar-badge

**Mode:** refresh → `incremental` (discovery-refresh.mjs).
**Reason:** 9 files changed since baseline (2 commits); all under `.sdlc/` or `.gitignore`. No
stack manifests changed (`manifests_changed: []`), no new AI-config paths. Baseline is materially
valid — per-run `baseline.json` is a verbatim copy of `.sdlc/baseline/current.json`.

- Baseline git HEAD: `4189de1` · current HEAD: `2d81253a` (branch `CMP-105/opus-only-v5`, 2 commits ahead of `origin/main`).
- Baseline built: 2026-08-20T04:32:08Z.

## Detected stacks (from baseline)

Monorepo (bun workspaces), 6 `node-typescript` packages:
`.` (root — react-18, tanstack-router/query, zustand, zod, tailwind-4, express, playwright, biome),
`packages/web` (react-18, zustand, tanstack-router, tiptap, dexie, zod, tailwind-4, testing-library, msw),
`packages/backend` (express, supertokens, mongodb), `packages/core` (zod),
`packages/sync` (googleapis), `packages/scripts`.

Runtime bun@1.3.14, TypeScript 7.0.2, node engine >=24.

## Test command

Proposed: `bun test:web` (from `.sdlc/baseline`, `test_command_source` = package.json script).
Gate 0 confirms.

## Detected AI/agent setup (all default OFF-LIMITS)

`.claude/settings.json`, `.claude/launch.json`, `.cursor/rules/` (4 .mdc files), `.cursor/hooks.json`,
`.cursor/hooks/format-after-edit.ts`, `.codex/config.toml`, `.codex/hooks.json`,
`.agents/skills/` (9 skills), `.agents/skills/chaos/agents/openai.yaml`, `AGENTS.md`.

## Coexistence risks

- **Cursor rules + `.cursor/hooks/format-after-edit.ts`** — plugin never touches them, but a
  format-on-save hook may reformat files the run edits.
- **Codex hooks** present — same note.
- `.sdlc/` **is** gitignored on this branch per the delta (`.gitignore` changed); a local
  post-checkout hook also parks `.sdlc/runs/` per-branch. Use `git add -f` for run artifacts.

## Task-relevant findings (feature-extend)

- **Grid event card:** `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx`
  (single file in its dir).
- **RSVP-status styling to reuse:** `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`
  — `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` maps
  `accepted→bg-success`, `declined→bg-error`, `tentative→bg-warning`, `needsAction→bg-text-subtle`;
  `attendeeStatusLabel()` gives the human string; dot is `size-2.5 shrink-0 rounded-full`.
- **Attendee data source:** `event.view-model.ts:93` exposes `attendees` from event details;
  shape is `AttendeeSchema` (`@core` contract) via `web.event.types.ts:87`
  (`attendees: z.array(AttendeeSchema).readonly().optional()`).
- `AttendeeResponseStatus` type: `@core/types/event-attendance.contracts`.

## Proposed off-limits

All AI-config paths above, `.env*`, `node_modules/**`, `dist/**`, `build/**`, `.git/**`,
`packages/backend/**`, `packages/sync/**`, `packages/scripts/**` (backend/sync/scripts are out of
scope for a web-only grid card change).
