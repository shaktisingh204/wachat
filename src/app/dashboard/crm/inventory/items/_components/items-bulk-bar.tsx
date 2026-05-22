'use client';

import { Button, DropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/zoruui';
import {
  Download,
  ListChecks,
  Pencil,
  RefreshCw,
  Trash2,
  Warehouse,
  X,
  } from 'lucide-react';

/**
 * <ItemsBulkBar> — sticky bulk-action ribbon for the items list.
 *
 * Mirrors `<InvoicesBulkBar>`: shows the selected count, exposes Archive,
 * Delete, Export CSV, Bulk-edit (category/brand/taxRate), Adjust stock,
 * Sync price. The parent owns confirmation dialogs for destructive ops.
 */

import * as React from 'react';

export type ItemsBulkEditField = 'category' | 'brand' | 'taxRate' | 'unit';

interface ItemsBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  /** Optional XLSX export. When omitted the XLSX button is hidden. */
  onExportXlsx?: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAdjustStock: () => void;
  onSyncPrice: () => void;
  onBulkEdit: (field: ItemsBulkEditField) => void;
}

const BULK_EDIT_OPTIONS: { value: ItemsBulkEditField; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'taxRate', label: 'Tax rate' },
  { value: 'unit', label: 'Unit' },
];

export function ItemsBulkBar({
  count,
  onClear,
  onExportCsv,
  onExportXlsx,
  onArchive,
  onDelete,
  onAdjustStock,
  onSyncPrice,
  onBulkEdit,
}: ItemsBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <ZoruButton size="sm" variant="outline" onClick={onArchive}>
          Archive
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </ZoruButton>
        {onExportXlsx ? (
          <ZoruButton size="sm" variant="outline" onClick={onExportXlsx}>
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </ZoruButton>
        ) : null}
        <ZoruButton size="sm" variant="outline" onClick={onAdjustStock}>
          <Warehouse className="h-3.5 w-3.5" /> Adjust stock
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onSyncPrice}>
          <RefreshCw className="h-3.5 w-3.5" /> Sync price
        </ZoruButton>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton size="sm" variant="outline">
              <Pencil className="h-3.5 w-3.5" /> Bulk edit
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent>
            {BULK_EDIT_OPTIONS.map((o) => (
              <ZoruDropdownMenuItem
                key={o.value}
                onSelect={() => onBulkEdit(o.value)}
              >
                {o.label}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
        <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ZoruButton>
        <ZoruButton
          size="sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </ZoruButton>
      </div>
    </div>
  );
}
