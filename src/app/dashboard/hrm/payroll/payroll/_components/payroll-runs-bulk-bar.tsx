'use client';

import { Button } from '@/components/zoruui';
import { Banknote, Check, Download } from 'lucide-react';

/**
 * <PayrollRunsBulkBar> — sticky bulk-action bar for the payroll-runs
 * list (per §1D.1). Actions: approve · disburse · export CSV.
 */

import * as React from 'react';

interface PayrollRunsBulkBarProps {
  count: number;
  onClear: () => void;
  onApprove: () => void;
  onDisburse: () => void;
  onExport: () => void;
}

export function PayrollRunsBulkBar({
  count,
  onClear,
  onApprove,
  onDisburse,
  onExport,
}: PayrollRunsBulkBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-zoru-ink">
        <span className="font-medium tabular-nums">{count}</span>
        {count === 1 ? ' run' : ' runs'} selected
      </span>
      <span className="mx-1 h-4 w-px bg-zoru-line" aria-hidden />
      <Button size="sm" variant="outline" onClick={onApprove}>
        <Check className="h-3.5 w-3.5 text-zoru-ink" /> Approve
      </Button>
      <Button size="sm" variant="outline" onClick={onDisburse}>
        <Banknote className="h-3.5 w-3.5" /> Disburse
      </Button>
      <Button size="sm" variant="outline" onClick={onExport}>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="ml-auto"
      >
        Clear selection
      </Button>
    </div>
  );
}
