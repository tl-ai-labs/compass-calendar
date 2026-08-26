import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { type Conference } from "@core/types/event-attendance.contracts";
import { ZIndex } from "@web/common/constants/web.constants";
import { theme } from "@web/common/styles/theme";
import { getInteractiveIconClassName } from "@web/components/Icons/icon.utils";
import { interactiveAffordanceAttributes } from "@web/grid/interaction/dom";

/**
 * The single gate that decides whether a conference link is renderable, shared
 * by both the timed and all-day grid cards so the padding they reserve for the
 * join icon can never disagree with whether the icon actually renders.
 * `Conference.url` is validated with `z.url()`, which constrains the string to
 * be a URL but not its scheme - a `javascript:` or `data:` value satisfies the
 * schema while still being unsafe to render as a clickable link. Re-parsing
 * here and checking the protocol closes that gap.
 */
export const getJoinableConference = (
  conference: Conference | null | undefined,
  isSaved: boolean,
): Conference | null => {
  if (!isSaved || !conference?.url) {
    return null;
  }

  try {
    const { protocol } = new URL(conference.url);

    return protocol === "http:" || protocol === "https:" ? conference : null;
  } catch {
    return null;
  }
};

interface Props {
  baseColor: string;
  conference: Conference;
  hasRepeatIcon: boolean;
  title?: string | null;
}

/**
 * The join-conference affordance shared by the timed and all-day grid cards,
 * pinned to the card's bottom-right and stepping inboard to `right-4` when
 * EventRepeatIcon already owns the `right-1` slot. Keeping it in one place
 * stops the two cards from drifting apart, and callers must gate rendering
 * with `getJoinableConference` so what is drawn always matches the space
 * reserved for it.
 *
 * Unlike EventRepeatIcon this cannot be `pointer-events-none`: it is a real
 * focusable link, not a decoration, so it sits above the LAYER_4 resize strips
 * at LAYER_5 to stay clickable and tabbable.
 *
 * The `interactiveAffordanceAttributes` spread is load-bearing - the Week and
 * Day interaction adapters read it via `isInteractiveAffordanceTarget` and
 * decline to resolve a drag target over this element. Without it the grid's
 * PointerCaptureBoundary claims the pointerdown in the capture phase and
 * preventDefault()s it, and the link never activates at all.
 *
 * KNOWN A11Y DEVIATION: this focusable link is a descendant of a card whose
 * root carries role="button". axe's `nested-interactive` rule flags that
 * (impact serious, wcag2a) because role="button" implies
 * childrenPresentational: true, so assistive tech is not guaranteed to expose
 * this link at all. The correct fix is moving the card root to a grid/gridcell
 * pattern instead of role="button", which is outside this change's scope - a
 * follow-up ticket owns it.
 */
export const EventJoinIcon = ({
  baseColor,
  conference,
  hasRepeatIcon,
  title,
}: Props) => {
  const eventTitle = title?.trim() || "Untitled event";
  const accessibleName = conference.label
    ? `Join ${eventTitle} via ${conference.label}`
    : `Join ${eventTitle}`;

  return (
    // No size gate, unlike EventRepeatIcon's width thresholds: this is a
    // functional affordance, not a decoration, so hiding it on a narrow card
    // would make it silently unreliable.
    <a
      aria-label={accessibleName}
      className={cn(
        "c-focus-ring absolute bottom-0.5 h-3 w-3",
        hasRepeatIcon ? "right-4" : "right-1",
      )}
      draggable={false}
      {...interactiveAffordanceAttributes}
      href={conference.url}
      rel="noopener noreferrer"
      style={{ zIndex: ZIndex.LAYER_5 }}
      target="_blank"
      onKeyDown={(e) => {
        // Anchors do not activate on Space natively, but this link lives
        // inside an element announced as a button, where Space is the
        // expected activation key. Stopping it without activating would be a
        // silent no-op.
        if (e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.click();
          return;
        }

        if (e.key === "Enter") {
          e.stopPropagation();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <VideoCameraIcon
        aria-hidden="true"
        className={getInteractiveIconClassName()}
        color={theme.getContrastText(baseColor)}
        size={12}
        weight="bold"
      />
    </a>
  );
};
