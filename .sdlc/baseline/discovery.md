# Discovery — project baseline

**Mode:** refresh → `incremental` (refreshed by run `20260829-122202-feature-extend-attendee-avatar-badge`)
**Built:** 2026-08-29T12:25:28Z · **Plugin:** 0.6.0
**Baseline carried from:** 2026-08-20T04:32:08Z @ `4189de1` (2 commits behind)

`discovery-refresh.mjs` returned `incremental`: 9 files changed since the last
baseline, and every one is under `.sdlc/` or is `.gitignore` itself. No stack
manifest changed and no new AI-config files appeared. Groups 1 (git), 6 (AI
config) and 7 (env) were re-scanned along with the gitignore-derived off-limits
list; groups 2–5 and 8 were carried forward after spot-verification (top-level
dirs, entry points and workspace membership all still resolve).

---

## Git state

| Field | Value |
|---|---|
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-105/opus-plus-sonnet` |
| Dirty | no — working tree fully clean |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Tracked files | 1590 |
| Submodules | none |
| Git-LFS | not in use |

> **Note — branch drift.** The session-start snapshot named the branch
> `CMP-105/opus-only-v5`; the actual checked-out branch is
> `CMP-105/opus-plus-sonnet`. Confirm the intended working branch at Gate 0
> before any write lands.

## Detected stacks

Bun-native TypeScript monorepo (`bun@1.3.14`, node engine `>=24`, TypeScript
`7.0.2`), managed as Lerna + Bun workspaces over `packages/*`:

| Package | Root | Frameworks |
|---|---|---|
| `@compass/web` | `packages/web` | React 18, Zustand, TanStack Router, Tiptap, Dexie, Zod, Tailwind 4, Testing Library, MSW |
| `@compass/backend` | `packages/backend` | Express, SuperTokens, MongoDB |
| `@compass/core` | `packages/core` | Zod (shared contracts) |
| `@compass/sync` | `packages/sync` | googleapis |
| `@compass/scripts` | `packages/scripts` | — |

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

**Adapter match:** no shipped adapter fits (v1 ships generic/nest/python only).
The cached adaptive profile at `.sdlc/baseline/stack-profile.md` is reused —
no manifest changed, so it was not rebuilt.

## Test command

**Proposed: `bun test:web`** (source: `package.json#scripts.test:web`, backed by
AGENTS.md's validation defaults, which say explicitly *"Avoid defaulting to
`bun test`; use the focused package test first."*). This intent touches
`packages/web` only.

Alternatives: `bun test` (full), `bun test:core`, `bun type-check`,
`bun run type-check:web-tests`, `bun lint`, `bun run verify` (diff-aware),
`bun test:e2e`.

**Pre-existing suite state — green.** Captured this run:

```
2298 pass · 0 fail · 5775 expect() calls · 302 files · 82.87s · exit 0
```

The suite prints React `act()` warnings from `SettingsModal` and the provider
tree. These are pre-existing stderr noise, **not** failures — do not read their
presence as regression signal.

> `bun lint` also runs `packages/scripts/src/testing/check-semantic-colors.ts`,
> which rejects raw Tailwind palette classes. Any new badge styling must use
> semantic tokens or lint fails.

---

## Detected AI/agent setup

`.claude/settings.json`, `.claude/settings.local.json`, `.cursor/rules/` (4 `.mdc`
files), `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`,
`.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/` (9 skills),
`.agents/skills/chaos/agents/openai.yaml`, `AGENTS.md`.

Absent: `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` (gitignored + not on disk),
`.cursorrules`, `.aider.conf.yml`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`.

**No change since the 2026-08-20 baseline.**

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/`. The
  plugin will never touch them, but `web-styles.mdc` and `web-testing.mdc` both
  glob `packages/web/**` — exactly this run's scope — so they encode the
  conventions codegen must match.
- **Cursor and Codex format-on-edit hooks are active**
  (`.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`).
  AGENTS.md states formatting is handled by these repo-local hooks after agent
  edits. Files this plugin writes may be reformatted out-of-band by Biome.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/` — only
  `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. As of commit
  `2d81253a` the `.sdlc/` tree is *tracked*, and `.sdlc/runs/**` is **not**
  ignored on this branch. Run artifacts (packets, `changes.md`, `backups/<file>`
  echoes of touched source) will be visible to `git add -A`. Gate 0 can offer to
  add `.gitignore` to this run's allowlist if you want the entry added.
- **Aggressive ignore globs.** `.gitignore` carries repo-wide `*.mjs` and
  `*.env*` rules. Verified: `foo.mjs` and `packages/web/src/x.env.ts` both match.
  Any file the plugin emits into user source with those name shapes would be
  silently untracked.
- **No competing MCP servers.** `.mcp.json` is gitignored and absent locally.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.

## Regulated-repo signals

One low-signal hit: `SECURITY.md` at repo root (a standard OSS vulnerability
disclosure policy, not a compliance regime). No HIPAA/PCI/SOC2/GDPR markers, no
`compliance/` or `regulated/` paths, no security/compliance CODEOWNERS entries.
`regulated_repo_warning_required: false` — no Gate 0 warning needed.

## Proposed off-limits

```
.git/**                      .claude/**                 .codex/**
.cursor/**                   .agents/**                 AGENTS.md
.mcp.json                    compass.yaml               .playwright-compass.yaml
*.env*  .env  .env.*         node_modules/**            build/**
buildcache/**                logs/**                    .hook-logs/**
packages/*/build/**          packages/*/node_modules/** bun.lock
patches/**                   playwright-report/**       test-results/**
blob-report/**               .github/workflows/**
```

## Environment keys

No `.env*` files exist on disk — config flows through `compass.yaml` (gitignored)
with `compass.example.yaml` as the tracked template. Env names referenced in
source (names only, never values): `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| `.sdlc/` not ignored | medium | Tracked tree; `git add -A` stages run artifacts incl. source backups |
| Aggressive gitignore | medium | Repo-wide `*.mjs`, `*.env*` |
| External format hooks | low | Cursor/Codex may rewrite plugin output |
| Branch mismatch | low | Snapshot said `opus-only-v5`, actual `opus-plus-sonnet` |
| Git-LFS | none | Not in use |
| Submodules | none | No `.gitmodules` |
| Dirty tree | none | Clean at scan time |
| Failing pre-existing tests | none | `bun test:web` 2298 pass / 0 fail |

---

## Verification log

**2026-08-29 · run `20260829-124312-feature-extend-attendee-avatar-badge` · `cached`**

`discovery-refresh.mjs` returned `cached` (HEAD unchanged at `2d81253a`, 0 commits
behind, no stack-manifest mtime moved). No re-scan. Spot-verified independently:
stacks, all test/lint/type-check scripts, monorepo layout and path aliases,
absence of submodules and Git-LFS, the AI-config inventory (incl. still no
`.mcp.json` and no repo-local `routing-policy.yaml`), the `.gitignore` shape via
`git check-ignore`, and the semantic-color guard. **All unchanged.**

Two metadata fields drifted and were corrected above:

- **Branch** is `CMP-105/opus-plus-flash-v37`, not `CMP-105/opus-plus-sonnet`.
  Sibling branch cut from the same HEAD; identical tree. The earlier
  "branch drift" note (lines 28–30) is superseded — this is the intended branch.
- **Dirty tree**: now dirty, but 100% confined to `.sdlc/` (7 modified plugin
  files + untracked `.sdlc/local/`). No user source modified.

Neither is material to scope, off-limits, or test strategy.
