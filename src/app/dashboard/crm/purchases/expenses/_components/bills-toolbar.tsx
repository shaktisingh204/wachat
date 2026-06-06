'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  CalendarRange,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <BillsToolbar> — top toolbar above the bills list (§1D).
 *
 * Renders: search, saved-view preset selector, density toggle, view
 * switcher (table | calendar), Export CSV button, New bill CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import type {
  BillDensity,
  BillPresetKey,
  BillViewMode,
} from './types';

export const BILL_PRESETS: { key: BillPresetKey; label: string }[] = [
  { key: 'all', label: 'All bills' },
  { key: 'my-overdue', label: 'My overdue' },
  { key: 'due-this-week', label: 'Due this week' },
  { key: 'paid-30d', label: 'Paid last 30 days' },
  { key: 'draft', label: 'Drafts' },
];

interface BillsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: BillViewMode;
  onViewChange: (next: BillViewMode) => void;
  density: BillDensity;
  onDensityChange: (next: BillDensity) => void;
  preset: BillPresetKey;
  onPresetChange: (next: BillPresetKey) => void;
  onExportCsv: () => void;
}

export function BillsToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  preset,
  onPresetChange,
  onExportCsv,
}: BillsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search bill #, vendor invoice # or vendor…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search bills"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={preset}
          onValueChange={(v) => onPresetChange(v as BillPresetKey)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {BILL_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={density}
          onValueChange={(v) => onDensityChange(v as BillDensity)}
        >
          <SelectTrigger className="h-9 w-[140px]" aria-label="Row density">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="dense">Dense</SelectItem>
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
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('calendar')}
            aria-pressed={view === 'calendar'}
            aria-label="Calendar view"
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/crm/purchases/expenses/new">
            <Plus className="h-3.5 w-3.5" /> New bill
          </Link>
        </Button>
      </div>
    </div>
  );
}
