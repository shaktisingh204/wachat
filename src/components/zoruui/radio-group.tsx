"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid gap-2", className)}
    {...props}
  />
));
ZoruRadioGroup.displayName = "ZoruRadioGroup";

export const ZoruRadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-zoru-line-strong bg-zoru-bg text-zoru-primary",
      "transition-colors hover:border-zoru-ink",
      "data-[state=checked]:border-zoru-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2 w-2 fill-current text-current" data-stop />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
ZoruRadioGroupItem.displayName = "ZoruRadioGroupItem";

/**
 * ZoruRadioCard — pill-card variant. A clickable bordered tile that
 * acts as a radio option; the option text is the visible affordance,
 * with the small dot for state. Replaces the heavyweight 3D variant
 * in componts.txt with something that fits the neutral aesthetic.
 */
export interface ZoruRadioCardProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

export const ZoruRadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  ZoruRadioCardProps
>(({ className, label, description, icon, id, ...props }, ref) => {
  const generatedId = React.useId();
  const itemId = id ?? generatedId;
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4 transition-colors",
        "hover:border-zoru-line-strong",
        "has-[[data-state=checked]]:border-zoru-ink has-[[data-state=checked]]:bg-zoru-surface",
      )}
    >
      <RadioGroupPrimitive.Item
        ref={ref}
        id={itemId}
        className={cn(
          "mt-0.5 aspect-square h-4 w-4 shrink-0 rounded-full border border-zoru-line-strong bg-zoru-bg text-zoru-primary",
          "transition-colors hover:border-zoru-ink",
          "data-[state=checked]:border-zoru-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-2 w-2 fill-current text-current" data-stop />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      <label
        htmlFor={itemId}
        className="flex flex-1 cursor-pointer flex-col gap-0.5"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zoru-ink">
          {icon}
          {label}
        </span>
        {description && (
          <span className="text-xs text-zoru-ink-muted">{description}</span>
        )}
      </label>
    </div>
  );
});
ZoruRadioCard.displayName = "ZoruRadioCard";
