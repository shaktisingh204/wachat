"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruWaterLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pixel size of the loader. Defaults to 56. */
  size?: number;
  /** Optional label rendered beneath the orb. */
  label?: React.ReactNode;
}

/**
 * ZoruWaterLoader — minimalist inline loading indicator. A neutral
 * black orb with a slow ripple. Re-coloured port of the SabNode
 * water loader, stripped down to fit the zoru aesthetic.
 */
export function ZoruWaterLoader({
  size = 56,
  label,
  className,
  ...props
}: ZoruWaterLoaderProps) {
  return (
    <div
      className={cn("inline-flex flex-col items-center gap-3", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-zoru-ink/15" />
        <span className="absolute inset-2 animate-pulse-soft rounded-full bg-zoru-ink/25" />
        <span className="relative inline-flex h-1/3 w-1/3 rounded-full bg-zoru-ink" />
      </div>
      {label && (
        <span className="text-xs text-zoru-ink-muted">{label}</span>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
