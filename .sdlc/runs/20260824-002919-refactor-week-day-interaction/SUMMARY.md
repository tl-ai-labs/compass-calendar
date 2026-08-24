# SUMMARY — CMP-104 under `opus-plus-flash-v37`

**Run** `20260824-002919-refactor-week-day-interaction` · brownfield / refactor
**Branch** `CMP-104/opus-plus-flash-v37` @ anchor `4189de13` · **nothing committed**
**Policy** `opus-plus-flash-v37` · **auth_mode** vendor · **Status** accepted at Gate 4

> **Authorship note.** This file was written by the parent session, not the orchestrator. The
> harness blocks subagents from writing `SUMMARY.md`; the orchestrator returned the final report as
> text and it is reproduced here. Every verification number below was independently re-run by the
> parent session before acceptance — not relayed.

## What shipped

**FR-1** — the grid column key is no longer a bare `string`. It is a type parameter threaded
through the shared visual types *and* the layout cache, instantiated `DateColumnKey` in Week and
`DayColumnKey` in Day, built on the pre-existing `@core` zod brands (`CalendarIdSchema`,
`DateOnlySchema`) so that no unchecked cast helper is needed anywhere in the delta.

**FR-2** — `grid/interaction/commit/cross-row.commit.ts`, which `dayjs`-parses the key at two sites
from the *shared* layer, is pinned to `DateColumnKey`. A Day-produced visual is now rejected with
TS2345 rather than being kept out only by import topology.

Plus four invariant guards (INV-6, INV-9/10, INV-11), the no-default regression proof file, and
`.gitignore` entries for `.sdlc/` and `.hook-logs/`.

**43 files, all inside the Gate-0 allowlist, zero violations. Engine untouched.**

The underlying defect: `dayDate` / `initialDayDate` were semantically overloaded — a `YYYY-MM-DD`
date in Week, a `CalendarId` in Day — so `dayjs(visual.dayDate).diff(...)` on a Day visual produced
`Invalid Date` → `NaN` → silently corrupted event dates, with no compiler help.

## Verification

| Check | Result | Verified by |
|---|---|---|
| `bun run test:web` | **2308 pass / 0 fail across 304 files** (73.67s) | parent session, independently |
| Baseline, measured on this branch pre-edit | 2298 / 0 across 302 | orchestrator |
| Regressions | **0** — the +10 are all new guards (2308 − 10 = 2298) | arithmetic |
| `bun run type-check` | exit 0 | parent session |
| `bun run lint` | exit 0, 10 warnings = tolerated pre-existing count, zero in delta | orchestrator |
| Proof file + 10 `@ts-expect-error` directives | present, 5,025 bytes | parent session |
| Corrected doc comment | guarantee / non-guarantee split present | parent session |
| `packages/web/src/interaction/**` | 0 changes; re-verified by a **denied** probe write | parent session |
| Provenance | 45 entries, all `sha_after`, **0 genuine gaps** | parent session |

The 7 null `sha_before` values are all `existed_before: false` new files — the correct value, not a
hole. `git_head_after == git_head_before`, `commits: []`.

## Scope

| | |
|---|---|
| Delivered | FR-1, FR-2, invariant guards, proof file, `.gitignore` |
| Deferred by human mid-run | FR-3, FR-5, FR-7 — fully specified in `deferred-scope.md` |
| Cut at Gate 2 | FR-4 (adapter runtime merge), FR-6 (coordinator merge) |

Smaller than the prior run's FR-1+FR-2+FR-5. At the FR-1 checkpoint the tree did not compile (53
errors, the expected mid-threading state) and the human chose to stop there and land the type work
as a clean, independently reviewable delta rather than push through the full approved scope. Stated
as fact, not as a shortfall.

**FR-6's cut was a measurement, not caution:** reading both coordinators line by line found the only
genuinely duplicated code is an ~11-line `mapEventsById` helper. **FR-4's cut** rested on 1,402 LOC
where the dominant risks — callback identity and hook ordering — are exactly what the tests do not
assert, so a green suite would not have been evidence of safety.

## Reviews

**Senior — approve-with-comments, no blockers.** 7 findings, 5 actioned: removed a tuple cast this
run had introduced, removed 7 now-redundant `as never` casts (the Day adapter test now has zero
casts), de-vacuumed the INV-6 assertion, corrected a false `toDateColumnKey` comment, recorded the
`.claude/settings.json` hygiene point.

**Security — PASS-with-findings.** Both MEDIUMs found and fixed:

1. **The proof file did not exist** — it was specified in `change_plan.md` §2.2 and in
   `packets.json` as `tp_s1_column_key_proof`, was senior-review finding 7, was not actioned, and
   had been *described as delivered*. Caught only by the security review.
2. **A doc claim was false** — it asserted shared code "cannot parse it without declaring the
   constraint." A branded string is still a string, and a live sink exists at
   `grid/interaction/date.ts` (`getLocalMinutes(date: string | undefined)`). The comment now states
   the real per-site guarantee.

**Security caveats that are NOT passes.** PII, authn/authz, audit-log integrity and headers are
**N/A** — 41 frontend files, no server surface reviewed, no claim made about backend/sync/core. The
production-only dependency subset is **unverified, not clean**: `npm audit --omit=dev` fails
`ENOLOCK` in a bun workspace and `bun audit` ignores `--omit=dev`, reporting 69 vulns (24 high, 37
moderate, 8 low) including the dev/build chain. Manifests are byte-unchanged, so none are introduced
by this delta.

## The two-way probe — a method worth reusing

The proof file was not merely written and asserted to work. The defect was reintroduced twice:

- Probing `= string` → fails at the **declaration site** (TS2344), because `string` does not satisfy
  the constraint. The constraint alone already blocks that edit.
- Probing `= GridColumnKey` — a constraint-**satisfying** default → the entire tree compiles clean
  **except** `column-key.types.test.ts` firing `TS2578: Unused '@ts-expect-error' directive`.

Only the second probe demonstrates the file earns its place; the first would have given false
confidence. Probe reverted, tree re-verified.

## Cost, and what it does and does not support

**Metered: $1.874483** across 18 dispatches (13 succeeded, 4 premium timeouts at $0, 1 Flash retry).

| Phase | Cost | | Model | Cost |
|---|---|---|---|---|
| `change_plan` | $0.998507 | | `claude-opus-5` | **$1.760120 (94%)** |
| `requirements_analysis` | $0.606113 | | `gemini-3.7-flash` | **$0.114363 (6%)** |
| `plan_task_packets` | $0.155500 | | | |
| `codegen` | **$0.112511** | | | |
| `docs` (smoke) | $0.001852 | | | |

**Six unmetered categories:** `change_plan.md` §4–7 (written in-session after the fourth timeout),
the `packets.json` decomposition (logged `provenance: "estimated"` — deliberately *not* stamped
`vendor`, since that would have falsified the comparison this run existed to produce),
annotation-only threading edits across ~10 files, the 10 new assertions including the proof file,
and **both review subagents**. The true total is meaningfully higher and no defensible number can be
put on the subagent share.

**Placeholder rates:** the policy carries `TODO(pricing): confirm Gemini 3.7 Flash rates`, carried
over from gemini-3.5-flash. The prior run used the same placeholder — internally consistent, neither
authoritative against Google's real card.

**Supported by this data:** the mechanical tier is near-free (all codegen = $0.1125) and premium
judgment dominates at 94% of spend. That shape is robust to every caveat above.

**Not supported:** the headline "$1.87 vs $4.94". **The cost axis of this A/B is compromised. The
decision-quality axis is not.**

## Findings about the already-shipped `62162a95` — file separately, not touched

1. **Scoping FR-1 to the visual types alone is impossible, not merely incomplete.** The math layer
   assigns `nextColumn?.date` into `dayDate`, so without threading `layout.cache.ts` the code does
   not build at all.
2. **The no-default choice forced all 27 use sites to declare their key kind.** Every initial error
   was `TS2314`. Under `62162a95`'s `<TColumnKey = string>` those same 27 sites compile green
   meaning `string`. Corollary from the senior review: type-check passing on a no-default parameter
   is *itself* proof that every consumer was found.
3. **A withdrawn claim, recorded for honesty.** This run initially suspected the prior branding was
   unsound for Day's single-column fallback. Inspecting `62162a95` refuted it — handled via a
   documented `DayColumnKey` union. Withdrawn before it reached the human as fact.

## Environment defects — one filing, three dropped-lifecycle classes

1. **Four `claude-cli` 300s timeouts**, zero output, $0 each. Correlate **perfectly** with
   `cache_hit: false`; every cache-hitting dispatch returned (1.7s–283s). Instruction length ruled
   out: a 2.8k-char instruction succeeded, then a 2.4k-char one in the identical shape hung. Points
   at the adapter's prompt-cache path.
2. **A subagent died silently** — the first security reviewer never returned and produced no error;
   relaunched from the parent session, where it completed cleanly.
3. **A completion notification never fired** — the orchestrator sat ~95 minutes with no process
   running while the run appeared active. Diagnosed by filesystem mtimes on the subagent transcript,
   not by the notification system.

**A/B finding that held through codegen:** under this policy a failed dispatch is unambiguously a
**no-op** — verified after every failure. The mechanical tier returns content that the orchestrator
writes through the gated Write/Edit path, so the prior run's `success:false`-but-actually-written
ambiguity is *structurally impossible* when the worker has no shell of its own.

## Process findings about this run

- **A specified artifact was reported as delivered before it existed.** Root cause: packets carrying
  `depends_on` were never swept for completion before the phase was called done. Mechanical fix:
  require an explicit `depends_on` completion sweep before closing any phase.
- **Provenance discipline degraded mid-run, then was repaired.** 23 entries were missing `sha_after`
  and 7 were stale from batching `--before` calls without pairing them. All 45 are now accurate; the
  7 stale ones needed direct recomputation because the helper cannot update a closed before/after
  pair. `written_at` on backfilled entries reflects the backfill, not the original write.
- **Judgment-labelled work was routed to the mechanical tier** (S2). The decision had already been
  made by the premium tier and the residue was transcription against a fixed spec; every output was
  compiler-verified and reviewed. Flagged as a deviation from the plan's own labelling rather than
  left silent.

## Open after this run

1. **The commit decision.** The human elected to commit later. 43 files sit uncommitted in the
   working tree. `.claude/settings.json` was dirty before this run started, was never touched by it,
   and should be committed separately to keep the ticket commit clean and revertable.
2. **A follow-up ticket for FR-3 / FR-5 / FR-7** — fully specified in `deferred-scope.md`. None filed
   by the pipeline.
3. **The `62162a95` findings above** — that branch is pushed and unreviewed, with no PR open.
4. **The three-class environment defect filing.**
