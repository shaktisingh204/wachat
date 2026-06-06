"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "../lib/cn";
import {
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
} from "../tooltip";

export interface ZoruAppRailItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export interface ZoruAppRailProps {
  /** Brand mark rendered at the top. */
  brand?: React.ReactNode;
  /** Primary navigation items. */
  items: ZoruAppRailItem[];
  /** Secondary items pinned to the bottom (e.g. settings, profile). */
  footer?: ZoruAppRailItem[];
  className?: string;
}

/**
 * Vertical 56px-wide icon rail. Tooltip on hover, optional active dot.
 * Generic — pass your own items; do not bake project-specific routes
 * into this component.
 */
export function ZoruAppRail({
  brand,
  items,
  footer,
  className,
}: ZoruAppRailProps) {
  return (
    <ZoruTooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-zoru-line bg-zoru-bg py-3",
          className,
        )}
      >
        {brand && <div className="mb-2 flex h-8 w-8 items-center justify-center">{brand}</div>}
        <nav
          // Long app lists scroll independently of the rest of the rail so
          // the footer (settings/profile) stays pinned at the bottom.
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <RailButton key={item.id} item={item} />
          ))}
        </nav>
        {footer && footer.length > 0 && (
          <nav className="flex flex-col items-center gap-1 border-t border-zoru-line/60 pt-2">
            {footer.map((item) => (
              <RailButton key={item.id} item={item} />
            ))}
          </nav>
        )}
      </aside>
    </ZoruTooltipProvider>
  );
}

function RailButton({ item }: { item: ZoruAppRailItem }) {
  const inner = (
    <span
      className={cn(
        // Default (inactive): transparent bg, dark icon, light hover wash.
        "relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] text-zoru-ink transition-colors",
        "hover:bg-zoru-surface-2",
        // Active: solid black tile with a white icon.
        item.active &&
          "bg-zoru-ink text-zoru-bg hover:bg-zoru-ink hover:text-zoru-bg",
        "[&_svg]:size-[18px]",
      )}
    >
      {item.icon}
      {item.badge && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zoru-primary px-1 text-[9px] font-semibold text-zoru-primary-foreground">
          {item.badge}
        </span>
      )}
    </span>
  );

  return (
    <Tooltip>
      <ZoruTooltipTrigger asChild>
        {item.href ? (
          <Link
            href={item.href}
            aria-label={item.label}
            onClick={item.onClick}
            className="focus-visible:outline-none"
          >
            {inner}
          </Link>
        ) : (
          <button
            type="button"
            aria-label={item.label}
            onClick={item.onClick}
            className="focus-visible:outline-none"
          >
            {inner}
          </button>
        )}
      </ZoruTooltipTrigger>
      <ZoruTooltipContent side="right">{item.label}</ZoruTooltipContent>
    </Tooltip>
  );
}
