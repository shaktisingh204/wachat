"use client";

/**
 * SabLaunchpad — full-screen app grid, macOS Launchpad style.
 *
 * Opened from the dock's Launchpad tile. Shows every app in SAB_APPS on a
 * blurred glass sheet with type-to-filter search. Each tile carries a
 * pin toggle (visible on hover / keyboard focus) that adds or removes the
 * app from the dock — the customization surface for "what lives on my
 * dock", including on touch devices where the dock has no right-click.
 *
 * Dialog semantics: `role="dialog"` + `aria-modal`, Escape and backdrop
 * dismiss, search autofocused on open, focus restored to the opener on
 * close, body scroll locked while open.
 *
 * Imports stay relative (never via the 20ui barrel) per the barrel
 * self-cycle rule.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Pin, PinOff, Search } from "lucide-react";

import { cn } from "../lib/cn";
import { SAB_APPS, isWindowableApp, type SabAppDescriptor } from "./apps";
import { SabAppLogo } from "./app-logos";
import { useDockApps } from "./use-dock-apps";
import { useDesktopWindows } from "./window-store";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface SabLaunchpadProps {
  open: boolean;
  onClose: () => void;
}

export function SabLaunchpad({ open, onClose }: SabLaunchpadProps) {
  const reduceMotion = useReducedMotion();
  const dock = useDockApps();
  const router = useRouter();
  // Open apps as live desktop windows (state preserved). Null if rendered
  // outside the desktop host — then fall back to navigation.
  const wm = useDesktopWindows();
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  /* Open/close side-effects: scroll lock, search focus, focus restore. */
  React.useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const apps = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAB_APPS;
    return SAB_APPS.filter((app) => app.name.toLowerCase().includes(q));
  }, [query]);

  function openApp(app: SabAppDescriptor) {
    onClose();
    if (!wm || !isWindowableApp(app)) {
      router.push(app.href);
      return;
    }
    wm.openWindow(app.id);
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Launchpad — all apps"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          onPointerDown={(e) => {
            // Backdrop press dismisses; presses inside tiles/search don't
            // reach here because children stop propagation.
            if (e.target === e.currentTarget) onClose();
          }}
          className={cn(
            "fixed inset-0 z-[90] flex flex-col items-center overflow-y-auto",
            "bg-[color-mix(in_srgb,var(--st-bg)_62%,transparent)]",
            "backdrop-blur-2xl backdrop-saturate-150",
            "px-4 pb-28 pt-[clamp(20px,6vh,64px)]",
          )}
        >
          {/* Search */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "sticky top-0 z-[1] flex w-full max-w-sm items-center gap-2 rounded-full",
              "border border-[var(--st-border)] px-4 py-2.5",
              "bg-[color-mix(in_srgb,var(--st-surface)_85%,transparent)] shadow-sm backdrop-blur-xl",
            )}
          >
            <Search aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps"
              aria-label="Search apps"
              className="w-full border-0 bg-transparent text-sm text-[var(--st-text)] outline-none placeholder:text-[var(--st-text)]/45"
            />
          </div>

          {/* App grid */}
          {apps.length === 0 ? (
            <p className="mt-16 text-sm text-[var(--st-text)]/60">
              No apps match “{query.trim()}”.
            </p>
          ) : (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-10 grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-2 gap-y-8"
            >
              {apps.map((app, i) => (
                <LaunchpadTile
                  key={app.id}
                  app={app}
                  index={i}
                  reduceMotion={Boolean(reduceMotion)}
                  pinned={dock.isPinned(app.id)}
                  onOpen={() => openApp(app)}
                  onTogglePin={() => dock.toggle(app.id)}
                />
              ))}
            </div>
          )}

          <p
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-12 text-[11px] text-[var(--st-text)]/45"
          >
            Hover an app and use the pin to keep it in the Dock · Esc to close
          </p>
        </m.div>
      )}
    </AnimatePresence>
  );
}

interface LaunchpadTileProps {
  app: SabAppDescriptor;
  index: number;
  pinned: boolean;
  reduceMotion: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}

function LaunchpadTile({
  app,
  index,
  pinned,
  reduceMotion,
  onOpen,
  onTogglePin,
}: LaunchpadTileProps) {
  return (
    <m.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        ease: EASE_OUT,
        delay: Math.min(index * 0.012, 0.22),
      }}
      className="group relative flex flex-col items-center gap-2"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${app.name}`}
          className={cn(
            "block size-14 rounded-[23%] border-0 bg-transparent p-0",
            "shadow-[0_4px_14px_-4px_rgba(0,0,0,0.45)]",
            "outline-none transition-transform duration-150 hover:scale-[1.06] active:scale-[0.95]",
            "focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)] focus-visible:ring-offset-2",
          )}
        >
          <SabAppLogo
            appId={app.id}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </button>

        {/* Pin toggle — revealed on hover / keyboard focus; always shown for
            pinned apps so the dock's contents are scannable at a glance. */}
        <button
          type="button"
          aria-label={pinned ? `Remove ${app.name} from Dock` : `Keep ${app.name} in Dock`}
          aria-pressed={pinned}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border",
            "shadow-sm outline-none transition-opacity duration-150",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)]",
            pinned
              ? "border-transparent bg-[var(--st-text)] text-[var(--st-bg)] opacity-100"
              : "border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text)] opacity-0 group-hover:opacity-100",
          )}
        >
          {pinned ? (
            <PinOff aria-hidden="true" className="size-3" />
          ) : (
            <Pin aria-hidden="true" className="size-3" />
          )}
        </button>
      </div>

      <span className="max-w-full truncate px-1 text-center text-xs text-[var(--st-text)]/85">
        {app.name}
      </span>
    </m.div>
  );
}
