"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "./lib/cn";

export const ZoruPopover = PopoverPrimitive.Root;
export const ZoruPopoverTrigger = PopoverPrimitive.Trigger;
export const ZoruPopoverAnchor = PopoverPrimitive.Anchor;
export const ZoruPopoverPortal = PopoverPrimitive.Portal;

export const ZoruPopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 6, ...props }, ref) => (
  <ZoruPopoverPortal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "zoruui z-50 w-72 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4 text-zoru-ink shadow-[var(--zoru-shadow-md)]",
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
  </ZoruPopoverPortal>
));
ZoruPopoverContent.displayName = "ZoruPopoverContent";
