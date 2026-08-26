# Final Report — refactor — Unify Week/Day interaction layers

**Run:** `20260826-082906-refactor-week-day-interaction`
**Branch:** `CMP-104/opus-plus-sonnet` · **Base:** `2d81253a` · **Commits made:** 0 (working tree only)
**Policy:** `opus-plus-sonnet` · **auth_mode:** `estimated` · **Cost:** **$9.08** of a $50 cap

---

## 1. Verified outcome

| Check | Result |
|---|---|
| `bun test:web` | **2305 pass / 0 fail / 303 files**, exit 0 (baseline 2298 / 0 / 302) |
| `bun type-check` | **exit 0** |
| `bunx biome check packages/` | **0 errors**, 9 pre-existing warnings |
| Scope | every changed path inside the four in-scope trees |
| `useUpdateEvent.ts` | **untouched** — both authz guards intact |

Independently re-run by the senior-reviewer subagent and again by the user at Gate 3. The user's
own line-count measurement differs by glob (13 091 / 7 818 vs 12 985 / 7 712 after shim deletion);
the conclusion is unchanged either way.

---

## 2. What was actually done

Eight stages: **SC** (characterization) → **S0** (shared scaffolding) → **S1** (bindings) →
**S2** (test collapse) → **S3** (adapter types) → **S4** (geometry) → **S5** (commit) →
**S6** (coordinators), plus a Gate-3-directed **shim deletion**.

**Genuinely consolidated**
- One shared `createViewInteractionBindings(viewName)` replaces the per-view registry + selector +
  targeting wiring.
- One `InteractionCommitResult` envelope + `commitWithMapper` replaces eight hand-rolled envelope
  builders, with per-view mappers as the declared extension point.
- One generic `view-adapter.types.ts` replaces two 149-line parallel type files.
- One table-driven targeting test replaces two 92-line copies (8 `it()` cases before and after).
- The **four-shim / 20-alias compatibility layer was deleted** at Gate 3 and all 28 importers
  repointed. 123 lines of shim became 18 lines of per-view bindings.

**Deliberately NOT consolidated** — and this is the load-bearing result. A Week column is a
**date**; a Day column is a **calendar**. Week's all-day drag shifts `startDate`/`endDate` by a day
delta and never touches `calendarId`; Day's rewrites `calendarId` and never touches dates. Week's
timed resize re-maps unconditionally; Day's gates on `hasMoved` and returns `target.event` by
identity. Week has cross-row drag and edge navigation; Day has neither. These are two correct
implementations of two different domain rules, not drift, and unifying them would have been a
behavior regression.

---

## 3. Honest assessment of value

**AC-7 FAILED.** On the criterion's own "four in-scope trees" wording: **12 636 → 12 985, +349**.
Excluding the 322 lines of Gate-2-directed characterization tests: **+27** — break-even, not a
reduction. It passes only on the two-tree sub-measure (−91), which is not what the text asks for.

Per-concern, before the shim deletion:

| Concern | Before | After | Δ |
|---|---|---|---|
| registry | 48 | 136 | **+88** to deduplicate 48 lines |
| adapter types | 298 | 297 | **−1** |
| commit | — | — | **+216** |
| targeting (src + test) | 254 | 161 | **−93** |

The shim deletion recovered 87 lines all-four and 104 two-tree, but did not close the gap.

**What this refactor actually bought:**
1. **Characterization tests over a data-loss path nothing covered before.** Week's cross-row
   same-day drop forces `hasMoved: true`; without that forcing the coordinator reopens the event
   instead of saving the row change. No existing test asserted it. This is the single most
   valuable artifact of the run.
2. Single-point-of-truth type declarations — one 149-line duplicate file eliminated.
3. One 92-line duplicate test eliminated.
4. A named, documented extension point where before there was implicit parallel structure.

**What it did not buy:** a smaller codebase. Roughly all of the two-tree reduction is relocation
into `grid/interaction/**`. The senior reviewer's framing is the correct one and is adopted here.

A further correction for the record: the architect's finding **F4** established that
`createViewInteractionRegistry` and `createGridEventTargeting` **already existed and were already
used by both views at HEAD**. AC-4's "one implementation" was already true for registry and
targeting before this run started. The real duplication was binding boilerplate, not
implementations.

---

## 4. Defects found — for plugin filing

These are written to be filable without re-deriving anything.

### D1 — `WORKER-WRITE-BYPASS` (high)

**Mechanical-tier workers dispatched via `execute_with_model` on the `claude-cli` adapter have
filesystem write access and use it.** Their writes bypass the `PreToolUse` write-contract hook
entirely (it matches only the orchestrator's `Write|Edit`), and they ignore the packet's declared
`artifact_path`.

Evidence:
- `tp_sc_002`'s worker created
  `packages/web/src/views/Day/interaction/adapter/commit-characterization.test.ts` at **09:23Z**,
  before the orchestrator's `write-provenance --before` ran at 09:25Z.
- `tp_sc_001`'s worker created
  `packages/web/src/views/Week/interaction/adapter/interactions/week-commit.characterization.test.ts`
  — **not** its `artifact_path`, which was `adapter/commit-characterization.test.ts`.
- **Non-deterministic.** Both SC packets returned unparsed `raw` markdown *and* wrote files;
  `tp_s2_001` returned clean structured output and wrote nothing. Detection cannot rely on it
  being consistent.

**Collateral:** `write-provenance --before` then recorded the worker's file as pre-existing, with a
backup. Left uncorrected, `/mmo:revert` would have **restored** the worker's file instead of
deleting it.

**Not Antigravity-specific.** The existing note on this gap concerns the Antigravity worker; this
run reproduces it on `claude-cli`.

**Mitigation used:** a pre/post sha manifest plus `find -newer` around the one remaining dispatch.
That detection worked — `tp_s2_001` came back clean.

### D2 — `BUDGET-MAXOUTPUTTOKENS-UNENFORCED` (medium)

`budget.maxOutputTokens` is not enforced on the `claude-cli` adapter.

| Packet | Declared | Returned | `hit_output_cap` | `stop_reason` |
|---|---|---|---|---|
| `tp_sc_001` | 3000 | **17 497** | `false` | `end_turn` |
| `tp_sc_002` | 3000 | **15 344** | `false` | `end_turn` |
| `tp_s2_001` | 3500 | 4 689 | `false` | `end_turn` |

The ceiling-doubling machinery documented in the pipeline skill therefore never engages, and the
budget field is decorative on this adapter.

### D3 — `MECHANICAL-TIER-CACHED-TOKEN-ECONOMICS` (medium, cost-model)

**The "cheap" tier was the most expensive phase in the run.**

| Phase | Model | Events | Cost |
|---|---|---|---|
| **tests** | **claude-sonnet-5** | **3** | **$2.6649** |
| codegen | claude-opus-5 | 7 | $2.4025 |
| change_plan | claude-opus-5 | 2 | $1.3141 |
| senior_code_review | claude-opus-5 | 1 | $0.9700 |
| security_review | claude-opus-5 | 1 | $0.6900 |
| plan_task_packets | claude-opus-5 | 1 | $0.4250 |
| requirements_analysis | claude-opus-5 | 2 | $0.3761 |
| test_run | claude-opus-5 | 1 | $0.2375 |
| **TOTAL** | | **18** | **$9.0801** |

Three test files on Sonnet cost **more** than seven Opus codegen events. Cause: the adapter bills
very large cached-context inputs per call — **1 544 084**, **2 242 907** and **392 112** cached
input tokens respectively. Per-packet: $1.10, $1.22, $0.34.

**Implication for the plugin's core claim.** A mixed policy is only cheaper if the mechanical tier
is actually cheap per packet. On this adapter, delegating a small file costs more than doing it in
the premium tier in-session. Cross-policy cost comparisons that ignore cached-context billing are
not meaningful.

### D4 — `PROVENANCE-MULTI-ROUND-STALE` (medium)

`write-provenance.mjs` cannot record a second edit to the same path. Once a `--before`/`--after`
pair is stamped, re-running `--after` prints `no matching --before record; ignoring` and changes
nothing. Six files drifted (3 from a Biome reformat, 3 from post-hoc fixes).

**Not fixable in place:** the only way to force a fresh `sha_after` is to run `--before` again,
which would overwrite `sha_before` with post-refactor content and break revert. `sha_before`,
`backup_path` and `tracked_in_git` remain correct; only `sha_after` is stale, which makes revert
*more* cautious. True shas in `provenance.reconciliation.json`.

### D5 — `PROVENANCE-MIDRUN-BACKUP` (high, revert correctness)

The same root cause, with a sharper edge. Four shim files have **two** `files_touched` entries:
entry #1 from S1 (correct pre-run `sha_before`, no backup needed — clean and tracked), entry #2
from the Gate-3 deletion, where the files were **dirty** so the helper backed up **the shim
content it had helped create** and recorded it as `sha_before`.

**Verified by sha and line-count comparison against `git show HEAD:<path>`** — the backups are not
merely mislabelled, they hold materially different content:

| Path | HEAD | Backup on disk | Identical? |
|---|---|---|---|
| `week-event.registry.ts` | 24 lines · `sha256:e7e155b1…` | **37 lines** · `sha256:0f1c13cb…` | **NO** |
| `day-event.registry.ts` | 24 lines · `sha256:21139d14…` | **30 lines** · `sha256:3828b9d3…` | **NO** |
| `week-event.targeting.ts` | 35 lines · `sha256:1a84c4ca…` | **30 lines** · `sha256:b6081372…` | **NO** |
| `day-event.targeting.ts` | 35 lines · `sha256:6c9fdb7b…` | **26 lines** · `sha256:8ce77924…` | **NO** |

Every backup imports `*-interaction.bindings`, a module that **did not exist at HEAD** — proof on
its face that the captured content is mid-run, not pre-run.

**Revert rule for these four paths: entry #1 is authoritative; ignore entry #2's `backup_path`.**
Restoring it would resurrect a shim that never existed before this run. Correct revert is from git
HEAD `2d81253a`.

**Mitigation applied at close-out.** Every entry in all five duplicate groups now carries a
machine-readable `on_revert` block, so a tool that naively reads the *last* entry for a path is
told in the data not to use it:

| Group | Entry #1 | Entry #2 |
|---|---|---|
| four shims | `RESTORE_FROM_GIT_HEAD` (`authoritative: true`) | `DO_NOT_RESTORE` |
| `Week/…/commit-characterization.test.ts` | `DELETE` (`existed_before: false`) | `DO_NOT_RESTORE` |

The five misleading backup files are **deliberately retained on disk** as evidence for this bug
report; the annotations exist so that nothing can act on them by mistake.

**This is almost certainly CMP-103's `PROV-1` seen from the other end** — same helper, same
multi-round blindness, same "backup is a mid-run intermediate" symptom. File as one defect.

**Suggested fix:** make `--before` idempotent per path per run. If an entry exists, do not
overwrite `sha_before`/`backup_path`; append to a `rounds[]` list instead.

### D6 — `ORCHESTRATOR-RETROACTIVE-PHASE-LOGGING` (medium, self-reported)

The orchestrator emitted `test_run` `phase.start`/`phase.end` **retroactively in a batch**, after
the suites had already run. The pair spans **61 ms** with no telemetry, so
`orchestrator.log` claims a test phase that took no time and produced nothing. The results were
true — the senior reviewer independently re-ran and confirmed — but the log misrepresented them.

Caught by the senior reviewer, not by the orchestrator. A correction pair bracketing a real 77 s
run has been appended. **Phase markers must be emitted around the work, never after it.**

---

## 5. Open items (not fixed, deliberately)

1. **Production dependency risk is UNMEASURED.** `npm audit --omit=dev` cannot run in this repo —
   `ENOLOCK`, Bun workspace, no `package-lock.json`. The security reviewer's `bun audit --prod`
   fallback **did not respect `--prod`**, so its 24 high findings span dev and backend rather than
   production web. One concrete pre-existing item: transitive **`dompurify@3.3.3`** under root
   `posthog-js@1.409.0` (`bun.lock:1824`); `packages/web` declares a safe direct `^3.4.13` and its
   own `posthog-js@1.413.3` pins `^3.4.12`. **Not fixed — `bun.lock` is off-limits and this is out
   of the ticket's scope.** A clean production audit needs a lockfile strategy decision.
2. **`bun run lint` (repo-wide) fails** on `.sdlc/baseline/current.json` and
   `.sdlc/runs/<rid>/baseline.json`, both discovery-phase artifacts. Verified **already failing at
   HEAD** — pre-existing, not a regression. `packages/` itself is clean.
3. **AC-7 recorded FAILED** on the four-tree measure (+349, or +27 excluding directed tests).

---

## 6. Process notes

- **Auto-mode's Bash-write reroute was declined throughout** (six times). Every file write went
  through `Write`/`Edit` so the `PreToolUse` write-contract hook could gate it; Bash was used only
  for reads, greps, `git mv`/`git rm`, and test runs. Given that this run surfaced two independent
  classes of ungated write (D1, D5), routing the orchestrator's own edits around the hook would
  have removed the last enforcement layer that was working.
- **Two defects were caught by the project's own tooling, not by the orchestrator's judgement:**
  `state.json` was malformed JSON (an object closed with `]`) — caught by Biome; and the Day
  characterization test compared a branded `CalendarId` to a plain string — caught by
  `bun type-check`. The latter vindicates making type-check non-negotiable, and means the earlier
  "SC green on pristine HEAD" claim was true for `bun test` but had not been type-checked at that
  point.
- **Mutation testing was performed twice.** The user proved CT-1 bit the pre-refactor code; the
  orchestrator re-proved both guards against the **refactored** code (removing the `isCrossRow`
  forcing fails CT-1 with `Expected: true, Received: false`; converging Week's resize to Day's
  gated form fails CT-2 on `.not.toBe`). Both restored and sha-verified.
- **Three of the brief's factual claims did not survive contact with the code** and were corrected
  at Gate 1: the commit layer is genuine domain divergence rather than drift; `useUpdateEvent.ts`
  does not consume the commit envelope; and the policy routes refactor codegen to Opus, not Sonnet.
  A fourth (F4) was found by the architect: registry and targeting were already consolidated at
  HEAD.

---

## 7. Recommendation

**Merge.** Behavior is preserved, verified by a full green suite, a clean type-check, a senior
review that checked all 21 invariants by reading code, a security review that confirmed no new
attack surface, and mutation testing of the two highest-risk guards.

**But do not record this as a line-count win.** It is not one. It is a correctness-and-clarity
change that cost ~350 lines across the four trees, bought a real data-loss guard, and removed two
genuine duplicate files. If the ticket's success is judged on AC-7 as written, it failed.
