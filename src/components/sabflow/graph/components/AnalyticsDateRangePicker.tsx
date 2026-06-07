'use client';

import { useMemo } from 'react';
import { Button, Field, Input } from '@/components/sabcrm/20ui';
import type { AnalyticsDateRange } from '../providers/AnalyticsProvider';

type Props = {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
};

/* Helpers */

function toInputValue(d: Date): string {
  // yyyy-MM-dd in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromInputValue(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function rangeForDaysAgo(days: number): AnalyticsDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: startOfDay(start), end: endOfDay(end) };
}

function rangeForHoursAgo(hours: number): AnalyticsDateRange {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}

function rangeAllTime(): AnalyticsDateRange {
  // Analytics rows exist from ~2020 onwards; go a bit earlier to be safe.
  const start = new Date('2020-01-01T00:00:00.000Z');
  const end = endOfDay(new Date());
  return { start, end };
}

type Preset = {
  label: string;
  make: () => AnalyticsDateRange;
  /** Used to diff against current range for "active" styling. */
  matchDays?: number;
  matchHours?: number;
};

const PRESETS: Preset[] = [
  { label: 'Last 24h', make: () => rangeForHoursAgo(24), matchHours: 24 },
  { label: 'Last 7d', make: () => rangeForDaysAgo(7), matchDays: 7 },
  { label: 'Last 30d', make: () => rangeForDaysAgo(30), matchDays: 30 },
  { label: 'Last 90d', make: () => rangeForDaysAgo(90), matchDays: 90 },
  { label: 'All time', make: rangeAllTime },
];

function isApproxEqualRange(a: AnalyticsDateRange, b: AnalyticsDateRange): boolean {
  // Tolerate sub-second drift when matching against a preset.
  return (
    Math.abs(a.start.getTime() - b.start.getTime()) < 60_000 &&
    Math.abs(a.end.getTime() - b.end.getTime()) < 60_000
  );
}

/* Component */

export function AnalyticsDateRangePicker({ value, onChange }: Props) {
  const activePreset = useMemo(() => {
    for (const preset of PRESETS) {
      if (isApproxEqualRange(preset.make(), value)) return preset.label;
    }
    return null;
  }, [value]);

  const handleStartInput = (raw: string) => {
    const parsed = fromInputValue(raw);
    if (!parsed) return;
    const nextStart = startOfDay(parsed);
    // Ensure start is not after end.
    const nextEnd = parsed.getTime() > value.end.getTime() ? endOfDay(parsed) : value.end;
    onChange({ start: nextStart, end: nextEnd });
  };

  const handleEndInput = (raw: string) => {
    const parsed = fromInputValue(raw);
    if (!parsed) return;
    const nextEnd = endOfDay(parsed);
    const nextStart =
      parsed.getTime() < value.start.getTime() ? startOfDay(parsed) : value.start;
    onChange({ start: nextStart, end: nextEnd });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.label;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={isActive ? 'primary' : 'secondary'}
              aria-pressed={isActive}
              onClick={() => onChange(preset.make())}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-2">
        <Field label="Start" className="flex-1">
          <Input
            type="date"
            inputSize="sm"
            value={toInputValue(value.start)}
            onChange={(e) => handleStartInput(e.target.value)}
          />
        </Field>
        <Field label="End" className="flex-1">
          <Input
            type="date"
            inputSize="sm"
            value={toInputValue(value.end)}
            onChange={(e) => handleEndInput(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
