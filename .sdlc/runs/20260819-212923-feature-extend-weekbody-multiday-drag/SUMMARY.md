# Run Summary — Multi-day drag-to-select in the week all-day row

- **Run:** `20260819-212923-feature-extend-weekbody-multiday-drag`
- **Mode:** brownfield · **Intent:** feature-extend · **Policy:** `opus-plus-flash-v37` · **Auth mode:** estimated
- **Anchor commit:** `4189de1389d8a4644ae20d9c5a907f1d161b5496`
- **Status:** complete. **Nothing committed, nothing branched** — all changes are in the working tree.

---

## What shipped

Pressing the mouse in the week view's all-day row and dragging horizontally across day columns now
selects a contiguous day range and, on release, creates a single all-day event spanning it, with a
live preview that grows and shrinks during the drag. A plain click is unchanged.

The user's request named a `WeekBody` component. **There is no such component in this repo** — the
gesture surface is `views/Week/components/Grid/AllDayRow/AllDayRow.tsx`, which binds
`grid/hooks/useAllDayDraftCreation.ts`. That correction was made at discovery and carried through.

### Files touched — 8 written, 5 allowlisted and deliberately untouched

| Change | File | Tier |
|---|---|---|
| EDIT | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | premium |
| EDIT (append-only) | `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | premium |
| EDIT | `packages/web/src/interaction/interaction.constants.ts` | mechanical |
| EDIT | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | mechanical |
| NEW | `packages/web/src/grid/interaction/math/all-day.create.ts` | mechanical |
| NEW | `packages/web/src/grid/interaction/math/all-day.create.test.ts` | mechanical |
| NEW | `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` | mechanical |
| NEW | `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` | mechanical |

Untouched despite being allowlisted: `AllDayEvents.tsx`, `all-day-draft.position.ts` (+ its test),
`AllDayRow.test.tsx`, and **`DayCalendarGrid.tsx` — zero edits to the Day view.**

**The live preview needed no new rendering code.** `GridDraft.tsx` already reads
`selectDraftActivity === "creating"` and already renders multi-day all-day bars;
`getDraftContainer` portals the draft into the `<div id={ID_GRID_EVENTS_ALLDAY}>` that
`AllDayEvents.tsx` renders. `AllDayEvents` is the portal *host*, not a participant.

---

## Verification

| Check | Result |
|---|---|
| `bun test:web` | **2324 pass / 0 fail / 304 files** (baseline **2298 / 0 / 302**) |
| Delta | +26 tests, +2 files, **zero new failures** |
| `bun type-check` | **clean** |
| Biome on the 8 changed files | **clean** |
| AC-4 append-only | first 110 lines sha256 unchanged; `git diff --numstat` = **383 / 0** |

### AC-7 correction — read this

The acceptance criteria said "`bun type-check` and `bun lint` are clean." **`bun type-check` is
clean. Repo-wide `bun lint` is not — and it was not clean before this run either.** I verified this
by stashing every change and re-running: it fails identically. The failures are in files this run
never touched (`packages/sync`, `DescriptionEditor.tsx`, `ShortcutKeys.tsx`, `GridEvent.tsx`,
`self-host/`), plus **`.sdlc/*.json`, which Biome scans because `.gitignore` has no `.sdlc/` entry.**

Three follow-ups for the repo owner, all outside this run's write contract:
1. Add `.sdlc/` to `.gitignore` (or to Biome's ignore list) so run artifacts stop failing lint.
2. The pre-run baseline captured tests but **not** lint, so this was invisible at Gate 0. Future
   runs should baseline lint too.
3. Add `.hook-logs/` to `.gitignore`. An untracked `.hook-logs/hook.jsonl` appeared during this run.
   **Attribution, corrected:** it is *not* from the repo's Cursor/Codex format-after-edit hooks —
   none of `.claude/settings.json`, `.cursor/hooks.json` or `.codex/hooks.json` mentions
   `.hook-logs` or `mcp_tool_postuse`. Its entries are `{"event":"mcp_tool_postuse"}` records whose
   timestamps match this run's MCP dispatches exactly, starting at `04:30:27Z` — the same second as
   the first telemetry event (the pre-check smoke packet). It is written by the **SDLC plugin's own
   MCP PostToolUse telemetry hook**. Left in place; it is outside the write contract either way.

### The Gate 2 regression risk is now automated, not a checklist item

At Gate 2 the highest risk was recorded as manual-only: `finish()` must call `preventDefault()` but
**not** `stopPropagation()`, because Week's editor opens from `useGridMouseUp` — a bubble-phase
`mouseup` listener on `#root` (`useGridMouseUp.ts:88`). A window-capture `stopPropagation` would
swallow it and the form would never open after a drag.

That is now covered by a test, and the test was **falsification-checked**: injecting
`stopPropagation()` into `finish()` makes it fail. Every other test in the file releases on
`window`, where nothing is below to propagate to, so only this one can see the defect.

A second falsification check found the senior reviewer's own suggested fix was wrong. It proposed
proving listener teardown *behaviorally*; that test still passed with the capture flag deliberately
broken, because the gesture's terminal-state guards make a leaked listener inert. The tracker was
replaced with one keyed on `type#capture-phase`, which now fails with
`keydown#capture:1 / keydown#bubble:-1`.

---

## Known finding — F-1 (low), accepted and deferred

Surfaced at Gate 3 and **consciously deferred by the user**; the run finished as-is.

`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` registers a **window capture-phase**
`keydown` listener and calls `stopPropagation()` on Escape while a preview is live. The repo has a
formal Escape arbitration module, `shortcuts/escape-ownership.ts` → `isHigherEscapeOwner()`
(app-locked ‖ floating layer ‖ event form open), with **4 existing consumers**. This listener is the
only Escape handler that does not consult it, so one keystroke is withheld from the shortcuts layer.

Bounded and fail-safe: it requires the button held *and* a day boundary crossed, the same keystroke
removes the listener, and the effect is to cancel a drag — never to dismiss a security guard.

**One-line remediation, whenever you want it:**

```ts
if (isPreviewStarted && !isHigherEscapeOwner()) {
  keyboardEvent.preventDefault();
  keyboardEvent.stopPropagation();
}
```

with `import { isHigherEscapeOwner } from "@web/shortcuts/escape-ownership";`.

---

## Reviews

- **Senior code review:** `approve-with-nits`, **0 blockers**, 3 refinement packets — all applied.
- **Security review:** `findings-informational`, **0 must-fix**. Zero PII delta, zero dependency
  delta, no network surface. The Day view's `canCreateDraftOnCalendar` guard was confirmed to still
  sit ahead of every draft-creating path. Full report in `security_review.md`.

Pre-existing observations worth the owner's attention (none introduced by this run):
- Week and Day enforce write permission at **different layers** — Week's all-day creation has no
  writable-calendar guard and passes `calendarId: null`; confirmed pre-existing via `git show HEAD`.
- `canCreateDraftOnCalendar` is a **UX gate, not an authorization boundary** (client-side
  `capabilities.canWrite` + a toast). Server-side rejection was not verified.
- `bun audit` reports 69 vulnerabilities concentrated in the build/test chain. No manifest changed
  this run.

---

## Cost — $4.2588 for the run ($4.2608 in the telemetry file)

| Tier | Model | Events | Input tok | Output tok | Cost | Provenance |
|---|---|---|---|---|---|---|
| Premium | `claude-opus-5` | 9 | 511,891 | 62,597 | **$4.1245** | estimated (in-session) |
| Mechanical | `gemini-3.7-flash` | 7 | 9,005 | 13,423 | **$0.1343** | vendor-metered |
| **Run total** | | **16** | | | **$4.2588** | |

`telemetry.jsonl` also carries **2 pre-check smoke events** (`pass: "pre-check-smoke"`,
`phase: "docs"`, $0.0019) written before this run began. They are counted in the file's $4.2608
total but are **not** part of this run's 16 events. Earlier gate messages quoted the $4.26 file
total; the run-attributable figure is $4.2588.

By phase (run events only): change_plan $1.018 · codegen $1.006 · senior_code_review $0.991 ·
security_review $0.474 · plan_task_packets $0.332 · requirements_analysis $0.253 · test_run $0.128 ·
tests $0.057

Pricing from the `opus-plus-flash-v37` policy `pricing` block (verified 2026-08-19). Opus figures are
**estimated** (char/3.8 heuristic) because the run used `auth_mode=estimated`; the Gemini figures are
real vendor-reported token counts. One packet (`tp_p1_constants`) hit its output ceiling and the
adapter auto-doubled 1500 → 3000; both attempts are in `telemetry.jsonl`.

---

## Reverting

Nothing was committed, so `HEAD` is still the anchor. To discard everything this run produced:

```bash
cd /home/sainadh/projects/compass-calendar/compass/compass-calendar

# 1. Revert the 4 modified tracked files
git checkout 4189de1389d8a4644ae20d9c5a907f1d161b5496 -- packages/web/src

# 2. Remove the 4 new untracked source files
rm -f packages/web/src/grid/interaction/math/all-day.create.ts \
      packages/web/src/grid/interaction/math/all-day.create.test.ts \
      packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts \
      packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx

# Verify: should print nothing
git status --porcelain packages/
```

Or, to preview first: `git diff` for the tracked edits and
`git ls-files --others --exclude-standard packages/` for the new files.

Per-file pre-run hashes are in `provenance.json`; `/sdlc:revert 20260819-212923-feature-extend-weekbody-multiday-drag`
reads the same record.
