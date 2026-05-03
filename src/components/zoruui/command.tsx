"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "./lib/cn";
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogTitle,
  type ZoruDialogContentProps,
} from "./dialog";

export const ZoruCommand = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-bg text-zoru-ink",
      className,
    )}
    {...props}
  />
));
ZoruCommand.displayName = "ZoruCommand";

export interface ZoruCommandDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  contentProps?: ZoruDialogContentProps;
}

export function ZoruCommandDialog({
  open,
  onOpenChange,
  title = "Command palette",
  children,
  contentProps,
}: ZoruCommandDialogProps) {
  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent
        {...contentProps}
        className={cn("overflow-hidden p-0 max-w-2xl", contentProps?.className)}
      >
        <ZoruDialogTitle className="sr-only">{title}</ZoruDialogTitle>
        <ZoruCommand className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-zoru-ink-subtle [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-zoru-line [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2">
          {children}
        </ZoruCommand>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export const ZoruCommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className="flex items-center border-b border-zoru-line px-3"
    cmdk-input-wrapper=""
  >
    <Search className="mr-2 h-4 w-4 shrink-0 text-zoru-ink-muted" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zoru-ink-subtle disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
ZoruCommandInput.displayName = "ZoruCommandInput";

export const ZoruCommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[320px] overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
));
ZoruCommandList.displayName = "ZoruCommandList";

export const ZoruCommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("py-6 text-center text-sm text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruCommandEmpty.displayName = "ZoruCommandEmpty";

export const ZoruCommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-zoru-ink",
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-zoru-ink-subtle",
      className,
    )}
    {...props}
  />
));
ZoruCommandGroup.displayName = "ZoruCommandGroup";

export const ZoruCommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-zoru-line", className)}
    {...props}
  />
));
ZoruCommandSeparator.displayName = "ZoruCommandSeparator";

export const ZoruCommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-sm outline-none text-zoru-ink",
      "data-[selected=true]:bg-zoru-surface-2",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));
ZoruCommandItem.displayName = "ZoruCommandItem";

export function ZoruCommandShortcut({
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
