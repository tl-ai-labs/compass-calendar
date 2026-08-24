# Run summary — multi-day drag-to-select in the Week all-day row

- **Run** `20260820-004405-feature-extend-allday-multiday-drag` · **mode** brownfield · **intent** feature-extend
- **Policy** `flash-agsdk-only` — every dispatched phase ran on `gemini-3.7-flash` through the Antigravity SDK agent door (`flash-agsdk-worker`), Vertex ADC, project `ai-studies-console`, region `global`
- **Auth mode** `estimated` · **Branch** `CMP-101/flash-agsdk-only` at `4189de1` · **Not committed**
- **Outcome** completed · Gates 0–3 approved, Gate 4 pending

## What shipped

A press-drag-release across day columns in the Week all-day row now opens one draft spanning the
inclusive dragged range. The gesture is **opt-in**: `useAllDayDraftCreation` takes a new optional
`visibleBounds?: { minDate, maxDate }`, and without it the hook returns down the original synchronous
mousedown-commit path before attaching any listener (`useAllDayDraftCreation.ts:75`). The Week binding
is the only caller that opts in, so Day view — whose x-axis selects a *calendar*, not a day — is
structurally untouched rather than merely untested.

### Files changed (9, all inside the write-contract allowlist)

| File | Change | Lines |
|---|---|---|
| `packages/web/src/grid/interaction/math/all-day.create.ts` | new | 69 |
| `packages/web/src/grid/interaction/math/all-day.create.test.ts` | new | 136 |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | edit | +175 / −20 |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | edit | +270 / −13 |
| `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` | new | 40 |
| `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` | new | 179 |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | edit | +5 / −18 |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | new | 235 |
| `docs/frontend/week-drag-interaction.md` | edit | +65 / −0 |

## Tests

`bun test:web` → **2327 pass / 0 fail / 305 files** (79.63s, exit 0) against the Gate 0 baseline of
**2298 pass / 0 fail / 302 files** at `4189de1`. **+29 tests, +3 files, 0 failures.** Re-run and
confirmed independently by the main session. Acceptance criterion 8 holds.

## Gate 0 constraints — final status

1. **Click-to-create unregressed** — held, with one approved timing change. The committed draft value
   for a plain click is unchanged. What moved is *when the form opens*: the Week all-day row now
   publishes `activity: "creating"` on mousedown and reaches `"gridClick"` (form opens) on mouseup,
   because a gesture cannot be classified as a click until release. **Approved by the user at Gate 2
   with this consequence visible — this is design, not drift.** Pinned by
   `useAllDayDraftCreation.test.tsx:334` and documented under "Form opens on release (deliberate
   consequence)".
2. **`packages/web/src/views/Day/**` proven unchanged** — held. `git diff --stat packages/web/src/views/Day/`
   is empty. Its suites pass untouched.
3. **`isSameDayDrag` guard stays** — held. `useTimedDraftCreation.ts` and `useTimedGridDraftCreation.ts`
   are unmodified; the timed grid still refuses cross-day drags.
4. **No backend / sync / core / scripts, no persistence** — held. Change is confined to
   `packages/web` and `docs`. `package.json` and `bun.lock` unmodified.

## Reviews

- **Senior review** — `approve_with_comments`, 8 findings, 7 at severity `none` with evidence, 1 minor.
- **Security review** — **PASS**, no follow-ups, changed-files-only scope per the feature-extend
  intent matrix.

### Recommended follow-up ticket: modifier-click eligibility

The one non-`none` finding (`Q1-MODIFIER-ELIGIBILITY`): the all-day hook guards only on `isRightClick`
(`mouse.util.ts` — `e.button === 2`), while `useTimedDraftCreation` also calls
`isEligibleInteractionPointerDown`. So alt/ctrl/meta/shift + left-press starts draft creation. On
macOS, ctrl+left-click is the secondary-click convention.

**Deliberately not fixed in this run**, and both obvious fixes were rejected for stated reasons —
carry these across to whoever picks it up:

- It is **not a regression**. The pre-change hook guarded on `isRightClick` alone, so modifier-click
  already created an all-day draft on both Week and Day. This run does not change that.
- The reviewer's own suggested fix puts the guard **before `preventDefault` on the shared entry
  path**, which would change Day view's click-to-create for modifier clicks — violating Gate 0
  constraints 1 and 2.
- Guarding **only inside the opt-in branch** would leave ctrl-click doing nothing in the Week all-day
  row while still creating a draft in Day — a Week/Day asymmetry no gate approved.
- The fix belongs in its own ticket that handles both surfaces consistently, with its own Gate 0 scope.

Full reasoning: `review.json` → `orchestrator_adjudication`.

## Cost — read this before comparing runs

**$4.0678, covering dispatched Flash calls only.** 8 dispatched packets, 1.46M uncached input tokens,
4.40M cached, 145k output (of which 76k reasoning), 1232s of dispatch latency.

| Phase | Carried by | Cost |
|---|---|---|
| `requirements_analysis` | Flash | $0.2842 |
| `architecture_design` (change plan) | Flash | $0.7566 |
| `plan_task_packets` | **Claude, in-session** | **$0.0000 — unpriced** |
| `codegen` (3 packets) | Flash | $1.7837 |
| `docs` | Flash | $0.2118 |
| `senior_code_review` | Flash | $0.6604 |
| `security_review` | Flash | $0.3711 |

Flash carried requirements, design, all three codegen packets, docs, senior review and security
review. Claude carried the packet decomposition (`tp_plan_001`, logged with `provenance: "estimated"`
at `cost_usd` 0 — the user chose this at Gate 2 over a recommendation to dispatch it) plus every
orchestration turn: gate handling, artifact integration, test runs, provenance and the defect
adjudications. None of that Claude time is priced, because `flash-agsdk-only` is strictly single-model
and carries no Claude pricing block, and `cost_usd` is sourced only from the policy YAML.

**The $4.26 from `opus-plus-flash-v37` is not a like-for-like comparison.** That policy prices its
Opus spend; this one cannot. A fair reading is: $4.07 of Flash tokens *plus* an unpriced quantity of
Claude orchestration, versus $4.26 of fully-priced mixed-tier work.

## AG-SDK door — observed failure modes

This run doubles as a study of the Antigravity agent door. Two reproducible characteristics, not
one-offs:

1. **Mid-document restart-and-re-emit.** On *both* free-text judgment packets the agent broke off
   part-way and re-emitted the whole document from the top — at FR-5 in `requirements.md`, at the
   section 6 table in `change_plan.md`. Each artifact is the complete second emission; raw messages
   are preserved verbatim in `delegation/worker-usage-*.json` (`.text`). Any pipeline consuming this
   door's free-text output needs a dedupe step.
2. **Confident factual inaccuracies in review output.** The security report credited the docs change
   with "mermaid sequence diagrams" (the file's 2 mermaid blocks pre-date this run; the diff adds
   zero) and described `hasExceededInteractionMoveThreshold` as a "Euclidean distance delta check"
   when it is a per-axis `Math.abs` test. Neither changed the verdict, both are recorded in
   `security_review.md` under "Orchestrator verification of this report". Review output from this
   door needs its load-bearing claims spot-checked.

A third, cheaper observation: per-packet cost floor is ~15x the trivial-packet estimate, because the
agent explores the repo on every dispatch. The $0.018 trivial-packet figure predicts nothing about
real work; packet *count* matters less than the exploration each one triggers.

## Rollback

Nothing is committed. The working tree holds the change.

```bash
git -C /home/sainadh/projects/compass-calendar/compass/compass-calendar restore --source=4189de1 --staged --worktree -- \
  packages/web/src/grid/hooks/useAllDayDraftCreation.ts \
  packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx \
  packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx \
  docs/frontend/week-drag-interaction.md
rm -f packages/web/src/grid/interaction/math/all-day.create.ts \
      packages/web/src/grid/interaction/math/all-day.create.test.ts \
      packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts \
      packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx \
      packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx
```

Or `/mmo:revert 20260820-004405-feature-extend-allday-multiday-drag`, which reads `provenance.json`.

`.sdlc/` and `.hook-logs/` are **untracked additions** left in place — run bookkeeping and the
write-contract hook journal. Neither is part of the feature; delete or gitignore at your discretion.
(Gate 0 approved adding `.sdlc/` to `.gitignore`; no packet needed it, so `.gitignore` is unmodified.)
