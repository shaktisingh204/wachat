"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./lib/cn";

export type ZoruCalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar — react-day-picker v9 themed in zoru tokens.
 * Pass `mode="single"` (default), `mode="range"`, or `mode="multiple"`
 * via the underlying API.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ZoruCalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-[var(--st-text)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-y-4 sm:gap-x-4 sm:gap-y-0",
        month: "flex flex-col gap-3",
        month_caption: "relative flex h-8 items-center justify-center pt-0.5",
        caption_label: "text-sm font-medium text-[var(--st-text)]",
        nav: "absolute inset-x-1 top-0 z-10 flex h-8 items-center justify-between",
        button_previous: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors",
        ),
        button_next: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "text-[var(--st-text-tertiary)] rounded-md w-9 h-9 font-normal text-[11px] flex items-center justify-center uppercase tracking-wide",
        week: "flex w-full mt-1",
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[var(--st-bg-muted)] first:[&:has([aria-selected])]:rounded-l-[var(--st-radius-sm)] last:[&:has([aria-selected])]:rounded-r-[var(--st-radius-sm)]",
        day_button: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] p-0 text-sm font-normal text-[var(--st-text)]",
          "hover:bg-[var(--st-bg-muted)] transition-colors",
          "aria-selected:opacity-100",
        ),
        range_end: "day-range-end",
        selected:
          "[&>button]:bg-[var(--st-accent)] [&>button]:text-[var(--st-text-inverted)] [&>button:hover]:bg-[var(--st-accent)] [&>button:hover]:text-[var(--st-text-inverted)] [&>button:focus]:bg-[var(--st-accent)] [&>button:focus]:text-[var(--st-text-inverted)]",
        today: "[&>button]:border [&>button]:border-[var(--st-border-strong)]",
        outside:
          "day-outside text-[var(--st-text-tertiary)] aria-selected:bg-[var(--st-surface)] aria-selected:text-[var(--st-text-secondary)]",
        disabled: "text-[var(--st-text-tertiary)] opacity-50",
        range_middle:
          "aria-selected:bg-[var(--st-bg-muted)] aria-selected:text-[var(--st-text)]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass, ...rest }: any) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClass)} {...rest} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClass)} {...rest} />
          ),
      } as any}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";
