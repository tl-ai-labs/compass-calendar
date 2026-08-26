import { dayInteractionBindings } from "@web/views/Day/interaction/day-interaction.bindings";

export function focusFirstDayCalendarEvent() {
  const target = dayInteractionBindings.getFirstVisibleGridEventTarget();

  if (!target) {
    return;
  }

  target.element.scrollIntoView({ block: "nearest" });
  dayInteractionBindings.focusGridEventTarget(target);
}
