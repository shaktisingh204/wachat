"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "./lib/cn";

export const ZoruTooltipProvider = TooltipPrimitive.Provider;
export const ZoruTooltip = TooltipPrimitive.Root;
export const ZoruTooltipTrigger = TooltipPrimitive.Trigger;

export const ZoruTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "zoruui z-50 overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-ink px-2.5 py-1.5 text-xs font-medium text-zoru-bg shadow-[var(--zoru-shadow-md)]",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
        "data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
ZoruTooltipContent.displayName = "ZoruTooltipContent";
