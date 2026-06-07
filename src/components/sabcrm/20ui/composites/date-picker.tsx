"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "./lib/cn";
import { Button } from "./button";
import { Calendar } from "./calendar";
import {
  Popover,
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

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  displayFormat = "PP",
  align = "start",
}: ZoruDatePickerProps) {
  return (
    <Popover>
      <ZoruPopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-[var(--st-text-tertiary)]",
            className,
          )}
        >
          <CalendarIcon />
          {value ? format(value, displayFormat) : placeholder}
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
        />
      </ZoruPopoverContent>
    </Popover>
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
    <Popover>
      <ZoruPopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value?.from && "text-[var(--st-text-tertiary)]",
            className,
          )}
        >
          <CalendarIcon />
          {label}
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={numberOfMonths}
          autoFocus
        />
      </ZoruPopoverContent>
    </Popover>
  );
}
