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
import {
  type AllDayCreateRange,
  isSameAllDayCreateRange,
  resolveAllDayCreateRange,
} from "@web/grid/interaction/math/all-day.create";
import { ALL_DAY_DRAFT_CREATE_MOVE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { hasExceededInteractionMoveThreshold } from "@web/interaction/interaction.pointer";

interface AllDayDraftCreationGesture {
  cancel(): void;
}

interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  /**
   * Opt-in (Week only): press-and-drag across day columns creates one draft
   * spanning the first→last column touched, previewed live through the draft
   * store. Off by default — the Day view's columns are calendars, not days, so
   * a horizontal drag there means nothing. When off, no window listener is
   * registered and the hook behaves exactly as it did before this option existed.
   */
  isMultiDayDragEnabled?: boolean;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}

export const useAllDayDraftCreation = ({
  getStartDate,
  isMultiDayDragEnabled = false,
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

    const anchorDate = getStartDate(event.clientX, event.clientY);

    const createDraftForRange = (range: AllDayCreateRange) =>
      createGridEventDraft(
        allDayGridSchedule(range.startDate, range.endDate),
        undefined,
        calendarId,
      );

    const handOffDraft = (draft: GridEventDraft) => {
      if (onCreateGridDraft) {
        onCreateGridDraft(draft);
        return;
      }

      onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
    };

    if (!isMultiDayDragEnabled) {
      handOffDraft(
        createDraftForRange(resolveAllDayCreateRange(anchorDate, anchorDate)),
      );
      return;
    }

    gestureRef.current?.cancel();

    const pointerStart = { x: event.clientX, y: event.clientY };
    let hasMoved = false;
    let isCancelled = false;
    let isFinished = false;
    let isPreviewStarted = false;
    let lastRange: AllDayCreateRange | null = null;

    // The day column is resolved from clientX alone. `getDateByXY` folds y into
    // the resolved date through an unbounded `getMinuteByY`, so a live y from a
    // pointer dragged below the grid would silently roll the span into the next
    // day. `pointerStart.y` is captured at press and never reassigned.
    const resolveRangeForPointer = (clientX: number) => {
      if (!hasMoved) {
        return resolveAllDayCreateRange(anchorDate, anchorDate);
      }

      return resolveAllDayCreateRange(
        anchorDate,
        getStartDate(clientX, pointerStart.y),
      );
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      gestureRef.current = null;
    };

    // The store draft is the preview: the all-day row renders it straight from
    // the store while the gesture runs, so a changed span has to be written.
    const previewRange = (range: AllDayCreateRange) => {
      if (isPreviewStarted && isSameAllDayCreateRange(lastRange, range)) {
        return;
      }

      lastRange = range;
      const draft = createDraftForRange(range);

      if (isPreviewStarted) {
        draftActions.setGridDraft(draft);
        return;
      }

      isPreviewStarted = true;
      draftActions.startGridDraft({ activity: "creating", draft });
    };

    function finish(mouseEvent: MouseEvent) {
      if (isFinished || isCancelled) {
        return;
      }

      isFinished = true;
      cleanup();
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      handOffDraft(
        createDraftForRange(resolveRangeForPointer(mouseEvent.clientX)),
      );
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
          { x: mouseEvent.clientX, y: pointerStart.y },
          pointerStart,
          ALL_DAY_DRAFT_CREATE_MOVE_THRESHOLD_PX,
        )
      ) {
        return;
      }

      hasMoved = true;
      previewRange(resolveRangeForPointer(mouseEvent.clientX));
    }

    function handleMouseUp(mouseEvent: MouseEvent) {
      finish(mouseEvent);
    }

    function handleWindowBlur() {
      cancel();
    }

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);
    gestureRef.current = { cancel };
  };
};
