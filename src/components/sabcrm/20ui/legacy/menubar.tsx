"use client";

import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruMenubarMenu = MenubarPrimitive.Menu;
export const ZoruMenubarGroup = MenubarPrimitive.Group;
export const ZoruMenubarPortal = MenubarPrimitive.Portal;
export const ZoruMenubarSub = MenubarPrimitive.Sub;
export const ZoruMenubarRadioGroup = MenubarPrimitive.RadioGroup;

export const ZoruMenubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-9 items-center gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 shadow-[var(--zoru-shadow-sm)]",
      className,
    )}
    {...props}
  />
));
ZoruMenubar.displayName = "ZoruMenubar";

const itemBase =
  "relative flex cursor-default select-none items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-sm outline-none text-zoru-ink transition-colors focus:bg-zoru-surface-2 data-[highlighted]:bg-zoru-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const ZoruMenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-[var(--zoru-radius-sm)] px-3 py-1 text-sm font-medium text-zoru-ink outline-none",
      "focus:bg-zoru-surface-2 data-[state=open]:bg-zoru-surface-2",
      className,
    )}
    {...props}
  />
));
ZoruMenubarTrigger.displayName = "ZoruMenubarTrigger";

export const ZoruMenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(itemBase, inset && "pl-8", "data-[state=open]:bg-zoru-surface-2", className)}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4 text-zoru-ink-muted" />
  </MenubarPrimitive.SubTrigger>
));
ZoruMenubarSubTrigger.displayName = "ZoruMenubarSubTrigger";

export const ZoruMenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "zoruui z-50 min-w-[8rem] overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 text-zoru-ink shadow-[var(--zoru-shadow-md)]",
      className,
    )}
    {...props}
  />
));
ZoruMenubarSubContent.displayName = "ZoruMenubarSubContent";

export const ZoruMenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  <ZoruMenubarPortal>
    <MenubarPrimitive.Content
      ref={ref}
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "zoruui z-50 min-w-[12rem] overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 text-zoru-ink shadow-[var(--zoru-shadow-md)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </ZoruMenubarPortal>
));
ZoruMenubarContent.displayName = "ZoruMenubarContent";

export const ZoruMenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(itemBase, inset && "pl-8", className)}
    {...props}
  />
));
ZoruMenubarItem.displayName = "ZoruMenubarItem";

export const ZoruMenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(itemBase, "pl-8", className)}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
));
ZoruMenubarCheckboxItem.displayName = "ZoruMenubarCheckboxItem";

export const ZoruMenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(itemBase, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
));
ZoruMenubarRadioItem.displayName = "ZoruMenubarRadioItem";

export const ZoruMenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
ZoruMenubarLabel.displayName = "ZoruMenubarLabel";

export const ZoruMenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-zoru-line", className)}
    {...props}
  />
));
ZoruMenubarSeparator.displayName = "ZoruMenubarSeparator";

export function ZoruMenubarShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-[11px] tracking-widest text-zoru-ink-subtle", className)}
      {...props}
    />
  );
}
