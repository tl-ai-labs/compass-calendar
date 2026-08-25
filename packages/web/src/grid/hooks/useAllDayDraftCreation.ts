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
import { ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import {
  hasExceededInteractionMoveThreshold,
  isEligibleInteractionPointerDown,
} from "@web/interaction/interaction.pointer";

interface AllDayDraftCreationGesture {
  cancel(): void;
}

interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  /**
   * Off by default. When off, no window listener is registered and the hook
   * behaves exactly as it did before this option existed: a mousedown commits
   * a one-day draft immediately. Week's all-day row opts in; the Day view does
   * not, which is what keeps Day behaviour byte-identical.
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

  // Shared by the click path and the drag path, so a sub-threshold release is
  // guaranteed to produce the same draft, callback and activity as a click.
  const commitAllDayDraft = (
    range: AllDayCreateRange,
    calendarId: CalendarId | null,
  ) => {
    const draft = createGridEventDraft(
      allDayGridSchedule(range.startDate, range.endDate),
      undefined,
      calendarId,
    );

    if (onCreateGridDraft) {
      onCreateGridDraft(draft);
      return;
    }

    onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
  };

  const startMultiDayGesture = (
    event: ReactMouseEvent<HTMLElement>,
    calendarId: CalendarId | null,
  ) => {
    gestureRef.current?.cancel();
    const pointerStart = { x: event.clientX, y: event.clientY };
    const anchorDate = getStartDate(event.clientX, event.clientY);
    let hasMoved = false;
    let isCancelled = false;
    let isFinished = false;
    let isPreviewStarted = false;
    let lastRange: AllDayCreateRange | null = null;
    const gesture: AllDayDraftCreationGesture = { cancel };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown, true);
      if (gestureRef.current === gesture) {
        gestureRef.current = null;
      }
    };

    // The store draft is the preview: both views render it straight from the
    // store while the gesture runs, so every move has to write it.
    const previewDraft = (mouseEvent: MouseEvent) => {
      const range = resolveAllDayCreateRange(
        anchorDate,
        getStartDate(mouseEvent.clientX, mouseEvent.clientY),
      );

      // Re-checked after getStartDate: that is consumer code and can re-enter.
      if (isCancelled || isFinished) {
        return;
      }

      if (isPreviewStarted && isSameAllDayCreateRange(lastRange, range)) {
        return;
      }

      lastRange = range;
      const draft = createGridEventDraft(
        allDayGridSchedule(range.startDate, range.endDate),
        undefined,
        calendarId,
      );

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

      const range = hasMoved
        ? resolveAllDayCreateRange(
            anchorDate,
            getStartDate(mouseEvent.clientX, mouseEvent.clientY),
          )
        : resolveAllDayCreateRange(anchorDate);

      commitAllDayDraft(range, calendarId);
    }

    function cancel() {
      if (isFinished || isCancelled) {
        return;
      }

      isCancelled = true;
      cleanup();

      // Never discards a draft this gesture did not create.
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
          pointerStart,
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

    function handleWindowBlur() {
      cancel();
    }

    // Net-new: the timed hook has no Escape handling. Capture-phase and scoped
    // to the live gesture, so a global Escape handler cannot also act on a
    // draft that is being torn down in the same tick. Only claims Escape once
    // the gesture owns a visible preview, so an armed-but-never-previewed
    // gesture cannot steal Escape from modals or the command palette.
    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key !== "Escape") {
        return;
      }

      if (isPreviewStarted) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
      }

      cancel();
    }

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown, true);
    gestureRef.current = gesture;
  };

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
      // Always null when the drag is disabled, so this is a no-op there. When
      // enabled it kills an in-flight gesture that would otherwise commit on
      // its own release after the user dismissed the draft.
      gestureRef.current?.cancel();
      draftActions.discard();
      return;
    }

    if (
      isMultiDayDragEnabled &&
      isEligibleInteractionPointerDown({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        isPrimary: true,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      })
    ) {
      startMultiDayGesture(event, calendarId);
      return;
    }

    commitAllDayDraft(
      resolveAllDayCreateRange(getStartDate(event.clientX, event.clientY)),
      calendarId,
    );
  };
};
