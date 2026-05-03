"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";
import { ZoruCalendar } from "./calendar";
import {
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
} from "./popover";

export interface ZoruDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Format string passed to date-fns. Defaults to "PP" (e.g. "May 3, 2026"). */
  displayFormat?: string;
  align?: "start" | "center" | "end";
}

export function ZoruDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  displayFormat = "PP",
  align = "start",
}: ZoruDatePickerProps) {
  return (
    <ZoruPopover>
      <ZoruPopoverTrigger asChild>
        <ZoruButton
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-zoru-ink-subtle",
            className,
          )}
        >
          <CalendarIcon />
          {value ? format(value, displayFormat) : placeholder}
        </ZoruButton>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-auto p-0">
        <ZoruCalendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
        />
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}

export interface ZoruDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayFormat?: string;
  align?: "start" | "center" | "end";
  numberOfMonths?: number;
}

export function ZoruDateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled,
  className,
  displayFormat = "PP",
  align = "start",
  numberOfMonths = 2,
}: ZoruDateRangePickerProps) {
  const label = React.useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, displayFormat);
    return `${format(value.from, displayFormat)} – ${format(value.to, displayFormat)}`;
  }, [value, placeholder, displayFormat]);

  return (
    <ZoruPopover>
      <ZoruPopoverTrigger asChild>
        <ZoruButton
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value?.from && "text-zoru-ink-subtle",
            className,
          )}
        >
          <CalendarIcon />
          {label}
        </ZoruButton>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-auto p-0">
        <ZoruCalendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={numberOfMonths}
          autoFocus
        />
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}
