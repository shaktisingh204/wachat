'use client';

import { Button } from '@/components/zoruui';
import { Archive, Building2, Download, ListChecks, Mail, UserCog, X, } from 'lucide-react';

/**
 * <EmployeesBulkBar> — sticky bulk-action ribbon for the employee list.
 *
 * Shows the selected count, exposes Archive, Export CSV, Change
 * department, Change manager, Send onboarding kit. The parent owns
 * confirmation dialogs and async wiring.
 */

import * as React from 'react';

interface EmployeesBulkBarProps {
  count: number;
  onClear: () => void;
  onExportCsv: () => void;
  onArchive: () => void;
  onChangeDepartment: () => void;
  onChangeManager: () => void;
  onSendOnboardingKit: () => void;
}

export function EmployeesBulkBar({
  count,
  onClear,
  onExportCsv,
  onArchive,
  onChangeDepartment,
  onChangeManager,
  onSendOnboardingKit,
}: EmployeesBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
        <ListChecks className="h-4 w-4 text-zoru-primary" />
        {count} selected
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <ZoruButton size="sm" variant="outline" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" /> Archive
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </ZoruButton>
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={onChangeDepartment}
        >
          <Building2 className="h-3.5 w-3.5" /> Change department
        </ZoruButton>
        <ZoruButton size="sm" variant="outline" onClick={onChangeManager}>
          <UserCog className="h-3.5 w-3.5" /> Change manager
        </ZoruButton>
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={onSendOnboardingKit}
        >
          <Mail className="h-3.5 w-3.5" /> Send onboarding kit
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
