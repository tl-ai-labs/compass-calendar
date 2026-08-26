import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type Dayjs } from "@core/util/date/dayjs";
import { isViewDragTarget } from "@web/grid/interaction/adapter/view-interaction.targets";
import { type ViewInteractionTarget } from "@web/grid/interaction/adapter/view-interaction.types";

/**
 * Resolves the drag column keys for one Day-view interaction.
 *
 * Lives in `geometry/` rather than `interactions/` because its output feeds the
 * layout-cache build, which happens before any per-interaction visual exists.
 */
export const resolveDayColumns = ({
  getColumnKeys,
  target,
  visibleDate,
}: {
  getColumnKeys: () => string[];
  target: ViewInteractionTarget;
  visibleDate: Dayjs;
}) => {
  const visibleDateKey = visibleDate.format(YEAR_MONTH_DAY_FORMAT);
  // The Day view renders one column per calendar, all sharing one date,
  // so drag column keys are CALENDAR IDS (not dates like the Week
  // view) — a column change is a cross-calendar move. Resizes stay
  // within the event's own column and keep the single-column layout.
  // An event whose calendar isn't among the rendered columns (columns
  // and events momentarily out of sync) also falls back to the single
  // column: anchoring it to column 0 would make a purely vertical drag
  // commit a calendar move the user never made.
  const calendarColumnKeys = isViewDragTarget(target) ? getColumnKeys() : [];
  const eventColumnIndex = calendarColumnKeys.indexOf(
    target.event.calendarId ?? "",
  );
  const columnKeys =
    eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];
  const initialColumnIndex = Math.max(0, eventColumnIndex);
  const initialColumnKey = columnKeys[initialColumnIndex]!;

  return { columnKeys, initialColumnIndex, initialColumnKey };
};
