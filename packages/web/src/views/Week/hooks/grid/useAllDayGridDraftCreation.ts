import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { draftActions } from "@web/events/stores/draft.store";
import {
  type AllDayDraftCreationHandler,
  useAllDayDraftCreation,
} from "@web/grid/hooks/useAllDayDraftCreation";
import { type WeekProps } from "../useWeek";
import { type DateCalcs } from "./useDateCalcs";

export const useAllDayGridDraftCreation = ({
  dateCalcs,
  weekProps,
}: {
  dateCalcs: DateCalcs;
  weekProps: WeekProps;
}): AllDayDraftCreationHandler => {
  const { weekDays } = weekProps.component;
  const visibleBounds =
    weekDays.length > 0
      ? {
          minDate: weekDays[0].format(YEAR_MONTH_DAY_FORMAT),
          maxDate: weekDays[weekDays.length - 1].format(YEAR_MONTH_DAY_FORMAT),
        }
      : undefined;

  return useAllDayDraftCreation({
    getStartDate: (clientX: number, clientY: number) =>
      dateCalcs.getDateStrByXY(
        clientX,
        clientY,
        weekProps.query.startOfView,
        YEAR_MONTH_DAY_FORMAT,
      ),
    onCreateGridDraft: (draft: GridEventDraft) => {
      draftActions.startGridDraft({ activity: "gridClick", draft });
    },
    visibleBounds,
  });
};
