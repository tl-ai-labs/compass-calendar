import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import { type CompassEvent } from "@core/types/compass-event.contracts";
import { type CalendarId } from "@core/types/domain-primitives";
import { isRightClick } from "@web/common/utils/mouse/mouse.util";
import { type GridEventDraft } from "@web/events/event-draft.types";
import {
  allDayGridSchedule,
  createGridEventDraft,
  gridEventDraftToSchemaEvent,
  replaceGridDraftSchedule,
} from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  selectIsDrafting,
  useDraftStore,
} from "@web/events/stores/draft.store";
import {
  type AllDayDayRange,
  hasExceededAllDayDragThreshold,
  isSameAllDayDayRange,
  resolveAllDayDayRange,
} from "@web/grid/interaction/math/all-day.create";
import { ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { isEligibleInteractionPointerDown } from "@web/interaction/interaction.pointer";

interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  /** Opt in to multi-day drag. Omit for press-only behaviour (Day view). */
  multiDayDrag?: { getVisibleDates: () => readonly string[] };
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}

export const useAllDayDraftCreation = ({
  getStartDate,
  multiDayDrag,
  onCreateDraft,
  onCreateGridDraft,
}: UseAllDayDraftCreationOptions) => {
  const isDrafting = useDraftStore(selectIsDrafting);
  const gestureRef = useRef<{
    cancel: (opts: { revert: boolean }) => void;
  } | null>(null);

  useEffect(
    () => () => {
      gestureRef.current?.cancel({ revert: false });
    },
    [],
  );

  return (
    event: ReactMouseEvent<HTMLElement>,
    calendarId: CalendarId | null = null,
  ) => {
    if (isRightClick(event)) {
      return;
    }

    gestureRef.current?.cancel({ revert: false });

    event.preventDefault();
    event.stopPropagation();

    if (isDrafting) {
      draftActions.discard();
      return;
    }

    const anchorDate = getStartDate(event.clientX, event.clientY);
    const visibleDates = multiDayDrag?.getVisibleDates();
    const pressRange = resolveAllDayDayRange({
      anchorDate,
      pointerDate: anchorDate,
      visibleDates,
    });

    const pressDraft = createGridEventDraft(
      allDayGridSchedule(pressRange.start, pressRange.end),
      undefined,
      calendarId,
    );

    if (onCreateGridDraft) {
      onCreateGridDraft(pressDraft);
    } else {
      onCreateDraft?.(gridEventDraftToSchemaEvent(pressDraft));
    }

    if (!multiDayDrag) {
      return;
    }

    if (
      !isEligibleInteractionPointerDown({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        isPrimary: true,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      })
    ) {
      return;
    }

    const pointerStart = { x: event.clientX, y: event.clientY };
    let hasMoved = false;
    let isFinished = false;
    let isCancelled = false;
    let lastRange: AllDayDayRange = pressRange;

    const resolveRangeForPointer = (mouseEvent: MouseEvent) =>
      resolveAllDayDayRange({
        anchorDate,
        pointerDate: getStartDate(mouseEvent.clientX, pointerStart.y),
        visibleDates,
      });

    const draftForRange = (range: AllDayDayRange) =>
      replaceGridDraftSchedule(
        pressDraft,
        allDayGridSchedule(range.start, range.end),
      );

    const cleanup = () => {
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("blur", onBlur);
      gestureRef.current = null;
    };

    const finish = (mouseEvent: MouseEvent) => {
      if (isFinished || isCancelled) return;
      isFinished = true;
      cleanup();
      if (!hasMoved) return;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      const finalRange = resolveRangeForPointer(mouseEvent);
      if (isSameAllDayDayRange(finalRange, pressRange)) return;
      const finalDraft = draftForRange(finalRange);
      if (onCreateGridDraft) {
        onCreateGridDraft(finalDraft);
      } else {
        onCreateDraft?.(gridEventDraftToSchemaEvent(finalDraft));
      }
    };

    const cancel = ({ revert }: { revert: boolean }) => {
      if (isFinished || isCancelled) return;
      isCancelled = true;
      cleanup();
      if (revert && hasMoved) {
        draftActions.setGridDraft(pressDraft);
      }
    };

    const onMouseMove = (mouseEvent: MouseEvent) => {
      if (isFinished || isCancelled) return;
      if (mouseEvent.buttons !== 1) {
        finish(mouseEvent);
        return;
      }
      if (
        !hasMoved &&
        !hasExceededAllDayDragThreshold(
          mouseEvent.clientX,
          pointerStart.x,
          ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX,
        )
      ) {
        return;
      }
      hasMoved = true;
      const nextRange = resolveRangeForPointer(mouseEvent);
      if (isSameAllDayDayRange(nextRange, lastRange)) {
        return;
      }
      lastRange = nextRange;
      draftActions.setGridDraft(draftForRange(nextRange));
    };

    const onMouseUp = (mouseEvent: MouseEvent) => {
      finish(mouseEvent);
    };

    const onBlur = () => {
      cancel({ revert: true });
    };

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("blur", onBlur);

    gestureRef.current = { cancel };
  };
};
