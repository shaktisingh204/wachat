"use client";

/**
 * SabAppDock — macOS-style application dock. Replaces the vertical app rail.
 *
 * Behaviour, deliberately faithful to the Mac dock:
 *   - Bottom-centred frosted-glass panel; icons magnify with cursor
 *     proximity (motion values + springs — never React state, so the
 *     magnification runs off the render loop and stays 60fps).
 *   - Auto-hides so it never steals space or input from the app. A 10px
 *     invisible strip along the bottom edge summons it; moving away
 *     dismisses it. Keyboard focus summons it instantly (no animation on
 *     keyboard-initiated reveals).
 *   - Right-click an icon for Open / Remove from Dock. The Launchpad tile
 *     opens the full app grid where any app can be pinned or unpinned.
 *   - The active app always shows (with its indicator dot) even when it
 *     isn't pinned — mirroring macOS "running app" behaviour.
 *   - Touch devices get a persistent pill handle that toggles a static,
 *     horizontally-scrollable dock (no hover physics on coarse pointers).
 *   - `prefers-reduced-motion` collapses magnification and slides to
 *     simple opacity fades.
 *
 * Imports stay relative (never via the 20ui barrel) per the barrel
 * self-cycle rule — this file is itself re-exported by the barrel.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUpRight, LayoutGrid, Pin, PinOff } from "lucide-react";

import { cn } from "../lib/cn";
import { SAB_APPS, type SabAppDescriptor } from "./apps";
import { useDockApps } from "./use-dock-apps";
import { SabLaunchpad } from "./launchpad";

/* Geometry (px). BASE tile, MAX under the cursor, RANGE of influence. */
const BASE = 44;
const MAX = 76;
const RANGE = 132;
const HIDE_DELAY_MS = 380;
/** Strong ease-out (emil): starts fast, settles softly. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface MenuState {
  appId: string;
  pinned: boolean;
}

export function SabAppDock({ className }: { className?: string }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const dock = useDockApps();

  const [finePointer, setFinePointer] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
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

  /* Show briefly on first load so the dock is discoverable, then hide. */
  React.useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => {
      if (!menuOpenRef.current) setVisible(false);
    }, 2200);
    return () => window.clearTimeout(t);
  }, []);

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

  const scheduleHide = React.useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      if (!menuOpenRef.current) {
        setVisible(false);
        setMenu(null);
      }
    }, HIDE_DELAY_MS);
  }, [cancelHide]);

  /* Resolve the dock's app list: pinned, plus the active app if unpinned. */
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
  const activeApp = React.useMemo(
    () => SAB_APPS.find((app) => app.isActive(pathname)) ?? null,
    [pathname],
  );
  const runningUnpinned =
    activeApp && !dock.pinnedIds.includes(activeApp.id) ? activeApp : null;

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

  /* Touch: tapping anywhere outside the dock dismisses it (there's no
     pointer-leave on coarse pointers). */
  React.useEffect(() => {
    if (finePointer || !visible) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setVisible(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [finePointer, visible]);

  const magnify = finePointer && !reduceMotion;

  const hiddenStyle = reduceMotion
    ? { opacity: 0 }
    : { y: 104, opacity: 0 };
  const shownStyle = reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 };

  if (!dock.hydrated) return null;

  return (
    <>
      {/* Bottom-edge summon strip (fine pointers only). Invisible, never
          intercepts clicks for the app itself — it only listens for the
          pointer brushing the very bottom edge, like macOS. */}
      {finePointer && !launchpadOpen && (
        <div
          aria-hidden="true"
          onPointerEnter={() => reveal(false)}
          className="fixed inset-x-0 bottom-0 z-[59] h-2.5"
        />
      )}

      {/* Touch handle: a small persistent pill that toggles the dock. */}
      {!finePointer && !visible && !launchpadOpen && (
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
          !visible && "pointer-events-none",
          className,
        )}
      >
      <m.div
        initial={false}
        animate={visible ? shownStyle : hiddenStyle}
        transition={
          instantReveal
            ? { duration: 0 }
            : { duration: reduceMotion ? 0.15 : 0.28, ease: EASE_OUT }
        }
        className="relative"
        onPointerEnter={() => {
          if (finePointer) reveal(false);
        }}
        onPointerLeave={() => {
          if (finePointer) {
            mouseX.set(Infinity);
            scheduleHide();
          }
        }}
        onFocusCapture={() => reveal(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
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
          className={cn(
            "flex items-end gap-1.5 rounded-[22px] border border-[var(--st-border)] px-2.5 py-2",
            "bg-[color-mix(in_srgb,var(--st-surface)_78%,transparent)]",
            "shadow-[0_18px_44px_-18px_rgba(0,0,0,0.45)]",
            "backdrop-blur-2xl backdrop-saturate-150",
            // Touch: cap to the viewport and let the row scroll.
            !finePointer && "max-w-[calc(100vw-16px)] overflow-x-auto",
          )}
        >
          <DockTile
            label="Launchpad"
            mouseX={mouseX}
            magnify={magnify}
            onActivate={() => {
              setMenu(null);
              setLaunchpadOpen(true);
            }}
          >
            <LayoutGrid aria-hidden="true" style={{ width: "46%", height: "46%" }} />
          </DockTile>

          <DockSeparator />

          {pinnedApps.map((app) => (
            <DockTile
              key={app.id}
              label={app.name}
              href={app.href}
              active={app.isActive(pathname)}
              mouseX={mouseX}
              magnify={magnify}
              menuOpen={menu?.appId === app.id}
              onContextMenu={() => setMenu({ appId: app.id, pinned: true })}
              onNavigate={() => {
                setMenu(null);
                if (!finePointer) setVisible(false);
              }}
            >
              <app.Icon aria-hidden="true" style={{ width: "52%", height: "52%" }} />
            </DockTile>
          ))}

          {runningUnpinned && (
            <>
              <DockSeparator />
              <DockTile
                label={runningUnpinned.name}
                href={runningUnpinned.href}
                active
                mouseX={mouseX}
                magnify={magnify}
                menuOpen={menu?.appId === runningUnpinned.id}
                onContextMenu={() =>
                  setMenu({ appId: runningUnpinned.id, pinned: false })
                }
                onNavigate={() => setMenu(null)}
              >
                <runningUnpinned.Icon
                  aria-hidden="true"
                  style={{ width: "52%", height: "52%" }}
                />
              </DockTile>
            </>
          )}
        </nav>

        {/* Context menu — static centered anchor; only the inner menu
            animates, so its transform can't break the centering. */}
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-[2] -translate-x-1/2">
          <AnimatePresence>
            {menu && (
              <DockContextMenu
                key={menu.appId}
                app={byId.get(menu.appId) ?? null}
                pinned={menu.pinned}
                reduceMotion={Boolean(reduceMotion)}
                onPinToggle={() => {
                  dock.toggle(menu.appId);
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
          scheduleHide();
        }}
      />
    </>
  );
}

function DockSeparator() {
  return (
    <span
      aria-hidden="true"
      className="mx-0.5 mb-[5px] block h-8 w-px self-end bg-[var(--st-border)]"
    />
  );
}

interface DockTileProps {
  label: string;
  href?: string;
  active?: boolean;
  mouseX: MotionValue<number>;
  magnify: boolean;
  menuOpen?: boolean;
  children: React.ReactNode;
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
  href,
  active,
  mouseX,
  magnify,
  menuOpen,
  children,
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
        "relative flex items-center justify-center rounded-[14px] border border-[var(--st-border)]/70",
        "bg-[var(--st-bg)] text-[var(--st-text)]",
        "transition-colors duration-150",
        "[&_svg]:shrink-0",
        active && "bg-[var(--st-text)] text-[var(--st-bg)] border-transparent",
      )}
    >
      {children}
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
      <span className="pointer-events-none absolute -top-9 left-1/2 z-[1] -translate-x-1/2">
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
          className="rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)] focus-visible:ring-offset-2 active:scale-[0.94] [transition:transform_140ms]"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={onActivate}
          className="rounded-[14px] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent,#4f46e5)] focus-visible:ring-offset-2 active:scale-[0.94] [transition:transform_140ms]"
        >
          {inner}
        </button>
      )}

      {/* Active indicator dot, like the macOS running-app dot. */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-[3px] h-1 w-1 rounded-full transition-opacity duration-150",
          active ? "bg-[var(--st-text)]/70 opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

interface DockContextMenuProps {
  app: SabAppDescriptor | null;
  pinned: boolean;
  reduceMotion: boolean;
  onPinToggle: () => void;
  onClose: () => void;
}

function DockContextMenu({
  app,
  pinned,
  reduceMotion,
  onPinToggle,
  onClose,
}: DockContextMenuProps) {
  const router = useRouter();
  if (!app) return null;

  return (
    <m.div
      role="menu"
      aria-label={`${app.name} options`}
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
        {app.name}
      </p>
      <DockMenuItem
        icon={<ArrowUpRight aria-hidden="true" className="size-3.5" />}
        label="Open"
        onSelect={() => {
          onClose();
          router.push(app.href);
        }}
      />
      <DockMenuItem
        icon={
          pinned ? (
            <PinOff aria-hidden="true" className="size-3.5" />
          ) : (
            <Pin aria-hidden="true" className="size-3.5" />
          )
        }
        label={pinned ? "Remove from Dock" : "Keep in Dock"}
        onSelect={onPinToggle}
      />
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
