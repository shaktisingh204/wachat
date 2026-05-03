import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruEmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Compact variant for inline empty cells. */
  compact?: boolean;
}

export function ZoruEmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
  ...props
}: ZoruEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg text-center",
        compact ? "gap-2 p-6" : "gap-3 p-12",
        className,
      )}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted",
            compact ? "h-9 w-9 [&_svg]:size-4" : "h-12 w-12 [&_svg]:size-5",
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className={cn("font-medium text-zoru-ink", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-zoru-ink-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
