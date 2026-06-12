"use client";

/**
 * DesktopRuntime — the heavy half of the desktop, code-split out of
 * `desktop-host` so it only loads on app routes. Provides the window store and
 * renders the live app-window iframes (DesktopCanvas) under the promoted dock.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import { SabAppDock } from "./app-dock";
import { DesktopCanvas } from "./desktop-canvas";
import { DesktopWindowsProvider } from "./window-store";

export function DesktopRuntime() {
  return (
    <DesktopWindowsProvider>
      <DesktopCanvas />
      <SabAppDock />
    </DesktopWindowsProvider>
  );
}
