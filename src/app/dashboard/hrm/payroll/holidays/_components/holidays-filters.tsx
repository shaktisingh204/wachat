'use client';

import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  XCircle } from 'lucide-react';

/**
 * <HolidaysFiltersRow> — filter row for the canonical holidays list
 * (per §1D.1). 5 filters: type, year, recurring, location, date range.
 */

import * as React from 'react';

export type HolidayTypeFilter =
  | 'all'
  | 'national'
  | 'regional'
  | 'religious'
  | 'optional'
  | 'restricted';

export type RecurringFilter = 'all' | 'yes' | 'no';

interface HolidaysFiltersRowProps {
  typeFilter: HolidayTypeFilter;
  onTypeChange: (v: HolidayTypeFilter) => void;
  yearFilter: string;
  onYearChange: (v: string) => void;
  yearOptions: number[];
  recurringFilter: RecurringFilter;
  onRecurringChange: (v: RecurringFilter) => void;
  locationFilter: string;
  onLocationChange: (v: string) => void;
  fromDate: string;
  onFromDate: (v: string) => void;
  toDate: string;
  onToDate: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function HolidaysFiltersRow({
  typeFilter,
  onTypeChange,
  yearFilter,
  onYearChange,
  yearOptions,
  recurringFilter,
  onRecurringChange,
  locationFilter,
  onLocationChange,
  fromDate,
  onFromDate,
  toDate,
  onToDate,
  hasActiveFilters,
  onClear,
}: HolidaysFiltersRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <EnumFilterField
          enumName="holidayType"
          value={typeFilter}
          onChange={(v) => onTypeChange(v as HolidayTypeFilter)}
          placeholder="All types"
        />

        <Select value={yearFilter} onValueChange={onYearChange}>
          <ZoruSelectTrigger className="h-9 w-[120px]" aria-label="Year">
            <ZoruSelectValue placeholder="Year" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All years</ZoruSelectItem>
            {yearOptions.map((y) => (
              <ZoruSelectItem key={y} value={String(y)}>
                {y}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <EnumFilterField
          enumName="yesNo"
          value={recurringFilter}
          onChange={(v) => onRecurringChange(v as RecurringFilter)}
          allLabel="All recurrence"
          placeholder="All recurrence"
        />

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-auto"
          >
            <XCircle className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Location
          </Label>
          <Input
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Filter by location/state…"
            className="mt-1 h-9 text-[12.5px]"
          />
        </div>
        <div>
          <Label
            htmlFor="holiday-from"
            className="text-[11px] uppercase text-[var(--st-text-secondary)]"
          >
            From
          </Label>
          <Input
            id="holiday-from"
            type="date"
            value={fromDate}
            onChange={(e) => onFromDate(e.target.value)}
            className="mt-1 h-9 text-[12.5px]"
          />
        </div>
        <div>
          <Label
            htmlFor="holiday-to"
            className="text-[11px] uppercase text-[var(--st-text-secondary)]"
          >
            To
          </Label>
          <Input
            id="holiday-to"
            type="date"
            value={toDate}
            onChange={(e) => onToDate(e.target.value)}
            className="mt-1 h-9 text-[12.5px]"
          />
        </div>
      </div>
    </div>
  );
}
