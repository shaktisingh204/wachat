'use client';

/**
 * <SubscriptionBulkBar> — sticky bulk-action ribbon for the §1D
 * subscriptions list. Mirrors `<InvoicesBulkBar>`.
 *
 * Actions: Pause · Resume · Cancel · Export CSV · Delete.
 * Parent owns the confirmation dialogs for destructive ops.
 */

import * as React from 'react';
import { Download, ListChecks, PauseCircle, PlayCircle, Trash2, X, XCircle } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';

interface SubscriptionBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function SubscriptionBulkBar({
  count,
  onClear,
  onExportCsv,
  onPause,
  onResume,
  onCancel,
  onDelete,
}: SubscriptionBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <ZoruButton size="sm" variant="outline" onClick={onPause}>
          <PauseCircle className="h-3.5 w-3.5" /> Pause
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onResume}>
          <PlayCircle className="h-3.5 w-3.5" /> Resume
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onCancel}>
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
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
