'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import {
  CalendarDays,
  CalendarRange,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <AttendanceToolbar> — top toolbar above the attendance list.
 *
 * Renders: search, saved-view preset selector, view switcher (table |
 * by-employee calendar | by-date calendar), Export CSV button, +New
 * record CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import type { AttendancePresetKey, AttendanceViewMode } from './types';

export const ATTENDANCE_PRESETS: { key: AttendancePresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This week' },
  { key: 'last-30-days', label: 'Last 30 days' },
  { key: 'late-only', label: 'Late only' },
  { key: 'leave-only', label: 'Leave only' },
];

interface AttendanceToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: AttendanceViewMode;
  onViewChange: (next: AttendanceViewMode) => void;
  preset: AttendancePresetKey | null;
  onPresetChange: (next: AttendancePresetKey) => void;
  onExportCsv: () => void;
}

export function AttendanceToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  preset,
  onPresetChange,
  onExportCsv,
}: AttendanceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search employee, notes…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search attendance"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={preset ?? 'today'}
          onValueChange={(v) => onPresetChange(v as AttendancePresetKey)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5">
          <Button
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'by-employee' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('by-employee')}
            aria-pressed={view === 'by-employee'}
            aria-label="Calendar by employee"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'by-date' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('by-date')}
            aria-pressed={view === 'by-date'}
            aria-label="Calendar by date"
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/hrm/payroll/attendance/new">
            <Plus className="h-3.5 w-3.5" /> New record
          </Link>
        </Button>
      </div>
    </div>
  );
}
