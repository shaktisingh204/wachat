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
      "peer h-4 w-4 shrink-0 rounded-[5px] border border-[var(--st-border-strong)] bg-[var(--st-bg)] shadow-[var(--st-shadow-sm)]",
      "transition-[border-color,box-shadow,background-color] hover:border-[var(--st-text)] hover:shadow-[var(--st-shadow-md)]",
      "data-[state=checked]:bg-[var(--st-accent)] data-[state=checked]:border-[var(--st-accent)] data-[state=checked]:text-[var(--st-text-inverted)]",
      "data-[state=indeterminate]:bg-[var(--st-accent)] data-[state=indeterminate]:border-[var(--st-accent)] data-[state=indeterminate]:text-[var(--st-text-inverted)]",
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
