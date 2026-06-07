"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "./lib/cn";

export const Select = SelectPrimitive.Root;
export const ZoruSelectGroup = SelectPrimitive.Group;
export const ZoruSelectValue = SelectPrimitive.Value;

export const ZoruSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm",
      "text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)]",
      "shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,background-color] hover:border-[var(--st-border-strong)]",
      "data-[state=open]:border-[var(--st-text)] data-[state=open]:shadow-[var(--st-shadow-md)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus-visible:outline-none [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" data-stop />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
ZoruSelectTrigger.displayName = "ZoruSelectTrigger";

const ZoruSelectScrollUp = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-[var(--st-text-secondary)]", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" data-stop />
  </SelectPrimitive.ScrollUpButton>
));
ZoruSelectScrollUp.displayName = "ZoruSelectScrollUpButton";

const ZoruSelectScrollDown = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-[var(--st-text-secondary)]", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" data-stop />
  </SelectPrimitive.ScrollDownButton>
));
ZoruSelectScrollDown.displayName = "ZoruSelectScrollDownButton";

export const ZoruSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-hidden",
        "zoruui-surface-sheen rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--st-shadow-lg)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1 w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...props}
    >
      <ZoruSelectScrollUp />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <ZoruSelectScrollDown />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
ZoruSelectContent.displayName = "ZoruSelectContent";

export const ZoruSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-[var(--st-text-secondary)] uppercase tracking-wide", className)}
    {...props}
  />
));
ZoruSelectLabel.displayName = "ZoruSelectLabel";

export const ZoruSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center gap-2 rounded-[var(--st-radius-sm)] py-2 pl-2.5 pr-8 text-sm outline-none",
      "text-[var(--st-text)]",
      "focus:bg-[var(--st-bg-muted)] data-[highlighted]:bg-[var(--st-bg-muted)] data-[state=checked]:bg-[var(--st-surface)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" data-stop />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
ZoruSelectItem.displayName = "ZoruSelectItem";

export const ZoruSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--st-border)]", className)}
    {...props}
  />
));
ZoruSelectSeparator.displayName = "ZoruSelectSeparator";

// Backward compatibility transitional aliases
export const SelectGroup = ZoruSelectGroup;
export const SelectValue = ZoruSelectValue;
export const SelectTrigger = ZoruSelectTrigger;
export const SelectContent = ZoruSelectContent;
export const SelectLabel = ZoruSelectLabel;
export const SelectItem = ZoruSelectItem;
export const SelectSeparator = ZoruSelectSeparator;

