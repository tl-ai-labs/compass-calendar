## Task tp_design_001 — architecture_design / delta_change_plan
Module: week-allday-drag
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA change plan (change_plan.md) for multi-day drag-to-select in the Week all-day row. ANALYSIS ONLY — create and modify NO files; return the document as your final message.

READ: .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/requirements.md (FR-1..FR-7, NFR-1..4, invariants) and .sdlc/runs/.../intent_brief.md (scope/off-limits). Then read the real code: useAllDayDraftCreation.ts, useTimedDraftCreation.ts, Week AllDayRow.tsx, useTimedGridDraftCreation.ts, useDateCalcs.ts, grid-event-draft.adapter.ts (allDayGridSchedule, replaceGridDraftSchedule), draft.store.ts, all-day-draft.position.ts, AllDayGridRow.tsx, and the two consumers' existing tests.

THREE DECISIONS ARE ALREADY MADE — encode them, do not re-litigate:
(A) OPT-IN GESTURE. The drag path must activate ONLY when the caller passes the new range options. Week's binding is the sole opt-in call site. Day's call site (DayCalendarGrid.tsx) passes no new options and must keep the LITERAL existing code path.
(B) DAY INVARIANT (state verbatim in the doc). Day view builds one column PER CALENDAR at the same date (useDayCalendarColumns.ts:34-39 -> {date: dateInView, key: calendar.id}), and its x-axis selects a CALENDAR, not a day (DayCalendarGrid.tsx:341-342 getCalendarAtX via getVisibleDateIndexByX; read at mousedown, line ~353). Therefore the invariant is NOT merely 'the date range collapses to one day' — it is: Day's all-day creation MUST still commit on MOUSEDOWN through the existing single-day path, with the calendar resolved at the same instant it is today. Any always-on threshold/preview/commit-on-mouseup path would change WHEN the draft opens and WHICH calendar is captured (anchor column vs release column). Show how the chosen option shape makes this structurally impossible, not merely unlikely.
(C) END-DATE EXCLUSIVITY. allDayGridSchedule(start,end) takes an EXCLUSIVE end (today's click path does dayjs(start).add(1,'day')). An inclusive N-day drag therefore commits end = lastDay + 1 day. Say this once, precisely, and keep every example consistent with it.

SECTIONS: 1. Summary. 2. Option-shape decision — the exact new TypeScript types added to UseAllDayDraftCreationOptions and the exact return shape, with the backwards-compatibility argument for both existing callers (ADR-style: options considered, choice, why). 3. Pure math module — exact exported signatures for grid/interaction/math/all-day.create.ts (normalize, clamp to visible bounds, inclusive-span -> exclusive-end conversion, single-day case), all pure, no dayjs-in-signature if avoidable. 4. Gesture lifecycle — mousedown/mousemove/mouseup/blur/escape state machine, which listeners on which target, threshold constant decision (reuse TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX or add an all-day constant — pick one and justify), cleanup on unmount. Note explicitly whether the timed hook handles Escape today and what you add if it does not. 5. Preview + commit — exact draftActions calls and where clamping bounds come from (weekDays first/last). 6. File-by-file change table: path | new-or-edit | what changes | which FR it satisfies. Every path MUST come from the intent brief's allowlist. 7. Test plan per test file — the concrete cases each file must cover, including right-to-left, clamp, single-day, escape/blur, and the Day-view no-op proof. 8. Risks and rejected alternatives. 9. Sequencing — the order the work must land in, and which files are safe to write in parallel.

Be concrete and short: exact identifiers and signatures beat prose. No file:// links — use plain repo-relative paths. No LaTeX.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/hooks/useAllDayDraftCreation.ts
_Included because: The click-only creator being extended — the exact code the plan must change_

```
export const useAllDayDraftCreation = ({ getStartDate, onCreateDraft, onCreateGridDraft }: UseAllDayDraftCreationOptions) => {
  const isDrafting = useDraftStore(selectIsDrafting);
  return (event: ReactMouseEvent<HTMLElement>, calendarId: CalendarId | null = null) => {
    if (isRightClick(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isDrafting) { draftActions.discard(); return; }
    const startDate = getStartDate(event.clientX, event.clientY);
    const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
    const draft = createGridEventDraft(allDayGridSchedule(startDate, endDate), undefined, calendarId);
    if (onCreateGridDraft) { onCreateGridDraft(draft); return; }
    onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
  };
};
// options: getStartDate: (clientX:number, clientY:number)=>string; onCreateDraft?; onCreateGridDraft?
```

#### packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx
_Included because: The call site that must keep the literal existing path — note calendarId is the handler's 2nd arg, resolved at mousedown from x_

```
const onAllDayMouseDown = useAllDayDraftCreation({ getStartDate: getAllDayDraftStartDate, onCreateGridDraft: openGridDraftForm });
// ...
const getCalendarAtX = useCallback((clientX: number) => displayedCalendars[dateCalcs.getVisibleDateIndexByX(clientX)] ?? null, [dateCalcs, displayedCalendars]);
const createOnCalendarSurface = useCallback((event, createDraft: (event, calendarId: CalendarId|null)=>void) => {
  const calendar = getCalendarAtX(event.clientX);
  if (!canCreateDraftOnCalendar(calendar, showErrorToast, writableCalendarIds)) { event.preventDefault(); event.stopPropagation(); return; }
  // ... then calls createDraft(event, calendar.id) on MOUSEDOWN
}, [...]);
```
### Acceptance criteria
- Markdown only; no JSON; no file:// links; no LaTeX
- Section 2 gives exact TypeScript option and return types and argues backwards compatibility for both existing callers
- The Day invariant is stated as commit-on-mousedown + calendar-resolved-at-mousedown, citing useDayCalendarColumns.ts:34-39 and DayCalendarGrid.tsx:341-342, and shows why the opt-in shape makes a Day behavior change structurally impossible
- Exclusive end-date convention is stated once and every example is consistent with it
- Section 6's file table lists only paths from the intent brief allowlist and maps each to an FR
- Section 4 states whether Escape is handled by the timed hook today and what is added
- No file in the repository was created or modified by this task
### Your final message
Return the deliverable itself as your final message — the file content or
the document that was asked for, not a report about producing it.