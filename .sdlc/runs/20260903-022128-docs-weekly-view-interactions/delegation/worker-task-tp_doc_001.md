## Task tp_doc_001 — docs / doc_addition
Module: docs-frontend
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a NEW contributor-facing reference page at docs/frontend/weekly-view-interactions.md for Compass Calendar's week view, covering three topics in this order: (1) all-day / multi-day selection, (2) recurring events, (3) event colors.

Every behavioral claim MUST come from the FACTS slices below. Do NOT explore the repo for more; do NOT infer behavior the slices do not state; do NOT soften a stated gap.

Structure, matching docs/frontend house style (see the HOUSE-STYLE slice):
- H1 title + one-line summary
- '## The one-sentence model' with a bolded thesis sentence
- one '##' section per topic, explanatory prose, source-cited with inline backticked repo-relative paths
- exactly ONE closing named trap section, titled '## The Scope You Did Not Choose'

Hard rules:
- The all-day section MUST state that drag-to-create does NOT exist for all-day events on this branch.
- Link to ./week-drag-interaction.md and ../acceptance/recurring-events.md; do NOT restate their content.
- Do NOT write a second trap section. Exactly one.
- No raw Tailwind/theme colour utility classes anywhere (no bg-blue-500, text-red-600, --color-slate-400 etc).
- Mermaid at most once, only if it earns its place.
- Write ONLY this one file. Touch no other path.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### FACTS/all-day-creation.md
_Included because: AC-2, correctness-critical. Primary evidence that all-day drag-to-create does not exist._

```
packages/web/src/grid/hooks/useAllDayDraftCreation.ts — the ENTIRE creation gesture. The hook returns a single mousedown handler. It registers NO mousemove listener and NO mouseup listener. Verbatim span computation:

    const startDate = getStartDate(event.clientX, event.clientY);
    const endDate = dayjs(startDate)
      .add(1, "day")
      .format(YEAR_MONTH_DAY_FORMAT);

It guards `isRightClick(event)` (returns early), calls preventDefault + stopPropagation, and if a draft is already open it calls `draftActions.discard()` and returns WITHOUT creating a replacement. Otherwise it builds `createGridEventDraft(allDayGridSchedule(startDate, endDate), undefined, calendarId)`.

The whole gesture therefore completes synchronously on mousedown. There is no drag phase to have a span.

PROOF IN TEST — packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx, test name verbatim: "creates a one-day all-day draft and stops the opening press". It asserts the created draft's schedule is exactly:
    { kind: "allDay", start: new Date("2026-05-20"), end: new Date("2026-05-21") }
Other tests: "ignores right-click presses", "dismisses an existing draft without creating a replacement".

CALL SITES: packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (week view) and packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx (day view). AllDayRow passes onCreateGridDraft that calls draftActions.startGridDraft({ activity: "gridClick", draft }) — note the activity is literally "gridClick".

The empty target has accessible name "Empty all-day space" (role button).
```

#### FACTS/timed-creation-contrast.md
_Included because: AC-2 contrast. Drag-select-to-create exists ONLY here, in the timed grid._

```
packages/web/src/grid/hooks/useTimedDraftCreation.ts — this is where drag-to-select-a-span DOES exist, for TIMED events only.

It attaches window listeners on mousedown:
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);

Behavior:
- A plain click (no movement past threshold) keeps a default 30-minute draft: DRAFT_DURATION_MIN from packages/web/src/grid/grid.constants.ts.
- Movement only counts once it exceeds TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX (packages/web/src/interaction/interaction.constants.ts), via hasExceededInteractionMoveThreshold.
- Once moved, the end may shrink to one grid step (GRID_TIME_STEP) but cannot flip past the origin. Dragging UPWARD swaps: resolvedStartDate = pointerDate, resolvedEndDate = start.
- The live preview IS the store draft: draftActions.startGridDraft({ activity: "creating", draft }) then draftActions.setGridDraft(next) on every move. Comment in source: "The store draft is the preview: both views render it straight from the store while the gesture runs, so every move has to write it."
- It only starts for an eligible primary-button pointer down (isEligibleInteractionPointerDown rejects alt/ctrl/meta/shift and non-primary buttons).
- window blur cancels the gesture.

CONTRAST TO DRAW: timed = press, drag, release, span follows the pointer. All-day = press, done, span is always exactly one day.
```

#### FACTS/all-day-multi-day-spans.md
_Included because: AC-2. How multi-day all-day spans actually arise: move/resize of SAVED events._

```
Multi-day all-day spans exist, but ONLY by moving or resizing an ALREADY-SAVED all-day event.

Math modules: packages/web/src/grid/interaction/math/all-day.resize.ts and all-day.drag.ts (siblings: timed.drag.ts, timed.resize.ts, cross-row.drag.ts).

all-day.resize.ts works in DAY INDICES, not pixels: createAllDayResizeVisual captures { startDayIndex, endDayIndex, initialEdge, initialStartDayIndex, initialEndDayIndex }. updateAllDayResizeVisual finds the pointer's nearest day column via getNearestDayColumn(layout.dayColumns, pointer.x) and then branches on visual.initialEdge === "startDate" ? resizeFromStart(...) : resizeFromEnd(...).

CRITICAL: it branches on `initialEdge` — the edge captured at grab time — never on a mutated current edge. This is required for idempotency (see the week-drag-interaction.md house-style slice, section 'updateVisual Must Be Idempotent').

Commit math for all-day events uses a DATE-DIFF DELTA, not an absolute day:
    dayjs(dayDate).diff(dayjs(initialDayDate), "day")
because multi-day spans are clamped to the visible window, so the initial column's date is the clamped visible edge, not necessarily the event's real start. (Timed events differ: they assign the target day absolutely via dayjs(visual.dayDate).startOf("day").)

Do not re-explain drag mechanics in depth — link to ./week-drag-interaction.md, which owns that material.
```

#### FACTS/recurrence.md
_Included because: Topic 2 + the mandated closing trap section. Verified by read-only exploration._

```
RECURRING EVENTS IN THE WEEK VIEW — all verified against this branch.

1. VISUAL MARKER EXISTS. packages/web/src/grid/components/EventRepeatIcon.tsx renders a RepeatIcon, size 10, weight bold, aria-hidden="true", positioned absolute bottom-right, tinted darken(baseColor, 30). Its docblock: "Decorative — the recurring state is announced via each card's aria-label."
   GATING (this is a real caveat, state it): timed cards show it only when duration AND width both qualify —
       const showRepeatIcon = isRecurring && !isPlaceholder &&
         durationMinutes >= REPEAT_ICON_MIN_DURATION_MINUTES && position.width >= REPEAT_ICON_MIN_WIDTH;
   with REPEAT_ICON_MIN_DURATION_MINUTES = 15 and REPEAT_ICON_MIN_WIDTH = 40, in packages/web/src/grid/components/TimedEventCard.tsx. The duration gate (not a pixel-height gate) is deliberate: a real 15-minute event and one resized to 15 minutes take different height paths and would disagree on a pixel threshold.
   All-day cards (packages/web/src/grid/components/AllDayEventCard.tsx) apply the WIDTH gate only, no duration gate, and add padding to reserve room for the icon.
   SCREEN READERS: both cards prefix the aria-label with "Recurring ", e.g. "Recurring Timed event: Planning block, 9 - 10 AM". So a narrow card loses the glyph but never loses the announcement.

2. DRAG / RESIZE IN THE GRID SHOWS NO SCOPE DIALOG. packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx builds the draft with editGridEventDraft(sourceEvent, "this") and commits through useUpdateEvent. Source comment: "Matches DayInteractionCoordinator: drag/resize commits go through useUpdateEvent (including recurring events) with no scope dialog." packages/web/src/events/mutations/useUpdateEvent.ts comments: "Recurrence always stays 'preserve' here — this hook only ever moves/resizes an existing event, never edits its recurrence rule." One guard: moving a repeating event to another calendar is blocked with "Repeating events can't move to another calendar."

3. THE SCOPE CHOICE ARRIVES AFTER THE FACT, AS A TOAST. packages/web/src/common/utils/toast/recurrence-scope.toast.tsx renders "Changed/Deleted <title>" plus the question "Apply to series?" with exactly two buttons: Following (keyboard 1) and All (keyboard 2). There is deliberately NO "This event" button — "this" already happened. State machine: packages/web/src/events/recurrence/recurrence-scope-opportunity.store.ts (begin / dismiss / requestPromotion / claimPromotion / complete). Mounted app-wide by packages/web/src/events/recurrence/RecurrenceScopeOpportunityHost.tsx.
   SESSION-SCOPED SUPPRESSION: the store keeps a `declinedEditInstanceIds` set. Source comment: "once ignored, that instance is a deliberate one-off and its later edits stop asking. Delete asks never read or write this set."
   The opportunity opens only when original.recurrence.kind === "occurrence" && scope === "this" && recurrence.kind === "preserve" && !isRestoringHistory() && the instance was not previously declined.

4. DELETE NEVER PROMPTS. packages/web/src/events/recurrence/recurrence-scope-decision.ts returns { kind: "apply", scope: THIS_EVENT } unconditionally for action === "delete"; packages/web/src/views/Forms/hooks/useDeleteEvent.ts hardcodes scope: "this" with the comment "No confirmation prompt: deletes are undoable via Cmd/Ctrl+Z."

5. WEEK DELIBERATELY DIFFERS FROM DAY. packages/web/src/views/Week/WeekView.tsx renders <SidebarEventDetails confirmAllRecurringEdits={false} />; the prop defaults to true and Day view takes the default. Docblock: "Day view always prompts before saving any edit to an existing recurring event. Week view applies occurrence-count and instance heuristics instead." Those heuristics are resolveRecurrenceScopeDecision() in recurrence-scope-decision.ts, returning prompt | apply | convertToStandalone. Key week rule: an occurrence edit with recurrence.kind === "preserve" never prompts — "apply to this instance now and let the live toast promote the exact mutation to following/all."

6. THE FORM (SIDEBAR) PATH STILL HAS A RADIO DIALOG. packages/web/src/views/Forms/EventForm/RecurrenceScopeDialog.tsx, a role="radiogroup" titled "Apply changes to", options This Event / This and Following Events / All Events, default = first option. When the recurrence RULE itself changed the options shrink to [This and Following, All] so the default becomes "This and Following Events" — "this" is not a valid rule-change operation.

7. THE SERIES BASE IS NEVER RENDERED. packages/web/src/events/queries/event.view-model.ts, scheduledNonSeries() filters `event.recurrence.kind !== "series"`, docblock: "A series base is metadata-only… Rendering the base too would double the first day."

8. BACKGROUND ONLY — ONE SENTENCE MAX EACH, do not expand: instances are materialized server-side by packages/sync/src/domain/occurrence-projection.ts for signed-in users, expanded client-side by packages/web/src/events/recurrence/expandLocalEventRecords.ts for local/IndexedDB use, and expanded optimistically in packages/web/src/events/mutations/useEventMutations.ts so a recurring create is not invisible until the settle refetch.

9. OPTIONAL, AT MOST ONE OR TWO SENTENCES OF BODY PROSE (NOT a second trap section): the grid's GridEvent type (packages/web/src/common/types/web.event.types.ts) carries a legacy recurrence shape { rule?, eventId? }, down-converted in event.view-model.ts from the strict discriminated union kind: "single" | "series" | "occurrence" in packages/core/src/types/event.contracts.ts. An occurrence carries no rule of its own, so opening one reads as non-recurring unless the caller resolves the base.

THE CLOSING TRAP SECTION — title it exactly '## The Scope You Did Not Choose'. Content: dragging or resizing a recurring event in the week grid does not ask which occurrences you meant; it commits to THIS occurrence and only then offers promotion through the "Apply to series?" toast. If you dismiss or ignore that toast, declinedEditInstanceIds records the instance as a deliberate one-off and later edits to it stop asking altogether — so the quietest possible outcome (drag, ignore a toast) is also the one that silently opts that instance out of the series for the rest of the session. Contributors adding a new grid mutation must decide whether it should open a scope opportunity, because nothing in the drag path will do it for them.
```

#### FACTS/colors.md
_Included because: AC-3 and AC-4. The two mandatory constraints plus the example ban._

```
EVENT COLORS.

1. ELEVEN SLOTS, A ZOD ENUM, 1:1 WITH GOOGLE. packages/core/src/types/event-color.contracts.ts:

    export const EventColorSlotSchema = z.enum([
      "lavender", "mint", "plum", "coral", "gold", "orange",
      "blue", "slate", "indigo", "green", "red",
    ]);

   Source comment verbatim: "Compass-owned event color slots. Maps 1:1 onto Google's legacy 11 event colors; providers adapt to/from these names at the boundary."
   Helpers in the same file: OptionalNullableEventColorSchema (nullable+optional — null CLEARS a tag), withColor() which omits the key entirely when the value is undefined, and withColorHex() mirroring it.

2. colorHex IS READ-ONLY / PROVIDER-ASSIGNED. Same file, verbatim comment on OptionalHexEventColorSchema: "A provider-assigned custom event color (e.g. Google's post-June-2026 event labels) that has no equivalent Compass slot. Read-only: Compass's own color picker still only ever writes `color`, never this."
   Both write paths confirm it: packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx calls onChange(slot) / onChange(null) only, and packages/web/src/views/Forms/hooks/useSetEventColor.ts patches the draft with { color } only — patchGridDraftFields(draft, { color }).

3. RENDERING. packages/web/src/common/styles/theme.util.ts holds EVENT_COLOR_SLOT_HEX (lavender #7986CB, mint #33B679, plum #8E24AA, coral #E67C73, gold #F6BF26, orange #F4511E, blue #039BE5, slate #616161, indigo #3F51B5, green #0B8043, red #D50000) and eventColorLabel(color), which returns "Calendar default" for null.
   Precedence, from resolveEventPalette: colorHex wins, then color, then the active theme's default palette. Use useEventPalette in components (it subscribes so a theme switch repaints); getEventPalette is the non-reactive read for plain functions.
   Palettes are DERIVED from a base hex (buildEventPaletteFromBase): hover = brighten(base), gradient = linear-gradient of darken(base,15) → darken(base,30), saveButtonShadow = darken(base,25).

4. HOW A SLOT COLOUR IS APPLIED — THE SANCTIONED PATTERN. The picker applies a slot as an INLINE STYLE from the hex map, never a utility class:
       style={{ backgroundColor: EVENT_COLOR_SLOT_HEX[slot] }}
   Its structural classes are SEMANTIC tokens: border-border, bg-bg-primary, ring-accent, outline-text.

5. THE BAN (AC-4). packages/scripts/src/testing/check-semantic-colors.ts, run by `bun run lint`, greps packages/web/src for raw palette utilities matching (bg|text|border|ring|outline|placeholder|divide|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-\d{2,3})? and raw --color-<palette> theme tokens, and exits 1 listing every violation: "Raw Tailwind colors are not allowed. Use semantic Compass colors".
   YOUR CONSTRAINT: no example in this doc may show such a class. Show the inline-style pattern or semantic tokens instead.
```

#### FACTS/house-style-exemplar.md
_Included because: AC-5 house style, and the link target for drag mechanics (AC-6)._

```
docs/frontend/ currently holds: week-drag-interaction.md, frontend-runtime-flow.md, responsive-layout.md, event-caching.md.

HOUSE STYLE, as exhibited by docs/frontend/week-drag-interaction.md (112 lines):
- H1 title, then a single one-line summary sentence.
- '## The one-sentence model' whose body opens with a BOLDED thesis sentence, e.g. "**A drag column knows its own date.**" followed by 2-4 lines expanding it.
- '## Why this exists' giving the historical failure the design fixes, often as a bullet list of symptoms.
- '## How it works now' with a short mermaid flowchart, then a 'Files:' bullet list of backticked repo-relative paths each with a one-line explanation.
- Prose is explanatory and dense; inline backticked paths appear constantly mid-sentence.
- A named, non-generic trap section at the end. week-drag-interaction.md uses '## updateVisual Must Be Idempotent' mid-document and closes with '## Pitfall'. event-caching.md closes with '## Memo Comparator Trap'.
- Relative links between docs, e.g. "[Responsive Layout](./responsive-layout.md)".

LINK TARGETS FOR YOUR PAGE (link, do NOT restate):
- ./week-drag-interaction.md — owns how dragging a SAVED event resolves the day it lands on: the layout cache stamping { index, left, width, date } per column, mid-drag week navigation, and the idempotency requirement on updateVisual.
- ../acceptance/recurring-events.md — owns recurrence UX as a manual acceptance runbook.

Both files are OFF-LIMITS for editing in this run.
```
### Acceptance criteria
- File docs/frontend/weekly-view-interactions.md is created and is the ONLY file written.
- Covers all three topics: all-day/multi-day selection, recurring events, event colors.
- States explicitly that all-day drag-to-create is NOT implemented on this branch; all-day creation is click-only with a fixed one-day span, citing useAllDayDraftCreation.ts and its hardcoded dayjs(startDate).add(1, 'day').
- States that multi-day all-day spans arise from move/resize of saved events, not from drag-selection at create time.
- Contrasts with the timed grid's drag-to-select (useTimedDraftCreation.ts), which does attach mousemove/mouseup listeners.
- Colors section states the 11-slot Zod enum in packages/core/src/types/event-color.contracts.ts mapping 1:1 to Google's legacy colors.
- Colors section states colorHex is read-only / provider-assigned and the picker only ever writes `color`.
- No raw Tailwind or theme colour utility class appears anywhere in the file.
- Opens with a '## The one-sentence model' section containing a bolded thesis sentence.
- Closes with exactly ONE named trap section titled '## The Scope You Did Not Choose'. No second trap section.
- Contains a relative link to ./week-drag-interaction.md and to ../acceptance/recurring-events.md, without restating their content.
- Inline backticked repo-relative paths are used to cite implementing modules throughout.
- At most one mermaid diagram.
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "content"
  ]
}
```