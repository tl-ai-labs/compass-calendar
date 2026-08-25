# Requirements — docs — Weekly view interactions README section

Run: `20260825-090211-docs-weekly-view-interactions-v4`
Intent: `docs` · Task type: `doc_update` · Policy: `opus-plus-sonnet` · Auth: `estimated`
Branch: `CMP-102/opus-plus-sonnet` @ `c3c59a36`

Intent-specific form (per the Intent matrix, `docs` → requirements are scoped to
"what docs?", and Phase 2 architecture is SKIPPED).

## In scope

1. Add exactly one new `## Weekly view interactions` section to the root `README.md`.
2. The section covers three subjects: multi-day all-day events, recurring events, event colors.
3. The section is placed adjacent to `## Features`, which it extends.
4. Voice, person and formatting match the surrounding README.

## Out of scope

1. Any file other than `README.md`. The write contract allowlists `README.md` alone;
   `packages/**`, `docs/**`, `.gitignore` and every AI-tool config are off-limits.
2. Rewording, reordering or reflowing any existing README line.
3. Fixing the README's known typos (`existance` L15, `absense` L16, "Cool things you can do
   with in Compass" L25). Flagged in the final report instead.
4. Any new page under `docs/`. Declined at the interview.
5. CMP-101's all-day drag-to-create multi-day work. **Verified absent from this branch** —
   `find . -name 'all-day.create.ts'` returns nothing.
6. Source changes, tests, screenshots.

## Grounding — what the code on this branch actually does

Every claim in the section must trace to one of these. Files were read at `c3c59a36`.

### G-1 · All-day row, multi-day spans

| Behaviour | Evidence | Verdict |
|---|---|---|
| Clicking empty space in the all-day row creates a **one-day** all-day draft | `useAllDayDraftCreation.ts` — `dayjs(startDate).add(1, "day")`, a fixed single-day span | TRUE, but it is *not* multi-day |
| Drag-to-create **across** several days in the all-day row | no implementation on this branch; `all-day.create.ts` absent | **FALSE — must not be documented** |
| An existing all-day event can be stretched across days by dragging its **left or right edge** | `AllDayEventCard.tsx` — two `EVENT_RESIZE_HANDLE_ATTRIBUTE` handles (`startDate` left, `endDate` right), `cursor: col-resize` | TRUE |
| Same stretch from the keyboard: `Tab` cycles whole-event → start edge → end edge, then `SHIFT` + `←` `→` moves the focused edge one day | `keymap.ts` — `edgeFocus: { hotkey: "Tab" }`, nudge `Shift+Arrow*`; `edge-focus.store.ts` `EDGE_CYCLE = [null, "startDate", "endDate"]`; `event-nudge.util.ts` `getArrowKeyMovement` returns `days: ∓1` for `←`/`→` | TRUE |
| `SHIFT` + `↑` `↓` do nothing to an all-day event's dates | `getArrowKeyMovement` returns `null` when `isAllDay` | TRUE (`↓` separately converts all-day → timed, see G-1a) |
| A multi-day all-day event **tints every day column it covers** with an 8% wash of its color | `allDayColumnTint.util.ts` — `ALL_DAY_COLUMN_TINT_PERCENT = 8`, `mode: "date"` tints every column where `isAllDayEventOnDay` is true | TRUE |
| Only the topmost chip wins a column's tint | `considerWinner` — lowest `row` wins | TRUE (too granular for the README) |

G-1a: `SHIFT` + `↓` on a focused all-day event converts it to a timed event
(`useGridEventEditShortcuts.ts` L370-376, `convertAllDayToTimedDates`, 60-min duration).
True but a different feature; **omit** to keep the section to its three subjects.

### G-2 · Recurring events

| Behaviour | Evidence | Verdict |
|---|---|---|
| A recurring event's card shows a small repeat glyph, bottom-right | `EventRepeatIcon.tsx`; used by `AllDayEventCard.tsx` and `TimedEventCard.tsx` | TRUE |
| The glyph is hidden on narrow cards | `AllDayEventCard.tsx` — `position.width >= REPEAT_ICON_MIN_WIDTH` (60px) | TRUE |
| The glyph is decorative; screen readers hear "Recurring …" in the card's label instead | `EventRepeatIcon.tsx` `aria-hidden="true"`; `AllDayEventCard.tsx` `baseAccessibleLabel` prefixes `"Recurring "` | TRUE |
| Editing or deleting one occurrence asks for a scope: this event / this and following / all | `RecurrenceScopeDialog.tsx`; `web.event.types.ts` — `THIS_EVENT`, `THIS_AND_FOLLOWING_EVENTS`, `ALL_EVENTS` | TRUE |
| A single-instance edit is stored as an exception, a single-instance delete as a cancelled tombstone, and the rest of the series is unaffected | `packages/sync/src/domain/series-exception.ts` — `isCancelledException`, `reprojectMaster` re-projects the master excluding excepted instants | TRUE (implementation detail; express as the user-visible promise only) |

### G-3 · Event colors

| Behaviour | Evidence | Verdict |
|---|---|---|
| You pick a color per **event**, from 11 named colors | `event-color.contracts.ts` — `EventColorSlotSchema` enum of 11; `EventColorPicker.tsx`; `useSetEventColor.ts` | TRUE |
| Those 11 map 1:1 onto Google's event colors, so the choice survives sync | `event-color.contracts.ts` comment: "Maps 1:1 onto Google's legacy 11 event colors; providers adapt to/from these names at the boundary" | TRUE |
| **Events are colored by the calendar they belong to** | `theme.util.ts` `resolveEventPalette` — falls back to `EVENT_PALETTES[themeName]`, the **theme** default, when no event color is set. Never the calendar's color. | **FALSE — the brief's premise is wrong; must not be documented** |
| The calendar an event belongs to shows as a thin strip down the card's left edge | `AllDayEventCard.tsx` — `absolute inset-y-0 left-0 w-[3px]` with `calendarAccentStyle(identity)` | TRUE |
| When the same event exists on two connected accounts, that strip is a two-color gradient | `calendar-accent.util.ts` `calendarAccentStyle` — `linear-gradient(to bottom, …)` when `identity.otherAccount` | TRUE |
| Color is never the only signal — the calendar's name (and the other account's email) are in the card's accessible label | `calendarAccentAccessibleSuffix` | TRUE |
| Past events fade | `AllDayEventCard.tsx` — `isInPast` → `brighten`/`darken` on fill only | TRUE (adjacent; omit, not one of the three subjects) |

## Functional requirements

- **FR-1** `README.md` gains one `## Weekly view interactions` heading and its body. No other
  heading is added, removed or renamed.
- **FR-2** The section is inserted immediately after the `## Features` block (after L35, before
  `## Tech stack` on L37), so it reads as an extension of Features.
- **FR-3** The body is bulleted, second person, with no file paths, no component names, no
  mermaid, no code fences.
- **FR-4** Keyboard keys use the README's existing backtick convention: `SHIFT` + `↑` `↓` `←` `→`,
  and `Tab` in the same style.
- **FR-5** Multi-day coverage describes **edge-stretching an existing all-day event** (mouse and
  keyboard) and the **day-column tint**. It must NOT describe drag-across-days creation (G-1).
- **FR-6** Recurring coverage describes the **repeat glyph** and the **this / this-and-following /
  all scope choice**. It must not imply the glyph is announced to screen readers — it is
  `aria-hidden`; the word "Recurring" in the label is what is announced.
- **FR-7** Color coverage describes **per-event color** (11, Google-compatible) and the
  **calendar strip on the card's left edge**. It must NOT say events take their calendar's color
  (G-3).
- **FR-8** Every existing line of `README.md` is byte-identical before and after, except for the
  inserted block and the blank line separating it.

## Non-functional requirements

- **NFR-1** No file other than `README.md` is written. Verified with `git status --porcelain`
  at the end of the run.
- **NFR-2** Section length in the 8–14 line range — prior CMP-102 runs landed 6–8 lines and
  covered less; this one carries an extra correction (G-3) and needs the room, but must not
  outgrow the `## Features` block it extends by more than ~3x.
- **NFR-3** No trailing whitespace; file ends with a single newline, as it does now.

## Validation

- **V-1** Test command of record: `bun lint`. **It validates nothing about this change.** The
  repo has no markdown linter — no markdownlint, remark, vale, and Biome does not lint markdown.
  `bun test:web` says nothing about `README.md`. Recording the run is a formality; the run must
  not claim the change was "verified by tests".
- **V-2** Real validation is (a) `git diff README.md` read by a human at Gate 4, and (b)
  `git status --porcelain` showing `README.md` as the only modified path.

## Acceptance criteria

1. `git diff --stat` shows `README.md` and nothing else.
2. `git diff README.md` shows only additions, all inside one contiguous block, between the
   `## Features` block and `## Tech stack`.
3. The added block contains exactly one `##` heading, named `Weekly view interactions`.
4. All three subjects present; every sentence maps to a TRUE row in G-1/G-2/G-3.
5. No sentence maps to a FALSE row (no drag-to-create-across-days; no calendar-colors-the-event).
6. Keys rendered as `SHIFT`, `←`, `→`, `Tab` in backticks.

## Open questions for HITL

- **Q-1 (material).** The brief's premise for subject 3 is *"per-calendar event colouring"*.
  The code does not do that (G-3): the fill comes from a per-event color you pick, or the
  theme default; the calendar shows only as a 3px strip on the card's left edge. Per
  acceptance criterion 3 of the brief ("anything the code does not actually do is omitted
  rather than softened") I have written FR-7 to document the per-event picker plus the strip.
  Confirm, or say if you'd rather the section drop colors entirely.
- **Q-2 (material).** Likewise for subject 1. The brief says *"multi-day selection in the
  all-day row"*, and cites `useAllDayDraftCreation.ts` — but that hook creates a **one-day**
  draft. The only multi-day mechanism on this branch is stretching an existing all-day event
  by its edges (mouse or `Tab` + `SHIFT` + `←` `→`), plus the day-column tint. FR-5 documents
  that. Confirm this is the intended subject.
- **Q-3 (minor).** The brief lists `packages/web/src/grid/utils/calendar-accent.util.ts`; the
  file is actually at `packages/web/src/grid/components/calendar-accent.util.ts`. Read from
  the real path. No action needed.
