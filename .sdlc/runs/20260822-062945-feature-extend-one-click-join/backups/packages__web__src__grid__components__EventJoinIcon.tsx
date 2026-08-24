import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { darken } from "@web/common/styles/color.utils";
import { EVENT_INTERACTION_IGNORE_ATTRIBUTE } from "@web/grid/interaction/event.registry";

// Larger than the repeat glyph's 10 on purpose: this is an interactive control
// rather than a decorative mark, the camera silhouette carries more internal
// detail than the repeat arrows (at 10/bold its negative space closes up), and
// 12 is what makes the all-day title reserve land on canonical Tailwind steps.
const JOIN_ICON_SIZE = 12;

/**
 * Render-time protocol guard for an event-supplied conference URL.
 *
 * `ConferenceSchema` validates with `z.url()` at the contract boundary, but a
 * grid card renders whatever reached it — a cached IndexedDB row written by an
 * older schema, a hand-seeded demo event, a future contract relaxation. A
 * `javascript:` or `data:` URL that slipped through must never become a
 * clickable control, so the protocol is re-checked at the point of render.
 *
 * `new URL()` strips leading/trailing C0-control-and-space per WHATWG, so a
 * padded `"  javascript:alert(1)  "` is parsed as `javascript:` and rejected
 * rather than throwing and accidentally looking like a different failure.
 */
export const isSafeConferenceUrl = (
  url: string | null | undefined,
): url is string => {
  if (!url) return false;

  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

interface Props {
  baseColor: string;
  label: string | null;
  offsetForRepeatIcon?: boolean;
  url: string;
}

/**
 * The one-click join affordance shared by the timed and all-day grid cards: a
 * small video-camera button pinned to the card's bottom-right, tinted the same
 * darker shade of the event color that `EventRepeatIcon` uses so the two read
 * as a set. Shifts left to `right-4` when the repeat glyph shares the corner.
 *
 * Unlike `EventRepeatIcon` this is *not* decorative — a join action is
 * announced nowhere else on the card, so the button carries a real accessible
 * name and only the glyph inside it is `aria-hidden`.
 *
 * The URL is never written into the DOM: activation goes through `window.open`
 * rather than an `href`, which keeps a meeting link (a capability token) out of
 * both the a11y tree and PostHog autocapture.
 */
export const EventJoinIcon = ({
  baseColor,
  label,
  offsetForRepeatIcon = false,
  url,
}: Props) => {
  // A provider entry-point label is normally a product name ("Google Meet",
  // "Zoom"). Some providers emit the meeting address as the label instead
  // ("meet.google.com/abc-defg-hij", "https://zoom.us/j/123"). A slash is the
  // reliable discriminator: no product name contains one, every URL-shaped
  // string does. Rejecting those keeps the medium-sensitivity meeting URL out
  // of the DOM entirely.
  const providerLabel = label && !label.includes("/") ? label : null;

  // Destination disclosure. Rendering a <button> rather than an <a href> (ADR-1)
  // keeps the meeting URL out of the DOM, but it also removes everything the
  // browser normally offers for judging a link before following it: no hover
  // status bar, no "copy link address", no context menu. Both `url` and `label`
  // arrive from provider-synced data, so an ordinary calendar invite can put an
  // arbitrary destination one click away.
  //
  // The host is the part that answers "where does this go" and is *not* the
  // capability material — the meeting token lives in the path/query, which is
  // deliberately never surfaced. `hostname` (not `host`) also drops any port and
  // any `user:pass@` prefix that could be used to dress a hostile origin up as a
  // familiar one.
  const conferenceHost = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  })();

  const joinAction = providerLabel ? `Join ${providerLabel}` : "Join video call";
  const accessibleName = conferenceHost
    ? `${joinAction} (${conferenceHost})`
    : joinAction;

  return (
    <button
      {...{ [EVENT_INTERACTION_IGNORE_ATTRIBUTE]: "true" }}
      aria-label={accessibleName}
      className={cn(
        "c-focus-ring ph-no-capture absolute bottom-0.5 inline-flex items-center justify-center rounded-xs",
        offsetForRepeatIcon ? "right-4" : "right-1",
      )}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(e: KeyboardEvent) => {
        // Enter and Space activate this button natively; the card's own
        // onKeyDown treats both as "open the event form" and calls
        // preventDefault(). Left to bubble, that would open the form *and*
        // cancel this button's Space activation. Note there is deliberately
        // no preventDefault() here — on a native button it would suppress
        // the click the browser generates on Space keyup.
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      // Load-bearing. Because the ignore attribute makes the grid decline
      // ownership, PointerCaptureBoundary no longer consumes the gesture, so
      // the compat mousedown now *does* reach this button and would bubble to
      // the cards' onEventMouseDown and the grids' draft-create handlers —
      // all of which are bubble-phase. Removing this reintroduces the bug the
      // ignore attribute was added to fix, one layer down.
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
      // Defensive only: no current listener reacts to a bubbled pointerdown,
      // and this cannot defend against the interaction engine — when the
      // engine does claim a gesture it consumes it in the capture phase on an
      // ancestor, and keyboard-only mode blocks even earlier at window
      // capture (useKeyboardOnlyMode.ts:79-81). What keeps the engine off
      // this button is EVENT_INTERACTION_IGNORE_ATTRIBUTE above, nothing here.
      onPointerDown={(e: PointerEvent) => e.stopPropagation()}
      // Same string as the accessible name, so the sighted-hover affordance and
      // the screen-reader announcement disclose the destination identically.
      title={accessibleName}
      type="button"
    >
      <VideoCameraIcon
        aria-hidden="true"
        color={darken(baseColor, 30)}
        size={JOIN_ICON_SIZE}
        weight="bold"
      />
    </button>
  );
};
