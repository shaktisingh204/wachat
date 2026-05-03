"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "./lib/cn";

export interface ZoruProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

export const ZoruProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ZoruProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-zoru-primary transition-transform duration-500", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
ZoruProgress.displayName = "ZoruProgress";
