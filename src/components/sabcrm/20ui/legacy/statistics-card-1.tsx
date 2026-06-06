import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "./lib/cn";

export interface ZoruStatisticsCard1Item {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: number;
  meta?: React.ReactNode;
}

export interface ZoruStatisticsCard1Props
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Top-line headline metric. */
  headline: React.ReactNode;
  /** Headline number. */
  value: React.ReactNode;
  /** Sub-stats laid out horizontally beneath the headline. */
  items?: ZoruStatisticsCard1Item[];
  footer?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Multi-stat card — one big headline number plus a row of secondary
 * stats. For dashboards where one metric anchors the view and a few
 * supporting numbers add context.
 */
export function ZoruStatisticsCard1({
  headline,
  value,
  items = [],
  footer,
  icon,
  className,
  ...props
}: ZoruStatisticsCard1Props) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-6",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zoru-ink-subtle">
            {headline}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-zoru-ink">
            {value}
          </p>
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-5">
            {icon}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-5 grid gap-4 border-t border-zoru-line pt-4 sm:grid-cols-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                {item.label}
              </p>
              <p className="text-base font-semibold text-zoru-ink">
                {item.value}
              </p>
              {item.delta !== undefined && (
                <p
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    item.delta >= 0 ? "text-zoru-success" : "text-zoru-danger",
                  )}
                >
                  {item.delta >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(item.delta).toFixed(1)}%
                </p>
              )}
              {item.meta && (
                <p className="text-xs text-zoru-ink-muted">{item.meta}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div className="mt-4 border-t border-zoru-line pt-3 text-xs text-zoru-ink-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
