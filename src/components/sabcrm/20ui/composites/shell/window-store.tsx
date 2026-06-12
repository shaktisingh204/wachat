"use client";

/**
 * Desktop window store — the macOS-style "many apps open at once" model.
 *
 * Each open app is a long-lived window. Switching between windows preserves the
 * app's full state (scroll, forms, in-memory data) because the window's content
 * is kept mounted (see `desktop-canvas.tsx` — apps live in same-origin iframes
 * that are merely hidden, never unmounted, while inactive). This store owns
 * *which* apps are open, *which* one is focused, and (in Windows mode) each
 * window's geometry / z-order / min-max state; the canvas owns the rendering.
 *
 * Two desktop modes share this one store, so flipping between them is a pure
 * chrome swap with no state migration:
 *   - "spaces"  — each open app is full-screen; one visible at a time (default).
 *   - "windows" — draggable / resizable overlapping windows.
 *
 * Persistence mirrors the dock-pins pattern (`use-dock-apps.ts`): the whole
 * desktop state lives in one localStorage key so a refresh / re-login reopens
 * the same apps ("restore open apps on reload"). Same-tab CustomEvent + cross-
 * tab `storage` keep every consumer and tab consistent. Only the *intent* to
 * reopen (ids + geometry + last href) is persisted, never live React state, so
 * a true cold reload legitimately starts each app fresh. Ids are validated
 * against the live SAB_APPS registry on read, so a renamed/hidden app drops out.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";

import { SAB_APPS, type SabAppDescriptor } from "./apps";

const STATE_KEY = "sabnode.desktop.state.v1";
const SYNC_EVENT = "sabnode:desktop-windows-changed";

/**
 * Cap on simultaneously *live* (mounted) windows. Beyond this, the least
 * recently focused windows are dropped from the DOM (they stay in the dock and
 * reopen on click) so a power user with many apps open doesn't hold every app
 * instance — and every SSE connection — in memory at once.
 */
export const MAX_LIVE_WINDOWS = 8;

export type DesktopMode = "spaces" | "windows";

export interface WindowGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DesktopWindow {
  /** === SabAppDescriptor.id */
  id: string;
  /** Canonical landing href (used to build the iframe src). */
  href: string;
  openedAt: number;
  lastFocusedAt: number;
  // ── Windows-mode fields (ignored while in Spaces mode) ──
  geometry: WindowGeometry;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  /** Geometry to restore to when un-maximizing. */
  prevGeometry?: WindowGeometry;
}

interface DesktopState {
  windows: DesktopWindow[];
  activeId: string | null;
  mode: DesktopMode;
  zCounter: number;
}

function appById(id: string): SabAppDescriptor | undefined {
  return SAB_APPS.find((a) => a.id === id);
}

function clampNum(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function sanitizeGeometry(raw: unknown, fallback: WindowGeometry): WindowGeometry {
  if (!raw || typeof raw !== "object") return fallback;
  const g = raw as Partial<WindowGeometry>;
  return {
    x: clampNum(g.x, fallback.x),
    y: clampNum(g.y, fallback.y),
    w: Math.max(320, clampNum(g.w, fallback.w)),
    h: Math.max(220, clampNum(g.h, fallback.h)),
  };
}

/** Cascading default geometry for a newly opened window (Windows mode). */
function defaultGeometry(count: number): WindowGeometry {
  const vw = (typeof window !== "undefined" && window.innerWidth) || 1280;
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  const w = Math.min(1100, Math.round(vw * 0.72));
  const h = Math.min(740, Math.round(vh * 0.74));
  const offset = (count % 6) * 32;
  const x = Math.max(16, Math.round((vw - w) / 2) - 80 + offset);
  const y = Math.max(16, Math.round((vh - h) / 2) - 48 + offset);
  return { x, y, w, h };
}

function emptyState(): DesktopState {
  return { windows: [], activeId: null, mode: "spaces", zCounter: 1 };
}

function sanitize(raw: unknown): DesktopState {
  if (!raw || typeof raw !== "object") return emptyState();
  const obj = raw as Partial<DesktopState>;
  const seen = new Set<string>();
  const fallback = defaultGeometry(0);
  const windows: DesktopWindow[] = [];
  for (const w of Array.isArray(obj.windows) ? obj.windows : []) {
    if (!w || typeof w !== "object") continue;
    const id = (w as DesktopWindow).id;
    if (typeof id !== "string" || seen.has(id)) continue;
    const app = appById(id);
    if (!app) continue; // renamed/hidden → drop
    seen.add(id);
    const openedAt = clampNum((w as DesktopWindow).openedAt, Date.now());
    windows.push({
      id,
      href: app.href, // re-derive so a moved landing path self-heals
      openedAt,
      lastFocusedAt: clampNum((w as DesktopWindow).lastFocusedAt, openedAt),
      geometry: sanitizeGeometry((w as DesktopWindow).geometry, fallback),
      zIndex: Math.max(1, clampNum((w as DesktopWindow).zIndex, 1)),
      minimized: Boolean((w as DesktopWindow).minimized),
      maximized: Boolean((w as DesktopWindow).maximized),
      prevGeometry: (w as DesktopWindow).prevGeometry
        ? sanitizeGeometry((w as DesktopWindow).prevGeometry, fallback)
        : undefined,
    });
  }
  windows.sort((a, b) => a.openedAt - b.openedAt); // stable dock order
  let activeId = typeof obj.activeId === "string" ? obj.activeId : null;
  if (activeId && !windows.some((w) => w.id === activeId)) activeId = null;
  const mode: DesktopMode = obj.mode === "windows" ? "windows" : "spaces";
  const zCounter = Math.max(
    1,
    clampNum(obj.zCounter, 1),
    ...windows.map((w) => w.zIndex),
  );
  return { windows, activeId, mode, zCounter };
}

function read(): DesktopState {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyState();
  }
}

function write(next: DesktopState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / blocked — the in-memory state still drives this tab.
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

/** Pick the focus target after the active window leaves (closed/minimized). */
function nextFocus(
  windows: DesktopWindow[],
  excludeId: string | null,
): string | null {
  const candidates = windows.filter(
    (w) => w.id !== excludeId && !w.minimized,
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)[0].id;
}

export interface DesktopWindows {
  /** Open windows, in open order (stable). Empty until hydrated. */
  windows: DesktopWindow[];
  /** Focused window id, or null when the desktop/background is showing. */
  activeId: string | null;
  mode: DesktopMode;
  /** True once localStorage has been read (avoids SSR/first-paint mismatch). */
  hydrated: boolean;
  /** The MAX_LIVE_WINDOWS most-recently-focused ids — only these are mounted. */
  liveIds: Set<string>;
  isOpen: (id: string) => boolean;
  /** Open the app if not already open, then focus it. */
  openWindow: (id: string) => void;
  /** Focus a window (un-minimizes + raises it in Windows mode). */
  focusWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  /** Defocus all windows → reveal the desktop/background. */
  showDesktop: () => void;
  closeAll: () => void;
  /** Cycle focus through open windows (Ctrl+Alt+←/→). +1 = next, -1 = prev. */
  cycle: (dir: 1 | -1) => void;
  setMode: (mode: DesktopMode) => void;
  // ── Windows-mode actions ──
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, geometry: WindowGeometry) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  bringToFront: (id: string) => void;
}

const DesktopWindowsContext = React.createContext<DesktopWindows | null>(null);

export function DesktopWindowsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<DesktopState>(emptyState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useLayoutEffect(() => {
    setState(read());
    setHydrated(true);

    const refresh = () => setState(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STATE_KEY) refresh();
    };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // All mutations read the latest persisted state, derive the next state, write
  // it, and let the SYNC_EVENT listener refresh React state — the same read-
  // modify-write+dispatch pattern as use-dock-apps, so two tabs never clobber.
  const mutate = React.useCallback(
    (fn: (cur: DesktopState) => DesktopState) => write(fn(read())),
    [],
  );

  const openWindow = React.useCallback(
    (id: string) => {
      const app = appById(id);
      if (!app) return;
      mutate((cur) => {
        const now = Date.now();
        const z = cur.zCounter + 1;
        const existing = cur.windows.find((w) => w.id === id);
        const windows = existing
          ? cur.windows.map((w) =>
              w.id === id
                ? { ...w, lastFocusedAt: now, minimized: false, zIndex: z }
                : w,
            )
          : [
              ...cur.windows,
              {
                id,
                href: app.href,
                openedAt: now,
                lastFocusedAt: now,
                geometry: defaultGeometry(cur.windows.length),
                zIndex: z,
                minimized: false,
                maximized: false,
              },
            ];
        return { ...cur, windows, activeId: id, zCounter: z };
      });
    },
    [mutate],
  );

  const focusWindow = React.useCallback(
    (id: string) => {
      mutate((cur) => {
        if (!cur.windows.some((w) => w.id === id)) return cur;
        const now = Date.now();
        const z = cur.zCounter + 1;
        return {
          ...cur,
          windows: cur.windows.map((w) =>
            w.id === id
              ? { ...w, lastFocusedAt: now, minimized: false, zIndex: z }
              : w,
          ),
          activeId: id,
          zCounter: z,
        };
      });
    },
    [mutate],
  );

  const closeWindow = React.useCallback(
    (id: string) => {
      mutate((cur) => {
        const windows = cur.windows.filter((w) => w.id !== id);
        const activeId =
          cur.activeId === id ? nextFocus(windows, null) : cur.activeId;
        return { ...cur, windows, activeId };
      });
    },
    [mutate],
  );

  const showDesktop = React.useCallback(
    () => mutate((cur) => ({ ...cur, activeId: null })),
    [mutate],
  );

  const closeAll = React.useCallback(
    () => mutate((cur) => ({ ...cur, windows: [], activeId: null })),
    [mutate],
  );

  const cycle = React.useCallback(
    (dir: 1 | -1) => {
      mutate((cur) => {
        if (cur.windows.length === 0) return cur;
        const order = cur.windows;
        const idx = order.findIndex((w) => w.id === cur.activeId);
        const nextIdx =
          idx < 0
            ? dir > 0
              ? 0
              : order.length - 1
            : (idx + dir + order.length) % order.length;
        const target = order[nextIdx];
        const now = Date.now();
        const z = cur.zCounter + 1;
        return {
          ...cur,
          windows: cur.windows.map((w) =>
            w.id === target.id
              ? { ...w, lastFocusedAt: now, minimized: false, zIndex: z }
              : w,
          ),
          activeId: target.id,
          zCounter: z,
        };
      });
    },
    [mutate],
  );

  const setMode = React.useCallback(
    (mode: DesktopMode) => mutate((cur) => ({ ...cur, mode })),
    [mutate],
  );

  const moveWindow = React.useCallback(
    (id: string, x: number, y: number) =>
      mutate((cur) => ({
        ...cur,
        windows: cur.windows.map((w) =>
          w.id === id ? { ...w, geometry: { ...w.geometry, x, y } } : w,
        ),
      })),
    [mutate],
  );

  const resizeWindow = React.useCallback(
    (id: string, geometry: WindowGeometry) =>
      mutate((cur) => ({
        ...cur,
        windows: cur.windows.map((w) =>
          w.id === id ? { ...w, geometry } : w,
        ),
      })),
    [mutate],
  );

  const minimizeWindow = React.useCallback(
    (id: string) =>
      mutate((cur) => {
        const windows = cur.windows.map((w) =>
          w.id === id ? { ...w, minimized: true } : w,
        );
        const activeId =
          cur.activeId === id ? nextFocus(windows, id) : cur.activeId;
        return { ...cur, windows, activeId };
      }),
    [mutate],
  );

  const toggleMaximize = React.useCallback(
    (id: string) =>
      mutate((cur) => {
        const z = cur.zCounter + 1;
        return {
          ...cur,
          activeId: id,
          zCounter: z,
          windows: cur.windows.map((w) => {
            if (w.id !== id) return w;
            if (w.maximized) {
              return {
                ...w,
                maximized: false,
                geometry: w.prevGeometry ?? w.geometry,
                prevGeometry: undefined,
                zIndex: z,
                minimized: false,
              };
            }
            return {
              ...w,
              maximized: true,
              prevGeometry: w.geometry,
              zIndex: z,
              minimized: false,
            };
          }),
        };
      }),
    [mutate],
  );

  const bringToFront = React.useCallback(
    (id: string) =>
      mutate((cur) => {
        const z = cur.zCounter + 1;
        return {
          ...cur,
          activeId: id,
          zCounter: z,
          windows: cur.windows.map((w) =>
            w.id === id ? { ...w, zIndex: z, minimized: false } : w,
          ),
        };
      }),
    [mutate],
  );

  const liveIds = React.useMemo(() => {
    const ranked = [...state.windows].sort(
      (a, b) => b.lastFocusedAt - a.lastFocusedAt,
    );
    const live = new Set(ranked.slice(0, MAX_LIVE_WINDOWS).map((w) => w.id));
    if (state.activeId) live.add(state.activeId);
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
      mode: state.mode,
      hydrated,
      liveIds,
      isOpen,
      openWindow,
      focusWindow,
      closeWindow,
      showDesktop,
      closeAll,
      cycle,
      setMode,
      moveWindow,
      resizeWindow,
      minimizeWindow,
      toggleMaximize,
      bringToFront,
    }),
    [
      state.windows,
      state.activeId,
      state.mode,
      hydrated,
      liveIds,
      isOpen,
      openWindow,
      focusWindow,
      closeWindow,
      showDesktop,
      closeAll,
      cycle,
      setMode,
      moveWindow,
      resizeWindow,
      minimizeWindow,
      toggleMaximize,
      bringToFront,
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
