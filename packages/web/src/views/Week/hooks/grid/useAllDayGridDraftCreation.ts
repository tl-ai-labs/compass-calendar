import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { draftActions } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "@web/grid/hooks/useAllDayDraftCreation";
import { type DateCalcs } from "./useDateCalcs";

export const useAllDayGridDraftCreation = ({
  dateCalcs,
  startOfView,
}: {
  dateCalcs: DateCalcs;
  startOfView: Dayjs;
}) =>
  useAllDayDraftCreation({
    getStartDate: (clientX: number, clientY: number) =>
      dateCalcs.getDateStrByXY(
        clientX,
        clientY,
        startOfView,
        YEAR_MONTH_DAY_FORMAT,
      ),
    isMultiDayDragEnabled: true,
    onCreateGridDraft: (draft: GridEventDraft) => {
      draftActions.startGridDraft({ activity: "gridClick", draft });
    },
  });
