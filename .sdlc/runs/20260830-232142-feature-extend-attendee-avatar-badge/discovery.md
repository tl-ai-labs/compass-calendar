# Discovery — run `20260830-232142-feature-extend-attendee-avatar-badge`

- **Mode:** refresh → decision **`incremental`**
- **Reason:** 9 files changed since baseline across 2 commits; every one under `.sdlc/` except `.gitignore`. No stack manifest changed, policy unchanged.
- **Baseline HEAD:** `4189de13` → **current HEAD:** `2d81253a`
- **Re-scanned:** group 1 (git state), group 6 (AI/agent config presence), group 2 (cheap topology re-list)
- **Reused from cache:** groups 3, 4, 5, 7, 8, 9 and `stack-profile.md`
- **Intent hint:** `feature-extend` — attendee avatar badge on grid event cards, reusing RSVP-status styling from `EventDetailsSection`. *Discovery does not scope this; Gate 0 does.*

## Git state

| Field | Value |
| --- | --- |
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-105/flash-agsdk-only` |
| Dirty | yes — `.sdlc/pre-check-status.json`, `.sdlc/project.json` modified; `.sdlc/local/` untracked |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Tracked files | ~1582 |

**Branch drift worth confirming.** The invoking session's snapshot named branch `CMP-103/opus-plus-flash-v37-t2` at `ddcf91f1`. On disk the repo is on `CMP-105/flash-agsdk-only` at `2d81253a` — a checkout happened after that snapshot was taken. `.sdlc/runs/` is empty on this branch, consistent with per-branch parking of run artifacts. Confirm the intended working branch at Gate 0 before any writes.

No user-source files are modified, so the rollback anchor is clean for source purposes.

## Topology

Top-level directories: `.agents`, `.claude`, `.codex`, `.cursor`, `.github`, `.hook-logs`, `build`, `docs`, `e2e`, `logs`, `packages`, `patches`, `self-host`.

New since baseline: `.hook-logs/`, `build/`, `logs/` — all generated/transient, all proposed off-limits.

Entry points re-verified as present: `packages/web/src/index.tsx`, `packages/backend/src/app.ts`, `packages/sync/src/app.ts`, `packages/scripts/src/cli.ts`.

## Detected stacks

Unchanged from baseline — no manifest changed, so groups 3-4 were not re-run.

Bun + TypeScript monorepo (`lerna.json` + Bun workspaces over `packages/*`), Bun `1.3.14`, TypeScript `7.0.2`, Node engine `>=24`.

| Manifest | Stack | Frameworks |
| --- | --- | --- |
| `package.json` (root) | node-typescript | react-18, tanstack-react-router, tanstack-react-query, zustand, zod, tailwind-4, express, playwright, biome |
| `packages/web/package.json` | node-typescript | react-18, zustand, tanstack-react-router, tiptap, dexie, zod, tailwind-4, testing-library, msw |
| `packages/backend/package.json` | node-typescript | express, supertokens, mongodb |
| `packages/core/package.json` | node-typescript | zod |
| `packages/sync/package.json` | node-typescript | googleapis |
| `packages/scripts/package.json` | node-typescript | — |

Lint/format is **Biome**, not ESLint/Prettier.

### Stack profile (Tier 2b)

`.sdlc/baseline/stack-profile.md` is **reused from cache**, built 2026-08-22. No refresh triggered: no manifest changed, the refresh decision is `incremental` rather than `full`, and roughly 3 runs have elapsed since it was built — under the 10-run freshness bound. It remains authoritative over the `generic.md` pre-authored adapter on conflict.

## Proposed test command

```
bun test:web
```

Source: `AGENTS.md#Validation-defaults` + `package.json#scripts.test:web`. `AGENTS.md` explicitly says *"Avoid defaulting to `bun test`; use the focused package test first."* The intent touches `packages/web`, so the scoped web suite is the right default.

Alternatives on record: `bun test` (full), `bun test:core`, `bun type-check`, `bun lint`, `bun test:e2e`, `bun run verify` (diff-aware).

**Gate 0 must confirm this** — Tier 2 item, not discovery's call.

## Detected AI/agent setup

Presence only; no deep parsing (v1).

| Path | Type |
| --- | --- |
| `.claude/settings.json` | claude-code |
| `.claude/settings.local.json` | claude-code-local — **new since baseline**, gitignored |
| `.claude/launch.json` | claude-code |
| `.cursor/rules/` | cursor — 4 `.mdc` files: `imports-and-packages`, `sync-package`, `web-styles`, `web-testing` |
| `.cursor/hooks.json` | cursor-hooks |
| `.cursor/hooks/format-after-edit.ts` | cursor-hook-script |
| `.cursor/settings.json`, `.cursor/environment.json`, `.cursor/bootstrap-backend.sh` | cursor — newly itemized |
| `.codex/config.toml`, `.codex/hooks.json` | codex + codex-hooks |
| `.agents/skills/` | shared agent skills — 9 skills incl. `ship`, `simplify`, `verify-change`, `a11y-audit` |
| `.agents/skills/chaos/agents/openai.yaml` | external-model agent config |
| `AGENTS.md` | agent instructions |

Confirmed absent: `.mcp.json` (gitignored at `.gitignore:14`, not on disk), `CLAUDE.md`, `CLAUDE.local.md`, `.cursorrules`, `.aider.conf.*`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, any `routing-policy.yaml`, any `gemini*.{yaml,json}`.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (4 `.mdc` files including `web-styles.mdc` and `web-testing.mdc`). The plugin will never touch them, but they encode the conventions codegen must match — and if Cursor's auto-lint runs on save, changes we make may trigger it.
- **Cursor AND Codex format-on-edit hooks are active** (`.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). `AGENTS.md` states formatting is handled by these repo-local hooks after agent edits. Files this plugin writes may be reformatted out-of-band by Biome.
- **`.sdlc/` is only partially gitignored.** Your `.gitignore` gained `.sdlc/**/_gemini_worker_save/`, `.sdlc/local/debug.log` and `.hook-logs/` since the last baseline, but `.sdlc/` as a whole is still not covered. Verified with `git check-ignore`: `.sdlc/runs/**`, `.sdlc/baseline/**`, `.sdlc/backups/**` and `.sdlc/packets.json` are **not ignored**. Run artifacts — including `backups/<file>`, which echo source content of files touched this run — will be untracked but visible to `git add -A`, and a distracted commit could push them. Gate 0 will offer to add `.gitignore` to this run's allowlist so the plugin can append a broader entry.
- **Aggressive repo-wide ignore globs.** `.gitignore` carries `*.mjs`, `*.log` and `*.env*` at repo scope — any `.mjs` or `.log` the plugin emits into user source would be silently untracked.
- **No custom MCP servers.** `.mcp.json` is gitignored and absent locally; nothing competing is registered.
- **No repo-local `routing-policy.yaml`** anywhere in the repo, so the shipped/selected policy applies unmodified.
- **Repo default policy is `flash-agsdk-only`** (`.sdlc/project.json#default_policy`, matching the current branch name). Confirm at Gate 0 that this is the intended arm for this run before any mechanical-tier work is dispatched.

## Env keys

No `.env*` files exist on disk. Config is via `compass.yaml` (gitignored) with `compass.example.yaml` as the tracked template. Cached from baseline; unchanged.

Names referenced in code (names only, never values): `API_BASEURL`, `COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Monorepo, submodules, LFS

`lerna` + Bun workspaces over `packages/*`. Packages: `@compass/web`, `@compass/backend`, `@compass/core`, `@compass/sync`, `@compass/scripts`, each with a `bun test:<pkg>` command. Path aliases: `@web/*`, `@core/*`, `@compass/backend`, `@compass/sync`, `@compass/scripts`.

No submodules (`.gitmodules` absent). No Git-LFS.

Infra: 11 GitHub workflows. Docker assets live under `.github/docker` and `self-host`, not repo root. No Terraform, GitLab CI, CircleCI or Jenkins.

## Regulated-repo signals

One weak signal: `SECURITY.md` at repo root (a standard OSS security-policy file, not a compliance-scope marker). No `HIPAA`/`PCI`/`SOC2`/`GDPR`/`COMPLIANCE` files or directories, and no security/compliance/privacy/legal team entries in CODEOWNERS. `regulated_repo_warning_required` stays **false** — no Gate 0 warning required.

## Proposed off-limits

Union of group-6 hits, generated/build dirs, and `.sdlc/project.json#off_limits_default`:

```
.git/**
.sdlc/**
.claude/**
.claude/settings.local.json
.codex/**
.cursor/**
.agents/**
AGENTS.md
.mcp.json
compass.yaml
.playwright-compass.yaml
*.env*
.env
.env.*
node_modules/**
build/**
buildcache/**
logs/**
.hook-logs/**
packages/*/build/**
packages/*/node_modules/**
bun.lock
patches/**
playwright-report/**
test-results/**
blob-report/**
.github/workflows/**
```

The user may override individual entries at Gate 0.
