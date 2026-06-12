"use client";

/**
 * Desktop window store — the macOS-style "many apps open at once" model.
 *
 * Each open app is a long-lived window. Switching between windows preserves
 * the app's full state (scroll, forms, in-memory data) because the window's
 * content is kept mounted (see `desktop-canvas.tsx` — apps live in same-origin
 * iframes that are merely hidden with `display:none`, never unmounted, while
 * inactive). This store owns *which* apps are open and *which* one is focused;
 * the canvas owns the actual rendering.
 *
 * Persistence mirrors the dock-pins pattern (`use-dock-apps.ts`): the open set
 * + focused id live in localStorage so a refresh / re-login reopens the same
 * apps ("restore open apps on reload"). Two sync channels keep every consumer
 * and every tab consistent — a same-tab CustomEvent and the cross-tab `storage`
 * event. Only the *intent* to reopen (ids + landing href) is persisted, never
 * live React state, so a true cold reload legitimately starts each app fresh.
 *
 * Window ids are validated against the live SAB_APPS registry on every read, so
 * a stale id (renamed/hidden app) silently drops instead of opening a dead
 * window. Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";

import { SAB_APPS, type SabAppDescriptor } from "./apps";

const WINDOWS_KEY = "sabnode.desktop.windows.v1";
const ACTIVE_KEY = "sabnode.desktop.active.v1";
const SYNC_EVENT = "sabnode:desktop-windows-changed";

/**
 * Cap on simultaneously *live* (mounted) windows. Beyond this, the least
 * recently focused windows are "suspended" — they stay in the dock and reopen
 * on click, but their iframe is dropped so a power user with 20 apps pinned
 * doesn't hold 20 live app instances (and 20 SSE connections) in memory.
 */
export const MAX_LIVE_WINDOWS = 8;

export interface DesktopWindow {
  /** === SabAppDescriptor.id */
  id: string;
  /** Canonical landing href (used to build the iframe src). */
  href: string;
  openedAt: number;
  lastFocusedAt: number;
}

function appById(id: string): SabAppDescriptor | undefined {
  return SAB_APPS.find((a) => a.id === id);
}

function sanitizeWindows(raw: unknown): DesktopWindow[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DesktopWindow[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const id = (w as DesktopWindow).id;
    if (typeof id !== "string" || seen.has(id)) continue;
    const app = appById(id);
    if (!app) continue; // renamed/hidden → drop
    seen.add(id);
    const openedAt = Number((w as DesktopWindow).openedAt) || Date.now();
    const lastFocusedAt = Number((w as DesktopWindow).lastFocusedAt) || openedAt;
    // Re-derive href from the live registry so a moved landing path self-heals.
    out.push({ id, href: app.href, openedAt, lastFocusedAt });
  }
  // Stable dock order = open order.
  out.sort((a, b) => a.openedAt - b.openedAt);
  return out;
}

interface Persisted {
  windows: DesktopWindow[];
  activeId: string | null;
}

function read(): Persisted {
  try {
    const rawW = window.localStorage.getItem(WINDOWS_KEY);
    const windows = sanitizeWindows(rawW ? JSON.parse(rawW) : []);
    let activeId = window.localStorage.getItem(ACTIVE_KEY);
    if (activeId && !windows.some((w) => w.id === activeId)) activeId = null;
    return { windows, activeId: activeId || null };
  } catch {
    return { windows: [], activeId: null };
  }
}

function write(next: Persisted): void {
  try {
    window.localStorage.setItem(WINDOWS_KEY, JSON.stringify(next.windows));
    if (next.activeId) window.localStorage.setItem(ACTIVE_KEY, next.activeId);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Storage full / blocked — the in-memory state still drives this tab.
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export interface DesktopWindows {
  /** Open windows, in open order (stable). Empty until hydrated. */
  windows: DesktopWindow[];
  /** Focused window id, or null when the desktop/background is showing. */
  activeId: string | null;
  /** True once localStorage has been read (avoids SSR/first-paint mismatch). */
  hydrated: boolean;
  /** The MAX_LIVE_WINDOWS most-recently-focused ids — only these are mounted. */
  liveIds: Set<string>;
  isOpen: (id: string) => boolean;
  /** Open the app if not already open, then focus it. */
  openWindow: (id: string) => void;
  /** Focus an already-open window (no-op if not open). */
  focusWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  /** Defocus all windows → reveal the desktop/background. */
  showDesktop: () => void;
  closeAll: () => void;
  /** Cycle focus through open windows (⌘-Tab). dir +1 = next, -1 = prev. */
  cycle: (dir: 1 | -1) => void;
}

const DesktopWindowsContext = React.createContext<DesktopWindows | null>(null);

export function DesktopWindowsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<Persisted>({
    windows: [],
    activeId: null,
  });
  const [hydrated, setHydrated] = React.useState(false);

  React.useLayoutEffect(() => {
    setState(read());
    setHydrated(true);

    const refresh = () => setState(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === WINDOWS_KEY || e.key === ACTIVE_KEY) {
        refresh();
      }
    };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // All mutations read the latest persisted state, derive the next state, write
  // it, and let the SYNC_EVENT listener above refresh React state — exactly the
  // read-modify-write+dispatch pattern of use-dock-apps, so two tabs editing
  // the desktop never clobber each other.
  const openWindow = React.useCallback((id: string) => {
    const app = appById(id);
    if (!app) return;
    const cur = read();
    const now = Date.now();
    const existing = cur.windows.find((w) => w.id === id);
    const windows = existing
      ? cur.windows.map((w) =>
          w.id === id ? { ...w, lastFocusedAt: now } : w,
        )
      : [
          ...cur.windows,
          { id, href: app.href, openedAt: now, lastFocusedAt: now },
        ];
    write({ windows, activeId: id });
  }, []);

  const focusWindow = React.useCallback((id: string) => {
    const cur = read();
    if (!cur.windows.some((w) => w.id === id)) return;
    const now = Date.now();
    write({
      windows: cur.windows.map((w) =>
        w.id === id ? { ...w, lastFocusedAt: now } : w,
      ),
      activeId: id,
    });
  }, []);

  const closeWindow = React.useCallback((id: string) => {
    const cur = read();
    const windows = cur.windows.filter((w) => w.id !== id);
    let activeId = cur.activeId;
    if (activeId === id) {
      // macOS: focus falls to the most-recently-focused remaining window.
      const next = [...windows].sort(
        (a, b) => b.lastFocusedAt - a.lastFocusedAt,
      )[0];
      activeId = next ? next.id : null;
    }
    write({ windows, activeId });
  }, []);

  const showDesktop = React.useCallback(() => {
    const cur = read();
    write({ windows: cur.windows, activeId: null });
  }, []);

  const closeAll = React.useCallback(() => {
    write({ windows: [], activeId: null });
  }, []);

  const cycle = React.useCallback((dir: 1 | -1) => {
    const cur = read();
    if (cur.windows.length === 0) return;
    const order = cur.windows; // open order
    const idx = order.findIndex((w) => w.id === cur.activeId);
    const nextIdx =
      idx < 0
        ? dir > 0
          ? 0
          : order.length - 1
        : (idx + dir + order.length) % order.length;
    const target = order[nextIdx];
    const now = Date.now();
    write({
      windows: cur.windows.map((w) =>
        w.id === target.id ? { ...w, lastFocusedAt: now } : w,
      ),
      activeId: target.id,
    });
  }, []);

  const liveIds = React.useMemo(() => {
    const ranked = [...state.windows].sort(
      (a, b) => b.lastFocusedAt - a.lastFocusedAt,
    );
    const live = new Set(ranked.slice(0, MAX_LIVE_WINDOWS).map((w) => w.id));
    if (state.activeId) live.add(state.activeId); // active is always live
    return live;
  }, [state.windows, state.activeId]);

  const isOpen = React.useCallback(
    (id: string) => state.windows.some((w) => w.id === id),
    [state.windows],
  );

  const value = React.useMemo<DesktopWindows>(
    () => ({
      windows: state.windows,
      activeId: state.activeId,
      hydrated,
      liveIds,
      isOpen,
      openWindow,
      focusWindow,
      closeWindow,
      showDesktop,
      closeAll,
      cycle,
    }),
    [
      state.windows,
      state.activeId,
      hydrated,
      liveIds,
      isOpen,
      openWindow,
      focusWindow,
      closeWindow,
      showDesktop,
      closeAll,
      cycle,
    ],
  );

  return (
    <DesktopWindowsContext.Provider value={value}>
      {children}
    </DesktopWindowsContext.Provider>
  );
}

/**
 * Read the desktop window store. Returns null when used outside a
 * DesktopWindowsProvider — callers (the dock, launchpad) must handle that so
 * they keep working on routes where the desktop host isn't mounted.
 */
export function useDesktopWindows(): DesktopWindows | null {
  return React.useContext(DesktopWindowsContext);
}
