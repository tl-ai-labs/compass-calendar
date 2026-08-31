# Discovery — run 20260830-164154-feature-extend-one-click-join

- **Mode:** refresh → **incremental**
- **Repo:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar`
- **Branch:** `CMP-103/opus-plus-flash-v37-t2`
- **HEAD:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
- **Baseline HEAD:** `4189de1389d8a4644ae20d9c5a907f1d161b5496` (2 commits behind)
- **Intent:** feature-extend — add a one-click join icon to `TimedEventCard` and `AllDayEventCard` for events with a conference link
- **Built at:** 2026-08-30T16:43:51Z (plugin 0.6.0, schema v1)

## Refresh decision

`discovery-refresh.mjs` returned `incremental` — "9 files changed since baseline (2 commits)".

Every one of those 9 files is `.sdlc/` bookkeeping plus `.gitignore`:

```
.gitignore
.sdlc/CLAUDE-SDLC.md          .sdlc/baseline/current.json
.sdlc/baseline/discovery.md   .sdlc/baseline/stack-profile.md
.sdlc/ledger.json             .sdlc/ledger.md
.sdlc/pre-check-status.json   .sdlc/project.json
```

`git diff 4189de1..HEAD -- packages/ e2e/` is **empty**. `manifests_changed: []`, `policy_changed: false`.
Stack manifests were last modified 2026-08-19, well before the baseline was built.

So groups 1 (git), 6 (AI config) and 7 (env) were re-scanned; groups 2, 3, 4, 5, 8, 9 carried forward
verbatim. The cached adaptive stack profile at `.sdlc/baseline/stack-profile.md` (2026-08-26) is reused —
no manifest change and no `full` decision, so no rebuild trigger fired.

The living baseline was updated only in its `git` block and the two gitignore-derived findings.

## Detected stacks

Single language, one runtime: **TypeScript on Bun**.

| Manifest | Stack | Notable |
|---|---|---|
| `package.json` (root) | node-typescript | bun@1.3.14, node engine >=24, TypeScript 7.0.2, Biome, Playwright |
| `packages/web/package.json` | node-typescript | React 18, TanStack Router/Query, Zustand, Zod, Tailwind 4, Testing Library, MSW, `@phosphor-icons/react` |
| `packages/backend/package.json` | node-typescript | Express, SuperTokens, MongoDB |
| `packages/core/package.json` | node-typescript | Zod (shared contracts) |
| `packages/sync/package.json` | node-typescript | googleapis |
| `packages/scripts/package.json` | node-typescript | — |

**Monorepo:** lerna + bun workspaces over `packages/*`. Path aliases `@web/*` → `packages/web/src/*`,
`@core/*` → `packages/core/src/*`.

**Adapter match:** no shipped adapter fits (v1 ships generic/nest/python only). The cached adaptive
stack profile is authoritative for codegen; `generic.md` is the fallback baseline.

## Proposed test command

```
bun test:web
```

Source: `AGENTS.md` §Validation defaults + `package.json#scripts.test:web`.

`AGENTS.md` line 16 is explicit — *"Avoid defaulting to `bun test`; use the focused package test first."*
This intent touches `packages/web` only, so the scoped web suite is correct. `.cursor/rules/web-testing.mdc`
additionally forbids adding `--parallel` to `test:web`.

Alternatives if Gate 0 wants wider coverage: `bun type-check` (the run reads a shared `@core` contract),
`bun lint`, `bun run verify` (diff-aware helper), `bun test` (full, all five packages).

**Baseline test status: unverified.** Tier 1 does not run suites. Phase 7 must capture a pre-change
green/red result before attributing any failure to this run.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| Git-LFS | none | No `.gitattributes` LFS filters. |
| Submodules | none | No `.gitmodules`. |
| Encrypted secrets | none | No `.env*` files at all; no sops/age/git-crypt/vault markers. Runtime config is `compass.yaml` (gitignored) seeded from the tracked `compass.example.yaml`. |
| `.sdlc/` not gitignored | medium | `.gitignore` only carries `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. Everything else under `.sdlc/` — packets, backups, changes.md — is untracked but visible to `git add -A`. Note that on **this** branch `.sdlc/runs/` is *not* ignored (verified with `git check-ignore`), unlike several sibling branches, so a plain `git add .sdlc` will sweep run artifacts in. |
| Aggressive `.gitignore` | medium | Repo-wide `*.mjs`, `*.env*`, `*.log` globs. Harmless for this run (only `.tsx`/`.ts` under `packages/web` are in scope), but any `.mjs` emitted into user source would be silently untracked. |
| External format-on-edit hooks | low | `.cursor/hooks.json`, `.codex/hooks.json` and `.cursor/hooks/format-after-edit.ts` are active. `AGENTS.md` line 17 says formatting is handled by these hooks after agent edits — plugin output may be reformatted by Biome out-of-band between write and verify. |
| Dirty tree | low | `.sdlc/pre-check-status.json` and `.sdlc/project.json` modified; `.sdlc/local/` untracked. **No tracked source file is modified**, so the rollback anchor at `2d81253a` is clean for source purposes. |
| Pre-existing failing tests | unknown | Not measured; see above. |
| Sibling-branch divergence | **medium** | Branch `CMP-105/opus-plus-flash-v37` (commit `649aea0c`, already pushed) added an attendee avatar badge to **these exact two card files**. This branch's HEAD predates it, so that badge is absent here. Both runs add a badge/icon affordance to the same render region of `TimedEventCard.tsx` and `AllDayEventCard.tsx`, and both touch `EventCard.test.tsx`. Expect a merge conflict later. |

## Detected AI / agent setup (competing configs)

Presence only — none of these are parsed or modified.

- `.claude/settings.json`, `.claude/launch.json`
- `.claude/settings.local.json` — **new since the baseline**; gitignored via `**/.claude/settings.local.json`
- `.cursor/rules/` — 4 `.mdc` files: `imports-and-packages`, `sync-package`, `web-styles`, `web-testing`
- `.cursor/hooks.json` + `.cursor/hooks/format-after-edit.ts`
- `.codex/config.toml`, `.codex/hooks.json`
- `.agents/skills/` — 9 shared skills (ship, simplify, verify-change, a11y-audit, …)
- `.agents/skills/chaos/agents/openai.yaml` — external-model agent config
- `AGENTS.md` — repo-wide agent instructions

Absent: `.mcp.json` (gitignored, not on disk), `CLAUDE.md`, `CLAUDE.local.md`, `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`,
and any repo-local `routing-policy.yaml` (searched to depth 3).

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/`. The plugin will never touch them, but `web-styles.mdc`
  and `web-testing.mdc` both glob `packages/web/**/*.{ts,tsx}` — they govern *every file this run edits*.
  Codegen must satisfy them or Cursor will flag the result.
- **Cursor *and* Codex format-on-edit hooks are active.** Files this plugin writes may be reformatted by
  Biome out-of-band. If a verify step compares bytes, expect churn.
- **No custom `.mcp.json`** — no competing MCP servers registered.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies; nothing silently overrides routing.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` will be untracked but visible to `git add -A`.
  Gate 0 can offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.

## Regulated-repo signals

One weak signal: `SECURITY.md` at repo root (a standard OSS vulnerability-disclosure policy, not a
compliance obligation). No HIPAA/PCI/SOC2/GDPR/PRIVACY documents, no `compliance/` or `regulated/`
directories, no security/compliance/legal CODEOWNERS entries.

`regulated_repo_warning_required: false` — no Gate 0 warning needed.

## Files most relevant to this job

The data is already plumbed. `GridEventSchema` (`packages/web/src/common/types/web.event.types.ts:88`)
carries `conference: ConferenceSchema.nullable().optional()`, and `event.view-model.ts:94` maps
`details?.conference` onto it — so `event.conference?.url` is reachable inside both cards with **no
contract or plumbing change**.

`Conference` is `{ url: z.url(), label: string|null }`
(`packages/core/src/types/event-attendance.contracts.ts:31`).

**Primary edits**

- `packages/web/src/grid/components/TimedEventCard.tsx` (368 lines) — render root is a `role="button"`
  div carrying a `biome-ignore lint/a11y/useSemanticElements`; `accessibleLabel` is composed ~line 268.
  A nested interactive element must `stopPropagation()` against the card's own drag/open
  `onMouseDown`/`onKeyDown`.
- `packages/web/src/grid/components/AllDayEventCard.tsx` (228 lines) — same `role="button"` shape;
  its `onMouseDown` already calls `e.stopPropagation()` to protect against the all-day row create handler.
- `packages/web/src/grid/components/EventCard.test.tsx` (575 lines) — the shared test file covering
  both cards; new coverage belongs here.

**Reference / prior art (do not modify)**

- `packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx` — an existing join affordance:
  `window.open(conferenceUrl, "_blank", "noopener,noreferrer")`, label `"Join"`, bound to the `V`
  shortcut, falling back to `"Open"` when there is no conference.
- `packages/web/src/components/Sidebar/UpNextCard/useUpNextEvent.ts:68-71` — the existing
  `conferenceUrl` selector.
- `packages/web/src/grid/components/EventRepeatIcon.tsx` — the closest structural precedent for a new
  in-card icon component.
- `packages/web/src/common/types/web.event.types.ts`, `packages/core/src/types/event-attendance.contracts.ts` —
  read-only contracts.

Icon library: `@phosphor-icons/react ^2.1.7`.

**Open questions for Gate 0**

1. New tab (mirroring `UpNextBanner`'s `noopener,noreferrer`) or in-place navigation?
2. Always visible on conference events, or hover/focus-revealed? Cards go down to `min-h-2.5`, so a
   permanently visible icon may not fit short events.
3. **A11y ruling needed** — a nested `<button>` inside a `role="button"` div is an element-nesting
   problem. Mirror the CMP-105 precedent (fold the affordance into the group-level `aria-label`), or
   introduce a real nested control with `stopPropagation`?
4. Is `bun test:web` sufficient, or add `bun type-check` given the shared `@core` contract read?

## Proposed off-limits

```
.git/**            .claude/**         .codex/**          .cursor/**
.agents/**         AGENTS.md          .mcp.json
compass.yaml       .playwright-compass.yaml
*.env*             .env               .env.*
node_modules/**    build/**           buildcache/**
packages/*/build/**                   packages/*/node_modules/**
bun.lock           patches/**
playwright-report/**   test-results/**   blob-report/**
.github/workflows/**
```

## Bounds

Scan completed well inside the Tier 1 timebox. No non-UTF8 read failures, no sampling fallback needed
(1590 tracked files). No symlinks followed outside the repo root. No env values were read — there are
no `.env*` files, and code-referenced env names were collected by name only.
