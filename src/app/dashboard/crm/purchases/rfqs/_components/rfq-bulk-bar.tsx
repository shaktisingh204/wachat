'use client';

import { ZoruButton, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/zoruui';
import {
  Download,
  ListChecks,
  Lock,
  Trash2,
  X } from 'lucide-react';

/**
 * <RfqBulkBar> — sticky bulk-action ribbon for the RFQs list. Wires
 * real server actions for archive / delete / status-change / close.
 * The parent owns confirmation flows for destructive ops.
 */

import * as React from 'react';

import type { CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';

const STATUS_OPTIONS: CrmRfqStatus[] = [
  'draft',
  'open',
  'closed',
  'awarded',
  'cancelled',
];

interface RfqBulkBarProps {
  count: number;
  onExportCsv: () => void;
  onClear: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
  onChangeStatus: (status: CrmRfqStatus) => void;
}

export function RfqBulkBar({
  count,
  onExportCsv,
  onClear,
  onArchive,
  onDelete,
  onClose,
  onChangeStatus,
}: RfqBulkBarProps) {
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
        <ZoruButton size="sm" variant="outline" onClick={onClose}>
          <Lock className="h-3.5 w-3.5" /> Close
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
