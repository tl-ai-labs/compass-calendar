import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { draftActions } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "@web/grid/hooks/useAllDayDraftCreation";
import { type WeekProps } from "../useWeek";
import { type DateCalcs } from "./useDateCalcs";

/**
 * All-day counterpart to `useTimedGridDraftCreation`: binds the shared all-day
 * gesture to the week grid's date math. Returns a bare mousedown handler (the
 * all-day hook's shape) rather than the timed hook's `{ start… }` object.
 */
export const useAllDayGridDraftCreation = ({
  dateCalcs,
  weekProps,
}: {
  dateCalcs: DateCalcs;
  weekProps: WeekProps;
}) =>
  useAllDayDraftCreation({
    getStartDate: (clientX: number, clientY: number) =>
      dateCalcs.getDateStrByXY(
        clientX,
        clientY,
        weekProps.component.startOfView,
        YEAR_MONTH_DAY_FORMAT,
      ),
    onCreateGridDraft: (draft: GridEventDraft) => {
      draftActions.startGridDraft({ activity: "gridClick", draft });
    },
  });
