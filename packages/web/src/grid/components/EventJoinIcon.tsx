import { VideoCameraIcon } from "@phosphor-icons/react";
import { type MouseEvent } from "react";
import { ZIndex } from "@web/common/constants/web.constants";
import { darken } from "@web/common/styles/color.utils";
import { getInteractiveIconClassName } from "@web/components/Icons/icon.utils";
import { EVENT_JOIN_CONTROL_ATTRIBUTE } from "@web/grid/interaction/dom";
import { type EventPosition } from "@web/grid/types/grid.types";

// 24, not 20. axe's target-size rule (WCAG 2.5.8) demands 24px and it *does*
// run under the e2e axe helper: `withTags()` matches on tags alone and never
// consults a rule's `enabled` flag, so target-size executes despite shipping
// disabled by default. At 20px this control fails the join specs and also
// introduces a new violation into the untouched app-a11y week-view scan, which
// already renders a conference-bearing demo event ("Morning standup").
export const JOIN_CONTROL_SIZE_PX = 24;

// EventRepeatIcon pins itself to `right-1` with a 10px glyph, i.e. it occupies
// x in [w-14, w-4]. Insetting the join box by 16 puts it at [w-40, w-16] — a
// 2px gap at any card height. EventRepeatIcon.tsx is not editable in this
// change, so the join control moves out of its way rather than the reverse.
export const JOIN_CONTROL_REPEAT_CLEARANCE_PX = 16;

const JOIN_CONTROL_DEFAULT_RIGHT_INSET_PX = 2;
const JOIN_GLYPH_SIZE_PX = 12;

/**
 * Resolves a stored conference URL to a value that is safe to put in an href,
 * or null when it is not.
 *
 * ConferenceSchema.url is `z.url()`, which validates that a string parses as a
 * URL but places no constraint on its scheme. Rendering it unchecked would make
 * a stored `javascript:` URL click-to-execute the moment it reaches an anchor —
 * and this component is what first puts provider-controlled data into an href
 * on a grid card. Returns the *original* string rather than `parsed.href` so the
 * rendered link stays byte-identical to what the provider sent.
 */
export const resolveJoinHref = (
  url: string | null | undefined,
): string | null => {
  if (!url) {
    return null;
  }

  let parsed: URL;

  try {
    // No base is supplied on purpose: a relative value must not silently
    // resolve against the app's own origin. `new URL` throws rather than
    // returning null, and URL.canParse is newer than some of the DOM shims
    // this code is exercised under, so try/catch is the portable form.
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  // Reject anything whose meaning changes once a base is applied. The check
  // above parses with NO base; the browser resolves an href AGAINST THE PAGE,
  // and for a special scheme matching the page's the parser drops into the
  // relative state instead of reading an authority. So `https:/evil.test/x`
  // validates here as host `evil.test` but navigates to
  // `https://<page-host>/evil.test/x`, and `https:/cleanup` reaches an
  // in-app route. Scheme cannot escape, but host and path can — which turns a
  // conference URL from any stranger's meeting invite into a same-origin
  // navigation primitive. Comparing both resolutions is the guard; the
  // original string is still what we return, so the rendered href stays
  // byte-identical to what the provider sent.
  try {
    if (parsed.href !== new URL(url, document.baseURI).href) {
      return null;
    }
  } catch {
    return null;
  }

  return url;
};

interface EventJoinIconProps {
  /** The host card's resolved fill; the glyph is darkened from it. */
  baseColor: string;
  /** Event title, used to build the accessible name. */
  eventTitle: string;
  /** The host card's rect. The control is laid over its right edge. */
  position: EventPosition;
  /** px from the card's right edge; pass the repeat clearance when that glyph shows. */
  rightInsetPx?: number;
  /** Raw, unvalidated conference URL. */
  url: string;
}

/**
 * The one-click join affordance on a grid event card.
 *
 * Rendered as a *sibling* of the card root rather than a child. Both card roots
 * are `role="button"`, whose ARIA contract declares its children presentational,
 * so any focusable descendant is an axe `nested-interactive` violation — and a
 * join control that is not focusable fails its own keyboard requirement. Being a
 * sibling is therefore the only shape that is both reachable and conformant. It
 * also keeps the anchor out of the drag ghost for free: createDraftEventClone
 * clones the card root, which no longer contains this element.
 */
export const EventJoinIcon = ({
  baseColor,
  eventTitle,
  position,
  rightInsetPx = JOIN_CONTROL_DEFAULT_RIGHT_INSET_PX,
  url,
}: EventJoinIconProps) => {
  const href = resolveJoinHref(url);

  if (!href) {
    return null;
  }

  return (
    <a
      {...{ [EVENT_JOIN_CONTROL_ATTRIBUTE]: "true" }}
      aria-label={`Join ${eventTitle.trim() || "Untitled event"}`}
      className="c-focus-ring absolute flex select-none items-center justify-center rounded-xs"
      href={href}
      rel="noopener noreferrer"
      style={{
        color: darken(baseColor, 30),
        height: JOIN_CONTROL_SIZE_PX,
        left:
          position.left + position.width - rightInsetPx - JOIN_CONTROL_SIZE_PX,
        // Cards shorter than the control (the 20px all-day chip) pin it to the
        // top edge instead of letting it float above them.
        top:
          position.top +
          Math.max(0, (position.height - JOIN_CONTROL_SIZE_PX) / 2),
        width: JOIN_CONTROL_SIZE_PX,
        zIndex: (position.zIndex ?? ZIndex.LAYER_1) + 1,
      }}
      target="_blank"
      onMouseDown={(e: MouseEvent<HTMLAnchorElement>) => {
        // The mouse path. PointerCaptureBoundary only intercepts pointer*
        // events, so this mousedown would otherwise bubble to the card root's
        // onEventMouseDown (and the grid's create-draft handlers) and open the
        // detail panel behind the newly opened tab. Deliberately no
        // preventDefault: that would suppress focus and break keyboard use.
        e.stopPropagation();
      }}
    >
      <VideoCameraIcon
        aria-hidden="true"
        className={getInteractiveIconClassName()}
        size={JOIN_GLYPH_SIZE_PX}
        weight="bold"
      />
    </a>
  );
};
