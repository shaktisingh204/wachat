"use client";

/**
 * MissionControl — an Exposé-style overlay of every open window. Toggle with
 * Ctrl+Alt+↑ (a combo the OS/browser leaves alone; the canvas forwards it from
 * inside app frames via a CustomEvent so it works while focus is in an app),
 * Esc closes. Click a card to focus that window. Works in both desktop modes.
 *
 * Imports stay relative per the barrel self-cycle rule.
 */

import * as React from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { cn } from "../lib/cn";
import { SAB_APPS } from "./apps";
import { SabAppLogo } from "./app-logos";
import { useDesktopWindows } from "./window-store";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const MISSION_CONTROL_EVENT = "sabnode:mission-control-toggle";

export function MissionControl() {
  const wm = useDesktopWindows();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener(MISSION_CONTROL_EVENT, toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(MISSION_CONTROL_EVENT, toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!wm) return null;
  const windows = wm.windows;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Open windows"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: EASE_OUT }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          className={cn(
            "fixed inset-0 z-[85] flex flex-col items-center justify-center gap-8 p-10",
            "bg-[color-mix(in_srgb,var(--st-bg)_55%,transparent)] backdrop-blur-2xl",
          )}
        >
          {windows.length === 0 ? (
            <p className="text-sm text-[var(--st-text)]/70">
              No open apps — open one from the dock.
            </p>
          ) : (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6"
            >
              {windows.map((wnd) => {
                const app = SAB_APPS.find((a) => a.id === wnd.id);
                const name = app?.name ?? wnd.id;
                const focused = wm.activeId === wnd.id;
                return (
                  <div
                    key={wnd.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      wm.focusWindow(wnd.id);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        wm.focusWindow(wnd.id);
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border p-5 text-center outline-none transition",
                      "focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)]",
                      focused
                        ? "border-[var(--st-accent,#4f46e5)] bg-[var(--st-surface)]"
                        : "border-[var(--st-border)] bg-[color-mix(in_srgb,var(--st-surface)_70%,transparent)] hover:bg-[var(--st-surface)]",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Close ${name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        wm.closeWindow(wnd.id);
                      }}
                      className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text)] opacity-0 transition-opacity hover:text-[var(--st-danger,#ef4444)] focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="size-16 overflow-hidden rounded-[22%] shadow-lg">
                      <SabAppLogo
                        appId={wnd.id}
                        style={{ width: "100%", height: "100%", display: "block" }}
                      />
                    </span>
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {name}
                    </span>
                    <span className="text-[11px] text-[var(--st-text)]/55">
                      {focused ? "Focused" : "Open"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-[var(--st-text)]/45">
            Ctrl+Alt+↑ toggle · Esc close · click a window to switch
          </p>
        </m.div>
      )}
    </AnimatePresence>
  );
}
