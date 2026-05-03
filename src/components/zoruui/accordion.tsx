"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, Plus } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruAccordion = AccordionPrimitive.Root;

export const ZoruAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b border-zoru-line last:border-b-0", className)}
    {...props}
  />
));
ZoruAccordionItem.displayName = "ZoruAccordionItem";

export const ZoruAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium text-zoru-ink",
        "transition-all hover:text-zoru-ink-strong",
        "[&[data-state=open]>svg]:rotate-180",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-zoru-ink-muted transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
ZoruAccordionTrigger.displayName = "ZoruAccordionTrigger";

export const ZoruAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm text-zoru-ink-muted data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0 leading-relaxed", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
ZoruAccordionContent.displayName = "ZoruAccordionContent";

/**
 * ZoruAccordion03 — boxed variant. Each item is its own card with a
 * plus/minus toggle and rounded edges. Use for FAQ sections where
 * separation between items is more important than density.
 */
export const ZoruAccordion03 = AccordionPrimitive.Root;

export const ZoruAccordion03Item = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-5 transition-colors data-[state=open]:bg-zoru-surface",
      className,
    )}
    {...props}
  />
));
ZoruAccordion03Item.displayName = "ZoruAccordion03Item";

export const ZoruAccordion03Trigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-5 text-left text-base font-medium text-zoru-ink",
        "transition-colors hover:text-zoru-ink-strong",
        "[&[data-state=open]>svg]:rotate-45",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <Plus className="h-5 w-5 shrink-0 text-zoru-ink-muted transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
ZoruAccordion03Trigger.displayName = "ZoruAccordion03Trigger";

export const ZoruAccordion03Content = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm text-zoru-ink-muted data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-5 pt-0 leading-relaxed", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
ZoruAccordion03Content.displayName = "ZoruAccordion03Content";
