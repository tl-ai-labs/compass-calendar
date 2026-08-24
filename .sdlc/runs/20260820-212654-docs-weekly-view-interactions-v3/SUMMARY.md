# Run Summary — `20260820-212654-docs-weekly-view-interactions-v3`

**Mode:** brownfield · **Intent:** `docs` · **Policy:** `opus-only-v5` · **Auth:** `estimated`
**Branch:** `CMP-102/opus-only-v5` · **Outcome:** completed · **Duration:** ~30.7 min wall clock

Third and final leg of the CMP-102 policy comparison, after `CMP-102/flash-agsdk-only`
and `CMP-102/opus-plus-flash-v37`.

---

## What shipped

One new **"Weekly view interactions"** section in the root `README.md`, sitting between
`## Features` and `## Tech stack`, covering three end-user behaviors — multi-day select,
recurring events, event colors — in summarize-and-link-out style. Plus a `.sdlc/` entry
appended to `.gitignore`.

| File | Added | Deleted |
|---|---|---|
| `README.md` | 8 | 0 |
| `.gitignore` | 1 | 0 |

Exactly the two paths in the frozen write contract. Zero deletions, zero violations.

---

## Cost

**Total: $1.8341** — 10 telemetry events, 9 LLM calls, 272,225 input / 18,920 output tokens.

| Phase | Events | Input | Output | Cost |
|---|---:|---:|---:|---:|
| requirements_analysis | 1 | 17,725 | 3,000 | $0.1636 |
| architecture_design | 1 | 0 | 0 | $0.0000 |
| plan_task_packets | 1 | 24,000 | 2,400 | $0.1800 |
| docs (2 packets + 1 refinement) | 3 | 85,500 | 1,420 | $0.4630 |
| senior_code_review | 1 | 55,000 | 5,800 | $0.4200 |
| test_run (doc-lint) | 1 | 31,000 | 1,400 | $0.1900 |
| security_review | 1 | 27,000 | 3,100 | $0.2125 |
| generate_final_report | 1 | 32,000 | 1,800 | $0.2050 |

**Provenance caveat — read before comparing against the sibling runs.** `auth_mode=estimated`
means every phase ran on the direct tier *inside* the Claude Code session. Token counts are
`chars/3.8` estimates, not vendor-reported, and `cost_usd` is derived from the `opus-only-v5`
pricing block ($5/MTok in, $25/MTok out). These are single-tier numbers with no mechanical-tier
delegation and no cache reuse (`input_tokens_cached: 0` throughout) — the expected shape for
an all-premium policy, and the baseline the two mixed-policy legs are measured against.

---

## Intent routing actually exercised

| Phase | Matrix cell (docs) | What happened |
|---|---|---|
| requirements_analysis | scoped ("what docs?") | ran, docs-scoped form |
| architecture_design | **SKIP** | skipped; telemetry event `task_type: "skipped"`; **Gate 2 skipped with it** |
| plan_task_packets | `doc_addition` / `doc_update` | 2 `doc_update` packets |
| test_run | doc-lint only | 15 assertions, 0 failures — no test suite run |
| security_review | changed files only | 2 files, no repo-wide audit |

`task_type` was taken verbatim from the brief's `## Task type` heading (`doc_update`) rather
than inferred, per the pipeline skill — including for the `.gitignore` packet.

---

## The correction this run existed to make

The two prior CMP-102 runs shipped a claim that you can drag across empty all-day space to
**create** a multi-day event. That capability does not exist on this branch.

It was blocked at four independent layers rather than trusted once:

1. **Requirements** — FR-2.2 made "must not claim create-by-drag" a hard requirement, with
   acceptance criterion 3 testing for it.
2. **Packet** — `tp_docs_001` carried the negative evidence as an explicit input slice
   (`endDate = dayjs(startDate).add(1, "day")`) with a `reason` naming the regression.
3. **Senior review** — verified against source, not prose: `useAllDayDraftCreation` is a
   mousedown handler computing a fixed single-day draft with no pointer-move span. Confirmed
   absent.
4. **Doc-lint** — automated assertion that no create/draw/paint language appears in the section.

The section anchors entirely on an existing event ("an event doesn't have to stay where you
first put it").

---

## Findings

**Senior review — approved, zero blockers.** 15 claims verified against source. Notably it
confirmed cross-*day* stretching is genuinely all-day-row-specific (`timed.resize.ts` clamps to
`[0, MINUTES_PER_DAY]` and never touches a day index), validating a mid-draft correction.

**Two accuracy corrections applied after the diff preview**, both surfaced by senior review and
approved at Gate 3:

- "as many days as you need" → "several days" — all-day resize skips edge navigation, so one
  gesture spans at most the visible week.
- "Compass asks what you actually meant" → "the change lands on just that occurrence — a toast
  then offers to widen it…" — the real UX is act-then-promote, not an up-front prompt
  (`docs/acceptance/recurring-events.md:28`). The original wording described a dialog the
  product does not show.

**Security review — pass-with-notes.** 0 Critical, 0 High, 0 Medium, 3 Low, 2 Info.

- **F2 (Low)** `.sdlc/` is unanchored; `/.sdlc/` would be tighter. Left as-is — every other
  entry in that `# DIRS #` block (`build/`, `logs/`, `tmp/`) is also unanchored. Verified no
  previously-tracked file became ignored.
- **F3 (Low)** `.sdlc/runs/*/backups/` is now invisible to git. Checked concretely: one
  `README.md` backup, no `.env*` on disk, zero secret-pattern hits across `.sdlc/`.
- **F4 (Info, positive)** Without the ignore line, `git add -A` would have published
  `.sdlc/baseline/discovery.md` — full stack inventory, directory topology, and the private
  remote URL — to a public repo.
- **F5 (Low, pre-existing, out of scope)** `.hook-logs/hook.jsonl` is untracked *and*
  un-ignored (`*.log` doesn't match `.jsonl`), so `git add -A` would commit it. Benign content
  today. **Recommended follow-up.**

**Known nit, requires a requirements change not a doc fix:** the label "Multi-day select"
names a selection gesture the product doesn't have. The body sentence disambiguates
immediately, and FR-1.3 mandates the topic name.

**Process hygiene:** packet `tp_docs_001` cited a stale evidence path
(`packages/web/src/views/Calendar/components/Grid/allDay/…`; the file lives at
`packages/web/src/grid/hooks/`). The evidence content was correct — worth tightening in the
planner's path resolution.

---

## Gates

| Gate | Title | Response |
|---|---|---|
| 0 | Discovery Confirmation | approved (before this run) |
| 1 | Requirements Approval | approved |
| 2 | Architecture Approval | **skipped** — docs intent |
| — | Write-contract diff preview | approved |
| 3 | Security Review | approved |
| 4 | Final Acceptance | pending |

---

## Artifacts

All under `.sdlc/runs/20260820-212654-docs-weekly-view-interactions-v3/`:

`intent_brief.md` · `baseline.json` · `discovery.md` · `requirements.md` · `packets.json` ·
`review.json` · `security_review.md` · `provenance.json` · `telemetry.jsonl` ·
`manifest.json` · `SUMMARY.md`

Both writes are recorded in `provenance.json` with a pre-write backup, so
`/mmo:revert 20260820-212654-docs-weekly-view-interactions-v3` restores the pre-run state.
No commits were made during the run.
