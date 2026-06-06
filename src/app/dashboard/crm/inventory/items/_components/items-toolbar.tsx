'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
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
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {ITEM_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={density}
          onValueChange={(v) => onDensityChange(v as ItemDensity)}
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
