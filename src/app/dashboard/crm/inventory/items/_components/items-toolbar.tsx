'use client';

import { Button, Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/sabcrm/20ui/compat';
import {
  Copy,
  Download,
  LayoutGrid,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <ItemsToolbar> — top toolbar above the items list.
 *
 * Renders: search, saved-view preset selector, density toggle, view
 * switcher (table | grid), Export CSV button, Find duplicates link,
 * New item CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import type { ItemDensity, ItemPresetKey, ItemViewMode } from './types';

export const ITEM_PRESETS: { key: ItemPresetKey; label: string }[] = [
  { key: 'all', label: 'All items' },
  { key: 'active', label: 'Active' },
  { key: 'low-stock', label: 'Low stock' },
  { key: 'out-of-stock', label: 'Out of stock' },
  { key: 'archived', label: 'Archived' },
];

interface ItemsToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: ItemViewMode;
  onViewChange: (next: ItemViewMode) => void;
  density: ItemDensity;
  onDensityChange: (next: ItemDensity) => void;
  preset: ItemPresetKey;
  onPresetChange: (next: ItemPresetKey) => void;
  onExportCsv: () => void;
}

export function ItemsToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  preset,
  onPresetChange,
  onExportCsv,
}: ItemsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, SKU, barcode, HSN…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search items"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={preset}
          onValueChange={(v) => onPresetChange(v as ItemPresetKey)}
        >
          <ZoruSelectTrigger className="h-9 w-[180px]">
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {ITEM_PRESETS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Select
          value={density}
          onValueChange={(v) => onDensityChange(v as ItemDensity)}
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
            variant={view === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('grid')}
            aria-pressed={view === 'grid'}
            aria-label="Card grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/inventory/items/duplicates">
            <Copy className="h-3.5 w-3.5" /> Find duplicates
          </Link>
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/crm/inventory/items/new">
            <Plus className="h-3.5 w-3.5" /> New item
          </Link>
        </Button>
      </div>
    </div>
  );
}
