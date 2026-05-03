"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "./lib/cn";

export interface ZoruLabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean;
}

export const ZoruLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  ZoruLabelProps
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none text-zoru-ink",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    {required && <span className="ml-0.5 text-zoru-danger">*</span>}
  </LabelPrimitive.Root>
));
ZoruLabel.displayName = "ZoruLabel";
