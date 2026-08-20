import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type CompassEvent } from "@core/types/compass-event.contracts";
import { type CalendarId } from "@core/types/domain-primitives";
import dayjs from "@core/util/date/dayjs";
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
import { calculateAllDayCreateSchedule } from "@web/grid/interaction/math/all-day.create";
import { TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { hasExceededInteractionMoveThreshold } from "@web/interaction/interaction.pointer";

export interface AllDayVisibleBounds {
  minDate: string;
  maxDate: string;
}

export interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  visibleBounds?: AllDayVisibleBounds;
}

export type AllDayDraftCreationHandler = (
  event: ReactMouseEvent<HTMLElement>,
  calendarId?: CalendarId | null,
) => void;

interface AllDayDraftCreationGesture {
  cancel(): void;
}

export const useAllDayDraftCreation = ({
  getStartDate,
  onCreateDraft,
  onCreateGridDraft,
  visibleBounds,
}: UseAllDayDraftCreationOptions): AllDayDraftCreationHandler => {
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

    if (!visibleBounds) {
      const startDate = getStartDate(event.clientX, event.clientY);
      const endDate = dayjs(startDate)
        .add(1, "day")
        .format(YEAR_MONTH_DAY_FORMAT);

      const draft = createGridEventDraft(
        allDayGridSchedule(startDate, endDate),
        undefined,
        calendarId,
      );

      if (onCreateGridDraft) {
        onCreateGridDraft(draft);
        return;
      }

      onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
      return;
    }

    gestureRef.current?.cancel();

    const pointerStart = { x: event.clientX, y: event.clientY };
    const rawAnchorDate = getStartDate(event.clientX, event.clientY);
    const initialSchedule = calculateAllDayCreateSchedule({
      anchorDate: rawAnchorDate,
      currentDate: rawAnchorDate,
      minDate: visibleBounds.minDate,
      maxDate: visibleBounds.maxDate,
    });

    let currentDraft = createGridEventDraft(
      allDayGridSchedule(initialSchedule.startDate, initialSchedule.endDate),
      undefined,
      calendarId,
    );
    let hasMoved = false;
    let isCancelled = false;
    let isFinished = false;

    draftActions.startGridDraft({ activity: "creating", draft: currentDraft });

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown, true);
      gestureRef.current = null;
    };

    const finish = (mouseEvent?: MouseEvent) => {
      if (isFinished || isCancelled) {
        return;
      }

      isFinished = true;
      cleanup();
      mouseEvent?.preventDefault();
      mouseEvent?.stopPropagation();

      if (onCreateGridDraft) {
        onCreateGridDraft(currentDraft);
        return;
      }

      onCreateDraft?.(gridEventDraftToSchemaEvent(currentDraft));
    };

    const cancel = () => {
      if (isFinished || isCancelled) {
        return;
      }

      isCancelled = true;
      cleanup();
      draftActions.discard();
    };

    function handleMouseMove(mouseEvent: MouseEvent) {
      if (isFinished || isCancelled) {
        return;
      }

      if (mouseEvent.buttons !== 1) {
        finish(mouseEvent);
        return;
      }

      const point = { x: mouseEvent.clientX, y: mouseEvent.clientY };

      if (
        !hasMoved &&
        !hasExceededInteractionMoveThreshold(
          point,
          pointerStart,
          TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX,
        )
      ) {
        return;
      }

      hasMoved = true;
      const currentDate = getStartDate(mouseEvent.clientX, mouseEvent.clientY);
      const scheduleDates = calculateAllDayCreateSchedule({
        anchorDate: rawAnchorDate,
        currentDate,
        minDate: visibleBounds.minDate,
        maxDate: visibleBounds.maxDate,
      });

      currentDraft = replaceGridDraftSchedule(
        currentDraft,
        allDayGridSchedule(scheduleDates.startDate, scheduleDates.endDate),
      );
      draftActions.setGridDraft(currentDraft);
    }

    function handleMouseUp(mouseEvent: MouseEvent) {
      finish(mouseEvent);
    }

    function handleWindowBlur() {
      cancel();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    }

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown, true);
    gestureRef.current = { cancel };
  };
};
