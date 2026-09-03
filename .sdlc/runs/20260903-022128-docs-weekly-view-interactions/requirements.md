# Requirements — docs — Weekly view interactions

- Run: `20260903-022128-docs-weekly-view-interactions`
- Intent: `docs` · task type: `doc_addition`
- Policy: `opus-plus-flash-v37` · auth mode: `estimated`
- Baseline: source identical to `4189de1`; branch `CMP-102/opus-plus-flash-v37-sdk` at `2d81253a`
- Phase form: intent-specific ("what docs?"), per the pipeline Intent matrix

## R-0 Scope

Add one contributor-facing reference page, `docs/frontend/weekly-view-interactions.md`,
covering the week view's interaction model across three topics — all-day / multi-day
selection, recurring events, and event colors — and add exactly one pointer bullet to the
root `README.md`.

This run changes no source, adds no tests, and changes no behavior.

## R-1 Deliverables (the entire write set)

| # | Path | Kind | Constraint |
|---|---|---|---|
| D-1 | `docs/frontend/weekly-view-interactions.md` | new file | the page body |
| D-2 | `README.md` | edit | exactly one pointer bullet; no other line changes |

Any write outside these two paths is a defect, not a judgment call. The frozen write
contract at `.sdlc/local/write-contract.json` (`strict: true`) enforces this at the
tool boundary; enforcement was probe-verified live at Gate 0 against `packages/**`.

## R-2 Content requirements — verified against this branch

Every behavioral claim below was read out of the source during this phase, not inferred.
Citations are the evidence the doc must carry.

### R-2.1 All-day / multi-day selection (the correctness-critical section)

**Verified fact.** All-day event *creation* is click-only with a fixed one-day span.
`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` computes:

```ts
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

The hook registers **no** `mousemove` listener and no `mouseup` listener — the returned
handler is a single `onMouseDown` that completes the whole gesture synchronously. Its own
test, `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`, is named
"creates a one-day all-day draft and stops the opening press" and asserts
`start: 2026-05-20 → end: 2026-05-21`.

**Contrast.** Drag-to-select a span at create time exists only in the *timed* grid,
`packages/web/src/grid/hooks/useTimedDraftCreation.ts`, which does attach
`mousemove` / `mouseup` / `blur` window listeners, gates on a movement threshold
(`TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`), and live-previews the draft through the store.

**Requirement.** The page MUST state plainly that all-day drag-to-create is **not
implemented** on this branch, and that multi-day all-day spans arise only from **move and
resize of already-saved** events
(`packages/web/src/grid/interaction/math/all-day.resize.ts`,
`all-day.drag.ts`). No phase of this run may soften, hedge, or "fix" this by describing the
gesture as working. (AC-2)

Called out because the originating request asked to document "multi-day select" — a gesture
that does not exist for creation. Documenting it as working would be the single worst
outcome of this run.

### R-2.2 Recurring events

Cover how a recurring series reaches the week grid and what the user can act on, citing the
implementing modules. Link to `docs/acceptance/recurring-events.md` for the UX runbook
rather than restating it. (AC-1, AC-6)

**Verified during this phase** (read-only exploration; the surface is materially larger than
the brief assumed, so the page must select ruthlessly and link out):

1. **A repeat glyph does exist.** `packages/web/src/grid/components/EventRepeatIcon.tsx`,
   `aria-hidden`, documented as decorative because the recurring state is announced through
   each card's `aria-label` (prefixed `"Recurring "`). Its display is *gated*: timed cards
   need `durationMinutes >= 15` **and** `position.width >= 40`
   (`REPEAT_ICON_MIN_DURATION_MINUTES` / `REPEAT_ICON_MIN_WIDTH` in
   `packages/web/src/grid/components/TimedEventCard.tsx`); all-day cards apply the width gate
   only (`AllDayEventCard.tsx`). So the icon is genuinely absent on narrow cards — a caveat
   worth stating, not a bug to report.
2. **Drag / resize of a recurring event in the week grid shows no scope dialog at all.**
   `packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` commits through
   `useUpdateEvent` with scope `"this"`; the scope choice is offered *after the fact* by a
   toast ("Apply to series?", Following = `1`, All = `2`) in
   `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx`, driven by
   `packages/web/src/events/recurrence/recurrence-scope-opportunity.store.ts`. This is the
   single most doc-worthy recurrence behavior in the week view, and it is exactly what a
   contributor would guess wrong.
3. **Week view and Day view deliberately differ.** `WeekView.tsx` renders
   `<SidebarEventDetails confirmAllRecurringEdits={false} />`; the prop defaults to `true`
   and Day view takes the default. Week substitutes the heuristics in
   `packages/web/src/events/recurrence/recurrence-scope-decision.ts`.
4. **Delete never prompts** — `recurrence-scope-decision.ts` returns `THIS_EVENT`
   unconditionally for deletes; `useDeleteEvent.ts` hardcodes `scope: "this"` because deletes
   are undoable.
5. **The series base is never rendered** — `scheduledNonSeries()` in
   `packages/web/src/events/queries/event.view-model.ts` filters
   `recurrence.kind !== "series"` so the first day is not painted twice.
6. **Expansion happens in more than one place**: server-side for signed-in users
   (`packages/sync/src/domain/occurrence-projection.ts`), client-side for local/IndexedDB
   (`packages/web/src/events/recurrence/expandLocalEventRecords.ts`), plus optimistic
   client-side expansion in `useEventMutations.ts`.

**Scope control.** Items 5 and 6 are background, not week-view interaction; mention them in
a sentence each at most. The page is an interaction reference, not a recurrence architecture
document. Anything deeper belongs behind the link to
`docs/acceptance/recurring-events.md`.

**Correction of record.** The Gate 1 prompt anticipated that a missing repeat marker might
be a negative finding. It is not — the glyph exists. The genuine negative findings in this
area are the *absent scope dialog* on grid drag/resize (item 2) and the *absent* delete
prompt (item 4).

### R-2.3 Event colors

Two constraints are mandatory (AC-3):

1. The 11 Compass color slots are a Zod enum in
   `packages/core/src/types/event-color.contracts.ts` (`EventColorSlotSchema`:
   lavender, mint, plum, coral, gold, orange, blue, slate, indigo, green, red), mapping
   1:1 onto Google's legacy 11 event colors.
2. `colorHex` is **read-only / provider-assigned**. The picker
   (`packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx`) and the
   context-menu path (`packages/web/src/views/Forms/hooks/useSetEventColor.ts`) only ever
   write `color`, never `colorHex`.

Supporting: `EVENT_COLOR_SLOT_HEX` and `eventColorLabel` in
`packages/web/src/common/styles/theme.util.ts`; precedence in `resolveEventPalette` is
`colorHex` → `color` → active theme default.

**AC-4 constraint on examples.** No example may show a raw Tailwind or theme color utility
class. `packages/scripts/src/testing/check-semantic-colors.ts` (run by `bun run lint`) bans
`(bg|text|border|ring|outline|placeholder|divide|from|to|via)-<palette>` and raw
`--color-<palette>` tokens across `packages/web/src`. Note the scanner walks
`packages/web/src` only, so a doc file is not itself scanned — the constraint is editorial,
and is exactly why examples must model the sanctioned pattern (semantic tokens, or an
inline `style={{ backgroundColor: EVENT_COLOR_SLOT_HEX[slot] }}` as the picker does).

## R-3 House style (AC-5)

Match `docs/frontend/`, as exhibited by `week-drag-interaction.md`:

- explanatory prose, heavily source-cited with inline backticked repo-relative paths
- a bolded `## The one-sentence model` opener
- a closing **named** trap section (the sibling pages use `## Pitfall`,
  `## Memo Comparator Trap`)
- Mermaid sparingly — only where a diagram carries load a paragraph cannot

Candidates for the closing named trap section, strongest first:

1. **The scope you did not choose.** A week-grid drag or resize of a recurring event silently
   commits as "this occurrence" and only then offers promotion via a toast; ignore the toast
   once and `declinedEditInstanceIds` stops asking for that instance for the session.
2. **The two recurrence models.** The grid's `GridEvent`
   (`packages/web/src/common/types/web.event.types.ts`) carries the *legacy*
   `recurrence: { rule?, eventId? }` shape, down-converted in `event.view-model.ts` from the
   strict `kind: "single" | "series" | "occurrence"` union in
   `packages/core/src/types/event.contracts.ts`. An occurrence carries no `rule` of its own,
   so opening one reads as non-recurring unless the caller resolves the base.

Pick one; do not write both. The page needs a single named trap, per house style.

## R-4 Linking, not restating (AC-6)

Link to, and do not duplicate:

- `docs/frontend/week-drag-interaction.md` — dragging **saved** events
- `docs/acceptance/recurring-events.md` — recurrence UX runbook

Both are off-limits for editing.

## R-5 README pointer (AC-7)

Exactly one bullet added; no restructuring, no other line changed. Verified by
`git diff -- README.md` showing a single added line.

## R-6 Verification plan

| AC | How it is checked |
|---|---|
| AC-1 | file exists, all three topics present |
| AC-2 | senior review re-reads `useAllDayDraftCreation.ts` against the prose |
| AC-3 | both color constraints present verbatim in substance |
| AC-4 | grep the doc for banned utility-class patterns |
| AC-5 | one-sentence-model opener + named closing trap section present |
| AC-6 | both links present, neither source restated |
| AC-7 | `git diff -- README.md` is exactly one added line |
| AC-8 | `git status --porcelain` lists only the two in-scope paths |

Test phase is **doc-lint only** per the Intent matrix; no `bun run test:web` gate applies
to a docs-only run. The pre-existing red test
(`RecurrenceSection > keeps the event's own date selectable when the event ends after
midnight`, date-dependent rot, fails on a clean tree) is explicitly out of scope and must
not be reported as run damage.

## R-7 Non-goals

No source changes. No new tests. No fix to the red baseline test. No implementation of
all-day drag-to-create. No README or `docs/` restructuring. No edit to
`docs/README.md`'s index.

## Open question for Gate 1

The Intent matrix marks Phase 2 (architecture) **SKIP** for `docs`, which also skips
Gate 2 — so no `design.md` / `change_plan.md` is produced, and the run goes from Gate 1
straight to packet planning. The run instructions listed `design.md/change_plan` among the
expected artifacts. Recommendation: honor the matrix and skip it (a one-page doc addition
has no design surface to record); the packet plan in `packets.json` carries the outline
instead. Confirm or override at Gate 1.
