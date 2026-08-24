# Run Summary — 20260822-125447-refactor-week-day-interaction

**Mode:** brownfield · **Intent:** refactor · **Policy:** `flash-agsdk-only` · **Auth:** vendor
**Window:** 2026-08-23T06:14:24Z → 2026-08-23T13:36:56Z
**Status at time of writing:** Gate 3 approved; senior review backfilled; Gate 4 (rev-2) pending.

Unifying the Week and Day interaction adapters behind branded column-key types. Delivered scope is
**FR-1 + FR-2 + FR-5** plus a `.gitignore` fix. FR-3, FR-4 and FR-6 were cut at Gate 2 / mid-execution
by operator decision and belong to a follow-up ticket.

> The 26,551 s wall-clock window is **not** continuous work: the original session ended after the
> security review at 08:51Z, and the run was resumed at 13:15Z to record Gate 3, generate this
> report, and backfill the missing senior review. Actual dispatch time is ~2 h 40 m.

---

## Cost

**Total (vendor-reported): $4.942951** across 30 dispatches, all to `gemini-3.7-flash`
via the `flash-agsdk-worker` adapter.

Tokens: 1,708,008 input · 2,758,963 cached input · 218,566 output.

### By phase

| Phase | Calls | Cost (USD) | Share |
|---|---:|---:|---:|
| codegen | 23 | 3.797879 | 76.8% |
| architecture_design | 2 | 0.454172 | 9.2% |
| tests | 1 | 0.167421 | 3.4% |
| plan_task_packets | 1 | 0.161032 | 3.3% |
| security_review | 1 | 0.138789 | 2.8% |
| senior_code_review | 1 | 0.138204 | 2.8% |
| requirements_analysis | 1 | 0.085454 | 1.7% |
| **Total** | **30** | **4.942951** | **100%** |

### By model

| Model | Calls | Cost (USD) | Input tok | Output tok |
|---|---:|---:|---:|---:|
| gemini-3.7-flash | 30 | 4.942951 | 1,708,008 | 218,566 |

Single-tier run: `flash-agsdk-only` routes every phase — judgment and mechanical alike — to the
Flash agent worker, so there is no premium-tier spend to compare against.

Cost concentration worth noting: **`tp_cg_004` alone cost $0.844018** (17.1% of the run) because the
worker ran the full test suite itself, pulling in 335,297 input tokens. A per-packet "do NOT run
tests / type-check / build / lint" instruction was added immediately afterwards; the remaining
codegen packets averaged ~$0.12 (median $0.1281).

### Known telemetry undercount — the total above is understated

Two codegen packets are recorded with `cost_usd = 0` and 0 tokens:

| Packet | File it wrote | Why the record is zero |
|---|---|---|
| `tp_cg_002` | `packages/web/src/grid/interaction/types/timed-drag.types.ts` | Worker exited 1 on a vendor-side HTTP 429 (`RESOURCE_EXHAUSTED`) followed by a TLS handshake failure against `oauth2.googleapis.com` |
| `tp_cg_019` | `packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts` | Worker exited 1 after repeated HTTP 429 `RESOURCE_EXHAUSTED` from the model provider |

**Both packets had already written their files correctly before the vendor error killed the
session**, and both were verified two ways — by reading the resulting file, and by the delegation
receipt's `files.modified` list. Both are counted as DONE in `state.json`'s `packets_done`.

The work was really performed and really billed by the vendor, but no usage record survived: there
is no `worker-usage-tp_cg_002.json` or `worker-usage-tp_cg_019.json` in `delegation/`, and both
delegation receipts carry `usage: null`. The spend is therefore **unrecoverable, not merely
unrecorded** — it can only be estimated.

Sizing it against peer codegen packets (median $0.1281, mean $0.1809, n=21), the two missing
packets plausibly account for **roughly $0.25–$0.36** of real spend not in the $4.942951 figure —
i.e. the true run cost is likely around **$5.19–$5.30**. That range is an estimate from peer
packets, *not* a vendor-reported number, and is deliberately excluded from `manifest.json`.

`telemetry.jsonl` was left unaltered so it stays a faithful record of what the vendor actually
reported. The discrepancy is disclosed here rather than patched in.

---

## Verification

| Check | Result |
|---|---|
| Type-check | **PASS** — exit 0, three `tsc` passes, TypeScript 7.0.2 |
| Lint | **PASS** — all 24 changed files clean. One pre-existing error remains in `packages/sync` (off-limits, untouched, unrelated) |
| Tests | **2298 pass / 0 fail** across 302 files (`bun run test:web`) — exactly the pre-run baseline, zero regressions |
| Senior code review | **`approve`** — zero refinement packets. See `senior_review.md` |
| Security review | **Safe to merge** — changed-files-only scope per the Intent matrix. See `security_review.md` |

The refactor's central claim is compiler-proven, not assumed: zod 4.4.3 defines `$brand` as a
required unique-symbol property, and the compiler produced exactly the intended error —
`Type string is not assignable to type string & $brand<"DateOnly">` — at the Week call sites into
the `DateColumnKey`-pinned cross-row commit. FR-1's compile-time guarantee is real.

## Files changed

**24 unique paths** — 21 modified under `packages/web`, 2 new type files, plus `.gitignore`.
Net diff on tracked files: +266 / −311 across 22 files; the 2 new files add 131 lines.

All 24 are inside the Gate 0 allowlist. `.claude/settings.json` is also dirty in the working tree
but was **not** touched by this run (it is `off_limits`) — that is a pre-existing local change.

> Note: the security review's change-surface header said "25 files / 23 modified / 277 insertions".
> That count mistakenly included `.claude/settings.json` (+11), which this run never touched. The
> correct run scope is **24 files / 22 modified / +266**, which matches `provenance.json`'s 24
> unique paths and `git diff --stat HEAD`. The senior review was scoped to the corrected 24.

Nothing has been committed. `git HEAD` is unchanged at `4189de13`.

---

## Gaps and deviations

**1. `senior_code_review` was missing — now closed.** The original session never ran it: no
artifact, no packet, no telemetry event, no `phase.start`/`phase.end` pair, and no `phase.skip`
event recording a deliberate skip. Since the Intent matrix does not make this phase skippable for
`refactor`, it was an omission rather than a decision. Raised at Gate 4; the operator answered
*"accept but run senior review first"*. Packet `tp_sr_001` was dispatched on 2026-08-23 at 13:36:56Z
($0.138204) and returned **`verdict: approve` with an empty `refinement_packets` array** — two
INFO-level observations, no defects, nothing blocking. Full document in `senior_review.md`.

**2. Senior review routing deviation (disclosed).** The request was to invoke the `senior-reviewer`
Claude subagent; `tp_sr_001` was instead dispatched to `flash-agsdk-worker` via `execute_with_model`.
Reasons: `flash-agsdk-only` carries an **explicit** rule (`rule_index 3`) mapping
`phase: senior_code_review` to the Flash agent; `auth_mode: vendor` requires every LLM call to be
metered through the MCP server; and all four sibling judgment phases in this run took the same
route, so an Opus subagent would have produced an unmetered call and a manifest row inconsistent
with the rest of the run. **Consequence: this is Flash reviewing Flash-generated code — not an
independent-tier review.** An additive independent pass remains available and is offered at Gate 4.

**3. `test_run` phase not logged.** The full suite was run (2298/0, recorded in `verification_state`)
but no `phase.start`/`phase.end` pair was emitted. Suite runs are Bash rather than model dispatches,
so the absence of a telemetry event is expected; the missing log lines are a logging omission only.
No cost impact.

**4. Scoped formatter deviation (disclosed).** After codegen, `biome format --write` and one
`biome check --write` (organizeImports) were run scoped strictly to files this run had already
written via packets, clearing 5 formatter diffs and 1 import-order issue. Provenance was recorded
before/after and non-import content verified byte-identical. Not packet-originated — the alternative
was ~6 dispatches to reformat whitespace.

**5. Plan deviation (resequencing, deliberate).** The change plan assumed the branding boundary lived
in the two large adapters; the source showed it actually lives in the geometry caches
(`week-layout.cache.ts:55`, `visibleDates: sources.visibleDays`). Branding there is a one-line change
that threads `DateColumnKey` through all of Week **without** touching the 795-line adapter — strictly
better for a no-behavior-change refactor. Geometry was therefore pulled ahead of the adapter packets,
and `tp_cg_012` became unnecessary as a result.

**6. Five plan gaps found during execution.** `tp_cg_004b`, `tp_cg_004c`, `tp_cg_011b`, `tp_cg_016b`
and `tp_cg_016c` were added after allowlist validation to cover files the original plan missed.
`tp_cg_014` was dropped: INV-6 and INV-7 are already covered by existing passing tests
(`day-interaction.adapter.test.ts:444` and `:457`) — the plan's new-assertion claim was wrong.

**7. Ungated worker adapter (accepted risk).** `flash-agsdk-only` routes all work to the
`antigravity-worker` adapter, which is **not** gated by the write-contract PreToolUse hook.
Mitigations held for all 26 dispatches: a per-packet prohibition on git/rm/mv/cleanup, plus
verification after every dispatch against both `git status` and the receipt's
`files.added/modified/removed`. **Zero out-of-scope writes occurred across the entire run**, including
`tp_sr_001`, whose receipt shows `added/modified/removed` all empty across 1588 scanned files.

---

## Artifacts

| Artifact | Path |
|---|---|
| Requirements | [`requirements.md`](./requirements.md) |
| Design / change plan | [`change_plan.md`](./change_plan.md) |
| Senior code review | [`senior_review.md`](./senior_review.md) |
| Security review | [`security_review.md`](./security_review.md) |
| Provenance (revert source of truth) | [`provenance.json`](./provenance.json) |
| Discovery snapshot | [`discovery.md`](./discovery.md) |
| Intent brief | [`intent_brief.md`](./intent_brief.md) |
| Packet plan | [`packets.json`](./packets.json) |
| Cost rollup | [`manifest.json`](./manifest.json) |
| Raw telemetry | [`telemetry.jsonl`](./telemetry.jsonl) |
| Run log | [`orchestrator.log`](./orchestrator.log) |
| Pre-write backups | [`backups/`](./backups/) |
| Delegation receipts | [`delegation/`](./delegation/) |

Deferred to a follow-up ticket: **FR-3, FR-4, FR-6** (packets `tp_cg_012`, `tp_cg_014`,
`tp_cg_020`, `tp_cg_021`, `tp_cg_022` remain in `packets.json`, undispatched).
