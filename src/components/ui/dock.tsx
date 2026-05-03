"use client";

/**
 * App dock — modern multicolour light variant.
 *
 *  - Each DockIcon accepts an optional `accent` (a Tailwind gradient pair) so
 *    the dock surface can showcase per-module brand colour on hover/active.
 *  - The hover tooltip is rendered with a vivid gradient chip and is allowed
 *    to overflow vertically (parents must not clip — see SabNodeAppDock for
 *    the wrapper that explicitly stays `overflow-visible`).
 *  - Magnification is preserved from the original implementation.
 */

import * as React from "react";
import { useRef } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface DockProps {
  className?: string;
  children: React.ReactNode;
  maxAdditionalSize?: number;
  iconSize?: number;
}

export type DockAccent = {
  /** Tailwind class string for the active/hover gradient (e.g. "from-rose-500 to-pink-500"). */
  gradient: string;
  /** Foreground text/ink colour to pair with the soft tile (e.g. "text-rose-700"). */
  ink: string;
  /** Soft tile bg (e.g. "bg-rose-50"). */
  soft: string;
  /** Ring colour used on hover (e.g. "ring-rose-200/60"). */
  ring: string;
};

interface DockIconProps {
  className?: string;
  src?: string;
  href: string;
  name: string;
  active?: boolean;
  accent?: DockAccent;
  handleIconHover?: (e: React.MouseEvent<HTMLLIElement>) => void;
  children?: React.ReactNode;
  iconSize?: number;
  /**
   * If provided, the icon's click is intercepted (preventDefault) and this
   * callback runs instead of navigating via the Link. Used by the tabs
   * system to open/focus a tab rather than perform a hard navigation.
   * The Link is still rendered (so Cmd/Ctrl+click "open in new tab" and
   * right-click "copy link" keep working).
   */
  onActivate?: (href: string, name: string) => void;
}

type ScaleValueParams = [number, number];

export const scaleValue = function (
  value: number,
  from: ScaleValueParams,
  to: ScaleValueParams,
): number {
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return Math.floor(capped * scale + to[0]);
};

const DEFAULT_ACCENT: DockAccent = {
  gradient: "from-zinc-700 to-zinc-900",
  ink: "text-zinc-700",
  soft: "bg-white",
  ring: "ring-zinc-200/60",
};

export function DockIcon({
  className,
  src,
  href,
  name,
  active,
  accent,
  handleIconHover,
  children,
  iconSize,
  onActivate,
}: DockIconProps) {
  const ref = useRef<HTMLLIElement | null>(null);
  const a = accent ?? DEFAULT_ACCENT;

  return (
    <>
      <style jsx>
        {`
          .icon:hover + .icon {
            width: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-right, 0px)
            );
            height: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-right, 0px)
            );
            margin-top: calc(
              var(--icon-size) * -0.33 + var(--dock-offset-right, 0) * -1
            );
          }

          .icon:hover + .icon + .icon {
            width: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-right, 0px)
            );
            height: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-right, 0px)
            );
            margin-top: calc(
              var(--icon-size) * -0.17 + var(--dock-offset-right, 0) * -1
            );
          }

          .icon:has(+ .icon:hover) {
            width: calc(var(--icon-size) * 1.33 + var(--dock-offset-left, 0px));
            height: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-left, 0px)
            );
            margin-top: calc(
              var(--icon-size) * -0.33 + var(--dock-offset-left, 0) * -1
            );
          }

          .icon:has(+ .icon + .icon:hover) {
            width: calc(var(--icon-size) * 1.17 + var(--dock-offset-left, 0px));
            height: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-left, 0px)
            );
            margin-top: calc(
              var(--icon-size) * -0.17 + var(--dock-offset-left, 0) * -1
            );
          }
        `}
      </style>
      <li
        ref={ref}
        style={
          {
            transition:
              "width, height, margin-top, cubic-bezier(0.25, 1, 0.5, 1) 150ms",
            "--icon-size": `${iconSize}px`,
          } as React.CSSProperties
        }
        onMouseMove={handleIconHover}
        className={cn(
          "icon group/li relative flex h-[var(--icon-size)] w-[var(--icon-size)] cursor-pointer items-center justify-center px-[calc(var(--icon-size)*0.075)] hover:-mt-[calc(var(--icon-size)/2)] hover:h-[calc(var(--icon-size)*1.5)] hover:w-[calc(var(--icon-size)*1.5)] [&_img]:object-contain",
          className,
        )}
      >
        <Link
          href={href}
          aria-label={name}
          aria-current={active ? "page" : undefined}
          onClick={(e) => {
            if (!onActivate) return;
            // Honour browser shortcuts so users can still open in a new
            // browser tab if they want.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            e.preventDefault();
            onActivate(href, name);
          }}
          className={cn(
            "group/a relative aspect-square w-full rounded-2xl p-1.5",
            "bg-white/90 ring-1 ring-zinc-200/70",
            "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_8px_-3px_rgba(15,23,42,0.18)]",
            "transition-all duration-200 ease-out",
            "hover:ring-2 hover:-translate-y-0.5",
            "hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_24px_-6px_rgba(15,23,42,0.28)]",
            a.ring,
            active &&
              cn(
                "ring-2 bg-gradient-to-b text-white",
                a.gradient,
                "shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_10px_22px_-8px_rgba(15,23,42,0.45)]",
              ),
          )}
        >
          {/* Tooltip pill — gradient chip floating above the dock. The
              dock wrapper MUST be overflow-visible for this not to clip. */}
          <span
            className={cn(
              "pointer-events-none absolute left-1/2 -top-10 -translate-x-1/2",
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium tracking-tight",
              "text-white shadow-lg shadow-black/15",
              "bg-gradient-to-r",
              a.gradient,
              "opacity-0 translate-y-1 transition-all duration-200 ease-out",
              "group-hover/li:opacity-100 group-hover/li:translate-y-0",
            )}
          >
            {name}
            {/* Triangle pointer */}
            <span
              aria-hidden
              className={cn(
                "absolute left-1/2 -bottom-1 h-2 w-2 -translate-x-1/2 rotate-45",
                "bg-gradient-to-br",
                a.gradient,
              )}
            />
          </span>

          {src ? (
            <img
              src={src}
              alt={name}
              className="h-full w-full rounded-[inherit]"
            />
          ) : (
            <span
              className={cn(
                "flex h-full w-full items-center justify-center",
                active ? "text-white" : a.ink,
              )}
            >
              {children}
            </span>
          )}
        </Link>
        {active && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full",
              "bg-gradient-to-r shadow-sm",
              a.gradient,
            )}
          />
        )}
      </li>
    </>
  );
}

export function Dock({
  className,
  children,
  maxAdditionalSize = 5,
  iconSize = 55,
}: DockProps) {
  const dockRef = useRef<HTMLElement | null>(null);

  const handleIconHover = (e: React.MouseEvent<HTMLLIElement>) => {
    if (!dockRef.current) return;
    const mousePos = e.clientX;
    const iconPosLeft = e.currentTarget.getBoundingClientRect().left;
    const iconWidth = e.currentTarget.getBoundingClientRect().width;

    const cursorDistance = (mousePos - iconPosLeft) / iconWidth;
    const offsetPixels = scaleValue(
      cursorDistance,
      [0, 1],
      [maxAdditionalSize * -1, maxAdditionalSize],
    );

    dockRef.current.style.setProperty(
      "--dock-offset-left",
      `${offsetPixels * -1}px`,
    );

    dockRef.current.style.setProperty(
      "--dock-offset-right",
      `${offsetPixels}px`,
    );
  };

  return (
    <nav ref={dockRef} role="navigation" aria-label="App dock">
      {/* Frosted-glass surface with multicolour rim glow */}
      <div className="relative">
        {/* Soft multicolour aurora behind the dock */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 -inset-y-3 -z-10 rounded-[26px] opacity-70 blur-2xl"
          style={{
            background:
              "radial-gradient(40% 80% at 15% 50%, rgba(244,114,182,0.35), transparent 70%)," +
              "radial-gradient(40% 80% at 50% 50%, rgba(99,102,241,0.30), transparent 70%)," +
              "radial-gradient(40% 80% at 85% 50%, rgba(45,212,191,0.32), transparent 70%)",
          }}
        />
        <ul
          className={cn(
            "relative flex items-center gap-0.5 rounded-2xl p-1.5",
            "bg-white/70 backdrop-blur-xl",
            "ring-1 ring-zinc-200/70",
            "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_-12px_rgba(15,23,42,0.35)]",
            className,
          )}
        >
          {React.Children.map(children, (child) =>
            React.isValidElement<DockIconProps>(child)
              ? React.cloneElement(child as React.ReactElement<DockIconProps>, {
                  handleIconHover,
                  iconSize,
                })
              : child,
          )}
        </ul>
      </div>
    </nav>
  );
}
