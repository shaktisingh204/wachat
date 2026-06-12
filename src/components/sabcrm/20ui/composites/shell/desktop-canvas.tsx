"use client";

/**
 * DesktopCanvas — renders every open app window as a full-screen, same-origin
 * iframe and keeps it ALIVE across switches AND across desktop-mode changes.
 *
 * State-preservation trick: an inactive/hidden window's iframe stays mounted
 * (just `display:none`), so React state, scroll, in-flight requests, and form
 * input all survive. Each app loads `?chromeless=1`; inside the frame the
 * desktop host detects it's embedded and does NOT re-mount the dock/desktop.
 *
 * One `DesktopWindowView` per window owns the iframe. Crucially, the iframe is
 * a stable keyed child, so flipping between "spaces" (full-screen) and "windows"
 * (draggable) only restyles its container — the iframe never reparents, so it
 * never reloads and its app state is preserved through a mode switch too.
 *
 * Only windows in `liveIds` are mounted (LRU cap). Same-origin frames let us
 * forward switch hotkeys (Ctrl+Alt+←/→) even while focus is inside an app.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";
import { m, useMotionValue, type MotionStyle } from "motion/react";
import { Minus, Square } from "lucide-react";

import { cn } from "../lib/cn";
import { SAB_APPS, type SabAppDescriptor } from "./apps";
import { SabAppLogo } from "./app-logos";
import { MISSION_CONTROL_EVENT } from "./mission-control";
import { withChromeless } from "./use-chromeless";
import {
  useDesktopWindows,
  type DesktopWindow,
  type DesktopWindows,
  type WindowGeometry,
} from "./window-store";

const TITLEBAR_H = 34;
const MIN_W = 360;
const MIN_H = 240;

function appOf(id: string): SabAppDescriptor | undefined {
  return SAB_APPS.find((a) => a.id === id);
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
    // Ctrl+Alt+Arrow drives switching — a combo set the OS/browser leaves alone.
    // (This handler is also attached to each same-origin app frame, so it fires
    // while focus is inside an app; `window` here is always the top document.)
    if (!e.ctrlKey || !e.altKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      store.cycle(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(MISSION_CONTROL_EVENT));
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Forget the loaded-state of windows closed or LRU-evicted, so a reopened
  // window remounts AND shows its spinner.
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

  const markLoaded = React.useCallback((id: string) => {
    setLoaded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!wm || !wm.hydrated) return null;

  const windowsMode = wm.mode === "windows";
  const liveWindows = wm.windows.filter((w) => wm.liveIds.has(w.id));

  return (
    // pointer-events: none so that with nothing covering it the background (the
    // routed page beneath) stays interactive; the wallpaper / active window /
    // window frames re-enable pointer events on themselves.
    <div
      aria-hidden={!windowsMode && !wm.activeId ? true : undefined}
      className="pointer-events-none fixed inset-0 z-[55]"
    >
      {/* Windows mode shows a desktop wallpaper that covers the routed page;
          clicking it defocuses all windows. Spaces mode has no wallpaper — the
          focused app is full-bleed over the background. */}
      {windowsMode && (
        <button
          type="button"
          aria-label="Show desktop"
          onClick={() => wm.showDesktop()}
          className="pointer-events-auto absolute inset-0 z-0 block border-0 bg-[radial-gradient(120%_120%_at_50%_0%,color-mix(in_srgb,var(--st-bg-secondary)_92%,var(--st-accent,#4f46e5))_0%,var(--st-bg-secondary)_60%)]"
        />
      )}

      {liveWindows.map((w) => (
        <DesktopWindowView
          key={w.id}
          win={w}
          app={appOf(w.id)}
          mode={wm.mode}
          active={wm.activeId === w.id}
          loaded={loaded.has(w.id)}
          onLoaded={markLoaded}
          onKey={onKey}
          wm={wm}
        />
      ))}
    </div>
  );
}

interface ViewProps {
  win: DesktopWindow;
  app: SabAppDescriptor | undefined;
  mode: "spaces" | "windows";
  active: boolean;
  loaded: boolean;
  onLoaded: (id: string) => void;
  onKey: (e: KeyboardEvent) => void;
  wm: DesktopWindows;
}

function DesktopWindowView({
  win,
  app,
  mode,
  active,
  loaded,
  onLoaded,
  onKey,
  wm,
}: ViewProps) {
  const name = app?.name ?? win.id;
  const x = useMotionValue(win.geometry.x);
  const y = useMotionValue(win.geometry.y);
  const w = useMotionValue(win.geometry.w);
  const h = useMotionValue(win.geometry.h);
  const [interacting, setInteracting] = React.useState(false);
  const interactingRef = React.useRef(false);
  const setBusy = (b: boolean) => {
    interactingRef.current = b;
    setInteracting(b);
  };

  const windowsMode = mode === "windows";
  const free = windowsMode && !win.maximized && !win.minimized;

  // Keep the motion values in sync with the stored geometry when not actively
  // dragging/resizing (covers cross-tab edits + un-maximize).
  React.useEffect(() => {
    if (interactingRef.current || !free) return;
    x.set(win.geometry.x);
    y.set(win.geometry.y);
    w.set(win.geometry.w);
    h.set(win.geometry.h);
  }, [free, win.geometry.x, win.geometry.y, win.geometry.w, win.geometry.h, x, y, w, h]);

  const chromeShown = windowsMode && !win.minimized;

  // Same-origin click-to-focus: the parent can't see pointer events that land
  // inside an iframe, so we forward them from the frame to raise the window.
  const liveRef = React.useRef<{ wm: DesktopWindows; id: string }>({
    wm,
    id: win.id,
  });
  liveRef.current = { wm, id: win.id };
  const onFramePointerDown = React.useCallback(() => {
    const { wm: store, id } = liveRef.current;
    if (store.mode === "windows" && store.activeId !== id) store.bringToFront(id);
  }, []);

  // Root container style per mode/state. The iframe is a stable keyed child, so
  // switching these never reparents (and never reloads) it. The explicit return
  // type narrows the string literals and lets the free branch use MotionValues.
  const rootStyle = ((): MotionStyle => {
    if (!windowsMode) {
      // Spaces — full-bleed; only the focused one is shown.
      return {
        position: "fixed",
        inset: 0,
        transform: "none",
        display: active ? "block" : "none",
        zIndex: 55,
      };
    }
    if (win.minimized) {
      return { position: "fixed", display: "none", zIndex: win.zIndex };
    }
    if (win.maximized) {
      return {
        position: "fixed",
        inset: 0,
        transform: "none",
        display: "block",
        zIndex: win.zIndex,
      };
    }
    return {
      position: "fixed",
      left: 0,
      top: 0,
      right: "auto",
      bottom: "auto",
      x,
      y,
      width: w,
      height: h,
      display: "block",
      zIndex: win.zIndex,
    };
  })();

  const focus = () => {
    if (windowsMode) wm.bringToFront(win.id);
    else wm.focusWindow(win.id);
  };

  /* ── Drag (titlebar) ───────────────────────────────────────────────── */
  const onTitlePointerDown = (e: React.PointerEvent) => {
    focus();
    if (!free) return; // can't drag a maximized/spaces window
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = x.get();
    const baseY = y.get();
    setBusy(true);
    const move = (ev: PointerEvent) => {
      x.set(Math.max(0, baseX + (ev.clientX - startX)));
      y.set(Math.max(0, baseY + (ev.clientY - startY)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBusy(false);
      wm.moveWindow(win.id, x.get(), y.get());
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ── Resize (8 edges/corners) ──────────────────────────────────────── */
  const onResizePointerDown = (dir: ResizeDir) => (e: React.PointerEvent) => {
    focus();
    if (!free) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const base: WindowGeometry = { x: x.get(), y: y.get(), w: w.get(), h: h.get() };
    setBusy(true);
    const move = (ev: PointerEvent) => {
      const g = applyResize(dir, base, ev.clientX - startX, ev.clientY - startY);
      x.set(g.x);
      y.set(g.y);
      w.set(g.w);
      h.set(g.h);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBusy(false);
      wm.resizeWindow(win.id, { x: x.get(), y: y.get(), w: w.get(), h: h.get() });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <m.div
      style={rootStyle}
      onPointerDown={windowsMode ? focus : undefined}
      className={cn(
        "overflow-hidden",
        chromeShown &&
          "rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]",
        windowsMode && !free && !win.minimized && "rounded-none",
      )}
    >
      {/* Titlebar (Windows mode only) */}
      {chromeShown ? (
        <div
          key="chrome"
          onPointerDown={onTitlePointerDown}
          onDoubleClick={() => wm.toggleMaximize(win.id)}
          style={{ height: TITLEBAR_H }}
          className={cn(
            "absolute inset-x-0 top-0 z-[2] flex items-center gap-2 px-3",
            "cursor-default select-none border-b border-[var(--st-border)]",
            "bg-[color-mix(in_srgb,var(--st-surface)_88%,transparent)] backdrop-blur-xl",
          )}
        >
          {/* Traffic lights */}
          <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <TrafficLight
              kind="close"
              label={`Close ${name}`}
              onClick={() => wm.closeWindow(win.id)}
            />
            <TrafficLight
              kind="min"
              label={`Minimize ${name}`}
              onClick={() => wm.minimizeWindow(win.id)}
            />
            <TrafficLight
              kind="max"
              label={win.maximized ? `Restore ${name}` : `Maximize ${name}`}
              onClick={() => wm.toggleMaximize(win.id)}
            />
          </div>
          <span className="pointer-events-none mx-auto flex items-center gap-1.5 truncate pr-12 text-xs font-medium text-[var(--st-text)]">
            <span className="inline-block size-3.5 overflow-hidden rounded-[5px]">
              <SabAppLogo appId={win.id} style={{ width: "100%", height: "100%", display: "block" }} />
            </span>
            {name}
          </span>
        </div>
      ) : (
        <React.Fragment key="chrome" />
      )}

      {/* The app — stable keyed child; never reparents → never reloads. */}
      <iframe
        key="frame"
        data-app-id={win.id}
        title={name}
        src={withChromeless(win.href)}
        onLoad={(e) => {
          onLoaded(win.id);
          try {
            const fwin = e.currentTarget.contentWindow;
            fwin?.removeEventListener("keydown", onKey);
            fwin?.addEventListener("keydown", onKey);
            fwin?.removeEventListener("pointerdown", onFramePointerDown);
            fwin?.addEventListener("pointerdown", onFramePointerDown);
          } catch {
            /* cross-origin frame — skip hotkey/focus forwarding */
          }
        }}
        style={{
          position: "absolute",
          left: 0,
          top: chromeShown ? TITLEBAR_H : 0,
          width: "100%",
          // iframes are REPLACED elements: height:auto resolves to the intrinsic
          // ~150px and top+bottom does NOT stretch them — the height must be
          // explicit or the app renders in a short strip over the page beneath.
          height: chromeShown ? `calc(100% - ${TITLEBAR_H}px)` : "100%",
          // Disable hit-testing while dragging/resizing so the iframe doesn't
          // swallow the pointer stream.
          pointerEvents: interacting ? "none" : "auto",
        }}
        className="block border-0 bg-[var(--st-bg)]"
      />

      {/* Loading veil until first load */}
      {active && !loaded && (
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-[var(--st-bg)]"
          style={{ top: chromeShown ? TITLEBAR_H : 0 }}
        >
          <span
            aria-label={`Loading ${name}`}
            role="status"
            className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--st-border)] border-t-[var(--st-text)]"
          />
        </div>
      )}

      {/* Resize handles (free windows only) */}
      {free &&
        RESIZE_DIRS.map((dir) => (
          <span
            key={dir}
            onPointerDown={onResizePointerDown(dir)}
            className={cn("absolute z-[3]", RESIZE_CLASS[dir])}
          />
        ))}
    </m.div>
  );
}

/* ── Traffic light ───────────────────────────────────────────────────── */

function TrafficLight({
  kind,
  label,
  onClick,
}: {
  kind: "close" | "min" | "max";
  label: string;
  onClick: () => void;
}) {
  const color =
    kind === "close" ? "#ff5f57" : kind === "min" ? "#febc2e" : "#28c840";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex size-3 items-center justify-center rounded-full border border-black/10"
      style={{ backgroundColor: color }}
    >
      {kind === "close" && (
        <span className="text-[7px] font-bold leading-none text-black/55 opacity-0 group-hover:opacity-100">
          ✕
        </span>
      )}
      {kind === "min" && (
        <Minus className="size-2 text-black/55 opacity-0 group-hover:opacity-100" />
      )}
      {kind === "max" && (
        <Square className="size-[7px] text-black/55 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

/* ── Resize geometry ─────────────────────────────────────────────────── */

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const RESIZE_CLASS: Record<ResizeDir, string> = {
  n: "inset-x-2 top-0 h-1.5 cursor-ns-resize",
  s: "inset-x-2 bottom-0 h-1.5 cursor-ns-resize",
  e: "inset-y-2 right-0 w-1.5 cursor-ew-resize",
  w: "inset-y-2 left-0 w-1.5 cursor-ew-resize",
  ne: "right-0 top-0 size-3 cursor-nesw-resize",
  nw: "left-0 top-0 size-3 cursor-nwse-resize",
  se: "bottom-0 right-0 size-3 cursor-nwse-resize",
  sw: "bottom-0 left-0 size-3 cursor-nesw-resize",
};

function applyResize(
  dir: ResizeDir,
  base: WindowGeometry,
  dx: number,
  dy: number,
): WindowGeometry {
  let { x, y, w, h } = base;
  if (dir.includes("e")) w = base.w + dx;
  if (dir.includes("s")) h = base.h + dy;
  if (dir.includes("w")) {
    w = base.w - dx;
    if (w < MIN_W) {
      x = base.x + (base.w - MIN_W);
      w = MIN_W;
    } else {
      x = base.x + dx;
    }
  }
  if (dir.includes("n")) {
    h = base.h - dy;
    if (h < MIN_H) {
      y = base.y + (base.h - MIN_H);
      h = MIN_H;
    } else {
      y = base.y + dy;
    }
  }
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.max(MIN_W, w),
    h: Math.max(MIN_H, h),
  };
}
