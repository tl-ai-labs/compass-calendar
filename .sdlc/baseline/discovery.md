# Compass Calendar — living baseline

- **Last refreshed:** 2026-08-26T08:31:51Z (incremental)
- **At commit:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` on `CMP-104/opus-plus-sonnet`
- **Plugin:** mmo 0.6.0
- **Machine-readable:** `.sdlc/baseline/current.json`
- **Stack profile:** `.sdlc/baseline/stack-profile.md` (authoritative for codegen conventions)

## Refresh history

| Run | Built | HEAD | Mode |
|---|---|---|---|
| `20260819-212923-feature-extend-weekbody-multiday-drag` | 2026-08-20T04:32:08Z | `4189de1` | first-time |
| `20260826-082906-refactor-week-day-interaction` | 2026-08-26T08:31:51Z | `2d81253a` | refresh / incremental |

The 2026-08-26 refresh changed **no source facts**. The 2-commit delta from `4189de1` to `2d81253a` was
verified to contain only `.sdlc/**` additions plus a `.gitignore` edit; all stack manifests retain
pre-baseline mtimes. Stacks, topology, docs, env keys and regulated signals were carried forward. Git state,
AI-config presence and gitignore coverage were re-scanned.

## Repo shape

Bun 1.3.14 / Node ≥24 / TypeScript 7.0.2 monorepo — lerna + bun workspaces over `packages/*`:
`@compass/web` (React 18, Zustand, TanStack Router/Query, Tailwind 4, testing-library, msw),
`@compass/backend` (Express, SuperTokens, MongoDB), `@compass/core` (Zod), `@compass/sync` (googleapis),
`@compass/scripts`.

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

Entry points: `packages/web/src/index.tsx`, `packages/backend/src/app.ts`, `packages/sync/src/app.ts`,
`packages/scripts/src/cli.ts`.

No submodules. No Git-LFS. No `.env*` files — runtime config is `compass.yaml` (gitignored) with
`compass.example.yaml` as the tracked template. Env names referenced in code: `API_BASEURL`,
`COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

Infra: 11 GitHub workflows. Docker assets under `.github/docker` and `self-host`, not repo root.

## Validation

Per-package, per `AGENTS.md` § Validation defaults — `bun test:core`, `bun test:sync`, `bun test:web`,
`bun test:backend`, `bun test:scripts`. `AGENTS.md` warns against defaulting to the full `bun test`; use the
focused package command. Also available: `bun type-check`, `bun lint`, `bun test:e2e`, `bun run verify`
(diff-aware).

## Web interaction architecture (durable finding, 2026-08-26)

The web package has a **shared interaction engine** at `packages/web/src/interaction/` (1527 lines), whose
core is `createInteractionEngine<TTarget, TVisual, TResult>` in `interaction.engine.ts` (604 lines) against
the `InteractionAdapter` contract in `interaction.adapter.types.ts`.

Beneath it, `packages/web/src/grid/interaction/` (2625 lines) holds the shared grid substrate — the
`createViewInteractionRegistry` and `createGridEventTargeting` factories, the layout cache, and all
drag/resize math.

Two view-level layers sit on top: `views/Week/interaction/` (5428 lines) and `views/Day/interaction/`
(2375 lines), each with adapter / commit / targeting / registry / coordinator concerns. They are
substantially duplicated — registry and targeting are pure name-substitution clones, and the commit
*envelope* is built under `adapter/interactions/` in Week but `adapter/commit/` in Day. Full evidence in
`.sdlc/runs/20260826-082906-refactor-week-day-interaction/discovery.md`.

`packages/web/src/events/mutations/useUpdateEvent.ts` is the single file both views' commit results converge on.

**No `WeekBody` component exists** (re-verified at `2d81253a`; zero repo-wide matches). The week body is
composed by `views/Week/components/Grid/Grid.tsx` via `AllDayRow > MainGrid > EventGrid`.

## AI/agent coexistence

Present: `.claude/` (settings.json, settings.local.json, launch.json), `.cursor/` (4 `.mdc` rules,
hooks.json, hooks/format-after-edit.ts), `.codex/` (config.toml, hooks.json), `.agents/skills/` (9 skills),
`AGENTS.md`. Absent: `CLAUDE.md`, `.mcp.json`, `.cursorrules`, aider, continue, copilot, roo, repo-local
`routing-policy.yaml`.

Standing risks:

- **Cursor and Codex format-on-edit hooks are both active.** `AGENTS.md` delegates formatting to them, so
  plugin-written files may be reformatted out-of-band by Biome.
- **`.gitignore` does not cover `.sdlc/`.** As of `2d81253a` it ignores only `.sdlc/**/_gemini_worker_save/`,
  `.sdlc/local/debug.log` and `.hook-logs/`. All other run artifacts remain visible to `git add -A`.
- **Repo-wide `*.mjs` ignore rule** — any `.mjs` written into user source would be silently untracked.
- `.cursor/rules/web-styles.mdc` and `web-testing.mdc` encode conventions codegen must match.

## Regulated-repo signals

`SECURITY.md` only — a standard OSS policy file. No HIPAA/PCI/SOC2/GDPR markers or compliance CODEOWNERS.
`regulated_repo_warning_required: false`.

## Default off-limits

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`, `compass.yaml`,
`.playwright-compass.yaml`, `*.env*`, `node_modules/**`, `build/**`, `buildcache/**`, `packages/*/build/**`,
`packages/*/node_modules/**`, `bun.lock`, `patches/**`, `playwright-report/**`, `test-results/**`,
`blob-report/**`, `.github/workflows/**`.

Individual runs may add scope-narrowing entries on top; those are recorded per-run, not here.
