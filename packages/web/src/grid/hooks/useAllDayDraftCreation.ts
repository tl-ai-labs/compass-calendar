import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import { type CompassEvent } from "@core/types/compass-event.contracts";
import { type CalendarId } from "@core/types/domain-primitives";
import { isRightClick } from "@web/common/utils/mouse/mouse.util";
import { type GridEventDraft } from "@web/events/event-draft.types";
import {
  allDayGridSchedule,
  createGridEventDraft,
  gridEventDraftToSchemaEvent,
} from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  selectIsDrafting,
  useDraftStore,
} from "@web/events/stores/draft.store";
import { getAllDayCreateRange } from "@web/grid/interaction/math/all-day.create";
import { ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { hasExceededInteractionMoveThreshold } from "@web/interaction/interaction.pointer";

/**
 * All-day draft creation: a click makes a one-day draft, a horizontal drag
 * across day columns makes a spanning one.
 *
 * Three deliberate differences from `useTimedDraftCreation`, the gesture this
 * otherwise mirrors. Each exists for a reason; none is an oversight.
 *
 * 1. **Returns a bare handler, not `{ start… }`.** The timed hook returns an
 *    object. This one stays a plain function because both call sites bind it
 *    directly (Week to `onMouseDown`, Day through `createOnCalendarSurface`),
 *    and changing the shape would churn them for no behavioral gain.
 * 2. **The mousedown still commits.** The timed gesture only commits on
 *    `mouseup`; here the press commits the one-day draft immediately, exactly
 *    as this hook always has, and a drag *supersedes* it with a second commit
 *    on release. A plain click therefore fires the callback once, a drag twice.
 *    Both current callbacks are idempotent overwrites; a future callback with
 *    side effects (analytics, network) must account for this.
 * 3. **`finish()` calls `preventDefault()` but NOT `stopPropagation()`.** The
 *    timed gesture stops propagation. Doing that here would break the feature:
 *    Week's editor is opened by `useGridMouseUp`, a bubble-phase `mouseup`
 *    listener on `#root`, so swallowing the event at window-capture means the
 *    form never opens after a drag-create.
 *
 * The preview is gated on the resolved *day* changing, not just on pixels. That
 * is what keeps the Day view's behavior bit-identical: its `getStartDate`
 * always returns the single date in view, so no preview ever starts there.
 */
interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}

interface AllDayDraftCreationGesture {
  cancel(): void;
}

export const useAllDayDraftCreation = ({
  getStartDate,
  onCreateDraft,
  onCreateGridDraft,
}: UseAllDayDraftCreationOptions) => {
  const isDrafting = useDraftStore(selectIsDrafting);
  const gestureRef = useRef<AllDayDraftCreationGesture | null>(null);

  useEffect(() => {
    return () => {
      gestureRef.current?.cancel();
    };
  }, []);

  return (
    event: ReactMouseEvent<HTMLElement>,
    calendarId: CalendarId | null = null,
  ) => {
    if (isRightClick(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isDrafting) {
      draftActions.discard();
      return;
    }

    gestureRef.current?.cancel();

    const anchorPoint = { x: event.clientX, y: event.clientY };
    const anchorDate = getStartDate(event.clientX, event.clientY);
    let hasMoved = false;
    let isCancelled = false;
    let isFinished = false;
    let isPreviewStarted = false;

    const buildDraft = (pointerDate: string) => {
      const { startDate, endDate } = getAllDayCreateRange(
        anchorDate,
        pointerDate,
      );

      return createGridEventDraft(
        allDayGridSchedule(startDate, endDate),
        undefined,
        calendarId,
      );
    };

    const commit = (draft: GridEventDraft) => {
      if (onCreateGridDraft) {
        onCreateGridDraft(draft);
        return;
      }

      onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
    };

    // Live X, frozen Y. `getDateByXY` adds `getMinuteByY(y)` minutes to the
    // column's date, so a pointer dragged down into a scrolled timed grid could
    // otherwise accumulate a full day and silently resolve to tomorrow. This
    // gesture is horizontal by definition, so the Y it started on is the only
    // Y that means anything.
    const resolvePointerDate = (mouseEvent: MouseEvent) =>
      getStartDate(mouseEvent.clientX, anchorPoint.y);

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleWindowBlur);
      gestureRef.current = null;
    };

    // The store draft is the preview: the week renders it straight from the
    // store while the gesture runs, so every qualifying move has to write it.
    const previewDraft = (mouseEvent: MouseEvent) => {
      const pointerDate = resolvePointerDate(mouseEvent);

      // Nothing to preview until the pointer actually leaves the anchor day.
      if (!isPreviewStarted && pointerDate === anchorDate) {
        return;
      }

      const nextDraft = buildDraft(pointerDate);

      if (isPreviewStarted) {
        draftActions.setGridDraft(nextDraft);
        return;
      }

      isPreviewStarted = true;
      draftActions.startGridDraft({ activity: "creating", draft: nextDraft });
    };

    function finish(mouseEvent: MouseEvent) {
      if (isFinished || isCancelled) {
        return;
      }

      isFinished = true;
      cleanup();

      // A press that never spanned a second day already committed its one-day
      // draft on mousedown. Returning here leaves the mouseup untouched so it
      // bubbles to #root, where useGridMouseUp opens the form as it does for
      // any plain click.
      if (!isPreviewStarted) {
        return;
      }

      mouseEvent.preventDefault();
      commit(buildDraft(resolvePointerDate(mouseEvent)));
    }

    function cancel() {
      if (isFinished || isCancelled) {
        return;
      }

      isCancelled = true;
      cleanup();

      if (isPreviewStarted) {
        draftActions.discard();
      }
    }

    function handleMouseMove(mouseEvent: MouseEvent) {
      if (isFinished || isCancelled) {
        return;
      }

      if (mouseEvent.buttons !== 1) {
        finish(mouseEvent);
        return;
      }

      if (
        !hasMoved &&
        !hasExceededInteractionMoveThreshold(
          { x: mouseEvent.clientX, y: mouseEvent.clientY },
          anchorPoint,
          ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX,
        )
      ) {
        return;
      }

      hasMoved = true;
      previewDraft(mouseEvent);
    }

    function handleMouseUp(mouseEvent: MouseEvent) {
      finish(mouseEvent);
    }

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key !== "Escape") {
        return;
      }

      // Only claim the key when there is a preview to take back. Before that
      // the draft belongs to the mousedown commit, and other Escape handlers
      // are entitled to see the event.
      if (isPreviewStarted) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
      }

      cancel();
    }

    function handleWindowBlur() {
      cancel();
    }

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleWindowBlur);
    gestureRef.current = { cancel };

    commit(buildDraft(anchorDate));
  };
};
