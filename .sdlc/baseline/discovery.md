# Baseline discovery — compass-calendar

- **Repo:** `git@github.com:tl-ai-labs/compass-calendar.git`
- **Baseline HEAD:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
- **Built:** 2026-09-03T10:54:48Z (plugin 0.6.0)
- **Last refreshed by run:** `20260903-105448-feature-extend-oneclick-join` (incremental)
- **Supersedes:** baseline built 2026-08-20T04:32:08Z at `4189de13`

## What changed in this refresh

`discovery-refresh.mjs` returned **`incremental`** — 9 files over 2 commits, *all* of them under
`.sdlc/` or `.gitignore`. No stack manifest changed, no policy changed, no new AI-config file
appeared. Groups 3, 4 and 6 were re-verified rather than re-derived. Three things were updated:

1. **Test baseline recorded as RED.** `bun run test:web` on a clean tree at HEAD is
   **2297 pass / 1 fail / 1 error**, 302 files, exit 1. The single failure is
   `RecurrenceSection > keeps the event's own date selectable when the event ends after midnight`
   — pre-existing date-rot. Every future gate must diff against 2297/1, not against green.
   The command string is also corrected to `bun run test:web` (the old baseline said `bun test:web`).
2. **`.gitignore` gained three narrow rules** — `.sdlc/**/_gemini_worker_save/`,
   `.sdlc/local/debug.log`, `.hook-logs/`. `.sdlc/` as a whole is still **not** ignored, and that is
   deliberate: the SDLC layer is tracked on `main`. `git check-ignore .sdlc/runs/` confirms not
   ignored.
3. **Topology grew two transient dirs** (`.hook-logs`, `logs`); tracked file count 1582 → 1590.

## Stack

Bun 1.3.14 monorepo, lerna + bun workspaces over `packages/*`, TypeScript 7.0.2, Biome, Playwright.

| Package | Root | Test |
|---|---|---|
| `@compass/web` | `packages/web` | `bun run test:web` |
| `@compass/backend` | `packages/backend` | `bun run test:backend` |
| `@compass/core` | `packages/core` | `bun run test:core` |
| `@compass/sync` | `packages/sync` | `bun run test:sync` |
| `@compass/scripts` | `packages/scripts` | `bun run test:scripts` |

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

`packages/web` is React 18 + **Tailwind v4** + Zustand + TanStack Router/Query + Dexie + zod v4 +
`@phosphor-icons/react`, tested with `bun:test` + Testing Library + MSW. **`styled-components` is
used in zero files** — the repo has fully migrated to Tailwind utilities plus inline
`CSSProperties`; shared `@utility` classes live in `packages/web/src/index.css`.

`AGENTS.md` explicitly says *"Avoid defaulting to `bun test`; use the focused package test first."*

## Entry points

`packages/web/src/index.tsx`, `packages/backend/src/app.ts`, `packages/sync/src/app.ts`,
`packages/scripts/src/cli.ts`.

## Docs

`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`,
`docs/architecture`, `docs/frontend`, `docs/features`. No repo-root `CLAUDE.md`.

## AI / agent config detected

`.claude/settings.json`, `.claude/launch.json`, `.cursor/rules/` (4 `.mdc` files:
imports-and-packages, sync-package, web-styles, web-testing), `.cursor/hooks.json`,
`.cursor/hooks/format-after-edit.ts`, `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/`
(9 skills incl. ship, simplify, verify-change, a11y-audit), `AGENTS.md`.

Absent: `.mcp.json`, `CLAUDE.md`, `CLAUDE.local.md`, `.cursorrules`, `.aider.conf.yml`,
`.continue/`, `.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`.

## Config / env

No `.env*` files. Config is `compass.yaml` (gitignored) with `compass.example.yaml` as the tracked
template. Env names referenced in code (names only, never values): `API_BASEURL`,
`COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Infra

11 GitHub workflows. No submodules, no Git-LFS, no Terraform, no GitLab/CircleCI/Jenkins. Docker
assets under `.github/docker` and `self-host`, not the repo root.

## Regulated-repo signals

One weak signal: `SECURITY.md` at repo root. No HIPAA/PCI/SOC2/GDPR docs, no compliance path
segments, no security/compliance CODEOWNERS entries. **No Gate 0 warning required.**

## Coexistence risks

- **Cursor rules** at `.cursor/rules/` — untouched by default, but `web-styles.mdc` and
  `web-testing.mdc` encode the conventions codegen must match.
- **Cursor *and* Codex format-on-edit hooks are active.** `AGENTS.md` states formatting is handled
  by these repo-local hooks after agent edits, so plugin output may be reformatted by Biome
  out-of-band. Byte-identity checks on written files can fail spuriously.
- **`.gitignore` carries a repo-wide `*.mjs` rule.** Any `.mjs` emitted into user source is
  silently untracked.
- **`.sdlc/` is tracked by design.** Run artifacts are visible to `git add -A`; do not offer to
  broaden the ignore. (Note: `.sdlc/runs/` *is* ignored on some other branches — check per branch,
  and prefer `git add -f` when committing run records.)
- **No `.mcp.json`, no repo-local `routing-policy.yaml`** — the shipped policy applies unmodified.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| Red test baseline | **high** | `bun run test:web` is 2297/1 on a clean tree. "Green" is unreachable; gate on "no new failures". |
| Aggressive gitignore | medium | `*.mjs` and `*.env*` are repo-wide ignore globs. |
| External format hooks | low | Cursor/Codex format-after-edit may rewrite plugin output. |
| Partial `.sdlc` ignore | low | Intentional; only worker blobs and `debug.log` excluded. |
| LFS / submodules / dirty tree | none | None in use; tree clean apart from `.sdlc/`. |

## Proposed off-limits (default)

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`,
`compass.yaml`, `.playwright-compass.yaml`, `*.env*`, `.env`, `.env.*`, `node_modules/**`,
`build/**`, `buildcache/**`, `packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`,
`patches/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`,
`.hook-logs/**`, `logs/**`.

## Adaptive stack profile

`.sdlc/baseline/stack-profile.md` (cached; **not** rebuilt this refresh — decision was
`incremental` and no stack manifest changed). The repo's primary stack (React SPA on Bun) has no
pre-authored adapter in v1, so the learned profile remains authoritative over `generic.md`.

## Per-run detail

Deep, file-and-line-level findings for the current intent (one-click join conference icon on grid
event cards) live in the run snapshot, not here:

- `.sdlc/runs/20260903-105448-feature-extend-oneclick-join/discovery.md`
- `.sdlc/runs/20260903-105448-feature-extend-oneclick-join/baseline.json`
