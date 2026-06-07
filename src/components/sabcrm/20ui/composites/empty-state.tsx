import * as React from "react";

import { cn } from "./lib/cn";

export interface SabEmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Compact variant for inline empty cells. */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
  ...props
}: SabEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] text-center",
        compact ? "gap-2 p-6" : "gap-3 p-12",
        className,
      )}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]",
            compact ? "h-9 w-9 [&_svg]:size-4" : "h-12 w-12 [&_svg]:size-5",
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className={cn("font-medium text-[var(--st-text)]", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-[var(--st-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
