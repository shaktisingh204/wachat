"use client";

/**
 * SabAppDock — macOS-style application dock. Replaces the vertical app rail.
 *
 * Behaviour, deliberately faithful to the Mac dock:
 *   - Bottom-centred frosted-glass panel; compact colourful tiles (each app
 *     has its own gradient, see `app-colors.ts`) that magnify with cursor
 *     proximity (motion values + springs — never React state, so the
 *     magnification runs off the render loop and stays 60fps).
 *   - Visible by default. Right-click the dock background for
 *     "Turn Hiding On/Off" (persisted) — with hiding on, a 10px strip along
 *     the bottom edge summons it and moving away dismisses it. Keyboard
 *     focus summons it instantly (no animation on keyboard-initiated
 *     reveals).
 *   - Right-click an icon for Open / Remove from Dock. The Launchpad tile
 *     opens the full app grid where any app can be pinned or unpinned.
 *   - The active app always shows (with its indicator dot) even when it
 *     isn't pinned — mirroring macOS "running app" behaviour.
 *   - Touch devices get no hover physics; with hiding on they get a
 *     persistent pill handle that toggles a static, horizontally-scrollable
 *     dock.
 *   - `prefers-reduced-motion` collapses magnification and slides to
 *     simple opacity fades.
 *
 * Imports stay relative (never via the 20ui barrel) per the barrel
 * self-cycle rule — this file is itself re-exported by the barrel.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  AppWindow,
  ArrowUpRight,
  Eye,
  EyeOff,
  Maximize,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from "lucide-react";

import { cn } from "../lib/cn";
import { SAB_APPS, isWindowableApp, type SabAppDescriptor } from "./apps";
import { SabAppLogo } from "./app-logos";
import { useDockApps, useDockAutoHide } from "./use-dock-apps";
import { useDesktopWindows, type DesktopMode } from "./window-store";
import { SabLaunchpad } from "./launchpad";

/* Compact geometry (px). BASE tile, MAX under the cursor, RANGE of influence. */
const BASE = 38;
const MAX = 64;
const RANGE = 112;
const HIDE_DELAY_MS = 380;
/** Strong ease-out (emil): starts fast, settles softly. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type MenuState =
  | { kind: "app"; appId: string; pinned: boolean }
  | { kind: "dock" };

export function SabAppDock({ className }: { className?: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const dock = useDockApps();
  const hiding = useDockAutoHide();
  // The desktop window store drives "what's open" + "what's focused". Null only
  // if the dock is ever rendered outside the desktop host (then it stays inert).
  const wm = useDesktopWindows();

  const [finePointer, setFinePointer] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [instantReveal, setInstantReveal] = React.useState(false);
  const [launchpadOpen, setLaunchpadOpen] = React.useState(false);
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const hideTimer = React.useRef<number | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuOpenRef = React.useRef(false);
  menuOpenRef.current = menu !== null;

  /* Cursor x in viewport coords; Infinity = pointer away (no magnification). */
  const mouseX = useMotionValue(Infinity);

  React.useLayoutEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFinePointer(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* With hiding on: show briefly on load for discoverability, then hide. */
  React.useEffect(() => {
    if (!hiding.hydrated || !hiding.autoHide) return;
    setVisible(true);
    const t = window.setTimeout(() => {
      if (!menuOpenRef.current) setVisible(false);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [hiding.hydrated, hiding.autoHide]);

  const cancelHide = React.useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const reveal = React.useCallback(
    (instant = false) => {
      cancelHide();
      setInstantReveal(instant);
      setVisible(true);
    },
    [cancelHide],
  );

  const autoHideRef = React.useRef(false);
  autoHideRef.current = hiding.autoHide;

  const scheduleHide = React.useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      if (autoHideRef.current && !menuOpenRef.current) {
        setVisible(false);
        setMenu(null);
      }
    }, HIDE_DELAY_MS);
  }, [cancelHide]);

  /* Resolve the dock's app list: pinned apps, plus any OPEN window that isn't
     pinned (macOS "running app" behaviour, now driven by real open windows). */
  const byId = React.useMemo(
    () => new Map(SAB_APPS.map((app) => [app.id, app])),
    [],
  );
  const pinnedApps = React.useMemo(
    () =>
      dock.pinnedIds
        .map((id) => byId.get(id))
        .filter((a): a is SabAppDescriptor => Boolean(a)),
    [dock.pinnedIds, byId],
  );
  const openUnpinned = React.useMemo(
    () =>
      (wm?.windows ?? [])
        .map((w) => byId.get(w.id))
        .filter((a): a is SabAppDescriptor => Boolean(a))
        .filter((a) => !dock.pinnedIds.includes(a.id)),
    [wm?.windows, byId, dock.pinnedIds],
  );

  /* Open (or focus) an app as a desktop window — or hard-navigate the apps that
     aren't windowable (SabCRM, SabSites). Also dismisses the menu and, on touch
     with hiding on, tucks the dock away. */
  const activateApp = React.useCallback(
    (app: SabAppDescriptor) => {
      setMenu(null);
      if (hiding.autoHide && !finePointer) setVisible(false);
      if (!wm || !isWindowableApp(app)) {
        router.push(app.href);
        return;
      }
      wm.openWindow(app.id);
    },
    [wm, router, hiding.autoHide, finePointer],
  );

  /* Close the context menu on outside press / Escape. */
  React.useEffect(() => {
    if (!menu) return;
    const onPress = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  /* Touch + hiding on: tapping anywhere outside the dock dismisses it
     (there's no pointer-leave on coarse pointers). */
  React.useEffect(() => {
    if (finePointer || !hiding.autoHide || !visible) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setVisible(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [finePointer, hiding.autoHide, visible]);

  const magnify = finePointer && !reduceMotion;
  /* With hiding off the dock is pinned on screen, whatever `visible` says. */
  const shown = !hiding.autoHide || visible;

  function toggleHiding() {
    const next = !hiding.autoHide;
    hiding.setAutoHide(next);
    setMenu(null);
    if (next) {
      setVisible(true);
      scheduleHide();
    } else {
      reveal(true);
    }
  }

  const hiddenStyle = reduceMotion ? { opacity: 0 } : { y: 88, opacity: 0 };
  const shownStyle = reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 };

  if (!dock.hydrated || !hiding.hydrated || !wm || !wm.hydrated) return null;

  return (
    <>
      {/* Bottom-edge summon strip (hiding on, fine pointers only). */}
      {hiding.autoHide && finePointer && !launchpadOpen && (
        <div
          aria-hidden="true"
          onPointerEnter={() => reveal(false)}
          className="fixed inset-x-0 bottom-0 z-[59] h-2.5"
        />
      )}

      {/* Touch handle (hiding on): a small pill that summons the dock. */}
      {hiding.autoHide && !finePointer && !shown && !launchpadOpen && (
        <button
          type="button"
          aria-label="Show app dock"
          onClick={() => reveal(true)}
          className="fixed bottom-1.5 left-1/2 z-[59] h-5 w-16 -translate-x-1/2 rounded-full border-0 bg-transparent p-0"
        >
          <span className="mx-auto block h-[5px] w-12 rounded-full bg-[var(--st-text)]/30" />
        </button>
      )}

      {/* Static fixed+centered frame; the inner m.div only animates y/opacity
          so motion's inline transform never clobbers the centering. */}
      <div
        ref={wrapRef}
        className={cn(
          "fixed bottom-2 left-1/2 z-[60] -translate-x-1/2",
          !shown && "pointer-events-none",
          className,
        )}
      >
      <m.div
        initial={false}
        animate={shown ? shownStyle : hiddenStyle}
        transition={
          instantReveal
            ? { duration: 0 }
            : { duration: reduceMotion ? 0.15 : 0.28, ease: EASE_OUT }
        }
        className="relative"
        onPointerEnter={() => {
          if (hiding.autoHide && finePointer) reveal(false);
        }}
        onPointerLeave={() => {
          if (finePointer) {
            mouseX.set(Infinity);
            if (hiding.autoHide) scheduleHide();
          }
        }}
        onFocusCapture={() => {
          if (hiding.autoHide) reveal(true);
        }}
        onBlurCapture={(e) => {
          if (
            hiding.autoHide &&
            !e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            scheduleHide();
          }
        }}
      >
        <nav
          aria-label="App dock"
          onMouseMove={(e) => {
            if (magnify) mouseX.set(e.clientX);
          }}
          onMouseLeave={() => mouseX.set(Infinity)}
          onContextMenu={(e) => {
            // Background right-click → dock settings (tiles stop propagation).
            e.preventDefault();
            setMenu({ kind: "dock" });
          }}
          className={cn(
            "flex items-end gap-1 rounded-[18px] border border-[var(--st-border)] px-2 py-1.5",
            "bg-[color-mix(in_srgb,var(--st-surface)_78%,transparent)]",
            "shadow-[0_14px_36px_-16px_rgba(0,0,0,0.45)]",
            "backdrop-blur-2xl backdrop-saturate-150",
            // Touch: cap to the viewport and let the row scroll.
            !finePointer && "max-w-[calc(100vw-16px)] overflow-x-auto",
          )}
        >
          <DockTile
            label="Launchpad"
            appId="launchpad"
            mouseX={mouseX}
            magnify={magnify}
            onActivate={() => {
              setMenu(null);
              setLaunchpadOpen(true);
            }}
          />

          <DockSeparator />

          {pinnedApps.map((app) => (
            <DockTile
              key={app.id}
              label={app.name}
              appId={app.id}
              active={wm.isOpen(app.id)}
              focused={wm.activeId === app.id}
              mouseX={mouseX}
              magnify={magnify}
              menuOpen={menu?.kind === "app" && menu.appId === app.id}
              onActivate={() => activateApp(app)}
              onContextMenu={() =>
                setMenu({ kind: "app", appId: app.id, pinned: true })
              }
            />
          ))}

          {openUnpinned.length > 0 && (
            <>
              <DockSeparator />
              {openUnpinned.map((app) => (
                <DockTile
                  key={app.id}
                  label={app.name}
                  appId={app.id}
                  active
                  focused={wm.activeId === app.id}
                  mouseX={mouseX}
                  magnify={magnify}
                  menuOpen={menu?.kind === "app" && menu.appId === app.id}
                  onActivate={() => activateApp(app)}
                  onContextMenu={() =>
                    setMenu({ kind: "app", appId: app.id, pinned: false })
                  }
                />
              ))}
            </>
          )}
        </nav>

        {/* Context menu — static centered anchor; only the inner menu
            animates, so its transform can't break the centering. */}
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-[2] -translate-x-1/2">
          <AnimatePresence>
            {menu && (
              <DockContextMenu
                key={menu.kind === "app" ? menu.appId : "dock"}
                menu={menu}
                app={menu.kind === "app" ? (byId.get(menu.appId) ?? null) : null}
                autoHide={hiding.autoHide}
                reduceMotion={Boolean(reduceMotion)}
                windowOpen={menu.kind === "app" ? wm.isOpen(menu.appId) : false}
                desktopMode={wm.mode}
                onToggleMode={() => {
                  wm.setMode(wm.mode === "windows" ? "spaces" : "windows");
                  setMenu(null);
                }}
                onOpen={() => {
                  const app =
                    menu.kind === "app" ? byId.get(menu.appId) : undefined;
                  if (app) activateApp(app);
                }}
                onCloseWindow={() => {
                  if (menu.kind === "app") wm.closeWindow(menu.appId);
                  setMenu(null);
                }}
                onPinToggle={() => {
                  if (menu.kind === "app") dock.toggle(menu.appId);
                  setMenu(null);
                }}
                onToggleHiding={toggleHiding}
                onResetDock={() => {
                  dock.reset();
                  setMenu(null);
                }}
                onClose={() => setMenu(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </m.div>
      </div>

      <SabLaunchpad
        open={launchpadOpen}
        onClose={() => {
          setLaunchpadOpen(false);
          if (hiding.autoHide) scheduleHide();
        }}
      />
    </>
  );
}

function DockSeparator() {
  return (
    <span
      aria-hidden="true"
      className="mx-0.5 mb-[4px] block h-7 w-px self-end bg-[var(--st-border)]"
    />
  );
}

interface DockTileProps {
  label: string;
  /** App id — picks the full macOS-style logo (gradient + glyph). */
  appId: string;
  href?: string;
  /** App has an open window (running-app dot). */
  active?: boolean;
  /** App's window is the focused one (brighter dot). */
  focused?: boolean;
  mouseX: MotionValue<number>;
  magnify: boolean;
  menuOpen?: boolean;
  onActivate?: () => void;
  onNavigate?: () => void;
  onContextMenu?: () => void;
}

/**
 * One dock icon. Size is a spring driven by the cursor's distance to the
 * tile centre — pure motion values, zero React re-renders per mousemove.
 */
function DockTile({
  label,
  appId,
  href,
  active,
  focused,
  mouseX,
  magnify,
  menuOpen,
  onActivate,
  onNavigate,
  onContextMenu,
}: DockTileProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);

  const distance = useTransform(mouseX, (x) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return Infinity;
    return x - bounds.x - bounds.width / 2;
  });
  const sizeTarget = useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAX, BASE]);
  const sizeSpring = useSpring(sizeTarget, {
    mass: 0.12,
    stiffness: 210,
    damping: 16,
  });
  const size = magnify ? sizeSpring : BASE;

  const inner = (
    <m.span
      style={{ width: size, height: size }}
      className={cn(
        "relative block rounded-[23%]",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.45)]",
      )}
    >
      <SabAppLogo
        appId={appId}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </m.span>
  );

  const showLabel = hovered || menuOpen;

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={
        onContextMenu
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu();
            }
          : undefined
      }
    >
      {/* Name label, macOS-style, above the icon. The outer span owns the
          centering transform; the inner m.span animates independently. */}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-[1] -translate-x-1/2">
        <AnimatePresence>
          {showLabel && (
            <m.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14, ease: EASE_OUT }}
              className={cn(
                "block whitespace-nowrap",
                "rounded-md border border-[var(--st-border)] px-2 py-1 text-[11px] font-medium",
                "bg-[color-mix(in_srgb,var(--st-surface)_92%,transparent)] text-[var(--st-text)]",
                "shadow-sm backdrop-blur-md",
              )}
            >
              {label}
            </m.span>
          )}
        </AnimatePresence>
      </span>

      {href ? (
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className="rounded-[23%] outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)] focus-visible:ring-offset-2 active:scale-[0.94] [transition:transform_140ms]"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={onActivate}
          className="rounded-[23%] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)] focus-visible:ring-offset-2 active:scale-[0.94] [transition:transform_140ms]"
        >
          {inner}
        </button>
      )}

      {/* Running-app dot — brighter + larger for the focused window. */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-[2px] rounded-full transition-all duration-150",
          focused
            ? "h-1.5 w-1.5 bg-[var(--st-text)] opacity-100"
            : active
              ? "h-1 w-1 bg-[var(--st-text)]/70 opacity-100"
              : "h-1 w-1 opacity-0",
        )}
      />
    </div>
  );
}

interface DockContextMenuProps {
  menu: MenuState;
  app: SabAppDescriptor | null;
  autoHide: boolean;
  reduceMotion: boolean;
  /** The menu's app currently has an open window. */
  windowOpen: boolean;
  desktopMode: DesktopMode;
  onToggleMode: () => void;
  onOpen: () => void;
  onCloseWindow: () => void;
  onPinToggle: () => void;
  onToggleHiding: () => void;
  onResetDock: () => void;
  onClose: () => void;
}

function DockContextMenu({
  menu,
  app,
  autoHide,
  reduceMotion,
  windowOpen,
  desktopMode,
  onToggleMode,
  onOpen,
  onCloseWindow,
  onPinToggle,
  onToggleHiding,
  onResetDock,
  onClose,
}: DockContextMenuProps) {
  if (menu.kind === "app" && !app) return null;

  return (
    <m.div
      role="menu"
      aria-label={menu.kind === "app" ? `${app?.name} options` : "Dock options"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "min-w-44 origin-bottom",
        "rounded-xl border border-[var(--st-border)] p-1",
        "bg-[color-mix(in_srgb,var(--st-surface)_94%,transparent)] shadow-xl backdrop-blur-xl",
      )}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-[var(--st-text-secondary,inherit)] opacity-70">
        {menu.kind === "app" ? app?.name : "Dock"}
      </p>

      {menu.kind === "app" && app && (
        <>
          <DockMenuItem
            icon={<ArrowUpRight aria-hidden="true" className="size-3.5" />}
            label={windowOpen ? "Switch to" : "Open"}
            onSelect={() => {
              onClose();
              onOpen();
            }}
          />
          {windowOpen && (
            <DockMenuItem
              icon={<X aria-hidden="true" className="size-3.5" />}
              label="Close Window"
              onSelect={onCloseWindow}
            />
          )}
          <DockMenuItem
            icon={
              menu.pinned ? (
                <PinOff aria-hidden="true" className="size-3.5" />
              ) : (
                <Pin aria-hidden="true" className="size-3.5" />
              )
            }
            label={menu.pinned ? "Remove from Dock" : "Keep in Dock"}
            onSelect={onPinToggle}
          />
          <div aria-hidden="true" className="mx-2 my-1 h-px bg-[var(--st-border)]" />
        </>
      )}

      <DockMenuItem
        icon={
          autoHide ? (
            <Eye aria-hidden="true" className="size-3.5" />
          ) : (
            <EyeOff aria-hidden="true" className="size-3.5" />
          )
        }
        label={autoHide ? "Turn Hiding Off" : "Turn Hiding On"}
        onSelect={onToggleHiding}
      />
      {menu.kind === "dock" && (
        <>
          <DockMenuItem
            icon={
              desktopMode === "windows" ? (
                <Maximize aria-hidden="true" className="size-3.5" />
              ) : (
                <AppWindow aria-hidden="true" className="size-3.5" />
              )
            }
            label={desktopMode === "windows" ? "Use Spaces" : "Use Windows"}
            onSelect={onToggleMode}
          />
          <DockMenuItem
            icon={<RotateCcw aria-hidden="true" className="size-3.5" />}
            label="Reset Dock"
            onSelect={onResetDock}
          />
        </>
      )}
    </m.div>
  );
}

function DockMenuItem({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs",
        "text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] focus-visible:bg-[var(--st-bg-muted)] outline-none",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
