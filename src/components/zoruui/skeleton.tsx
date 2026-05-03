import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ZoruSkeleton({ className, ...props }: ZoruSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2",
        className,
      )}
      {...props}
    />
  );
}
