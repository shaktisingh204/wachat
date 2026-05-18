'use client';

import { ZoruButton, ZoruInput, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search bill #, vendor invoice # or vendor…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search bills"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ZoruSelect
          value={preset}
          onValueChange={(v) => onPresetChange(v as BillPresetKey)}
        >
          <ZoruSelectTrigger className="h-9 w-[180px]">
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {BILL_PRESETS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruSelect
          value={density}
          onValueChange={(v) => onDensityChange(v as BillDensity)}
        >
          <ZoruSelectTrigger className="h-9 w-[140px]" aria-label="Row density">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="comfortable">Comfortable</ZoruSelectItem>
            <ZoruSelectItem value="compact">Compact</ZoruSelectItem>
            <ZoruSelectItem value="dense">Dense</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        <div className="flex items-center rounded border border-zoru-line bg-zoru-surface p-0.5">
          <ZoruButton
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </ZoruButton>
          <ZoruButton
            type="button"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('calendar')}
            aria-pressed={view === 'calendar'}
            aria-label="Calendar view"
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>

        <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </ZoruButton>

        <ZoruButton size="sm" asChild>
          <Link href="/dashboard/crm/purchases/expenses/new">
            <Plus className="h-3.5 w-3.5" /> New bill
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
