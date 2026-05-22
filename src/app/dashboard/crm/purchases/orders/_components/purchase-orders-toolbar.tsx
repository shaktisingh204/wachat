'use client';

import { Button, Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  CalendarRange,
  Copy,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <PurchaseOrdersToolbar> — top toolbar above the PO list.
 *
 * Renders: search, saved-view preset selector, density toggle, view
 * switcher (table | calendar), Export CSV button, Find duplicates link,
 * New purchase order CTA. Mirrors `<InvoicesToolbar>`.
 */

import * as React from 'react';
import Link from 'next/link';

import type {
  PurchaseOrderDensity,
  PurchaseOrderPresetKey,
  PurchaseOrderViewMode,
} from './types';

export const PO_PRESETS: { key: PurchaseOrderPresetKey; label: string }[] = [
  { key: 'all', label: 'All purchase orders' },
  { key: 'all-open', label: 'All open' },
  { key: 'my-pending-approval', label: 'My pending approval' },
  { key: 'overdue-delivery', label: 'Overdue delivery' },
  { key: 'closed-30d', label: 'Closed last 30 days' },
  { key: 'drafts', label: 'Drafts' },
];

interface PurchaseOrdersToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: PurchaseOrderViewMode;
  onViewChange: (next: PurchaseOrderViewMode) => void;
  density: PurchaseOrderDensity;
  onDensityChange: (next: PurchaseOrderDensity) => void;
  preset: PurchaseOrderPresetKey;
  onPresetChange: (next: PurchaseOrderPresetKey) => void;
  onExportCsv: () => void;
}

export function PurchaseOrdersToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  preset,
  onPresetChange,
  onExportCsv,
}: PurchaseOrdersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search PO #, vendor name…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search purchase orders"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ZoruSelect
          value={preset}
          onValueChange={(v) => onPresetChange(v as PurchaseOrderPresetKey)}
        >
          <ZoruSelectTrigger className="h-9 w-[200px]">
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {PO_PRESETS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>

        <ZoruSelect
          value={density}
          onValueChange={(v) => onDensityChange(v as PurchaseOrderDensity)}
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

        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/purchases/orders/duplicates">
            <Copy className="h-3.5 w-3.5" /> Find duplicates
          </Link>
        </ZoruButton>

        <ZoruButton size="sm" asChild>
          <Link href="/dashboard/crm/purchases/orders/new">
            <Plus className="h-3.5 w-3.5" /> New purchase order
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
