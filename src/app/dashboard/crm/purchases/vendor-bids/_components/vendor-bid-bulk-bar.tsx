'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
import {
  Download,
  ListChecks,
  Trash2,
  X } from 'lucide-react';

/**
 * <VendorBidBulkBar> — sticky bulk-action ribbon for the Vendor Bids
 * list. Wires real server actions for archive / delete / status-change.
 * The parent owns confirmation flows for destructive ops.
 */

import * as React from 'react';

import type { CrmVendorBidStatus } from '@/lib/rust-client/crm-vendor-bids';

const STATUS_OPTIONS: CrmVendorBidStatus[] = [
  'submitted',
  'shortlisted',
  'awarded',
  'rejected',
  'withdrawn',
];

interface VendorBidBulkBarProps {
  count: number;
  onExportCsv: () => void;
  onClear: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onChangeStatus: (status: CrmVendorBidStatus) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function VendorBidBulkBar({
  count,
  onExportCsv,
  onClear,
  onArchive,
  onDelete,
  onChangeStatus,
  onApprove,
  onReject,
}: VendorBidBulkBarProps) {
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
        <Button size="sm" variant="outline" onClick={onApprove} className="text-[var(--st-status-ok)]">
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} className="text-[var(--st-danger)]">
          Reject
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
