"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "../lib/cn";
import { renderIcon, type IconProp } from "../../_icon";
import {
  Tooltip,
  SabTooltipContent,
  SabTooltipProvider,
  SabTooltipTrigger,
} from "../tooltip";

export interface SabAppRailItem {
  id: string;
  label: string;
  icon: IconProp;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export interface SabAppRailProps {
  /** Brand mark rendered at the top. */
  brand?: React.ReactNode;
  /** Primary navigation items. */
  items: SabAppRailItem[];
  /** Secondary items pinned to the bottom (e.g. settings, profile). */
  footer?: SabAppRailItem[];
  className?: string;
}

/**
 * Vertical 56px-wide icon rail. Tooltip on hover, optional active dot.
 * Generic — pass your own items; do not bake project-specific routes
 * into this component.
 */
export function SabAppRail({
  brand,
  items,
  footer,
  className,
}: SabAppRailProps) {
  return (
    <SabTooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-[var(--st-border)] bg-[var(--st-bg)] py-3",
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
          <nav className="flex flex-col items-center gap-1 border-t border-[var(--st-border)]/60 pt-2">
            {footer.map((item) => (
              <RailButton key={item.id} item={item} />
            ))}
          </nav>
        )}
      </aside>
    </SabTooltipProvider>
  );
}

function RailButton({ item }: { item: SabAppRailItem }) {
  const inner = (
    <span
      className={cn(
        // Default (inactive): transparent bg, dark icon, light hover wash.
        "relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-text)] transition-colors",
        "hover:bg-[var(--st-bg-muted)]",
        // Active: solid black tile with a white icon.
        item.active &&
          "bg-[var(--st-text)] text-[var(--st-bg)] hover:bg-[var(--st-text)] hover:text-[var(--st-bg)]",
        "[&_svg]:size-[18px]",
      )}
    >
      {renderIcon(item.icon)}
      {item.badge && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--st-accent)] px-1 text-[9px] font-semibold text-[var(--st-text-inverted)]">
          {item.badge}
        </span>
      )}
    </span>
  );

  return (
    <Tooltip>
      <SabTooltipTrigger asChild>
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
      </SabTooltipTrigger>
      <SabTooltipContent side="right">{item.label}</SabTooltipContent>
    </Tooltip>
  );
}
