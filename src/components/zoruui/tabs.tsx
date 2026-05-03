"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./lib/cn";

/**
 * In-page tabs primitive. NOT URL-synced — the multi-tab dashboard
 * shell from `src/components/tabs/` is intentionally excluded from
 * the zoruui shell per the project plan.
 */
export const ZoruTabs = TabsPrimitive.Root;

export const ZoruTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center gap-1 rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-1 text-zoru-ink-muted",
      className,
    )}
    {...props}
  />
));
ZoruTabsList.displayName = "ZoruTabsList";

export const ZoruTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--zoru-radius-sm)] px-3 py-1 text-sm font-medium transition-all",
      "text-zoru-ink-muted hover:text-zoru-ink",
      "data-[state=active]:bg-zoru-bg data-[state=active]:text-zoru-ink data-[state=active]:shadow-[var(--zoru-shadow-sm)]",
      "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ZoruTabsTrigger.displayName = "ZoruTabsTrigger";

export const ZoruTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
ZoruTabsContent.displayName = "ZoruTabsContent";

/**
 * Underline variant — flat horizontal tabs with an active border.
 * Use for in-page section navigation where pill style is too heavy.
 */
export const ZoruTabsListUnderline = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 w-full items-center gap-6 border-b border-zoru-line text-zoru-ink-muted",
      className,
    )}
    {...props}
  />
));
ZoruTabsListUnderline.displayName = "ZoruTabsListUnderline";

export const ZoruTabsTriggerUnderline = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex h-10 items-center gap-2 px-0 pb-2 text-sm font-medium",
      "text-zoru-ink-muted hover:text-zoru-ink",
      "data-[state=active]:text-zoru-ink",
      "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:scale-x-0 after:bg-zoru-ink after:transition-transform",
      "data-[state=active]:after:scale-x-100",
      "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ZoruTabsTriggerUnderline.displayName = "ZoruTabsTriggerUnderline";
