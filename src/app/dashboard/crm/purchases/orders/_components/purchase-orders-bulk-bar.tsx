'use client';

import { ZoruButton, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/zoruui';
import {
  CheckCheck,
  Download,
  ListChecks,
  Mail,
  PackageCheck,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * <PurchaseOrdersBulkBar> — sticky bulk-action ribbon for the PO list.
 *
 * Mirrors `<InvoicesBulkBar>`: shows the selected count, exposes
 * Archive, Export CSV, Approve, Send, Change status, Convert to GRN,
 * Delete. The parent owns confirmation dialogs for destructive ops.
 */

import * as React from 'react';
import Link from 'next/link';

import type { CrmPurchaseOrderStatus } from '@/lib/rust-client/crm-purchase-orders';

const STATUS_OPTIONS: { value: CrmPurchaseOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface PurchaseOrdersBulkBarProps {
  count: number;
  selectedIds: string[];
  onClear: () => void;
  onExportCsv: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onSend: () => void;
  onChangeStatus: (next: CrmPurchaseOrderStatus | string) => void;
}

export function PurchaseOrdersBulkBar({
  count,
  selectedIds,
  onClear,
  onExportCsv,
  onArchive,
  onDelete,
  onApprove,
  onSend,
  onChangeStatus,
}: PurchaseOrdersBulkBarProps) {
  if (count === 0) return null;
  // The "Convert to GRN" bulk shortcut takes the first selected PO and
  // routes to the GRN new-form with the standard `fromKind/fromId` query
  // — the GRN flow handles multi-line PO pre-fill.
  const grnHref =
    selectedIds.length > 0
      ? `/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=${selectedIds[0]}`
      : '/dashboard/crm/inventory/grn/new';
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
        <ZoruButton size="sm" variant="outline" onClick={onApprove}>
          <CheckCheck className="h-3.5 w-3.5" /> Approve
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onSend}>
          <Mail className="h-3.5 w-3.5" /> Send
        </ZoruButton>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton size="sm" variant="outline">
              Change status
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent>
            {STATUS_OPTIONS.map((s) => (
              <ZoruDropdownMenuItem
                key={s.value}
                onSelect={() => onChangeStatus(s.value)}
              >
                {s.label}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
        <ZoruButton size="sm" variant="outline" asChild>
          <Link href={grnHref}>
            <PackageCheck className="h-3.5 w-3.5" /> Convert to GRN
          </Link>
        </ZoruButton>
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
