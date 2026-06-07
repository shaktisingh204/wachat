"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "./lib/cn";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const ZoruDropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const ZoruDropdownMenuGroup = DropdownMenuPrimitive.Group;
export const ZoruDropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const ZoruDropdownMenuSub = DropdownMenuPrimitive.Sub;
export const ZoruDropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const itemBase =
  "relative flex cursor-default select-none items-center gap-2 rounded-[var(--st-radius-sm)] px-2.5 py-2 text-sm outline-none text-[var(--st-text)] transition-colors focus:bg-[var(--st-bg-muted)] data-[highlighted]:bg-[var(--st-bg-muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export const ZoruDropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(itemBase, inset && "pl-8", "data-[state=open]:bg-[var(--st-bg-muted)]", className)}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4 text-[var(--st-text-secondary)]" />
  </DropdownMenuPrimitive.SubTrigger>
));
ZoruDropdownMenuSubTrigger.displayName = "ZoruDropdownMenuSubTrigger";

export const ZoruDropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "zoruui-surface-sheen z-50 min-w-[8rem] overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1.5 text-[var(--st-text)] shadow-[var(--st-shadow-lg)]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      className,
    )}
    {...props}
  />
));
ZoruDropdownMenuSubContent.displayName = "ZoruDropdownMenuSubContent";

export const ZoruDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <ZoruDropdownMenuPortal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "zoruui-surface-sheen z-50 min-w-[8rem] overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1.5 text-[var(--st-text)] shadow-[var(--st-shadow-lg)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
        className,
      )}
      {...props}
    />
  </ZoruDropdownMenuPortal>
));
ZoruDropdownMenuContent.displayName = "ZoruDropdownMenuContent";

export const ZoruDropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    destructive?: boolean;
  }
>(({ className, inset, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      itemBase,
      inset && "pl-8",
      destructive && "text-[var(--st-danger)] focus:bg-[var(--st-danger)]/10 focus:text-[var(--st-danger)]",
      className,
    )}
    {...props}
  />
));
ZoruDropdownMenuItem.displayName = "ZoruDropdownMenuItem";

export const ZoruDropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(itemBase, "pl-8", className)}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
ZoruDropdownMenuCheckboxItem.displayName = "ZoruDropdownMenuCheckboxItem";

export const ZoruDropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(itemBase, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
ZoruDropdownMenuRadioItem.displayName = "ZoruDropdownMenuRadioItem";

export const ZoruDropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
ZoruDropdownMenuLabel.displayName = "ZoruDropdownMenuLabel";

export const ZoruDropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--st-border)]", className)}
    {...props}
  />
));
ZoruDropdownMenuSeparator.displayName = "ZoruDropdownMenuSeparator";

export function ZoruDropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-[11px] tracking-widest text-[var(--st-text-tertiary)]",
        className,
      )}
      {...props}
    />
  );
}

// Backward compatibility transitional aliases
export const DropdownMenuTrigger = ZoruDropdownMenuTrigger;
export const DropdownMenuGroup = ZoruDropdownMenuGroup;
export const DropdownMenuPortal = ZoruDropdownMenuPortal;
export const DropdownMenuSub = ZoruDropdownMenuSub;
export const DropdownMenuRadioGroup = ZoruDropdownMenuRadioGroup;
export const DropdownMenuSubTrigger = ZoruDropdownMenuSubTrigger;
export const DropdownMenuSubContent = ZoruDropdownMenuSubContent;
export const DropdownMenuContent = ZoruDropdownMenuContent;
export const DropdownMenuItem = ZoruDropdownMenuItem;
export const DropdownMenuCheckboxItem = ZoruDropdownMenuCheckboxItem;
export const DropdownMenuRadioItem = ZoruDropdownMenuRadioItem;
export const DropdownMenuLabel = ZoruDropdownMenuLabel;
export const DropdownMenuSeparator = ZoruDropdownMenuSeparator;
export const DropdownMenuShortcut = ZoruDropdownMenuShortcut;

