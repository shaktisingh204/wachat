"use client";

/**
 * DesktopCanvas — renders every open app window as a full-screen, same-origin
 * iframe and keeps it ALIVE across switches.
 *
 * The state-preservation trick: an inactive window's iframe is hidden with
 * `display:none`, which stops it painting but never tears down its document —
 * so React state, scroll, in-flight requests, and form input all survive a
 * switch and are intact when you return. Each app loads `?chromeless=1`, and
 * inside the frame the desktop host detects it's embedded and does NOT re-mount
 * the dock/desktop (no infinite dock-in-dock).
 *
 * Only windows in `liveIds` are mounted (LRU cap, see window-store) so a power
 * user with many apps open doesn't hold every app instance — and every SSE
 * connection — in memory at once.
 *
 * Because all frames are same-origin, we attach a keydown forwarder to each
 * frame's window for app-switching hotkeys that work even while focus is inside
 * an app (Ctrl+Alt+←/→ to cycle). ⌘-Tab / Ctrl-Tab are intentionally NOT used —
 * the OS/browser grab them before the page sees them.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";

import { SAB_APPS } from "./apps";
import { withChromeless } from "./use-chromeless";
import { useDesktopWindows, type DesktopWindows } from "./window-store";

function appName(id: string): string {
  return SAB_APPS.find((a) => a.id === id)?.name ?? id;
}

export function DesktopCanvas() {
  const wm = useDesktopWindows();
  const [loaded, setLoaded] = React.useState<Set<string>>(new Set());

  // Stable handler that always sees the latest store, attachable to any
  // same-origin window (top + each app frame).
  const wmRef = React.useRef<DesktopWindows | null>(wm);
  wmRef.current = wm;
  const onKey = React.useCallback((e: KeyboardEvent) => {
    const store = wmRef.current;
    if (!store) return;
    // Ctrl+Alt+Arrow cycles open windows — a combo the OS/browser leaves alone.
    if (e.ctrlKey && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      store.cycle(e.key === "ArrowRight" ? 1 : -1);
    }
  }, []);

  // Top-window hotkeys (focus in the dock / background).
  React.useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Forget the loaded-state of windows that were closed or LRU-evicted, so when
  // an evicted window is reopened its iframe remounts AND shows the spinner.
  const liveIds = wm?.liveIds;
  React.useEffect(() => {
    if (!liveIds) return;
    setLoaded((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (liveIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [liveIds]);

  if (!wm || !wm.hydrated) return null;

  const liveWindows = wm.windows.filter((w) => wm.liveIds.has(w.id));
  const activeLoaded = wm.activeId ? loaded.has(wm.activeId) : true;

  return (
    // pointer-events: none so that with no active window the background (the
    // routed page beneath) stays fully interactive; the active iframe re-enables
    // pointer events on itself.
    <div
      aria-hidden={wm.activeId ? undefined : true}
      className="pointer-events-none fixed inset-0 z-[55]"
    >
      {liveWindows.map((w) => {
        const active = wm.activeId === w.id;
        return (
          <iframe
            key={w.id}
            data-app-id={w.id}
            title={appName(w.id)}
            src={withChromeless(w.href)}
            onLoad={(e) => {
              setLoaded((prev) => {
                if (prev.has(w.id)) return prev;
                const next = new Set(prev);
                next.add(w.id);
                return next;
              });
              // Same-origin: forward switch hotkeys from inside the app too.
              try {
                const win = e.currentTarget.contentWindow;
                win?.removeEventListener("keydown", onKey);
                win?.addEventListener("keydown", onKey);
              } catch {
                // Cross-origin frame (shouldn't happen for app windows) — skip.
              }
            }}
            // display:none keeps the document (and its state) alive while hidden.
            style={{ display: active ? "block" : "none" }}
            className="pointer-events-auto absolute inset-0 h-full w-full border-0 bg-[var(--st-bg)]"
          />
        );
      })}

      {/* Loading veil over a window that hasn't fired its first load yet. */}
      {wm.activeId && !activeLoaded && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[var(--st-bg)]">
          <span
            aria-label={`Loading ${appName(wm.activeId)}`}
            role="status"
            className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--st-border)] border-t-[var(--st-text)]"
          />
        </div>
      )}
    </div>
  );
}
