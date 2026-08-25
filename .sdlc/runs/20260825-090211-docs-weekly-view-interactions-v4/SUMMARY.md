# Run Summary — `20260825-090211-docs-weekly-view-interactions-v4`

Mode `brownfield` · Intent `docs` · Task type `doc_update` · Policy `opus-plus-sonnet` ·
Auth `estimated` · Branch `CMP-102/opus-plus-sonnet` @ `c3c59a36` · **Nothing committed.**

Ticket CMP-102, fourth run under a different policy each time.

## Outcome

Added one `## Weekly view interactions` section to the root `README.md` — 14 insertions,
0 deletions, placed between `## Features` and `## Tech stack`. No existing line reworded
or reordered.

## Per-phase tokens and cost

Two provenance classes, kept separate on purpose. The Sonnet rows are vendor-metered and
real. The Opus rows are char-count estimates that book `cached = 0`, so they are an upper
bound — the true figure is lower, and this total must not be used to rank policies.

| Phase | Model | Calls | Input | Cached | Output | Cost | Provenance |
|---|---|---|---|---|---|---|---|
| requirements_analysis | claude-opus-5 | 1 | 21,000 | 0 | 3,200 | $0.1850 | estimated |
| architecture_design | — | 1 | 0 | 0 | 0 | $0.0000 | skipped |
| plan_task_packets | claude-opus-5 | 1 | 9,800 | 0 | 2,600 | $0.1140 | estimated |
| docs (dispatch 1, rejected) | claude-sonnet-5 | 1 | 18,903 | 64,302 | 3,849 | $0.1904 | **vendor** |
| docs (dispatch 2, accepted) | claude-sonnet-5 | 1 | 17,605 | 118,099 | 8,053 | $0.2618 | **vendor** |
| execute_packets (validate + integrate) | claude-opus-5 | 1 | 14,500 | 0 | 3,400 | $0.1575 | estimated |
| test_run | — | 1 | 0 | 0 | 0 | $0.0000 | no LLM call |
| senior_code_review | claude-opus-5 | 1 | 82,386 | 0 | 5,700 | $0.5544 | estimated |
| security_review | claude-opus-5 | 1 | 38,409 | 0 | 2,050 | $0.2433 | estimated |
| **TOTAL** | | **9** | **202,603** | **182,401** | **28,852** | **$1.7065** | |

- **Vendor-metered (Sonnet, real): $0.4523**
- **Estimated (Opus, in-session, upper bound): $1.2542**

The two subagent rows split a combined token total the harness reports as one number; the
in/out split is an orchestrator estimate, not a vendor figure.

## Files touched

**User source — one file, as the contract required:**
- `README.md` (tracked, +14/-0)

**Also modified in the working tree, NOT written by this run:**
- `.sdlc/baseline/current.json` — merged by discovery during Gate 0, before the write
  contract was frozen. Tracked, so it shows in `git status`. "Only README.md was written"
  is true of *user source*, not of *tracked files overall*.
- `.claude/settings.json` — already dirty at session start (mtime 2026-08-22), unrelated.

**Run record (untracked, `.sdlc/runs/<run-id>/`):** `requirements.md`, `packets.json`,
`review.json`, `security_review.md`, `SUMMARY.md`, `manifest.json`, `telemetry.jsonl`,
`provenance.json`, `orchestrator.log`, `backups/README.md`.

## What was skipped, and why

| Skipped | Reason |
|---|---|
| Phase 2 `architecture_design` | Intent matrix, `docs` row: SKIP. A README section needs no design artifact. |
| **Gate 2** | Skipped with the phase it gates. |
| Debug packet after `bun lint` failure | The failure is not attributable to this change, and every path implicated is off-limits. Raising a debug packet would have been noise. |
| Third dispatch for the `TAB` / arrow-glyph style fixes | The senior reviewer supplied exact replacement wording; applying it is integration, not generation. Saved a ~$0.26 dispatch and avoided drift. |

## Validation — nothing was tool-validated

`bun lint` exits 1. **Not attributable to this change.** `bunx biome check README.md` reports
`Checked 0 files ... These paths were provided but ignored: README.md`. All 3 errors are
formatter errors on `.sdlc/*.json` plumbing written by Gate 0 discovery; `packages` +
`self-host` alone give 10 pre-existing warnings and 0 errors. The repo has no markdown
linter (no markdownlint, remark, vale; Biome does not lint markdown). Human review at
Gate 4 was the only real gate.

## Corrections made after the first draft landed

Two review findings changed shipped text; both independently re-verified in source:

1. **`SHIFT` + `←` `→` does nothing to a focused *timed* edge.** `event-nudge.util.ts:152`
   returns `null` when `movement.minutes === 0`; timed edges move only on up/down. The first
   draft would have told readers to press dead keys on an ordinary meeting. Rewritten and
   split into two bullets, scoped to all-day.
2. **The calendar stripe is gated on more than one calendar.** `useCalendarLookup.ts:97` —
   `if (!calendarId || lookup.size <= 1) return null`. Single-calendar accounts never see a
   stripe. Bullet now says "When you have more than one calendar".

Also narrowed: the column tint bullet, because only the topmost chip wins a contested
column, so "every column they cross" was not always true.

## Two premises in the brief that the code contradicted

Surfaced at Gate 1, both confirmed by the coordinator, both documented as the code behaves
rather than as the ticket assumed:

- **"per-calendar event colouring" does not exist.** `theme.util.ts` `resolveEventPalette`
  falls back to `EVENT_PALETTES[themeName]` — the theme default — never the calendar color.
- **"multi-day selection in the all-day row" does not exist.** `useAllDayDraftCreation.ts`
  creates a one-day draft (`.add(1, "day")`). CMP-101's `all-day.create.ts` is confirmed
  absent from this branch. Only edge-stretching of an existing event is real.

## Follow-ups (not actioned — all out of scope)

1. **`.sdlc/` hygiene — local only, no exposure.** `.sdlc/pre-check-status.json` (contains
   `<home>`) and `.sdlc/CLAUDE-SDLC.md` (names GCP project `<gcp-project>`)
   became tracked in `c3c59a36`, *"chore(sdlc): track the project-level SDLC layer on main"*
   — a local commit made earlier in this session, outside this run.
   **Nothing is pushed:** `git branch -r --contains c3c59a36` is empty and main is 2 ahead
   of `origin/main`. So there is no public exposure, and the remedy is rewriting two local
   commits — it does **not** require touching `.gitignore`, so the off-limits conflict the
   security reviewer flagged does not apply. Decide before pushing.
2. **PROC-05 — write-contract carve-out is not encoded in the contract.** The
   `security-reviewer` subagent refused to write `security_review.md`, reasoning from
   `.sdlc/local/write-contract.json` that `.sdlc/**` is off-limits while `allowlist` is
   `["README.md"]`. The refusal was wrong: the PreToolUse hook implements a run-record
   carve-out, and writes to `.sdlc/runs/<run-id>/` from the orchestrator and from
   `senior-reviewer` (`review.json`) all succeeded in this same run. The contract JSON does
   not encode the carve-out the hook enforces, so any subagent reading it literally reaches
   the wrong conclusion. **Recurring gap, not a one-off** — fix belongs in the plugin: either
   the contract encodes the carve-out (e.g. an explicit `run_record_path` allowlist entry)
   or the reviewer subagent is told about it. Orchestrator persisted the returned report.
3. **Backup-at-write-time defect — the run's backup is NOT a pre-run snapshot.** `provenance.json`
   records three sequential writes to `README.md`; the backup was skipped on the first and
   overwritten on each later one, so `backups/README.md` holds an **intermediate draft that already
   contains the new section**:

   | packet_id | sha_before | backup_path |
   |---|---|---|
   | `tp_docs_001_r1` | `1ec462bb` — **the true pre-run original** | `null` |
   | `tp_docs_001_refine` | `81582a6d` | `backups/README.md` |
   | `tp_docs_001_style` | `aa22b3ca` | `backups/README.md` (overwrote the above) |

   The backup on disk hashes to `aa22b3ca` — the *third* write's before-state, so it was overwritten
   twice. It is 3,816 bytes against a 2,846-byte original, and differs from the accepted file only in
   bolded vs plain key spans. The one write where a backup mattered recorded `backup_path: null`.

   **The escape hatch still works, but incidentally, not by design.** `commands/revert.md` routes a
   pre-existing, tracked, committed file to `git checkout <baseline-sha> -- <path>`, and
   `git_head_before` is recorded correctly, so the backup is never consulted. **Masked here purely by
   `README.md` being tracked and committed.** Had it been untracked or uncommitted, revert would have
   restored a draft containing the new section — or refused outright, since that doc says not to
   proceed when `backup_path` is null on a backup-dependent case.

   **Fix:** take the backup on the FIRST write to a path within a run, and never overwrite it on later
   writes to that same path in the same run.

4. **README typos, left alone by design** (brief non-goal): `existance` (L15), `absense`
   (L16), "Cool things you can do with in Compass" (L25).
5. **Undocumented Google side effect.** Setting a Compass event color first clears any
   custom Google event label (`google-event-writer.adapter.ts`, preconditioned
   `eventLabelId: ""` patch). Worth a future sentence; out of scope here.
6. **Cross-account gradient not documented.** Real, but omitted — security review confirmed
   the omission is safe.

## Escape hatch

Nothing was committed. To discard this run's only user-source change:

```
git checkout -- README.md
```

Or revert the whole run:

```
/mmo:revert 20260825-090211-docs-weekly-view-interactions-v4
```

**This restores from git, not from the backup** — see follow-up 3. `README.md` is
pre-existing, tracked and committed, so `commands/revert.md` routes it to
`git checkout <baseline-sha> -- README.md` against the recorded
`git_head_before: c3c59a36`. The backup at `backups/README.md` is an intermediate draft
and must not be used to restore this file.
