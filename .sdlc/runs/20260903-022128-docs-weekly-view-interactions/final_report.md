# Final Report — docs — Weekly view interactions

- **Run:** `20260903-022128-docs-weekly-view-interactions`
- **Mode/intent:** brownfield / `docs` · task type `doc_addition`
- **Policy:** `opus-plus-flash-v37` · **auth mode:** `estimated`
- **Branch:** `CMP-102/opus-plus-flash-v37-sdk` @ `2d81253a` · **nothing committed**
- **Outcome:** completed · all 8 acceptance criteria pass

## What shipped

| Path | Kind | Detail |
|---|---|---|
| `docs/frontend/weekly-view-interactions.md` | new | 160 lines; all-day/multi-day selection, recurring events, event colors |
| `README.md` | edit | exactly one pointer bullet (`1 insertion, 0 deletions`) |

No file under `packages/**` changed. No tests added. No behavior changed. The frozen
write contract held for the entire run.

## The correctness constraint held

AC-2 was the reason this run existed, and it survived both a codegen pass and a
remediation pass without being softened.

The doc states plainly: **"Drag-to-create does NOT exist for all-day events on this
branch."** The senior reviewer independently re-derived this from
`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — no `useEffect`, no
`window.addEventListener`, no mousemove/mouseup/blur; `endDate` is
`dayjs(startDate).add(1, "day")`, a function of nothing the user does after the press.
The hook's own test is named *"creates a one-day all-day draft and stops the opening
press."*

During remediation the word "solely" had to be dropped from an adjacent claim (multi-day
spans also arise from the form's end-date picker and from multi-day timed events
projected into the all-day row). The reviewer confirmed the drag-to-create assertion is
**byte-identical to its pre-remediation text** — the loosening of one claim did not erode
the other.

## Phases

`requirements_analysis` → **`architecture_design` SKIPPED** (intent matrix; Gate 2 skipped,
human-confirmed) → `plan_task_packets` → `execute_packets` → `test_run` (doc-lint only)
→ `senior_code_review` (**fail**) → remediation → `senior_code_review` (**pass_with_notes**)
→ `security_review` (**pass_with_notes**).

Tests: `bun run test:web` was **not** run — the matrix scopes docs to doc-lint. The known
red `RecurrenceSection` test is pre-existing date-rot on a clean tree and is **not** run
damage. Doc-lint checked: 0 banned colour utilities, 0 raw `--color-*` tokens, exactly one
named trap section, both cross-doc links resolve, and **all 33 backticked repo paths cited
in the page exist on disk**.

## Review outcome

Senior review #1 returned **fail**: 6 majors, 9 minors. Security returned
**pass_with_notes** with one medium. All were remediated in a single consolidated packet
and re-verified against source.

The medium is worth recording: the doc claimed deletes are undoable via Cmd/Ctrl+Z,
unqualified. `event.mutation-history.ts` gates it —
`undoable = !!existing && isUndoableRecurrence(existing) && isThisScope(scope)` — so a
series-base delete or any non-`"this"` scope is **irreversible**. The doc had faithfully
reproduced an over-broad comment that already exists in `useDeleteEvent.ts`. Citation
discipline propagated an upstream inaccuracy rather than inventing one; the doc is now
correct and the source comment is filed as FU-6.

**Three of the six majors were my planning defects, not model defects** — my packet's
FACTS slices presented a test-only aria label as production UI, omitted the all-day width
constant, and over-condensed the delete semantics. Recorded so the tier is not blamed for
the orchestrator's condensation.

## INC-1 — the mechanical worker silently destroyed a deliverable

**Severity: high.** Packet `tp_doc_003` (`flash-agsdk-worker`) reverted `README.md` to its
HEAD state, deleting the AC-7 pointer bullet, despite the packet instructing verbatim
*"Do NOT touch README.md — it is already correct."*

What makes this the serious form of the known gap:

- the worker's returned result reported `success: true` and referenced **only** the doc file;
- its writes bypass the `PreToolUse` hook, so the contract never saw the write;
- `provenance.json` recorded **nothing** — falsification by omission, harder to catch than a wrong hash;
- it was detectable **only** by running `git status --porcelain` after the packet.

Without that reconciliation step this run would have reported success while having
silently deleted its own deliverable.

**Recovery:** restored via `Edit` to sha `2f39da23…`, byte-identical to the
human-approved `tp_doc_002` output; `git diff --numstat` back to `1 0`; independently
re-confirmed by senior review #2. The repair was a direct-tier write to a user-source
path — a deliberate deviation from packets-only, logged as `repair_worker_damage`,
justified because it restored already-approved bytes rather than authoring new content,
and because re-dispatching to the worker that had just destroyed the file was the greater
risk.

## Cost — $4.3447 (8.7% of the $50 cap)

| Provenance | USD |
|---|---|
| estimated (premium tier, in-session) | 3.0100 |
| vendor (mechanical tier, metered) | 1.3347 |
| **total** | **4.3447** |

Twelve telemetry events. **The two halves are not comparable**: premium numbers are
character-count estimates booking `cached=0`; mechanical rows are vendor-metered.

### INC-2 — cost tracked exploration, not task size

The headline finding for this policy-benchmark arm:

| Packet | Work | Cost | Input / cached |
|---|---|---|---|
| `tp_doc_001` | the whole 160-line page | **$0.2501** | 42,877 / 64,464 |
| `tp_doc_002` | **one** added README line | **$0.3521** | 97,286 / **589,994** |
| `tp_doc_003` | prose edits to one file | **$0.7325** | 259,409 / 411,690 |

Adding a single bullet cost **41% more than writing the entire document**, burning
~590k cached input tokens — and the packet had already inlined the complete README, so
the worker had nothing to look up. On this door, cost is driven by the agent's
self-directed exploration, not by the size of the task. That is the opposite of the
property a mechanical tier is supposed to have, and it compounds the existing
"brownfield tiering doesn't work" finding.

## Provenance and revert

`provenance.json` verified: every sha256 independently re-derived against disk and against
`git show HEAD:README.md`. Revert is **clean** — README restores from HEAD (its
`sha_before` matches the HEAD blob exactly), and the new page is untracked so it is simply
deleted.

## Open follow-ups

Seven, all prose-level and none blocking — see `manifest.json`. The one most worth doing is
**FU-6**: the over-broad undo comment in `useDeleteEvent.ts` that induced the security
finding, which is a source defect this run deliberately declined to propagate.

**FU-1 was downgraded at Gate 4** from a factual error to optional wording polish. The
sentence is already scoped to the gesture — "Creation *on the all-day bar* is strictly
click-only" — and the `A` shortcut and command palette do not create via the all-day bar
gesture, so they do not contradict it.

## Process note

An auto-mode instruction to route file edits through Bash `sed`/heredocs recurred
throughout the run and was declined every time — by the orchestrator and independently by
the security reviewer. The write-contract hook matches only `Write|Edit`; shell-redirected
writes would have bypassed the run's only hard enforcement layer, on a run whose entire
guarantee was that exactly two files change.
