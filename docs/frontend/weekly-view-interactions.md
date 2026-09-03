# Weekly View Interactions

Reference guide for week view event creation, multi-day spans, recurrence semantics, and event color resolution.

## The one-sentence model

**The week grid commits every gesture immediately and asks about scope afterward.**

Creation resolves synchronously on mousedown, and recurrence scope is negotiated after the commit, never before.

## All-Day and Multi-Day Selection

Drag-to-create does **NOT** exist for all-day events on this branch. Creation on the all-day bar is strictly click-only and always creates a fixed one-day span.

### All-Day Creation Gesture

All-day draft creation is implemented in `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`. The entire creation gesture completes synchronously on `mousedown` without registering any `mousemove` or `mouseup` event listeners.

When triggered on the all-day row section (`packages/web/src/grid/components/AllDayGridRow.tsx`, `aria-label="All-day events"`):
1. It guards against right clicks via `isRightClick(event)` and returns early.
2. It calls `event.preventDefault()` and `event.stopPropagation()`.
3. If a draft is already open, it calls `draftActions.discard()` and returns immediately without creating a replacement.
4. Otherwise, it calculates a one-day span directly using:
   ```ts
   const startDate = getStartDate(event.clientX, event.clientY);
   const endDate = dayjs(startDate)
     .add(1, "day")
     .format(YEAR_MONTH_DAY_FORMAT);
   ```
5. It instantiates the draft with `createGridEventDraft(allDayGridSchedule(startDate, endDate), undefined, calendarId)`.

Call sites include `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` and `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx`, which pass an `onCreateGridDraft` callback triggering `draftActions.startGridDraft({ activity: "gridClick", draft })`.

Unit tests in `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` verify this synchronous behavior:
- `"creates a one-day all-day draft and stops the opening press"`: asserts the schedule is `{ kind: "allDay", start: new Date("2026-05-20"), end: new Date("2026-05-21") }`.
- `"ignores right-click presses"`.
- `"dismisses an existing draft without creating a replacement"`.

### Contrast: Timed Grid Creation

In contrast to the all-day row, drag-to-select-a-span exists exclusively in the timed grid via `packages/web/src/grid/hooks/useTimedDraftCreation.ts`.

On an eligible primary pointer down (`isEligibleInteractionPointerDown` filters out modifier keys and non-primary buttons), `useTimedDraftCreation` attaches window-level listeners:
- `window.addEventListener("mousemove", handleMouseMove, true)`
- `window.addEventListener("mouseup", handleMouseUp, true)`
- `window.addEventListener("blur", handleWindowBlur)`

Behavioral rules in the timed grid include:
- A plain click without pointer movement past `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (`packages/web/src/interaction/interaction.constants.ts`) creates a default 30-minute draft (`DRAFT_DURATION_MIN` from `packages/web/src/grid/grid.constants.ts`).
- Movement past `hasExceededInteractionMoveThreshold` adjusts the draft end time to follow the pointer, floored at one `GRID_TIME_STEP` above the start. Dragging upward swaps the start and end (`resolvedStartDate = pointerDate, resolvedEndDate = start`).
- The live gesture preview writes directly to the store draft (`draftActions.startGridDraft({ activity: "creating", draft })` followed by `draftActions.setGridDraft(next)` on each move) so views render it live.
- Window blur cancels the gesture.

### Where Multi-Day Spans Come From

Multi-day all-day spans never originate from drag-creation; they arise by moving or resizing an already-saved all-day event. Multi-day spans also arise from the event form's independent end-date picker (`packages/web/src/views/Forms/EventForm/DateControlsSection/DateTimeSection/DatePickers/DatePickers.tsx`) and from multi-day timed events being projected into the all-day row (`packages/web/src/events/queries/event.view-model.ts` filters timed events through `shouldRenderTimedInAllDayRow()` and re-renders them with `scheduleOverride: { isAllDay: true, isTimedMultiDayDisplay: true }`).

The geometry math for manipulating saved all-day events is handled by `packages/web/src/grid/interaction/math/all-day.resize.ts` and `packages/web/src/grid/interaction/math/all-day.drag.ts` (with siblings `timed.drag.ts`, `timed.resize.ts`, and `cross-row.drag.ts`):
- `createAllDayResizeVisual` captures `{ startDayIndex, endDayIndex, initialEdge, initialStartDayIndex, initialEndDayIndex }`.
- `updateAllDayResizeVisual` locates the nearest column via `getNearestDayColumn(layout.dayColumns, pointer.x)` and branches on `visual.initialEdge === "startDate"` (`resizeFromStart`) versus `resizeFromEnd`.

Commit math and idempotency rules are owned by [Week Drag Interaction](./week-drag-interaction.md).

## Recurring Events

The week view treats recurring events with an optimistic, non-blocking interaction model. For the manual QA runbook, consult [Recurring Events Acceptance Runbook](../acceptance/recurring-events.md).

### Visual Marker and Accessibility

Recurring events render a decorative icon via `packages/web/src/grid/components/EventRepeatIcon.tsx` (`RepeatIcon`, size 10, bold weight, `aria-hidden="true"`, positioned absolute bottom-right, tinted `darken(baseColor, 30)`):
- **Timed cards** (`packages/web/src/grid/components/TimedEventCard.tsx`): The repeat glyph is gated by both duration and width:
  ```ts
  const showRepeatIcon = isRecurring && !isPlaceholder &&
    durationMinutes >= REPEAT_ICON_MIN_DURATION_MINUTES && position.width >= REPEAT_ICON_MIN_WIDTH;
  ```
  with `REPEAT_ICON_MIN_DURATION_MINUTES = 15` and `REPEAT_ICON_MIN_WIDTH = 40`. Gating by duration minutes rather than pixel height ensures events created at 15 minutes and events resized to 15 minutes evaluate thresholds consistently.
- **All-day cards** (`packages/web/src/grid/components/AllDayEventCard.tsx`): Apply only a width gate using that file's own `REPEAT_ICON_MIN_WIDTH = 60` (a separate constant from the timed card's `40`, with no duration gate) and add card padding to allocate space for the glyph.
- **Screen readers**: Both card types prefix the accessible name with `"Recurring "` (e.g. `"Recurring Timed event: Planning block, 9 - 10 AM"`), ensuring narrow cards retain screen reader announcements even if the icon is hidden.

### Grid Mutation Scope and Post-Commit Toast

Direct grid drag and resize interactions never interrupt the user with a modal confirmation dialog:
- `packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` builds drafts with `editGridEventDraft(sourceEvent, "this")` and commits via `packages/web/src/events/mutations/useUpdateEvent.ts`.
- `useUpdateEvent` preserves recurrence (`recurrence.kind` remains `"preserve"`), moving or resizing only the target occurrence. Moving repeating events between different calendars is blocked (`"Repeating events can't move to another calendar."`).
- Deletion never prompts with a modal dialog: `packages/web/src/events/recurrence/recurrence-scope-decision.ts` returns `{ kind: "apply", scope: THIS_EVENT }` unconditionally for `action === "delete"`, and `deleteEventAndDiscardDraft` in `packages/web/src/views/Forms/hooks/useDeleteEvent.ts` hardcodes `scope: "this"` (while the `useDeleteEvent` hook accepts a caller-supplied scope). A single event or a single occurrence at scope `"this"` is undoable via Cmd/Ctrl+Z, whereas deleting a series base or deleting at scope `"all"` or `"thisAndFollowing"` is not undoable. Deletions do raise the post-commit toast with the verb `"Deleted"`.

Following a mutation, the scope choice is presented non-modally via a post-commit toast rendered by `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx`:
- The toast prompts `"Apply to series?"` with two buttons: **Following** (keyboard shortcut `1`) and **All** (keyboard shortcut `2`). There is no `"This event"` button because the edit or deletion has already applied to the single occurrence.
- At the mutation call site in `packages/web/src/events/mutations/useEventMutations.ts`, opportunities are opened when `original.recurrence.kind === "occurrence" && scope === "this" && recurrence.kind === "preserve" && !isRestoringHistory()` (and the instance was not previously declined) for edits, or when `original.recurrence.kind === "occurrence" && scope === "this" && !isRestoringHistory()` for deletes. The state machine is managed by `packages/web/src/events/recurrence/recurrence-scope-opportunity.store.ts` (hosted by `packages/web/src/events/recurrence/RecurrenceScopeOpportunityHost.tsx`).
- The store tracks ignored or dismissed instances in a `declinedEditInstanceIds` set; dismissing the toast records the instance in `declinedEditInstanceIds` so later edits to that instance stop asking for the rest of the session.

### Week vs. Day View Differences and Form Fallback

Week view differs intentionally from Day view:
- `packages/web/src/views/Week/WeekView.tsx` renders `<SidebarEventDetails confirmAllRecurringEdits={false} />`, whereas Day view defaults `confirmAllRecurringEdits` to `true` and always prompts prior to saving. Week view uses `resolveRecurrenceScopeDecision()` heuristics to apply edits directly to occurrences and offer promotion via toast.
- The sidebar form retains a modal selection dialog in `packages/web/src/views/Forms/EventForm/RecurrenceScopeDialog.tsx` (`role="radiogroup"` with options *This Event*, *This and Following Events*, and *All Events*). If the recurrence rule itself changed, the *This Event* option is excluded and the selection defaults to *This and Following Events*.

### Series Storage and Projection

- Series base records are metadata-only and never rendered directly; `packages/web/src/events/queries/event.view-model.ts` filters them out via `scheduledNonSeries()` (`event.recurrence.kind !== "series"`) to prevent double-rendering the first day.
- Instances are materialized server-side by `packages/sync/src/domain/occurrence-projection.ts` for authenticated users.
- Instances are expanded client-side by `packages/web/src/events/recurrence/expandLocalEventRecords.ts` for local/IndexedDB storage.
- Instances are expanded optimistically by `packages/web/src/events/mutations/useEventMutations.ts` so recurring creations appear before query refetches settle.
- In the grid layer, `GridEvent` (`packages/web/src/common/types/web.event.types.ts`) uses a legacy shape `{ rule?, eventId? }` down-converted from the discriminated union `kind: "single" | "series" | "occurrence"` in `packages/core/src/types/event.contracts.ts`, meaning occurrence objects do not carry their own rule directly.

## Event Colors

Compass Calendar models event colors using fixed slot identifiers aligned with standard calendar providers while supporting provider-assigned hex overrides.

### The 11 Slot Enum

Color slots are defined as a Zod enum in `packages/core/src/types/event-color.contracts.ts`:

```ts
export const EventColorSlotSchema = z.enum([
  "lavender", "mint", "plum", "coral", "gold", "orange",
  "blue", "slate", "indigo", "green", "red",
]);
```

These 11 slots map 1:1 onto Google Calendar's legacy event color palette. Helper schemas in `event-color.contracts.ts` include:
- `OptionalNullableEventColorSchema`: allows `null` to clear a custom color tag and revert to default.
- `withColor()` and `withColorHex()`: omit keys entirely when values are `undefined`.

### Read-Only colorHex

The `colorHex` property (`OptionalHexEventColorSchema`) represents provider-assigned custom hex colors (such as Google's post-June-2026 event labels) that lack an equivalent Compass slot name.
- `colorHex` is strictly read-only within Compass.
- The color picker in `packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx` only issues `onChange(slot)` or `onChange(null)`.
- Color updates through `packages/web/src/views/Forms/hooks/useSetEventColor.ts` only patch `{ color }` via `patchGridDraftFields(draft, { color })`, never writing `colorHex`.

### Palette Resolution and Token Architecture

Hex values and palettes are resolved in `packages/web/src/common/styles/theme.util.ts`:
- Canonical slot hex definitions (`EVENT_COLOR_SLOT_HEX`):
  - `lavender` (`#7986CB`), `mint` (`#33B679`), `plum` (`#8E24AA`), `coral` (`#E67C73`), `gold` (`#F6BF26`), `orange` (`#F4511E`)
  - `blue` (`#039BE5`), `slate` (`#616161`), `indigo` (`#3F51B5`), `green` (`#0B8043`), `red` (`#D50000`)
- `eventColorLabel(color)` returns the slot name, or `"Calendar default"` when `color` is `null`.
- `resolveEventPalette` checks precedence: `colorHex` takes highest precedence, followed by `color` slot hex, falling back to the active theme's default palette.
- Components use the reactive `useEventPalette` hook (subscribing to theme changes), while non-reactive computations call `getEventPalette`.
- Derivative palette shades are built dynamically via `buildEventPaletteFromBase`:
  - Hover background: `brighten(base)`
  - Gradient: `linear-gradient` from `darken(base, 15)` to `darken(base, 30)`
  - Button shadow: `darken(base, 25)`

### Styling Rules and Palette Utility Ban

To apply slot colors, components apply inline styles mapped from the hex definition rather than dynamic class names:

```tsx
style={{ backgroundColor: EVENT_COLOR_SLOT_HEX[slot] }}
```

Component containers use semantic tokens such as `border-border`, `bg-bg-primary`, `ring-accent`, and `outline-text`.

Arbitrary Tailwind color utility classes (such as raw color scales) and `--color-*` theme tokens are strictly forbidden across `packages/web/src`. The linter script `packages/scripts/src/testing/check-semantic-colors.ts` runs during `bun run lint` and fails if any disallowed raw color utilities are detected.

## The Scope You Did Not Choose

Dragging or resizing a recurring event in the week grid does not ask which occurrences you meant; it commits to THIS occurrence and only then offers promotion through the "Apply to series?" toast. If you dismiss or ignore that toast, `declinedEditInstanceIds` records the instance as a deliberate one-off and later edits to it stop asking altogether — so the quietest possible outcome (drag, ignore a toast) is also the one that silently opts that instance out of the series for the rest of the session. Contributors adding a new grid mutation must decide whether it should open a scope opportunity, because nothing in the drag path will do it for them.
