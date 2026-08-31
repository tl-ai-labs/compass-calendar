import { type GridEvent } from "@web/common/types/web.event.types";

/**
 * Validates that an incoming URL string uses a safe HTTP or HTTPS protocol before the
 * grid renders an actionable join link. Provider-sourced meeting URLs can carry arbitrary
 * schemes such as javascript: or data:, so narrowing to explicit web schemes guards against
 * script execution and navigation to malformed targets.
 */
export const isJoinableUrl = (
  url: string | null | undefined,
): url is string => {
  if (!url) {
    return false;
  }
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Safely extracts the conference URL from a grid event payload, returning the provider's
 * original URL string unchanged if it passes the HTTP(S) scheme check or null otherwise.
 * Preserving the raw string avoids new URL().href normalization, which could rewrite
 * vendor-specific tracking parameters, query fragments, or path formatting.
 */
export const getJoinableConferenceUrl = (
  conference: GridEvent["conference"],
): string | null => {
  const url = conference?.url;
  return isJoinableUrl(url) ? url : null;
};
