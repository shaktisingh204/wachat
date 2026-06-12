"use client";

/**
 * DesktopRuntime — the heavy half of the desktop, code-split out of
 * `desktop-host` so it only loads on app routes. Provides the window store and
 * renders the live app-window iframes (DesktopCanvas) under the promoted dock.
 *
 * Everything is wrapped in a `.20ui light|dark` scope synced to the app theme
 * (useHtmlDark) so the dock, Launchpad, window chrome, and wallpaper resolve
 * their `--st-*` tokens for the CURRENT theme — the same scope the dock carried
 * before it was promoted out of SabHomeShell (dropping it left the dock stuck on
 * default/light tokens). The wrapper is a plain block with no transform, so the
 * fixed-position dock/canvas still anchor to the viewport.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import { useHtmlDark } from "./app-theme";
import { SabAppDock } from "./app-dock";
import { DesktopCanvas } from "./desktop-canvas";
import { MissionControl } from "./mission-control";
import { DesktopWindowsProvider } from "./window-store";

export function DesktopRuntime() {
  const appDark = useHtmlDark();
  return (
    <DesktopWindowsProvider>
      <div className={`20ui ${appDark ? "dark" : "light"}`}>
        <DesktopCanvas />
        <SabAppDock />
        <MissionControl />
      </div>
    </DesktopWindowsProvider>
  );
}
