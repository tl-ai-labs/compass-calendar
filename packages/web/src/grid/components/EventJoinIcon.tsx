import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { type Conference } from "@core/types/event-attendance.contracts";
import { ZIndex } from "@web/common/constants/web.constants";
import { theme } from "@web/common/styles/theme";
import { getInteractiveIconClassName } from "@web/components/Icons/icon.utils";
import { interactiveAffordanceAttributes } from "@web/grid/interaction/dom";

/**
 * A conference that has been proven safe to render as a one-click link, carrying
 * the re-serialized URL and the host that will actually be navigated to.
 */
export interface JoinableConference {
  host: string;
  label: string | null;
  url: string;
}

/**
 * The single gate that decides whether a conference link is renderable, shared
 * by both the timed and all-day grid cards so the padding they reserve for the
 * join icon can never disagree with whether the icon actually renders.
 *
 * `Conference.url` is validated with `z.url()`, which constrains the string to
 * parse as a URL but not its scheme - `javascript:`, `data:`, `vbscript:` and
 * `blob:` all satisfy the schema while being unsafe in an href. The value is
 * third-party data: it comes from a calendar invite, which anyone who knows the
 * user's address can create. So the scheme is checked against an allowlist
 * (not a denylist - a denylist loses to `JaVaScRiPt:` and embedded whitespace),
 * and `https:` only, because every real video entry point is HTTPS.
 *
 * The re-serialized `parsed.href` is returned rather than the raw string, so the
 * value that was validated is the value that gets navigated to.
 */
export const getJoinableConference = (
  conference: Conference | null | undefined,
  isSaved: boolean,
): JoinableConference | null => {
  if (!isSaved || !conference?.url) {
    return null;
  }

  try {
    const parsed = new URL(conference.url);

    return parsed.protocol === "https:"
      ? { host: parsed.host, label: conference.label, url: parsed.href }
      : null;
  } catch {
    return null;
  }
};

interface Props {
  baseColor: string;
  conference: JoinableConference;
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
 * decline to resolve an interaction target over this element. Without it the
 * grid's PointerCaptureBoundary claims the pointerdown in the capture phase
 * and preventDefault()s it, and the link never activates at all.
 *
 * The destination host is surfaced in both the tooltip and the accessible name
 * on purpose. The title and the conference label are attacker-controllable
 * (they come from the invite), so a bare "Join <title> via Google Meet" can be
 * made to describe a link that goes anywhere. Naming the host is what lets a
 * user - sighted or using AT - tell a real meeting from a lookalike before
 * committing the one click this affordance exists to make easy.
 *
 * `ph-no-capture` keeps the href out of PostHog autocapture. A meeting URL is
 * itself the credential for the meeting (Zoom `?pwd=`, Teams tenant/thread
 * ids), so it must not be shipped off-origin as an event property.
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
  const via = conference.label
    ? ` via ${conference.label} (${conference.host})`
    : ` (${conference.host})`;

  return (
    // No size gate, unlike EventRepeatIcon's width thresholds: this is a
    // functional affordance, not a decoration, so hiding it on a narrow card
    // would make it silently unreliable.
    <a
      aria-label={`Join ${eventTitle}${via}`}
      className={cn(
        "c-focus-ring ph-no-capture absolute bottom-0.5 h-3 w-3",
        hasRepeatIcon ? "right-4" : "right-1",
      )}
      draggable={false}
      {...interactiveAffordanceAttributes}
      href={conference.url}
      rel="noopener noreferrer"
      style={{ zIndex: ZIndex.LAYER_5 }}
      target="_blank"
      title={conference.host}
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
