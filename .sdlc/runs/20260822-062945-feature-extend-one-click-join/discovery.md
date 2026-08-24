# Discovery — run 20260822-062945-feature-extend-one-click-join

- **Mode:** refresh → decision `cached`
- **Scanned at:** 2026-08-22T06:29:45Z
- **Repo root:** /home/sainadh/projects/compass-calendar/compass/compass-calendar
- **Ticket / policy:** CMP-103 / opus-only-v5

## Cached baseline in use

`discovery-refresh.mjs` returned **`cached`**: git HEAD is unchanged
(`4189de1389d8a4644ae20d9c5a907f1d161b5496`) and no stack manifest has been modified
since the living baseline was built at **2026-08-20T04:32:08Z** (2 days old, **0 commits
behind**, `policy_changed: false`). No re-scan was performed. This run's
`baseline.json` is a verbatim copy of `.sdlc/baseline/current.json` for every
scan-derived field; only run-provenance fields (`run_id`, `mode`, `git.branch`,
`cached_from`, `intent_scope`) plus two newly observed repo-state items were
overridden. The living baseline files were **not** rewritten — they are still current.

Spot-checks confirming the cached data is still true: `.gitignore` still has no `.sdlc`
entry; `.claude/`, `.cursor/`, `AGENTS.md` still present; `CLAUDE.md`, `.cursorrules`,
`.mcp.json`, `.aider*`, `.continue/`, `.roo/`, `routing-policy.yaml` still absent.

## Git state

| Field | Value |
|---|---|
| HEAD | `4189de1389d8a4644ae20d9c5a907f1d161b5496` |
| Branch | `CMP-103/opus-only-v5` |
| Tracked-file changes | none |
| Untracked | `.sdlc/`, `.hook-logs/` |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| `.sdlc/` gitignored | **no** |

`CMP-103/opus-only-v5` sits exactly on `origin/main`. This is a **clean base**.

## Repeat-run context (CMP-103, attempt 3)

Two prior one-click-join runs exist, each on its own sibling branch. Neither is merged
into this branch, so none of their code is in the working tree.

| Run | Branch | Head | Diff vs base | Artifacts |
|---|---|---|---|---|
| `20260821-113930-…` | `CMP-103/opus-plus-flash-v37` | `399a2554` | 4 files, +612/−2 | complete (incl. baseline.json, review.json) |
| `20260822-040449-…` | `CMP-103/flash-agsdk-only` | `cb4a809f` | 5 files, +552/−2 | **incomplete** — no `baseline.json`, no `discovery.md` |

Verified absent from this worktree: `EventJoinIcon.tsx`, `EventCard.test.tsx`, and any
`conferenceData` / `hangoutLink` / `EventJoinIcon` reference under `packages/web/src`.
Phase planning should treat this as a from-scratch implementation, not a continuation.

Both prior attempts converged on the same four files, which is a strong prior for scope:
`TimedEventCard.tsx`, `AllDayEventCard.tsx`, new `EventJoinIcon.tsx`, new
`EventCard.test.tsx`, all under `packages/web/src/grid/components/`. Note the
`flash-agsdk-only` attempt also edited `.gitignore` (+1 line) — a file outside the
component scope.

## Detected stacks

Single-language monorepo: **node-typescript** throughout, Bun `1.3.14`, TypeScript
`7.0.2`, node engine `>=24.0.0`. Managed as **lerna + bun workspaces** over
`packages/*`:

| Package | Root | Frameworks |
|---|---|---|
| `@compass/web` | `packages/web` | react-18, zustand, tanstack-react-router, tiptap, dexie, zod, tailwind-4, testing-library, msw |
| `@compass/backend` | `packages/backend` | express, supertokens, mongodb |
| `@compass/core` | `packages/core` | zod |
| `@compass/sync` | `packages/sync` | googleapis |
| `@compass/scripts` | `packages/scripts` | — |

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

No pre-authored adapter matches (v1 ships `generic.md`, `nest.md`, `python.md`); this is
a React/Vite SPA on Bun. `adapter_match.adaptive_profile_recommended` is **true** —
check `.sdlc/baseline/stack-profile.md` and build it if missing or stale.

## Proposed test command

**`bun test:web`** — source: `AGENTS.md#Validation-defaults` + `package.json#scripts.test:web`.

`AGENTS.md` explicitly says *"Avoid defaulting to `bun test`; use the focused package
test first."* The intent touches `packages/web` only, so the scoped command is correct.
Alternatives available: `bun test` (full), `bun test:core`, `bun type-check`, `bun lint`,
`bun test:e2e`, `bun run verify` (diff-aware). Gate 0 must confirm.

## Detected AI/agent setup

- `.claude/settings.json`, `.claude/launch.json` — Claude Code project config
- `.cursor/rules/` — 4 `.mdc` rule files: `imports-and-packages`, `sync-package`,
  `web-styles`, `web-testing`
- `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts` — Cursor format-on-edit
- `.codex/config.toml`, `.codex/hooks.json` — Codex config and hooks
- `.agents/skills/` — 9 shared skills (`ship`, `simplify`, `verify-change`, `a11y-audit`, …)
- `.agents/skills/chaos/agents/openai.yaml` — external-model agent config
- `AGENTS.md` — repo-wide agent instructions

Absent: `.mcp.json` (gitignored and not on disk), `CLAUDE.md`, `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`,
repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/`. The plugin will never touch them, but
  `web-styles.mdc` and `web-testing.mdc` encode the conventions codegen must match —
  feed them to the packet planner rather than ignoring them.
- **Cursor *and* Codex format-on-edit hooks are active.** `AGENTS.md` states formatting
  is handled by these repo-local hooks after agent edits. Files this plugin writes may be
  reformatted out-of-band by Biome; do not treat a post-write diff as tampering.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` — `packets.json`,
  `changes.md`, and `backups/<file>` (which echo source content of files touched this
  run) — are untracked but visible to `git add -A`. Gate 0 should offer to add
  `.gitignore` to this run's allowlist so the entry can be added as part of the run.
  The `flash-agsdk-only` attempt appears to have done exactly this.
- **`.hook-logs/` is new since the baseline** and also not gitignored. Same exposure.
- **Repo-wide `*.mjs` ignore glob** in `.gitignore` — any `.mjs` emitted into user source
  would be silently untracked.
- **No custom MCP servers** registered, and **no repo-local `routing-policy.yaml`**, so
  the shipped `opus-only-v5` policy applies unmodified.

## Proposed off-limits

```
.git/**            .claude/**         .codex/**          .cursor/**
.agents/**         AGENTS.md          .mcp.json          .sdlc/**
.hook-logs/**      compass.yaml       .playwright-compass.yaml
*.env*             .env               .env.*
node_modules/**    packages/*/node_modules/**
build/**           buildcache/**      packages/*/build/**
bun.lock           patches/**
playwright-report/**   test-results/**   blob-report/**
.github/workflows/**
```

## Env keys

No `.env*` files exist on disk. Configuration is via `compass.yaml` (gitignored) with
`compass.example.yaml` as the tracked template, so `env_keys_by_file` is empty.
Names referenced in code (names only, never values): `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Regulated-repo signals

One low-signal hit: `SECURITY.md` at repo root (a standard OSS security policy, not a
compliance regime marker). `regulated_repo_warning_required: false` — no Gate 0 warning.

## Other topology

Submodules: none. Git-LFS: not in use. Infra: 11 GitHub Actions workflows; Docker assets
live under `.github/docker` and `self-host`, not repo root; no Terraform, GitLab CI,
CircleCI, or Jenkins.
