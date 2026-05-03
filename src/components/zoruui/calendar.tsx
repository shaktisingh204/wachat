"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./lib/cn";

export type ZoruCalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * ZoruCalendar — react-day-picker v9 themed in zoru tokens.
 * Pass `mode="single"` (default), `mode="range"`, or `mode="multiple"`
 * via the underlying API.
 */
export function ZoruCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ZoruCalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-zoru-ink", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-y-4 sm:gap-x-4 sm:gap-y-0",
        month: "flex flex-col gap-3",
        month_caption: "relative flex h-8 items-center justify-center pt-0.5",
        caption_label: "text-sm font-medium text-zoru-ink",
        nav: "absolute inset-x-1 top-0 z-10 flex h-8 items-center justify-between",
        button_previous: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2 transition-colors",
        ),
        button_next: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2 transition-colors",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "text-zoru-ink-subtle rounded-md w-9 h-9 font-normal text-[11px] flex items-center justify-center uppercase tracking-wide",
        week: "flex w-full mt-1",
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-zoru-surface-2 first:[&:has([aria-selected])]:rounded-l-[var(--zoru-radius-sm)] last:[&:has([aria-selected])]:rounded-r-[var(--zoru-radius-sm)]",
        day_button: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] p-0 text-sm font-normal text-zoru-ink",
          "hover:bg-zoru-surface-2 transition-colors",
          "aria-selected:opacity-100",
        ),
        range_end: "day-range-end",
        selected:
          "[&>button]:bg-zoru-primary [&>button]:text-zoru-primary-foreground [&>button:hover]:bg-zoru-primary [&>button:hover]:text-zoru-primary-foreground [&>button:focus]:bg-zoru-primary [&>button:focus]:text-zoru-primary-foreground",
        today: "[&>button]:border [&>button]:border-zoru-line-strong",
        outside:
          "day-outside text-zoru-ink-subtle aria-selected:bg-zoru-surface aria-selected:text-zoru-ink-muted",
        disabled: "text-zoru-ink-subtle opacity-50",
        range_middle:
          "aria-selected:bg-zoru-surface-2 aria-selected:text-zoru-ink",
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
ZoruCalendar.displayName = "ZoruCalendar";
