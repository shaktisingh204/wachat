import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: ZoruSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] shadow-inner",
        className,
      )}
      {...props}
    />
  );
}
