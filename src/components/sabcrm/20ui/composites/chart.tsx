"use client";

import * as React from "react";
import * as Recharts from "recharts";

import { cn } from "./lib/cn";

/**
 * Neutral palette used by ZoruChart. Pure greyscale only — for visual
 * separation between series, use stroke pattern or shape variation
 * rather than hue. Charts in zoru are deliberately quiet; reach for
 * a dedicated viz component if you need rainbow categorical colours.
 */
export const ZORU_CHART_PALETTE = [
  "hsl(var(--st-text))",
  "hsl(var(--st-text-secondary))",
  "hsl(var(--st-text-tertiary))",
  "hsl(var(--st-border-strong))",
  "hsl(var(--st-border))",
] as const;

export interface ZoruChartContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Height in px or any CSS length. Defaults to 280. */
  height?: number | string;
  config?: unknown;
}

export function ZoruChartContainer({
  className,
  config: _config,
  height = 280,
  children,
  style,
  ...props
}: ZoruChartContainerProps) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ height, ...style }}
      {...props}
    >
      <Recharts.ResponsiveContainer width="100%" height="100%">
        {children as any}
      </Recharts.ResponsiveContainer>
    </div>
  );
}

export interface ZoruChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string;
  }>;
  label?: string | number;
  className?: string;
}

export function ZoruChartTooltip({
  active,
  payload,
  label,
  className,
}: ZoruChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-xs shadow-[var(--st-shadow-sm)]",
        className,
      )}
    >
      {label !== undefined && (
        <p className="mb-1 font-medium text-[var(--st-text)]">{String(label)}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, idx) => (
          <li
            key={`${entry.dataKey}-${idx}`}
            className="flex items-center gap-2 text-[var(--st-text-secondary)]"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: entry.color ?? "currentColor" }}
            />
            <span className="truncate">{entry.name}</span>
            <span className="ml-auto font-medium text-[var(--st-text)]">
              {String(entry.value ?? "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ZoruChart re-exports the Recharts primitives directly so users get
 * the full API. The container + tooltip + palette above are the only
 * pieces this wrapper opinionates.
 */
export const ZoruChart = Recharts;
