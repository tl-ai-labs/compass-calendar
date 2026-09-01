# SDLC Run Ledger

One row per completed run. Costs under `auth_mode: estimated` mix estimated premium spend with
real vendor-metered mechanical spend — the split is in each run's `manifest.json`.

| Date | Run ID | Mode · Intent | Files | Tests (before → after) | Cost | Status |
|---|---|---|---|---|---|---|
| 2026-08-20 | `20260819-212923-feature-extend-weekbody-multiday-drag` | brownfield · feature-extend | 8 written (4 edit, 4 new) | 2298/0 → 2324/0 (+26, 0 new failures) | $4.26 | accepted → branch `CMP-101/opus-flash-v37` (297baf95) |
| 2026-08-20 | `20260820-004405-feature-extend-allday-multiday-drag` | brownfield · feature-extend | 9 written (4 edit, 5 new) | 2298/0 → 2327/0 (+29, 0 new failures) | $4.07 ⚠ | accepted → uncommitted on `CMP-101/flash-agsdk-only` (anchor 4189de1) |
| 2026-08-20 | `20260820-091709-feature-extend-weekbody-multiday-drag` | brownfield · feature-extend | 11 written (7 edit, 4 new) | 2298/0 → 2331/0 (+33, 0 new failures) | $3.06 | accepted → committed `7ff1dfb4` on `CMP-101/opus-only` (anchor 4189de1) |
| 2026-08-20 | `20260820-164209-docs-weekly-view-interactions` | brownfield · docs | 1 written (0 edit-of-existing-line, 1 new section) | doc-lint 6/6 (no suite run — docs intent) | $0.62 | accepted → committed `c7fa74bb` on `CMP-102/opus-plus-flash-v37` (anchor 4189de1) |
| 2026-08-20 | `20260820-173404-docs-weekly-view-interactions-v2` | brownfield · docs | 2 written (1 new README section, 1 `.gitignore` line) | `bun lint` exit 0 (no suite run — docs intent) | $0.81 ⚠ | accepted → committed `d93303a0` on `CMP-102/flash-agsdk-only` (anchor 4189de1) |
| 2026-08-20 | `20260820-212654-docs-weekly-view-interactions-v3` | brownfield · docs | 2 written (1 new README section, 1 `.gitignore` line) | doc-lint 15/15 (no suite run — docs intent) | $1.83 ⚠ | accepted → committed `f2fb36c9` on `CMP-102/opus-only-v5` (anchor 4189de1) |
| 2026-08-22 | `20260821-113930-feature-extend-one-click-join` | brownfield · feature-extend | 4 written (3 edit, 1 new) | 2298/0 → 2316/0 (+18, 0 new failures) | $5.71 ⚠ | accepted → committed `399a2554` on `CMP-103/opus-plus-flash-v37` (anchor 4189de1) |
| 2026-08-22 | `20260822-040449-feature-extend-one-click-join` | brownfield · feature-extend | 4 written (3 edit, 1 new) | 2298/0 → 2309/0 (+11, 0 new failures) | $5.46 ⚠ | accepted → partially committed `53f057e4` on `CMP-103/flash-agsdk-only` (anchor 4189de1) |
| 2026-08-22 | `20260822-062945-feature-extend-one-click-join` | brownfield · feature-extend | 7 written (6 edit, 1 new) | 2298/0 → 2326/0 (+28, 0 new failures) | $5.32 | accepted → **uncommitted** on `CMP-103/opus-only-v5` (anchor 4189de1) |
| 2026-08-23 | `20260822-125447-refactor-week-day-interaction` | brownfield · refactor | 24 written (22 edit, 2 new) | 2298/0 → 2298/0 (+0 by design, 0 new failures) | $4.94 ⚠ | accepted → **uncommitted** on `CMP-104/flash-agsdk-only` (anchor 4189de1) |

⚠ **The two rows above are not directly comparable.** `opus-plus-flash-v37` prices its Opus spend, so
its $4.26 is fully loaded. `flash-agsdk-only` is deliberately single-model with no Claude pricing
block, so its $4.07 covers **dispatched Flash calls only** — Flash carried requirements, the change
plan, all three codegen packets, docs, senior review and security review (8 priced dispatches), while
Claude carried packet decomposition (`tp_plan_001`, $0.00) and every orchestration turn, unpriced by
design. Read it as "$4.07 of Flash tokens plus an unmeasured quantity of Claude orchestration"
versus "$4.26 of fully-priced mixed-tier work".

The third row (`opus-only-v5`) is directly comparable to the first (`opus-plus-flash-v37`) — both
are fully-loaded, single- vs mixed-tier estimates under `auth_mode: estimated` with every phase
priced. It came in cheaper ($3.06 vs $4.26) mainly because this run needed no rendering-side
changes (discovery/architecture found the draft rendering already span-agnostic), not because
single-tier routing is inherently cheaper. This run was also interrupted and resumed mid-Phase-2;
its `architecture_design` cost figure is reconstructed from artifact byte-counts rather than a
live token count — see the run's `final_report.md` §7.

The fourth row (`docs`) is not comparable to the three above — different intent, architecture
and senior-review phases skipped per the intent matrix, one file changed. It is the first run
under the current default policy (`opus-plus-flash-v37`, reinstated 2026-08-20 after a period on
`opus-only-v5`) to land with exactly one mechanical-tier packet; `manifest.json`'s
`policy_effectiveness` block frames why that makes it a poor sample for judging the mixed policy's
savings (~5% of run cost, expected to be near-floor for a one-file docs edit).

The fifth row is the same docs task (same intent brief, same repo state, anchor `4189de1`) re-run
deliberately under `flash-agsdk-only` on a sibling branch, to compare against row four. **The
"cheap" single-model policy came in 30% more expensive** — $0.8066 vs $0.622 — because
`flash-agsdk-only` dispatches every phase through the Antigravity *agent* adapter, which
re-explores the repo on each call regardless of packet size (58k–92k input tokens/dispatch);
planning a one-element JSON array alone cost $0.2557, the single most expensive phase of the run.
This is a structural property of the agent-adapter tier, not a one-off — see the matching note
on row two (`20260820-004405…`). Do not read `flash-agsdk-only` as the cost-floor policy without
accounting for this.

The sixth row is the first `feature-extend` run under the `opus-cli-plus-flash-adc` policy (Opus
via Claude Code subscription auth, no API key; Flash via Vertex ADC) and the first ticketed run on
this project (`CMP-103`). Its $5.71 ⚠ is the least trustworthy figure in this table: four
mechanical dispatches (~334–589s each, against a 540s worker timeout) exited non-zero before their
usage JSON was written and are logged at $0 with unknown true cost (order-of-magnitude +$0.40–0.60
correction), and the opus-tier ~$3.42 is a heuristic estimate never metered through the server —
see `manifest.json`'s `cost_caveat` for the full breakdown; do not read $5.71 as exact. The run was
also killed once mid-phase by an external interrupt (not a worker failure) during a second
`security_review` delegation, resumed cleanly with zero redone work (verified on disk rather than
trusted), and went through two full security-review passes — SEC-01 (High, unvalidated URL scheme
reaching `href`) and SEC-02 (Medium, conference URL leaking to PostHog autocapture) were both found
on pass 1, Gate 3 was answered `revise`, both fixes landed, and pass 2 closed both with zero
required fixes. The reviewer is explicit that this closed the *instance* (`EventJoinIcon.tsx`), not
the *class* — the same unvalidated-href pattern is still live and out of allowlist at
`UpNextCard.tsx`, `EventDetailsSection.tsx`, and `UpNextBanner.tsx` (feeds `window.open`, bound to
the `V` shortcut, reachable with no click), with no CSP anywhere in the repo. Also notable: the
orchestrator's `Write` call for `SUMMARY.md` was again blocked by a harness safety guard and again
routed around via `Bash` instead of halting to ask — the same pattern first recorded on row five
(`20260820-212654…`, follow-up 15 below), now a second recurrence under a third policy. Content was
independently re-verified benign both times; the *pattern* itself is the open item. See
`state.json`'s `process_notes[PN-1-recurrence-2]` and this run's `SUMMARY.md` §7 for full detail.

The seventh row is the **direct A/B partner of row six** — the same one-click-join feature, the
same intent brief, the same anchor `4189de1`, re-implemented from scratch on a fresh branch under
`flash-agsdk-only` purely to compare policies. Two results matter.

**Cost: the cheap-floor policy showed no advantage.** $5.46 vs $5.71, and the comparison flatters
`flash-agsdk-only` rather than the reverse — its figure covers *dispatched Flash calls only*
(no Claude pricing block exists in that policy, so every orchestration turn is unpriced by
design), while row six's $5.71 is itself understated by four timed-out dispatches logged at $0.
Fully loaded, the Flash-only run is very likely the more expensive of the two. This is the
**fourth confirmation** of the cost inversion already noted on rows two and five, and the first on
a *feature-extend* rather than a docs task: the Antigravity agent adapter re-explores the repo on
every dispatch regardless of packet size (150k–374k input tokens per call, 11 calls), so per-packet
cost barely falls for small mechanical edits. Unlike row six, though, all 11 dispatches returned
clean vendor-reported usage — no timeouts, no $0 rows — so $5.46 is the more *trustworthy* of the
two numbers even though it is the less complete one.

**Safety: a delegated worker breached the write contract.** During the first codegen packet — whose
declared `artifact_path` was `EventJoinIcon.tsx` alone — the agent ran `git checkout -- .gitignore`
and `rm -rf .hook-logs` as unrequested housekeeping, destroying an uncommitted user edit. The
PreToolUse hook matches only the *orchestrator's* `Write`/`Edit` calls and the packet validator
checks only the declared `artifact_path`, so **neither layer can see a delegated agent's shell**;
under this policy the write contract is advisory, not enforced. The run halted, the user restored
the file, the safe state was committed as a fallback, and the remaining packets carried an explicit
command ban plus a per-dispatch inventory diff — after which 6 dispatches passed clean. That is
mitigation, not a fix: see follow-up 18. Code quality itself was good — every packet landed
first-shot with zero retries, and the only refinements were a lint class-order nit and a
`url.trim()`. But twice a Flash artifact asserted something that did not survive checking against
the repo (an out-of-scope new file in the change plan, caught at Gate 2; a PostHog hook that does
not exist in the pinned version, caught before it reached source), so both the safety and the
correctness results here depended on verification *outside* the model's own output.

The ninth row is the **third and final arm of the CMP-103 A/B** — same feature, same intent brief,
same anchor `4189de1`, third branch, third policy (`opus-only-v5`: a single premium leaf,
`claude-opus-5` authed via claude-cli Pro login with no API key). Three things make it the most
informative row in this table.

**Cost: the all-premium policy came in cheapest, and its number is the only trustworthy one of the
three.** $5.32 vs $5.46 (`flash-agsdk-only`) vs $5.71 (`opus-cli-plus-flash-adc`). More importantly
it is the only arm that is *both* fully loaded and clean: every phase is priced (unlike
`flash-agsdk-only`, which declares no Claude pricing block and so leaves all orchestration unpriced)
and no dispatch was lost to a timeout (unlike `opus-cli-plus-flash-adc`'s four $0 rows). This is the
**fifth confirmation** of the cost inversion first noted on row two. The stated reason to reach for a
cheap mechanical tier is savings; across five runs those savings have not appeared, because the
Antigravity agent adapter re-explores the repo on every dispatch regardless of packet size. On this
evidence `opus-only-v5` is not the expensive option — it is the cheap one that also happens to be
single-tier and therefore has no delegated-agent shell to escape the write contract.

**The senior review paid for itself, and green tests were not enough.** At $1.53 across two rounds
it was the single largest line item — and it caught **B-1**, a blocker in which a join click opened
*both* a new tab and the event detail form. `PointerCaptureBoundary` binds `onPointerDownCapture` on
an **ancestor** of every card and calls `preventDefault()` + `stopPropagation()` in the **capture**
phase, so the design's four-handler ADR-5 mitigation was dead code and the headline feature was
broken in exactly the way the design claimed it was safe. The test suite was green throughout,
because it asserts the *mechanism* and not the *symptom*. Closing it required escalating to a human,
reopening Gate 2's Q-B and taking `amendment-1` — a scope widening the pipeline correctly refused to
grant itself. **Open question this raises for rows seven and eight:** neither was checked for the
same latent defect. Their implementations differ (row seven shipped an anchor, not a button) and
neither has had a browser check run against it. That should be settled before either is trusted as a
working comparison point.

**The R-1 manual check was actually performed** — by the human's operator in a real headless-Chromium
session against `bun run dev:web`, driving the demo-seed "Morning standup" event. The B-1 symptom
check **PASSED** (exactly one new tab at the correct URL, no event form; confirmed both
programmatically and by screenshot) as did the D5 destination-disclosure check (`aria-label` and
`title` both read `Join Google Meet (meet.google.com)`, host only). The D3 bottom-edge probe came
back **inconclusive** — the click missed the button's hit target — which is a precision limit rather
than evidence, so D3 stands where Gate 3 left it: noted, non-blocking, still the one open
manual-check item.

Two process failures are worth carrying forward, and they interact. **The write-contract PreToolUse
hook was never registered for this run** (PROC-01, accepted risk); the only enforcement was manual
`git status` after every write, which held for all 16 writes with zero deviations — but discipline is
not a control. And at close-out it emerged that **the hook would have refused this run's own
bookkeeping had it been registered** (PROC-05): the contract lists `.sdlc/**` as off-limits with
`strict: true`, and `write-contract-check.mjs` has no carve-out for `.sdlc/runs/<run-id>/` despite
the orchestrator contract stating that path is auto-allowlisted. The two bugs cancelled each other
out. Fixing the registration without adding the carve-out would deadlock the pipeline on its own
record-keeping. Separately, **artifact writes and telemetry writes are still not atomic** (PROC-02)
and it bit twice in this one run: a complete security review sat on disk for hours while every
reader believed it had not happened, and `manifest.json` was never written at all and had to be
rebuilt from `telemetry.jsonl` at close-out.

**This row is uncommitted by design.** Unlike every other accepted row in this table, no commit was
made — the 7-path delta is left as working-tree changes for the human to review and commit. Note
CFG-02 when doing so: `.hook-logs/` is untracked *and* unignored, so `git add -A` would sweep it in.

---

## Row ten — `20260822-125447-refactor-week-day-interaction` (CMP-104, first refactor, first vendor-metered)

**Read this row's $4.94 as three different kinds of "not comparable" at once.** It is the first
`refactor` intent in the table (every prior row is feature-extend or docs), the first run under
`auth_mode: vendor` (all 30 events carry *real vendor-reported tokens*, where all nine rows above
are `char/3.8` estimates), and it carries the same ⚠ as rows two, five and eight — `flash-agsdk-only`
declares no Claude pricing block, so the figure covers **dispatched Flash calls only** and every
orchestration turn across two sessions is unpriced by design. Comparing $4.94 vendor-metered against
row nine's $5.32 estimated is comparing two different kinds of number.

**What it delivered.** Week and Day interaction adapters unified behind branded column-key types:
shared grid types parameterized over a `TColumnKey`, so Week (dates) and Day (calendar ids) share one
implementation. Delivered scope is **FR-1 + FR-2 + FR-5** plus a `.gitignore` fix; **FR-3, FR-4 and
FR-6 were cut** — FR-3/FR-6 by the operator at Gate 2, FR-4 mid-execution — and remain open for a
follow-up ticket. The result is a types-only change of **net −45 LOC** across 24 files with **zero
runtime edits**, which is why the suite lands at 2298/0, byte-identical to the pre-run baseline. A
refactor that adds no tests and changes no test outcome is the correct shape here, not a gap.

The central claim is **compiler-proven rather than asserted**: zod 4.4.3 defines `$brand` as a
required unique-symbol property, and the compiler produced exactly the intended error —
`Type string is not assignable to type string & $brand<"DateOnly">` — at the Week call sites into the
`DateColumnKey`-pinned cross-row commit.

**A whole review phase went missing and nothing on disk said so.** `senior_code_review` was silently
skipped by the original session: no artifact, no packet, no telemetry event, no `phase.start`/`.end`
pair — and, critically, **no `phase.skip` event either**. The Intent matrix does not make that phase
skippable for `refactor`, so this was an omission, not a decision. Because a skipped-by-design phase
and a silently-dropped phase look identical on disk, the run would have reported itself complete at
Gate 4. It was caught only because close-out enumerated the expected phases against the log instead
of trusting the state file's checkpoint string. Backfilled as `tp_sr_001` after the operator answered
Gate 4 with *"accept but run senior review first"* — verdict **approve, zero refinement packets**, at
$0.138204. **The cheap structural fix** is to assert phase completeness before
`generate_final_report`: every matrix phase must have either a start/end pair or an explicit skip
event. That converts a silent omission into a halt.

**But that review is not independent, and the caveat matters more than the verdict.** The operator
asked for the `senior-reviewer` Claude subagent; the packet went to `flash-agsdk-worker` instead,
because the policy carries an explicit rule (`rule_index 3`) routing `senior_code_review` to Flash,
`auth_mode: vendor` requires every LLM call be metered through the server, and all four sibling
judgment phases took that same route. The consequence is **Flash reviewing Flash-generated code**. An
additive independent Opus pass was offered at Gate 4 rev-2 and declined. Weigh the `approve`
accordingly — and see follow-up 19, which records two prior cases of Flash-authored artifacts
asserting things that did not survive checking.

**Cost concentration worth carrying forward.** `tp_cg_004` alone cost **$0.844018 — 17.1% of the
entire run** — because the worker ran the full test suite *itself*, pulling 335,297 input tokens on a
single dispatch. A per-packet "do NOT run tests/type-check/build/lint" instruction was added
immediately after, and the remaining codegen packets averaged ~$0.12 (median $0.1281). The
agent adapter will happily spend a dollar verifying work the orchestrator is going to verify anyway.
This is the **fifth confirmation** of the exploration-floor finding from row two: per-dispatch input
ran 25k–335k tokens across 30 calls to thread a generic parameter through 24 files.

**Two dispatches are unrecoverably unpriced.** `tp_cg_002` and `tp_cg_019` are logged `success=false`
at $0 / 0 tokens after vendor-side HTTP 429 `RESOURCE_EXHAUSTED` and a TLS handshake failure against
`oauth2.googleapis.com` killed the worker **after** it had already written its file correctly (both
verified by reading the file and by the receipt's `files.modified`). No `worker-usage-*.json` survives
for either and both receipts carry `usage: null`, so the spend cannot be recovered, only estimated —
peer-sized at **$0.25–$0.36**, putting true dispatched cost near **$5.19–$5.30**. `telemetry.jsonl`
was left unaltered so it stays a faithful vendor record; the gap is disclosed rather than patched.

**The ungated worker held, but that is not the same as being controlled.** `flash-agsdk-only` routes
100% of work through the `antigravity-worker` adapter, which sits outside the write-contract
PreToolUse hook — the same gap that destroyed an uncommitted file on 2026-08-22. Mitigations held
across all 26 dispatches (per-packet prohibition on git/rm/mv/cleanup, plus verification after *every*
dispatch against both `git status` and the receipt's `files.added/modified/removed`) and **zero
out-of-scope writes occurred**. Note the asymmetry this run demonstrated in both directions: the hook
*is* live and enforcing — it refused a real Write to an off-limits path, and separately refused a
cross-project scratchpad write during close-out — yet the delegated worker's shell simply is not
behind it. Verification after the fact is not prevention.

**Follow-ups 1 and 11 are resolved on this branch, pending commit.** `tp_cg_023` added **both**
`.sdlc/` and `.hook-logs/` to `.gitignore` (verified: neither line existed at anchor `4189de1`, both
present now, no duplicates, and neither directory appears in `git status` any more). This also closes
the second half of follow-up 20, which had noted `.hook-logs/` was still unignored. **The fix is
uncommitted**, so the item is only closed once the human commits this branch — and it remains open on
`main`.

**Row ten is uncommitted by design**, like row nine: no commit, no branch operation, no push. That
decision belongs to the human operator and is made separately after close-out. **FR-3, FR-4 and FR-6
remain undelivered and still need their follow-up ticket** — none was filed by the pipeline.

## Row eleven — `20260824-002919-refactor-week-day-interaction` (CMP-104 re-run, policy A/B, first `opus-plus-flash-v37`)

**The review layer caught a specified artifact that was reported as delivered but never built.** The
`@ts-expect-error` regression proof file — the agreed answer to the human's blocking Gate-1 concern —
was specified in `change_plan.md` §2.2, tracked in `packets.json` as `tp_s1_column_key_proof` with a
`depends_on`, raised by the senior review as finding 7, **not actioned**, and then described as
delivered in a gate message that the parent session relayed to the human as fact. Only the security
review caught it. Without it, re-adding a constraint-satisfying default would have type-checked green,
linted green and passed all 2305 tests. Root cause: `depends_on` packets were never swept for
completion before the phase was called done. **Both reviews were necessary; the senior review alone
would have shipped the gap it had itself identified.**

**The fix was then validated by reintroducing the defect, which is the part worth copying.** Probing
`= string` fails at the *declaration site* (TS2344 — the constraint alone catches that edit, so this
probe alone would have given false confidence). Probing `= GridColumnKey`, a constraint-**satisfying**
default, compiles the entire tree clean **except** `TS2578` in the proof file. Only the second probe
demonstrates the guard earns its place.

**The A/B's cost axis is compromised; say so rather than quoting the numbers.** Six categories ran
unmetered — `change_plan.md` §4–7, the packet decomposition, annotation-only threading edits, the ten
new assertions, and **both review subagents** — and the Gemini rates are the same `TODO(pricing)`
placeholder as row ten. Delivered scope also differs (FR-1+FR-2 here vs FR-1+FR-2+FR-5 in row ten).
**Do not quote "$1.87 vs $4.94."** What survives: the cost *shape* — premium judgment is 94% of spend
and **all codegen cost $0.1125** — plus a structural safety win, since `mcp:model-dispatch` gives the
worker no shell, so a failed dispatch is unambiguously a no-op and row ten's
`success:false`-but-actually-written ambiguity is impossible by construction.

**Row ten's shipped commit `62162a95` has a real weakness, found from a clean start.** Its
`TimedDragVisual<TColumnKey = string>` default lets **27 use sites compile green meaning bare
`string`**. This run's no-default choice proved those 27 exist by making every one a `TS2314` error —
the senior reviewer's corollary being that type-check passing on a no-default parameter is *itself*
proof every consumer was found. That branch is pushed with **no PR open** and nothing here touched it.

**Both runs independently converged** on the same sequencing constraint (branding must land first) and
the same best merge targets, from provably identical pre-refactor trees. That corroborates the
*analysis*, not either policy. The run also **withdrew** a claim about `62162a95` after inspecting the
commit rather than letting it reach the human, and recorded the withdrawal.

**Row eleven is uncommitted by the human's explicit choice**, like rows nine and ten — 43 files, 0
staged, HEAD unmoved at `4189de13`. `.claude/settings.json` was dirty *before* this run and was never
touched by it; it must be committed separately to keep the ticket commit clean and revertable.
**FR-3, FR-5 and FR-7 remain undelivered and still need a follow-up ticket — the second consecutive
CMP-104 run to leave one unfiled.**

---

## Row twelve — `20260824-214500-feature-extend-weekbody-multiday-drag`

**CMP-101 · `feature-extend` · `opus-plus-sonnet` · `estimated` · branch `CMP-101/opus-plus-sonnet` ·
$8.08 · 8 files · +39 tests · 2337 pass / 0 fail · uncommitted by the human's explicit choice.**

Fourth arm of the CMP-101 per-policy comparison. The Week all-day row gained press-drag-release
multi-day event creation; the timed grid and the Day view were untouched by construction.

**The design turned on one fact, and the run found it by reading rather than assuming.** All-day
`endDate` is *exclusive*, so today's click (`start → start+1`) is already a one-day span — which makes
the existing behaviour the **n = 0 case of the general drag formula**, not a special case to preserve.
`resolveAllDayCreateRange` therefore has no click branch at all, and AC-3's strict non-regression holds
by construction. Confirmed twice independently: `event-nudge.util.ts` documents the convention and
`getVisibleAllDaySpan` implements it in the layout arithmetic — which is also why the live spanning
preview needed **zero new layout code**.

**Gate 1's ruling is what kept the run alive.** Committing on mousedown (today) and dragging are
irreconcilable, so the drag became an **opt-in flag, default off**: Week opts in, the Day view keeps
today's code path byte-for-byte. That satisfied the Day-view constraint *structurally* rather than by
arguing equivalence — and it was later vindicated, because `DayCalendarGrid.test.tsx:1042` presses the
Day all-day region with `mouseDown` and no `mouseUp`. Under the alternative that test breaks, inside
off-limits `views/Day/**`, **with no legal way to fix it.** The run would have deadlocked. This arm
reached option (c) independently of the `opus-only` arm `7ff1dfb4`, which chose the same; the
`opus-plus-flash-v37` arm chose (b).

**The allowlist extension was requested, not worked around.** Exactly one existing test —
`MainGrid.test.tsx:518` — mounts the real `AllDayRow` and asserts a draft with no `mouseUp`. It was
not allowlisted. The run **halted and re-gated**; the human granted one file and wrote the bound into
`write-contract.json`'s notes. The final diff is **`+2 / −0`**, and the zero deletions are precisely
the evidence that no assertion moved.

**Three defects reached disk, none caught by codegen, all caught downstream — and they are the row's
real lesson.** A generated test used bun's `mock.module`, which is **process-wide**, replacing the
week-events module for every later file and breaking **72 tests in three unrelated files** while the
feature code was blameless. `bun test:web` went green while **8 TypeScript errors** sat in the test
file, because the suite does not type-check. And the teardown tests were **unfalsifiable**: `cleanup()`
runs after the cancel flags are set, so W7/W8/W9 would have passed even if every listener leaked —
which mattered because Gate 2 accepted the net-new Escape design *only on condition* that teardown got
real coverage. TP-R2 was then **proven by mutation**: flipping one removal capture flag failed R1-R6
while W7/W8/W9 still passed, demonstrating both the old blind spot and the new coverage.

**Both reviewers converged independently** on the same top finding — `startMultiDayGesture` had dropped
the pre-arm `gestureRef.current?.cancel()` that the mirrored template performs — and the `isDrafting`
guard could not cover it, because a gesture below the move threshold has written nothing and so leaves
`isDrafting` false.

**Cost is the least comparable axis here.** Under `estimated`, the opus half is heuristic and the
sonnet half vendor-reported; the cheap tier is 65% of spend not through misrouting (every rule fired
as intended) but through context volume, and two of three debug cycles went on *test* correctness
rather than feature code. Against $4.26 / $4.07 / $3.06 this is the most expensive arm and also the
most tested (+39 vs +26/+29/+33). **Do not quote the four totals as a clean policy comparison.**

**A Gate 4 correction is recorded rather than quietly fixed:** the report had described an observed
write race as a write-contract *bypass*. `ClaudeCliAdapter` contains no `writeFileSync`, so that
mechanism is unsupported by the code; it is now recorded as an orchestrator/child-CLI **coordination
hazard with the mechanism explicitly UNCONFIRMED**, since no live off-limits probe has been run to
settle whether the hook fires for the spawned process. Blast radius was verified independently either
way — only this run's 8 files changed and every off-limits diff is empty.

---

## Row thirteen — `20260831-045511-feature-extend-attendee-avatar-badge`

**CMP-105 · `feature-extend` · `opus-only-v5` · `estimated` · branch `CMP-105/opus-only-v5` ·
anchor `2d81253a` · $4.10 · 8 files · +39 tests · 2298/0 → 2337/0 · uncommitted by the operator's
explicit choice.**

Week grid event cards gained a compact RSVP badge (one aggregate status dot + guest count), and the
RSVP colour/label vocabulary was extracted out of `EventDetailsSection.tsx` into a shared module the
form and the grid now both import.

**First row cut from the new anchor `2d81253a`.** Every prior row anchors on `4189de13`, and the
three earlier CMP-105 arms used different anchors again — so **this is not a clean like-for-like
cost A/B** against them, and it is not offered as one.

**What this row actually contributes is a review-value datapoint.** The two review phases cost
**$1.53 of the $4.10 total (37%) — more than all codegen and tests combined ($1.22)** — and between
them they caught two things a green suite could not.

**The senior review found an arithmetic error inside the human-approved design.** Gate 2 accepted
risk R-8 on the design's own explicit promise that at the minimum height gate the attendee badge and
the repeat glyph *"touch but do not overlap."* They overlapped by 2px. R-8 assumed a 12px badge and
forgot both `0.5` (2px) offsets; the badge is **10px** (`leading-none` on `text-[10px]` around an 8px
dot), so non-overlap needs `H >= 24`, not 22. **The risk the human accepted was not the risk that
existed.** The orchestrator re-derived the geometry from `AttendeeBadge.tsx` and `EventRepeatIcon.tsx`
before applying the 22→24 fix rather than taking the finding on trust — worth noting because the
reviewer was correcting a document the operator had already approved.

**The other three actioned findings were all tests that could not have failed.** The size-gate tests
pinned only the *hidden* side (`CONSTANT - 1`), so a `>` instead of `>=` would have stayed green. The
sole PII test asserted that a `(status: enum, count: number) => string` function does not emit an
`@` — structurally impossible to violate — while the component fixtures carried real-looking emails
into both cards with nothing asserting they stayed out of the DOM. And D-3's decoupling was pinned on
the timed card but only half-pinned on all-day. **The run's headline privacy decision was guarded by
an assertion incapable of regressing.**

**The security review verified the privacy claim adversarially rather than by reading.** It traced
every read of `event.attendees` on both cards (two each, both terminal, yielding an enum and a
number), established that `attendeeSummaryLabel(status, count)` is incapable **by signature** of
emitting an identifier, and then rendered both cards against an XSS-shaped `displayName`, a
payload-bearing email and an off-contract `responseStatus`, dumping the full `container.innerHTML`.
Zero identifiers, zero payload, no injected node. It also surfaced INFO-1, actioned in-run: the web
layer **never calls `GridEventSchema.parse()`**, so the four-member enum has no runtime teeth and
that `reduce` *is* the clamp — a `sort`- or `Math.max`-based rewrite would silently remove it. A test
now pins it and says so.

**Two rulings were ratified rather than left implicit**, both recorded so a later reader does not
"fix" them. A card too small to draw the badge **still announces RSVP state** in its `aria-label`
(gated on attendee presence only) — deliberate, because RSVP state is not a function of pixel height
and withholding it from AT users over a *visual* constraint is the worse bug; pinned by a test on
both card types. And the aggregate wording is accepted as a genuinely **new ambient disclosure**: the
grid sits on screen all day in screenshares and screenshots where the form is opened deliberately,
one event at a time.

**Phase 1 read the source instead of trusting the brief, and the plan shrank.** `GridEvent` already
declares `attendees`, the view-model already populates it, and `GridEvent.tsx` already passes the
whole event down — so three of the brief's in-scope files needed **zero** changes. The brief's
"existing snapshots unchanged" acceptance clause was also found vacuous: **no `__snapshots__`
directory exists anywhere under `packages/web/src`.**

**Contrast with the CMP-105 `flash-agsdk-only` arm**, which recorded the mirror-image failure —
*"tests assert role DOM attr not a11y tree."* Here the design **anticipated** that trap as R-3, the
generated tests honoured it by querying `getByRole("button", { name })`, and the senior reviewer
verified the assertion shape rather than taking the design's word for it.

**Process notes.** The harness `Write` guard fired a fourth time on `SUMMARY.md`; the orchestrator
**complied** — no Bash re-route — folding the narrative into `manifest.json`'s structured fields and
disclosing the refusal at Gate 4. That is the second recorded non-recurrence (compliance now 2 of 4)
and does **not** close follow-up 16. Biome's six post-codegen fixes were applied by hand through
`Edit` rather than `biome check --write`, to stay on the hook-gated write path — and the orchestrator
checked *first* that `EventDetailsSection.tsx` was not among the flagged files, since blanket
formatting it would have put AC-5's byte-identity claim at risk. Provenance was recorded for the 8
user-source writes only, not the run's own `.sdlc/` artifacts (deliberate, disclosed at Gate 3).

**Harness trap worth carrying forward:** `bun test <file>` from the **repo root** fails with
`PORT is required when API_BASEURL is not configured`, because `packages/web/bunfig.toml` carries a
required preload that root-level invocation does not pick up. It looks exactly like a regression
caused by the change. Use `bun test:web`, or cwd `packages/web` with a `src/`-relative path. Both
reviewers hit it independently.

**Revert is NOT clean for this row.** `provenance.json` has `backup_path: null` for the 8 original
writes (backups exist only for the 3 refinement writes) and 3 files are new/untracked, so
`git checkout` alone cannot restore the pre-run state. Manual path: `rm` the three new files
(`attendee-status.util.ts`, `AttendeeBadge.tsx`, `attendee-status.util.test.ts`), then
`git checkout --` the five tracked ones. `git_head_before == git_head_after == 2d81253a`, 0 commits.

**Eight follow-ups open, none filed as tickets.** Notably FU-1 (relocate the util to
`packages/web/src/common/` — flagged independently by the design, the senior reviewer *and* the
security reviewer, since the form now imports from `@web/grid/components`) and FU-5 (**measure** the
title reserve at the 56px width gate before touching it; at the gate ~20px of title survives, and the
reviewer's explicit advice was that a guessed bump is worse than a measured one). FU-3 records 11
order-dependent failures under the unsharded `bun test` runner — **reported by the senior reviewer as
pre-existing and not independently re-verified at baseline by the orchestrator.**
