"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./lib/cn";

export type ZoruCalendarLumeProps = React.ComponentProps<typeof DayPicker>;

/**
 * ZoruCalendarLume — minimal-frame calendar variant. No card surface,
 * no caption background, larger day cells. For use inline beside form
 * fields where the calendar should feel like part of the form.
 */
export function ZoruCalendarLume({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ZoruCalendarLumeProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("text-[var(--st-text)]", className)}
      classNames={{
        months: "flex flex-col gap-y-2",
        month: "flex flex-col gap-2",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-[13px] font-semibold tracking-tight text-[var(--st-text)]",
        nav: "absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "text-[var(--st-text-tertiary)] w-10 h-8 font-normal text-[10px] flex items-center justify-center uppercase tracking-[0.15em]",
        week: "flex w-full",
        day: "relative h-10 w-10 p-0 text-center text-sm",
        day_button: cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full p-0 text-sm font-medium text-[var(--st-text)]",
          "hover:bg-[var(--st-bg-muted)] transition-colors",
        ),
        selected:
          "[&>button]:bg-[var(--st-accent)] [&>button]:text-[var(--st-text-inverted)]",
        today: "[&>button]:font-semibold [&>button]:text-[var(--st-text)]",
        outside: "day-outside text-[var(--st-text-tertiary)]",
        disabled: "text-[var(--st-text-tertiary)] opacity-40",
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
ZoruCalendarLume.displayName = "ZoruCalendarLume";
