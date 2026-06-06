'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
import {
  Banknote,
  Download,
  ListChecks,
  Mail,
  Trash2,
  X } from 'lucide-react';

/**
 * <InvoicesBulkBar> — sticky bulk-action ribbon for the invoice list.
 *
 * Mirrors `<DealBulkBar>`: shows the selected count, exposes Archive,
 * Export CSV, Mark paid, Change status, Send, Delete. The parent owns
 * confirmation dialogs for destructive ops.
 */

import * as React from 'react';

import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

const STATUS_OPTIONS: { value: CrmInvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoicesBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
  onSend: () => void;
  onChangeStatus: (next: CrmInvoiceStatus | string) => void;
}

export function InvoicesBulkBar({
  count,
  onClear,
  onExportCsv,
  onArchive,
  onDelete,
  onMarkPaid,
  onSend,
  onChangeStatus,
}: InvoicesBulkBarProps) {
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
        <Button size="sm" variant="outline" onClick={onMarkPaid}>
          <Banknote className="h-3.5 w-3.5" /> Mark paid
        </Button>
        <Button size="sm" variant="outline" onClick={onSend}>
          <Mail className="h-3.5 w-3.5" /> Send
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Change status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onSelect={() => onChangeStatus(s.value)}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
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
