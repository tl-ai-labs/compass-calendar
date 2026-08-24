# Requirements — docs — Weekly view interactions README section

**Run:** `20260820-212654-docs-weekly-view-interactions-v3`
**Mode:** brownfield · **Intent:** `docs` · **Policy:** `opus-only-v5` · **Auth:** `estimated`
**Branch:** `CMP-102/opus-only-v5` (cut clean from `main`)

This is the docs-scoped form of Phase 1 per the Intent matrix: it answers
*"what docs, saying what, sourced from where"* rather than producing a general
system requirements document. Phase 2 (architecture) SKIPs, and Gate 2 with it.

---

## 1. In scope

1. Add exactly one new section, **"Weekly view interactions"**, to the root
   `README.md`, positioned under the existing `## Features` section.
2. The section covers three end-user behaviors, each as a short blurb:
   multi-day select, recurring events, event colors.
3. Append a `.sdlc/` entry to `.gitignore` (approved by the user at Gate 0).

## 2. Out of scope

1. Any edit to `docs/frontend/week-drag-interaction.md` or
   `docs/acceptance/recurring-events.md` — this run links to them, never edits them.
2. Any new engineer-facing doc under `docs/` (including for event colors, which
   has no existing doc — the fresh content lives only in the README blurb).
3. Any change under `packages/**`. This is a docs-only run; a doc/implementation
   mismatch is reported, never "fixed" in code.
4. Restructuring `README.md` beyond inserting the one new section, or
   restructuring `.gitignore` beyond the appended entry.
5. Enumerating the individual color slot names or their count in prose.

---

## 3. Source-of-truth verification (performed this phase, at this HEAD)

The two prior CMP-102 runs on sibling branches carried an inaccurate claim.
Each factual assertion the README section will make was re-verified against
this branch's working tree before drafting:

| Claim to be made | Verified against | Verdict |
|---|---|---|
| Existing all-day events can be edge-resized across days | `packages/web/src/grid/interaction/math/all-day.resize.ts` | present |
| Existing events can be dragged between rows/days | `packages/web/src/grid/interaction/math/cross-row.drag.ts` (+ `.test.ts`) | present |
| Drag on empty all-day space creates a **multi-day** event | `packages/web/src/views/.../useAllDayDraftCreation.ts` — derives `endDate = dayjs(startDate).add(1, "day")`, a fixed single-day draft | **ABSENT — must not be claimed** |
| Recurring create/edit/delete has series-vs-occurrence scope | `docs/acceptance/recurring-events.md` | present |
| Per-event color picker exists | `packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx` | present |
| Color slots are a zod enum in core | `packages/core/src/types/event-color.contracts.ts` — `EventColorSlotSchema`, 11 slots, plus a `null` "no color" swatch rendered by the picker | present |
| Both link targets exist on disk | `docs/frontend/week-drag-interaction.md`, `docs/acceptance/recurring-events.md` | both present |

**Finding F-1 (informational, no action).** The intent brief describes
`docs/acceptance/recurring-events.md` as a 5-scenario runbook; the file at this
HEAD contains 10 scenarios plus a "Focused Regression Checks" section. This does
not affect the README content (the blurb links to the doc rather than counting
its scenarios) and requires no change to either file. Recorded so the count is
not propagated into prose.

**Finding F-2 (informational, no action).** `EventColorPicker` renders 11 enum
slots plus one `null` swatch. Requirement FR-3.3 forbids stating either number,
so the zod enum in `packages/core` remains the single source of truth and no
drift is introduced.

---

## 4. Functional requirements

### FR-1 — Section placement and shape

- **FR-1.1** The new section is titled `Weekly view interactions` at heading
  level `##`, matching the level of its sibling sections (`## Features`,
  `## Tech stack`).
- **FR-1.2** It is inserted after the `## Features` block (which currently ends
  with the "Things you can't do in Compass (yet)" list) and before `## Tech stack`.
- **FR-1.3** The three behaviors appear as three sub-items in a consistent form
  (bolded lead-in per behavior), in the order: multi-day select, recurring
  events, event colors.
- **FR-1.4** Tone and register match the surrounding README: end-user facing,
  second person, short. No file paths, no symbol names, no framework nouns in
  the prose.
- **FR-1.5** Style is *summarize + link out*. Each blurb stays short and points
  at the deeper doc instead of restating its content.

### FR-2 — Multi-day select blurb

- **FR-2.1** Describes what exists on this branch: taking an **existing** event
  in the week grid and stretching it across days by dragging its edge, or moving
  it across days/rows by dragging the event itself.
- **FR-2.2** **MUST NOT** state or imply that dragging across empty all-day
  space creates a multi-day event. Verified absent (see §3). This is the
  regression the two prior CMP-102 runs introduced.
- **FR-2.3** Links to `docs/frontend/week-drag-interaction.md` using a
  repo-relative path, framed as implementation detail.

### FR-3 — Recurring events blurb

- **FR-3.1** Describes, in user terms, that when you edit or delete a repeating
  event you choose the scope: just that occurrence, that one and everything
  after it, or the whole series.
- **FR-3.2** Links to `docs/acceptance/recurring-events.md` framed as **how the
  behavior is tested/verified**, not as a feature guide — the file is a manual
  QA runbook.
- **FR-3.3** Does not enumerate the runbook's scenarios or their count (F-1).

### FR-4 — Event colors blurb

- **FR-4.1** Fresh content, written this run; no existing doc covers it.
- **FR-4.2** Describes assigning a color to an individual event from the event
  form, and that the chosen color shows on the event's chip in the grid.
- **FR-4.3** Mentions that leaving it unset falls back to the calendar's default
  appearance (the `null` / no-color swatch), without calling it "the 12th swatch".
- **FR-4.4** **MUST NOT** enumerate color names or state how many exist —
  avoids a second source of truth against `EventColorSlotSchema` (F-2).
- **FR-4.5** Carries no link (none exists), and does not invent one.

### FR-5 — `.gitignore`

- **FR-5.1** A `.sdlc/` entry is **appended**, not inserted into or reordering
  the existing structure.
- **FR-5.2** Placed in the file's existing `# DIRS #` block, consistent with how
  other directory entries are written (trailing slash, no leading `/`).
- **FR-5.3** No existing line is modified, removed, or reordered.

---

## 5. Non-functional requirements

- **NFR-1 — Write scope.** Only `README.md` and `.gitignore` are modified.
  Everything else is off-limits per the frozen write contract at
  `.sdlc/local/write-contract.json` (`strict: true`), enforced at the tool
  boundary by the PreToolUse hook.
- **NFR-2 — Markdown validity.** The section renders cleanly: valid
  repo-relative links, consistent heading depth, no broken list nesting, no
  trailing-whitespace-dependent line breaks.
- **NFR-3 — Link liveness.** Every link target resolves to a file present in
  this branch's working tree (both verified in §3).
- **NFR-4 — No drift surface.** No fact stated in the README duplicates an
  enumerable value that lives in code (color names/counts, scenario counts,
  keyboard-shortcut tables).
- **NFR-5 — Diff minimality.** The `README.md` diff is a contiguous insertion;
  the `.gitignore` diff is a single added line. No reflow of untouched prose.
- **NFR-6 — Provenance.** Both writes are recorded in
  `.sdlc/runs/<run-id>/provenance.json` with pre-write backups, so
  `/mmo:revert` can restore the pre-run state.

---

## 6. PII inventory

Not applicable. This run writes documentation prose and one `.gitignore` line.
No personal data is read, stored, transformed, or transmitted; no code paths
that handle user data are touched.

## 7. Role matrix

Not applicable — no authz surface is created or modified by a docs-only change.

---

## 8. Acceptance criteria

1. `README.md` contains a `## Weekly view interactions` section positioned
   between `## Features` and `## Tech stack`.
2. The section covers all three behaviors: multi-day select, recurring events,
   event colors.
3. The multi-day select blurb describes resize / cross-row drag of an
   **existing** event and contains no create-by-drag claim.
4. The multi-day select blurb links to `docs/frontend/week-drag-interaction.md`.
5. The recurring blurb links to `docs/acceptance/recurring-events.md` and frames
   it as the test/behavior reference.
6. The event colors blurb names no individual color and states no color count,
   and carries no link.
7. `.gitignore` contains a `.sdlc/` entry, with every pre-existing line byte-identical.
8. `git status --porcelain` shows exactly two modified tracked files:
   `README.md` and `.gitignore`.
9. Doc-lint (Phase 7, doc-lint-only per the Intent matrix) passes: markdown
   parses, all relative links resolve on disk.
10. Security review (Phase 8, changed-files-only) reports no secret, no
    credential, and no internal-only path leaked into public docs.

## 9. Open questions for HITL

None blocking. Two informational findings (F-1, F-2) are recorded in §3; both
resolve to "state it in prose, don't count it", which FR-3.3 and FR-4.4 already
encode. No user decision is required to proceed.
