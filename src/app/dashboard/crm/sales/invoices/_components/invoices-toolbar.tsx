'use client';

import { Button, Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/sabcrm/20ui/compat';
import {
  CalendarRange,
  Copy,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <InvoicesToolbar> — top toolbar above the invoice list.
 *
 * Renders: search, saved-view preset selector, density toggle, view
 * switcher (table | calendar), Export CSV button, Find duplicates link,
 * New invoice CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import type {
  InvoiceDensity,
  InvoicePresetKey,
  InvoiceViewMode,
} from './types';

export const INVOICE_PRESETS: { key: InvoicePresetKey; label: string }[] = [
  { key: 'all', label: 'All invoices' },
  { key: 'my-overdue', label: 'My overdue' },
  { key: 'due-this-week', label: 'Due this week' },
  { key: 'paid-30d', label: 'Paid last 30 days' },
  { key: 'draft', label: 'Drafts' },
];

interface InvoicesToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: InvoiceViewMode;
  onViewChange: (next: InvoiceViewMode) => void;
  density: InvoiceDensity;
  onDensityChange: (next: InvoiceDensity) => void;
  preset: InvoicePresetKey;
  onPresetChange: (next: InvoicePresetKey) => void;
  onExportCsv: () => void;
}

export function InvoicesToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  preset,
  onPresetChange,
  onExportCsv,
}: InvoicesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search invoice #, customer name or email…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search invoices"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={preset}
          onValueChange={(v) => onPresetChange(v as InvoicePresetKey)}
        >
          <ZoruSelectTrigger className="h-9 w-[180px]">
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {INVOICE_PRESETS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Select
          value={density}
          onValueChange={(v) => onDensityChange(v as InvoiceDensity)}
        >
          <ZoruSelectTrigger className="h-9 w-[140px]" aria-label="Row density">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="comfortable">Comfortable</ZoruSelectItem>
            <ZoruSelectItem value="compact">Compact</ZoruSelectItem>
            <ZoruSelectItem value="dense">Dense</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>

        <div className="flex items-center rounded border border-zoru-line bg-zoru-surface p-0.5">
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

        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/sales/invoices/duplicates">
            <Copy className="h-3.5 w-3.5" /> Find duplicates
          </Link>
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/crm/sales/invoices/new">
            <Plus className="h-3.5 w-3.5" /> New invoice
          </Link>
        </Button>
      </div>
    </div>
  );
}
