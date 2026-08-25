# Discovery — run 20260825-090211-docs-weekly-view-interactions-v4

- **Mode:** refresh
- **Refresh decision:** `incremental`
- **Intent hint:** docs
- **Built at:** 2026-08-25T09:04:22Z
- **Plugin version:** 0.6.0
- **Baseline reused from:** 2026-08-20T04:32:08Z (5 days, 2 commits behind)

## Refresh decision and why

`discovery-refresh.mjs` returned `incremental`, reason *"9 files changed since baseline (2 commits)"*.

That count overstates the real staleness. Of the 9 delta files, **8 are under `.sdlc/`** — the
plugin's own bookkeeping (`ledger.json`, `project.json`, `baseline/*`, `pre-check-status.json`) —
and the 9th is `.gitignore`. Confirmed with a scoped diff:

```
git diff 4189de1..c3c59a36 --stat -- . ':(exclude).sdlc'
 .gitignore | 5 +++++
```

**No user source changed. No stack manifest changed. No policy file changed.** So the honest
re-scan surface was narrow:

| Group | Action |
|---|---|
| 1 — git state | **re-scanned** (HEAD, branch, dirty, `.gitignore` coverage all moved) |
| 6 — AI/agent config | **re-scanned** (cheap presence check, to catch new tooling) |
| 5 — docs | **partially refreshed** (not in the delta, but the intent is `docs`, so worth the two seconds) |
| 2, 3, 4, 7, 8, 9 | **carried forward** from the 2026-08-20 baseline |

## Git state

| Field | Value |
|---|---|
| HEAD | `c3c59a36658d435273b033a2f0346012b5a5c998` |
| Branch | `CMP-102/opus-plus-sonnet` |
| Dirty | **yes** — one tracked modification |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Tracked files | ~1583 |

The single dirty file is `.claude/settings.json`. The diff adds a `Write|Edit` PreToolUse hook that
invokes the mmo `write-contract-check.mjs`, carrying an inline comment noting the plugin's own
`hooks/hooks.json` declaration was empirically confirmed not to fire here. See risks below — this
matters more than a normal dirty file.

Branch note: the baseline was taken on `main`; the session opened on `CMP-103/opus-plus-flash-v37`;
HEAD is now `CMP-102/opus-plus-sonnet`. Worth a conscious confirmation at Gate 0 that this is where
the run should land.

## Detected stacks

Carried forward unchanged — no manifest moved.

A **Bun-run TypeScript monorepo** (`lerna` + bun workspaces over `packages/*`), 6 manifests:

| Manifest | Frameworks |
|---|---|
| `package.json` (root) | react-18, tanstack-react-router, tanstack-react-query, zustand, zod, tailwind-4, express, playwright, biome |
| `packages/web` | react-18, zustand, tanstack-react-router, tiptap, dexie, zod, tailwind-4, testing-library, msw |
| `packages/backend` | express, supertokens, mongodb |
| `packages/core` | zod |
| `packages/sync` | googleapis |
| `packages/scripts` | — |

Runtime `bun@1.3.14`, node engine `>=24.0.0`, TypeScript `7.0.2`.

**Adapter:** no shipped adapter matches (v1 ships `generic`, `nest`, `python`). The cached adaptive
profile at `.sdlc/baseline/stack-profile.md` is reused — Tier 2b does **not** re-trigger, since no
manifest changed, the decision isn't `full`, and no `--refresh-profile` was passed.

## Proposed test command

**`bun lint`** — low confidence, Gate 0 must confirm.

Reasoning: the intent is `docs`. This repo has **no markdown linter at all** — no markdownlint,
remark, prettier or vale config — and Biome does not lint `.md`. The unit suites validate nothing
about a documentation change. `bun lint` (`check-semantic-colors.ts` + `biome check .`) is the
cheapest gate that isn't vacuous, but **"no automated gate, human review only" is a legitimate
answer for this intent** and Gate 0 should be willing to pick it.

AGENTS.md rule still applies: *"Avoid defaulting to `bun test`; use the focused package test first."*

Fallbacks if the run ends up touching source: `bun test:web`, `bun type-check`, `bun run verify`
(diff-aware).

**Baseline tests were not run.** Discovery is Tier 1 read-only; green-baseline confirmation is
Gate 0 / Phase 7 work.

## Docs topology (intent-relevant)

43 markdown files under `docs/`, in: `CI-CD`, `Config`, `acceptance`, `architecture`, `backend`,
`development`, `features`, `frontend`, `self-hosting`.

Nearest existing neighbour to this run's slug is **`docs/frontend/week-drag-interaction.md`**. It
sets the house style downstream phases should match: H1 title, a one-line summary, a bolded
**"## The one-sentence model"** thesis, **"## Why this exists"** framing the bug//motivation,
**"## How it works now"** with a mermaid diagram, and relative cross-links to sibling docs.

## Detected AI/agent setup

Four agent toolchains coexist in this repo. None changed since the baseline.

- `.claude/settings.json` *(modified, uncommitted)*, `.claude/settings.local.json`, `.claude/launch.json`
- `.cursor/rules/` — 4 `.mdc` files: imports-and-packages, sync-package, web-styles, web-testing
- `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`
- `.codex/config.toml`, `.codex/hooks.json`
- `.agents/skills/` — 9 shared skills (ship, simplify, verify-change, a11y-audit, …)
- `.agents/skills/chaos/agents/openai.yaml` — external-model agent config
- `AGENTS.md`

**Absent:** `.mcp.json` (gitignored and not on disk), `CLAUDE.md`, `.cursorrules`, `.aider.conf.yml`,
`.continue/`, `.github/copilot-instructions.md`, `.roo/`, and — checked explicitly — **no repo-local
`routing-policy.yaml`** at any depth ≤ 3, so the selected shipped policy applies without silent override.

Only delta since baseline: `.claude/settings.local.json` now observed on disk. No new tool onboarded.

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/`. The plugin will never touch
  them, but `web-styles.mdc` and `web-testing.mdc` encode conventions codegen is expected to match.
- **Cursor *and* Codex format-on-edit hooks are active.** AGENTS.md states formatting is handled by
  these repo-local hooks after agent edits. Files this plugin writes may be reformatted out-of-band
  by Biome between write and review — don't read a diff churn as tampering.
- **No custom `.mcp.json`.** It is gitignored and absent locally; no competing MCP servers registered.
- **No repo-local `routing-policy.yaml`.** Nothing silently changes routing.
- **`.sdlc/` is not blanket-gitignored** — but this is now deliberate. Commit `c3c59a36` added only
  targeted rules (`.sdlc/**/_gemini_worker_save/`, `.sdlc/local/debug.log`, `.hook-logs/`) with the
  comment *"keep the reports, drop the worker save-state blobs"*. So `.sdlc/runs/**` — this run's
  packets, `changes.md`, `backups/` — stays untracked but visible to `git add -A`, on purpose.
  Gate 0 does **not** need to offer a blanket rule unless you now want one.
- **The write contract is armed by an uncommitted edit.** See risks.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| `write_contract_uncommitted` | **medium** | The mmo write-contract hook is registered by hand in `.claude/settings.json`, and that edit is uncommitted. The enforcement mechanism for this run lives only in the working tree; a checkout, stash or reset would silently disarm it. Probe with a real Write before trusting it. |
| `aggressive_gitignore` | **medium** | Repo-wide `*.mjs`, `*.log` and `*.env*` globs. Anything the plugin writes into user source matching these is silently untracked. (`*.log` is already why `.sdlc/pre-check/orchestrator.log` is ignored.) |
| `dirty_tree` | low | One tracked modification, `.claude/settings.json` — off-limits for this run, so it won't be clobbered, but rollback won't restore it either. |
| `gitignore_missing_sdlc` | low | `.sdlc/runs/**` untracked but `git add -A`-visible. Deliberate. |
| `external_format_hooks` | low | Cursor/Codex format-after-edit may rewrite plugin output. |
| `runs_dir_empty` | info | `.sdlc/runs/` held **0 files** at discovery. A local `.git/hooks/post-checkout` parks prior runs per-branch. This is local-only state, lost on reclone — do not read the absence of prior run dirs as evidence that no prior runs happened. |
| `branch_mismatch` | info | HEAD is `CMP-102/opus-plus-sonnet`; run slug and session-start branch disagree. Confirm at Gate 0. |
| **Git-LFS** | none | No `.gitattributes` LFS filters. Not in use. |
| **Submodules** | none | No `.gitmodules`. None. |

## Regulated-repo signals

One weak signal: `SECURITY.md` at repo root. No `HIPAA/`, `PCI/`, `SOC2/`, `COMPLIANCE.md`,
`PRIVACY.md`, `GDPR.md`, and no compliance/security/privacy/legal CODEOWNERS entries.

`regulated_repo_warning_required: false` — a stock `SECURITY.md` is standard OSS hygiene, not a
compliance obligation. No Gate 0 warning required.

## Env keys

**None.** No `.env*` files exist on disk. Config is via `compass.yaml` (gitignored) with
`compass.example.yaml` as the tracked template.

Referenced in code (names only, per the privacy hard-line — no values were read):
`API_BASEURL`, `COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`,
`POSTHOG_KEY`, `TZ`.

## Proposed off-limits

```
.git/**            .claude/**         .codex/**          .cursor/**
.agents/**         AGENTS.md          .mcp.json          compass.yaml
.playwright-compass.yaml              *.env*             .env      .env.*
node_modules/**    build/**           buildcache/**
packages/*/build/**                   packages/*/node_modules/**
bun.lock           patches/**         playwright-report/**
test-results/**    blob-report/**     .github/workflows/**
```

Since the intent is `docs`, Gate 0 will likely want the write allowlist scoped to `docs/**` — and
`docs/frontend/` in particular.
