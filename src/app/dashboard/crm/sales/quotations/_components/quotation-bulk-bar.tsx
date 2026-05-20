'use client';

import { ZoruButton, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/zoruui';
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
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex items-center gap-1">
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
        <ZoruButton size="sm" variant="outline" onClick={onSend}>
          <Send className="h-3.5 w-3.5" /> Send
        </ZoruButton>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton size="sm" variant="outline">
              Change status
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent>
            {STATUS_OPTIONS.map((s) => (
              <ZoruDropdownMenuItem key={s} onSelect={() => onChangeStatus(s)}>
                {s}
              </ZoruDropdownMenuItem>
            ))}
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
        <ZoruButton size="sm" variant="outline" onClick={onConvertToInvoice}>
          Convert to invoice
        </ZoruButton>
        <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ZoruButton>
        <ZoruButton size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="h-3.5 w-3.5" />
        </ZoruButton>
      </div>
    </div>
  );
}
