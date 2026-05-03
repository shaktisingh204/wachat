"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "../lib/cn";
import {
  ZoruTooltip,
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
        <nav className="flex flex-col items-center gap-1">
          {items.map((item) => (
            <RailButton key={item.id} item={item} />
          ))}
        </nav>
        {footer && footer.length > 0 && (
          <nav className="mt-auto flex flex-col items-center gap-1 pt-2">
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
        "relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] text-zoru-ink-muted transition-colors",
        "hover:bg-zoru-surface-2 hover:text-zoru-ink",
        item.active && "bg-zoru-surface-2 text-zoru-ink",
        "[&_svg]:size-[18px]",
      )}
    >
      {item.icon}
      {item.badge && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zoru-primary px-1 text-[9px] font-semibold text-zoru-primary-foreground">
          {item.badge}
        </span>
      )}
      {item.active && (
        <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-zoru-ink" />
      )}
    </span>
  );

  return (
    <ZoruTooltip>
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
    </ZoruTooltip>
  );
}
