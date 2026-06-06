'use client';

import { Input, Label } from '@/components/sabcrm/20ui/compat';
/**
 * <AttendanceFilters> — collapsible filter row for the attendance list.
 *
 * Six dimensions per §1D: status, employee, department, date range,
 * shift, source. Pure presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

interface AttendanceFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  employeeFilter: string | null;
  onEmployeeFilter: (next: string | null) => void;
  departmentFilter: string | null;
  onDepartmentFilter: (next: string | null) => void;
  shiftFilter: string | null;
  onShiftFilter: (next: string | null) => void;
  sourceFilter: string;
  onSourceFilter: (next: string) => void;
  fromDate: string;
  onFromDate: (v: string) => void;
  toDate: string;
  onToDate: (v: string) => void;
}

export function AttendanceFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  employeeFilter,
  onEmployeeFilter,
  departmentFilter,
  onDepartmentFilter,
  shiftFilter,
  onShiftFilter,
  sourceFilter,
  onSourceFilter,
  fromDate,
  onFromDate,
  toDate,
  onToDate,
}: AttendanceFiltersProps) {
  return (
    <details className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Filters{' '}
        {filtersActive ? (
          <>
            <span className="ml-2 text-[var(--st-text)]">·</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClearAll();
              }}
              className="ml-1 text-[var(--st-text)] hover:underline"
            >
              clear all
            </button>
          </>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <EnumFilterField
            enumName="attendanceStatus"
            value={statusFilter}
            onChange={onStatusFilter}
            allLabel="All statuses"
          />
        </div>
        <div className="space-y-1">
          <Label>Employee</Label>
          <EntityFormField
            entity="employee"
            name="_filter_employee"
            initialId={employeeFilter}
            onChange={onEmployeeFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <EntityFormField
            entity="department"
            name="_filter_department"
            initialId={departmentFilter}
            onChange={onDepartmentFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Shift</Label>
          <Input
            value={shiftFilter ?? ''}
            onChange={(e) => onShiftFilter(e.target.value || null)}
            placeholder="Shift ID"
          />
        </div>
        <div className="space-y-1">
          <Label>Source</Label>
          <EnumFilterField
            enumName="attendanceMode"
            value={sourceFilter}
            onChange={onSourceFilter}
            allLabel="All sources"
          />
        </div>
        <div className="space-y-1">
          <Label>Date — from</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Date — to</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onToDate(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
