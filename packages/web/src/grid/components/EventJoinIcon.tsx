import { VideoCameraIcon } from "@phosphor-icons/react";
import cn from "classnames";
import { darken } from "@web/common/styles/color.utils";

export interface EventJoinIconProps {
  baseColor: string;
  className?: string;
  title?: string;
  url: string;
}

/**
 * Pure type guard verifying that a given value is a non-empty string
 * representing a valid HTTP or HTTPS conference URL.
 */
export function isSafeConferenceUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.trim() === "") {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The join meeting action link shared by the timed and all-day grid cards:
 * a small video camera icon button pinned to the card's bottom-right,
 * tinted a darker shade of the event color so it complements the card.
 * Launches the conference URL in a new tab without triggering card interactions.
 */
export const EventJoinIcon = ({
  baseColor,
  className,
  title,
  url,
}: EventJoinIconProps) => (
  <a
    aria-label={title ? `Join meeting: ${title}` : "Join meeting"}
    className={cn(
      "ph-no-capture absolute bottom-0.5 z-10 flex items-center justify-center rounded-xs p-0.5 hover:opacity-80 focus-visible:outline-(--event-focus-color) focus-visible:outline-1",
      className ?? "right-1",
    )}
    href={url.trim()}
    onClick={(e) => {
      e.stopPropagation();
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation();
      }
    }}
    onMouseDown={(e) => {
      e.stopPropagation();
    }}
    rel="noopener noreferrer"
    target="_blank"
  >
    <VideoCameraIcon
      aria-hidden="true"
      color={darken(baseColor, 30)}
      size={10}
      weight="bold"
    />
  </a>
);
