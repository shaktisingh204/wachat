'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  Download,
  GitBranch,
  LayoutGrid,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <EmployeesToolbar> — top toolbar above the employee list.
 *
 * Renders: search, saved-view preset selector, view switcher (table |
 * grid | org-chart), Export CSV button, +New Employee CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import type { EmployeePresetKey, EmployeeViewMode } from './types';

export const EMPLOYEE_PRESETS: { key: EmployeePresetKey; label: string }[] = [
  { key: 'all-active', label: 'All active' },
  { key: 'my-team', label: 'My team' },
  { key: 'on-probation', label: 'On probation' },
  { key: 'joined-last-30d', label: 'Joined last 30 days' },
  { key: 'terminated', label: 'Terminated' },
];

interface EmployeesToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: EmployeeViewMode;
  onViewChange: (next: EmployeeViewMode) => void;
  preset: EmployeePresetKey | null;
  onPresetChange: (next: EmployeePresetKey) => void;
  onExportCsv: () => void;
}

export function EmployeesToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  preset,
  onPresetChange,
  onExportCsv,
}: EmployeesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, employee ID, email or phone…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search employees"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={preset ?? 'all-active'}
          onValueChange={(v) => onPresetChange(v as EmployeePresetKey)}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5">
          <Button
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('grid')}
            aria-pressed={view === 'grid'}
            aria-label="Card grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'org' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('org')}
            aria-pressed={view === 'org'}
            aria-label="Org chart view"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/hrm/payroll/employees/new">
            <Plus className="h-3.5 w-3.5" /> New Employee
          </Link>
        </Button>
      </div>
    </div>
  );
}
