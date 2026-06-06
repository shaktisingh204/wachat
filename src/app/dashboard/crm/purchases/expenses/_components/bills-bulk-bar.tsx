'use client';

import { Button, DropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import {
  Banknote,
  Download,
  ListChecks,
  Trash2,
  X } from 'lucide-react';

/**
 * <BillsBulkBar> — sticky bulk-action ribbon for the bill list (§1D).
 *
 * Mirrors `<InvoicesBulkBar>`: shows selected count, exposes Archive,
 * Export CSV, Mark paid, Change status, Delete.
 */

import * as React from 'react';

import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

const STATUS_OPTIONS: { value: CrmBillStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface BillsBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  /** Optional XLSX export — hidden when omitted. */
  onExportXlsx?: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
  onChangeStatus: (next: CrmBillStatus | string) => void;
}

export function BillsBulkBar({
  count,
  onClear,
  onExportCsv,
  onExportXlsx,
  onArchive,
  onDelete,
  onMarkPaid,
  onChangeStatus,
}: BillsBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
        {count} selected
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" onClick={onArchive}>
          Archive
        </Button>
        <Button size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        {onExportXlsx ? (
          <Button size="sm" variant="outline" onClick={onExportXlsx}>
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onMarkPaid}>
          <Banknote className="h-3.5 w-3.5" /> Mark paid
        </Button>
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Change status
            </Button>
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
        </DropdownMenu>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
