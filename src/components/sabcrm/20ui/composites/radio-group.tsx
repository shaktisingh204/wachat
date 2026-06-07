"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "./lib/cn";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid gap-2", className)}
    {...props}
  />
));
RadioGroup.displayName = "RadioGroup";

export const ZoruRadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-[var(--st-border-strong)] bg-[var(--st-bg)] text-[var(--st-accent)] shadow-[var(--st-shadow-sm)]",
      "transition-[border-color,box-shadow,background-color] hover:border-[var(--st-text)] hover:shadow-[var(--st-shadow-md)]",
      "data-[state=checked]:border-[var(--st-accent)]",
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
        "group relative flex items-start gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,transform,background-color]",
        "hover:-translate-y-0.5 hover:border-[var(--st-border-strong)] hover:shadow-[var(--st-shadow-md)]",
        "has-[[data-state=checked]]:border-[var(--st-text)] has-[[data-state=checked]]:bg-[var(--st-surface)] has-[[data-state=checked]]:shadow-[var(--st-shadow-md)]",
      )}
    >
      <RadioGroupPrimitive.Item
        ref={ref}
        id={itemId}
        className={cn(
          "mt-0.5 aspect-square h-4 w-4 shrink-0 rounded-full border border-[var(--st-border-strong)] bg-[var(--st-bg)] text-[var(--st-accent)]",
          "shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,background-color] hover:border-[var(--st-text)]",
          "data-[state=checked]:border-[var(--st-accent)]",
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
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          {icon}
          {label}
        </span>
        {description && (
          <span className="text-xs text-[var(--st-text-secondary)]">{description}</span>
        )}
      </label>
    </div>
  );
});
ZoruRadioCard.displayName = "ZoruRadioCard";
