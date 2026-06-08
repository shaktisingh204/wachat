import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "./lib/cn";
import { renderIcon, type IconProp } from "../_icon";

export interface SabStatisticsCard1Item {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: number;
  meta?: React.ReactNode;
}

export interface SabStatisticsCard1Props
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Top-line headline metric. */
  headline: React.ReactNode;
  /** Headline number. */
  value: React.ReactNode;
  /** Sub-stats laid out horizontally beneath the headline. */
  items?: SabStatisticsCard1Item[];
  footer?: React.ReactNode;
  icon?: IconProp;
}

/**
 * Multi-stat card — one big headline number plus a row of secondary
 * stats. For dashboards where one metric anchors the view and a few
 * supporting numbers add context.
 */
export function SabStatisticsCard1({
  headline,
  value,
  items = [],
  footer,
  icon,
  className,
  ...props
}: SabStatisticsCard1Props) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-6",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
            {headline}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-[var(--st-text)]">
            {value}
          </p>
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] [&_svg]:size-5">
            {renderIcon(icon)}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-5 grid gap-4 border-t border-[var(--st-border)] pt-4 sm:grid-cols-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                {item.label}
              </p>
              <p className="text-base font-semibold text-[var(--st-text)]">
                {item.value}
              </p>
              {item.delta !== undefined && (
                <p
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    item.delta >= 0 ? "text-[var(--st-status-ok)]" : "text-[var(--st-danger)]",
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
                <p className="text-xs text-[var(--st-text-secondary)]">{item.meta}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div className="mt-4 border-t border-[var(--st-border)] pt-3 text-xs text-[var(--st-text-secondary)]">
          {footer}
        </div>
      )}
    </div>
  );
}
