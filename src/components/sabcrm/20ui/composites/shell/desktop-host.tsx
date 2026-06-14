"use client";

/**
 * DesktopHost — the single, persistent macOS-style desktop layer.
 *
 * Mounted once in the root layout (`src/app/layout.tsx`), it is the ONLY
 * subtree that survives every in-app navigation, which is what lets open app
 * windows stay alive while you switch between them.
 *
 * This file is deliberately LIGHT: the root layout ships to every route
 * (including public / marketing / auth), so the heavy runtime — window store,
 * iframe canvas, dock — is code-split into `desktop-runtime` and only fetched
 * when we're actually on an app route. The gate renders nothing unless we're
 * the top-level document on an authenticated app route:
 *   - `mounted` — never render on the server / first paint (the desktop is a
 *     client-only overlay backed by localStorage; nothing to SSR).
 *   - `!embedded` — inside an app-window iframe this returns null, so the dock
 *     and desktop never recurse (no infinite dock-in-dock).
 *   - app route — public / marketing / auth routes get no desktop.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

import { useIsEmbedded } from "./use-chromeless";

/**
 * Route prefixes that get the desktop — the surfaces that mount a SabNode shell
 * (so the dock appears wherever app-switching lives). `/sabcrm` is included: it
 * now shares the SabNode chrome (dock + sidebar + header), its old app rail
 * having been retired in favour of the dock.
 */
const APP_PREFIXES = [
  "/dashboard",
  "/wachat",
  "/sabsms",
  "/sabmail",
  "/sabpay",
  "/sabwa",
  "/sabcrm",
];

function isDesktopRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Heavy runtime (window store + iframe canvas + dock) — code-split + client-only
// so it never ships to public/marketing/auth pages.
const DesktopRuntime = dynamic(
  () => import("./desktop-runtime").then((m) => m.DesktopRuntime),
  { ssr: false },
);

export function DesktopHost() {
  const pathname = usePathname();
  const { embedded, mounted } = useIsEmbedded();

  if (!mounted || embedded || !isDesktopRoute(pathname)) return null;

  return <DesktopRuntime />;
}
