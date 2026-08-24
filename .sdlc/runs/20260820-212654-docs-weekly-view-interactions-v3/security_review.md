# Security Review — pass2 (brownfield, intent: `docs`)

**Run:** `20260820-212654-docs-weekly-view-interactions-v3`
**Verdict:** **pass-with-notes**

## Scope reviewed

Scope confirmed by `git status --porcelain` + `git diff --stat` and cross-checked against
`.sdlc/runs/20260820-212654-docs-weekly-view-interactions-v3/provenance.json`. All three
sources agree on exactly two files:

| File | Change | Provenance packets |
|---|---|---|
| `README.md` | +8 lines — one `## Weekly view interactions` section (3 blurbs, 2 relative links) | `tp_docs_001`, `tp_docs_003_refine` |
| `.gitignore` | +1 line — `.sdlc/` | `tp_docs_002` |

No application code, dependency manifest, lockfile, CI workflow, or test fixture was touched.
`git ls-files | grep -i sdlc` returns nothing, confirming `.sdlc/` was never tracked.

Read as supporting evidence (not modified): both README link targets, the full `.gitignore`,
`.sdlc/` tree contents including `backups/`, `.sdlc/project.json`, `.sdlc/baseline/discovery.md`,
`.hook-logs/hook.jsonl`.

Per the Intent matrix, `docs` scoping applies: review focuses on secret exposure in prose/examples
and information disclosure. Full authz/PII/audit-log checks are skipped — no runtime behavior changed.

---

## Findings

### F1 — README prose and links contain no sensitive material — **Info** (no action)

The three blurbs (multi-day drag/resize, recurring edit/delete scope, per-event colors) are
purely user-facing feature description. Scanned for and found none of: credentials, tokens, API
keys, internal hostnames, private URLs, customer names, employee names. No authorization boundary,
rate limit, sync-token mechanism, or unreleased feature is described.

The one adjacent-to-security sentence — recurring edits defaulting to a single occurrence with a
toast to widen scope — describes a UX affordance, not a permission model. It is not attack-useful:
it grants an actor nothing they could not discover by opening the event form.

Both added links resolve to regular files (`file` reports `Unicode text, UTF-8`, not symlinks),
both already tracked in git and therefore already public:

- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/docs/frontend/week-drag-interaction.md`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/docs/acceptance/recurring-events.md`

Skimmed both for content the README now points a wider audience toward. `week-drag-interaction.md`
cites internal `packages/web/src/...` paths and drag-geometry internals — but every one of those
source files is already public in this open-source repo, so the doc reveals no non-public structure.
`recurring-events.md` is a manual QA runbook; its "Log in with any account" step is a local-dev
instruction with no embedded credential. Neither is a path that should be withheld from a public
README. **No action required.**

### F2 — `.sdlc/` ignore pattern is unanchored — **Low**

`.sdlc/` has no leading slash, so per gitignore semantics it matches a directory named `.sdlc` at
**any depth**, not just the repo root — e.g. a future `packages/web/.sdlc/` would be silently
ignored too. Today this is harmless (`git status --porcelain --ignored` shows only the root
`.sdlc/` matching, alongside pre-existing `build/` and `.claude/settings.local.json`).

**Verified no regression:** piping every tracked path through
`git ls-files | git check-ignore --stdin --no-index` returns zero matches (exit 1). No
previously-tracked file became ignored, and no legitimately-tracked path is shadowed. Git's
tracked-beats-ignored rule was not relied on — the check confirms the set is genuinely empty.

**Recommendation:** change the entry to `/.sdlc/` to anchor it to the repo root, matching the
intent of "this plugin's bookkeeping directory." Non-blocking.

### F3 — `.sdlc/runs/*/backups/` is now an unreviewed on-disk store — **Low**

The provenance schema records a `backup_path` per edited file; this run created
`.sdlc/runs/20260820-212654-docs-weekly-view-interactions-v3/backups/README.md`. The mechanism
copies **verbatim** whatever file a run edits — so in principle it could hold a copy of a
secret-bearing uncommitted file.

Assessed concretely rather than hypothetically:

- The only backup file anywhere under `.sdlc/` is that one `README.md` (public content).
- No `.env*` file exists anywhere on disk (`find` over the tree, max depth 4, excluding
  `node_modules`, returns nothing). `.sdlc/baseline/current.json` independently records the same:
  config is via `compass.yaml`, which is **absent** from disk and already gitignored.
- Secret-bearing paths are structurally excluded from being edited at all:
  `.sdlc/project.json.off_limits_default` lists `.env`, `.env.*`, `.mcp.json`,
  `.claude/settings.local.json`, and `.sdlc/**`. A file the runner will not edit gets no backup.
- Direct secret scans across all of `.sdlc/` — `(api_key|secret|token|password|credential|bearer|
  authorization)\s*[:=]\s*<value>` and known key prefixes (`sk-`, `ghp_`, `AKIA`, `ya29.`, `eyJ`) —
  returned **zero** hits. The only `.env` mentions are ignore-pattern *names* in config and prior
  review text, not values.

**Net effect of ignoring the directory is positive on this axis:** if a backup ever did capture a
gitignored secret file (say `compass.yaml`), that copy would previously have been stageable by
`git add -A`, silently defeating the very ignore rule protecting the original. `.sdlc/` in
`.gitignore` closes that gitignore-bypass path. The residual risk is only local: such a copy would
sit on disk outside `git status` and outside PR review, and would ride along in any tarball, backup,
or `git add -f`.

**Recommendation:** have the runner refuse to back up any path matching an off-limits or gitignored
pattern, and prune `backups/` on run completion. Track for v1.5; not a blocker.

### F4 — `.gitignore` change reduces disclosure risk (positive) — **Info**

Judged against what `.sdlc/` actually holds today, not what it might hold. Absent this line, a
`git add -A` would have committed to public history:

- `.sdlc/baseline/discovery.md` — enumerates the full stack and dependency versions (bun 1.3.14,
  TypeScript 7.0.2, React 18, Zustand 5, Dexie, TipTap…), the directory topology, all four entry
  points, a 1,582-file tracked count, and the **private remote** `git@github.com:tl-ai-labs/compass-calendar.git`.
- `telemetry.jsonl`, `orchestrator.log`, `packets.json`, `review.json`, `intent_brief.md`,
  `delegation/worker-*` — internal agent prompts, model routing, and run bookkeeping.
- `.sdlc/local/state*.json`, `debug.log`, `write-contract.json` — local machine state.

None of this is secret material, but it is an inventory of the stack and layout with no upstream
value, and a dependency-version list is mildly attack-useful reconnaissance. Ignoring it is the
correct call.

### F5 — `.hook-logs/` left untracked **and** un-ignored — **Low** (advisory)

Same plugin family, adjacent to this change, but strictly speaking outside the two changed files —
recorded as advisory, not gating. `git check-ignore` confirms `.hook-logs/hook.jsonl` is **not**
ignored (the pre-existing `*.log` glob does not cover `.jsonl`), and `git status` shows it as
untracked. It would therefore be swept into a commit by `git add -A`.

Content is currently benign — timestamp, event name, and a payload **byte count** only, with no
payload bodies:

```
{"ts":"2026-08-20T07:43:38Z","event":"mcp_tool_postuse","payload_bytes":3511}
```

**Recommendation:** since this run was already editing `.gitignore` for exactly this class of
artifact, add `.hook-logs/` alongside `/.sdlc/`. Low value, low cost.

---

## Explicit N/A items

- **Supply chain / dependency risk — N/A, confirmed.** No `package.json`, no lockfile
  (`bun.lock`/`package-lock.json`), no `patches/`, and no `.github/workflows/` file appears in the
  diff. `npm audit --omit=dev` is not applicable: intent is `docs`, not `deps`, and the dependency
  graph is byte-for-byte unchanged by this run. Any advisory it surfaced would be pre-existing and
  out of scope per brownfield rules.
- **PII handling (encryption at rest, role-based masking, audit-log ordering) — N/A.** No entity,
  service, controller, serializer, interceptor, or DTO was touched. No `government_id`,
  `bank_account`, or `salary_base` field exists in the changed files.
- **Authn & authz (route guards, `reports_to` checks, JWT secret source, password hashing) — N/A.**
  No route, guard, or auth code in scope. Documentation-only change; zero runtime behavior delta.
- **Audit log integrity (append-only, auditor-read-only, entry fields) — N/A.** No audit-log code
  in scope.
- **Surface & headers (helmet, rate limiting, global error filter) — N/A.** No middleware,
  bootstrap, or filter file in scope.
- **Test-fixture credentials — N/A.** No test file was created or modified by this run.

## Noted (pre-existing, out of scope)

- `.gitignore` carries repo-wide globs `*.mjs` and `*.env*`, flagged `medium` as
  `aggressive_gitignore` in `.sdlc/baseline/discovery.md`. Broad ignores can mask a file a reviewer
  should see. Pre-existing on `main`, untouched by this run, non-gating.
- `docs/frontend/week-drag-interaction.md` and `docs/acceptance/recurring-events.md` were already
  committed and public before this run. This run only added links to them; their content is not a
  finding of this run.

## Required fixes before sign-off

**None.** No Critical, High, or Medium finding was introduced by this run. Nothing blocks Gate 3.

Optional hardening, deferrable:

1. Anchor the pattern as `/.sdlc/` (F2).
2. Add `.hook-logs/` to `.gitignore` while the file is open (F5).
3. Exclude off-limits/gitignored paths from `backups/` and prune on completion (F3, v1.5).
