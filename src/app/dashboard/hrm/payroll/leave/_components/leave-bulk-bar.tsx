'use client';

import { Button } from '@/components/zoruui';
import { Check, Download, X } from 'lucide-react';

/**
 * <LeaveBulkBar> — sticky bulk-action bar for the leave list (per §1D.1).
 *
 * Actions: approve · reject · export CSV.
 */

import * as React from 'react';

interface LeaveBulkBarProps {
  count: number;
  onClear: () => void;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => void;
}

export function LeaveBulkBar({
  count,
  onClear,
  onApprove,
  onReject,
  onExport,
}: LeaveBulkBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-zoru-ink">
        <span className="font-medium tabular-nums">{count}</span>
        {count === 1 ? ' request' : ' requests'} selected
      </span>
      <span className="mx-1 h-4 w-px bg-zoru-line" aria-hidden />
      <ZoruButton size="sm" variant="outline" onClick={onApprove}>
        <Check className="h-3.5 w-3.5 text-emerald-600" /> Approve
      </ZoruButton>
      <ZoruButton size="sm" variant="outline" onClick={onReject}>
        <X className="h-3.5 w-3.5 text-rose-500" /> Reject
      </ZoruButton>
      <ZoruButton size="sm" variant="outline" onClick={onExport}>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </ZoruButton>
      <ZoruButton
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="ml-auto"
      >
        Clear selection
      </ZoruButton>
    </div>
  );
}
