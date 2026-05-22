"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "./lib/cn";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-[5px] border border-zoru-line-strong bg-zoru-bg shadow-[var(--zoru-shadow-sm)]",
      "transition-[border-color,box-shadow,background-color] hover:border-zoru-ink hover:shadow-[var(--zoru-shadow-md)]",
      "data-[state=checked]:bg-zoru-primary data-[state=checked]:border-zoru-primary data-[state=checked]:text-zoru-primary-foreground",
      "data-[state=indeterminate]:bg-zoru-primary data-[state=indeterminate]:border-zoru-primary data-[state=indeterminate]:text-zoru-primary-foreground",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      {props.checked === "indeterminate" ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
