import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruCard, ZoruCardContent } from "./card";

export interface ZoruStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** % delta vs previous period (positive = up). */
  delta?: number;
  /** Format string for the delta — defaults to `{n}%`. */
  formatDelta?: (delta: number) => string;
  /** Period label, e.g. "vs last week". */
  period?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional inline sparkline / chart node. */
  chart?: React.ReactNode;
  /** For deltas where "up" is bad (e.g. error rate) — invert colours. */
  invertDelta?: boolean;
}

export function ZoruStatCard({
  label,
  value,
  delta,
  formatDelta,
  period,
  icon,
  chart,
  invertDelta,
  className,
  ...props
}: ZoruStatCardProps) {
  const positive = delta !== undefined && delta >= 0;
  const isGood = invertDelta ? !positive : positive;

  return (
    <ZoruCard className={cn("overflow-hidden", className)} {...props}>
      <ZoruCardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zoru-ink-subtle">
              {label}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-zoru-ink">
              {value}
            </p>
          </div>
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-4">
              {icon}
            </span>
          )}
        </div>
        {(delta !== undefined || period) && (
          <div className="flex items-center gap-2 text-xs">
            {delta !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  isGood ? "text-zoru-success" : "text-zoru-danger",
                )}
              >
                {positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {formatDelta ? formatDelta(delta) : `${Math.abs(delta).toFixed(1)}%`}
              </span>
            )}
            {period && <span className="text-zoru-ink-muted">{period}</span>}
          </div>
        )}
        {chart && <div className="-mx-2 -mb-2">{chart}</div>}
      </ZoruCardContent>
    </ZoruCard>
  );
}
