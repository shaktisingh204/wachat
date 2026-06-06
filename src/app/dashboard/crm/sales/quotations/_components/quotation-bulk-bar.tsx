'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
import {
  Download,
  ListChecks,
  Send,
  Trash2,
  X } from 'lucide-react';

/**
 * <QuotationBulkBar> — sticky bulk-action ribbon for the quotations
 * list. Wires real server actions for archive / delete / status-change
 * / send. The parent owns confirmation flows for destructive ops.
 */

import * as React from 'react';

import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

const STATUS_OPTIONS: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

interface QuotationBulkBarProps {
  count: number;
  onExportCsv: () => void;
  onExportXlsx?: () => void;
  onClear: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSend: () => void;
  onConvertToInvoice: () => void;
  onChangeStatus: (status: CrmQuotationStatus) => void;
}

export function QuotationBulkBar({
  count,
  onExportCsv,
  onExportXlsx,
  onClear,
  onArchive,
  onDelete,
  onSend,
  onConvertToInvoice,
  onChangeStatus,
}: QuotationBulkBarProps) {
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
        {count} selected
      </div>
      <div className="flex items-center gap-1">
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
        <Button size="sm" variant="outline" onClick={onSend}>
          <Send className="h-3.5 w-3.5" /> Send
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Change status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onChangeStatus(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={onConvertToInvoice}>
          Convert to invoice
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
