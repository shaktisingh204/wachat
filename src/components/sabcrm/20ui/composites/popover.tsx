"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "./lib/cn";

export const Popover = PopoverPrimitive.Root;
export const SabPopoverTrigger = PopoverPrimitive.Trigger;
export const SabPopoverAnchor = PopoverPrimitive.Anchor;
export const SabPopoverPortal = PopoverPrimitive.Portal;

export const SabPopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 6, ...props }, ref) => (
  <SabPopoverPortal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "zoruui-surface-sheen z-50 w-72 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 text-[var(--st-text)] shadow-[var(--st-shadow-lg)]",
        "outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
        className,
      )}
      {...props}
    />
  </SabPopoverPortal>
));
SabPopoverContent.displayName = "SabPopoverContent";

export {
  SabPopoverTrigger as PopoverTrigger,
  SabPopoverAnchor as PopoverAnchor,
  SabPopoverPortal as PopoverPortal,
  SabPopoverContent as PopoverContent,
};
