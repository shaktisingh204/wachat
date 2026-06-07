"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, Plus } from "lucide-react";

import { cn } from "./lib/cn";

export const Accordion = AccordionPrimitive.Root;

export const SabAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b border-[var(--st-border)] last:border-b-0", className)}
    {...props}
  />
));
SabAccordionItem.displayName = "SabAccordionItem";

export const SabAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium text-[var(--st-text)]",
        "transition-all hover:text-[var(--st-text)]",
        "[&[data-state=open]>svg]:rotate-180",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)] transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
SabAccordionTrigger.displayName = "SabAccordionTrigger";

export const SabAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm text-[var(--st-text-secondary)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0 leading-relaxed", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
SabAccordionContent.displayName = "SabAccordionContent";

/**
 * SabAccordion03 — boxed variant. Each item is its own card with a
 * plus/minus toggle and rounded edges. Use for FAQ sections where
 * separation between items is more important than density.
 */
export const SabAccordion03 = AccordionPrimitive.Root;

export const SabAccordion03Item = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-5 transition-colors data-[state=open]:bg-[var(--st-surface)]",
      className,
    )}
    {...props}
  />
));
SabAccordion03Item.displayName = "SabAccordion03Item";

export const SabAccordion03Trigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-5 text-left text-base font-medium text-[var(--st-text)]",
        "transition-colors hover:text-[var(--st-text)]",
        "[&[data-state=open]>svg]:rotate-45",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <Plus className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)] transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
SabAccordion03Trigger.displayName = "SabAccordion03Trigger";

export const SabAccordion03Content = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm text-[var(--st-text-secondary)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-5 pt-0 leading-relaxed", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
SabAccordion03Content.displayName = "SabAccordion03Content";
