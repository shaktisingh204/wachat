"use client";

/**
 * Embedded / chromeless detection for the desktop window system.
 *
 * App windows are same-origin iframes whose src carries `?chromeless=1`. Two
 * things must NOT recursively mount inside those iframes: the desktop host and
 * its dock (else infinite dock-in-dock). The authoritative runtime signal is
 * `window.self !== window.top`; the query param is a fast, SSR-available hint.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";

export const CHROMELESS_PARAM = "chromeless";

/**
 * useIsEmbedded — whether this document renders inside another frame (i.e. it
 * is a desktop app-window, not the top-level desktop). SSR-safe: `mounted` is
 * false on the server and first client render (the desktop host renders nothing
 * then anyway), and `embedded` resolves in the mount effect.
 */
export function useIsEmbedded(): { embedded: boolean; mounted: boolean } {
  const [mounted, setMounted] = React.useState(false);
  const [embedded, setEmbedded] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      // Cross-origin parent → access throws → we are definitely framed.
      setEmbedded(true);
    }
  }, []);

  return { embedded, mounted };
}

/** True when the current URL carries `?chromeless=1`. */
export function hasChromelessParam(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      new URLSearchParams(window.location.search).get(CHROMELESS_PARAM) === "1"
    );
  } catch {
    return false;
  }
}

/** Append `?chromeless=1` (preserving any existing query) to an app href. */
export function withChromeless(href: string): string {
  const [path, hash] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${CHROMELESS_PARAM}=1${hash ? `#${hash}` : ""}`;
}
