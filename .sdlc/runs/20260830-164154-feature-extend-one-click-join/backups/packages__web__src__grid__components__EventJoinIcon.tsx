import { type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { VideoCameraIcon } from "@phosphor-icons/react";
import { ZIndex } from "@web/common/constants/web.constants";
import { darken } from "@web/common/styles/color.utils";
import { isJoinableUrl } from "./event-join-url.util";

interface Props {
  /** The card's resolved fill (bgColor), not the raw palette base. */
  baseColor: string;
  /** conference.label; null/absent falls back to "Join meeting". */
  label?: string | null;
  /** Already scheme-checked by the card; re-checked here (fail closed). */
  url: string;
}

/**
 * The one-click join affordance shared by the timed and all-day grid cards. It
 * is a real <button> rather than part of the card's own click target because
 * the card's mousedown starts a drag - a nested control with its own name is
 * the only way to offer "join" without also meaning "select and drag this
 * event". Sits one slot left of the repeat glyph and borrows its size/weight/tint
 * so the two read as one icon family rather than two competing badges. The URL
 * is re-checked here, not just at the call site, because conference.url is
 * provider-sourced and a control that can be tricked into opening a javascript:
 * URL is worse than no control.
 */
export const EventJoinIcon = ({ baseColor, label, url }: Props) => {
  if (!isJoinableUrl(url)) return null;

  const accessibleLabel = label ? `Join ${label}` : "Join meeting";

  const openConference = () => {
    if (!isJoinableUrl(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openConference();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.stopPropagation();
    e.preventDefault();
    openConference();
  };

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      className="absolute right-4.5 bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-(--event-focus-color)"
      style={{ zIndex: ZIndex.LAYER_5 }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
    >
      <VideoCameraIcon
        aria-hidden="true"
        className="pointer-events-none"
        color={darken(baseColor, 30)}
        size={10}
        weight="bold"
      />
    </button>
  );
};
