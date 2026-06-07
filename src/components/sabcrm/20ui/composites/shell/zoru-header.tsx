"use client";

import * as React from "react";

import { cn } from "../lib/cn";

export interface ZoruHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Left slot — typically breadcrumb / page title. */
  leading?: React.ReactNode;
  /** Center slot — typically a global search input. */
  center?: React.ReactNode;
  /** Right slot — actions, notifications, profile menu, dock. */
  trailing?: React.ReactNode;
  /** Render as sticky to the viewport top. Defaults to true. */
  sticky?: boolean;
}

/**
 * Top header bar — neutral, 56px tall, with three composable slots.
 * Generic; pass slots from your layout instead of baking in nav state.
 */
export function ZoruHeader({
  leading,
  center,
  trailing,
  sticky = true,
  className,
  ...props
}: ZoruHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center gap-4 border-b border-zoru-line bg-zoru-bg px-4",
        sticky && "sticky top-0 z-20",
        className,
      )}
      {...props}
    >
      {leading && <div className="flex min-w-0 items-center gap-2">{leading}</div>}
      {center && <div className="mx-auto w-full max-w-xl">{center}</div>}
      {trailing && (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      )}
    </header>
  );
}
