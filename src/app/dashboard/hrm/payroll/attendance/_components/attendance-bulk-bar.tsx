'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { CheckCheck, CheckCircle2, Download, ListChecks, UserX, X, } from 'lucide-react';

/**
 * <AttendanceBulkBar> — sticky bulk-action ribbon for attendance.
 *
 * Mirrors the §1D contract: Approve · Mark present · Mark absent ·
 * Export CSV. The parent owns async wiring + confirmation dialogs.
 */

import * as React from 'react';

interface AttendanceBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  onApprove: () => void;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}

export function AttendanceBulkBar({
  count,
  onClear,
  onExportCsv,
  onApprove,
  onMarkPresent,
  onMarkAbsent,
}: AttendanceBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" onClick={onApprove}>
          <CheckCheck className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onMarkPresent}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark present
        </Button>
        <Button size="sm" variant="outline" onClick={onMarkAbsent}>
          <UserX className="h-3.5 w-3.5" /> Mark absent
        </Button>
        <Button size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
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
