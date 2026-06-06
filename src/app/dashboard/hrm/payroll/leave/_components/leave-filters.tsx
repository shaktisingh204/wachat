'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import {
  XCircle } from 'lucide-react';

/**
 * <LeaveFiltersRow> — filter chip row for the leave list (per §1D.1).
 *
 * 6 filters: status, employee, leave type, department, date range, approver.
 * Status pivots local state; entity filters use <EntityFormField>.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

import type {
  LeavePreset,
  LeaveStatusFilter,
  LeaveTypeOption,
} from './types';

interface LeaveFiltersRowProps {
  /* status / preset */
  statusFilter: LeaveStatusFilter;
  onStatusChange: (next: LeaveStatusFilter) => void;
  preset: LeavePreset;
  onPresetChange: (next: LeavePreset) => void;
  /* entity filters */
  employeeFilter: string | null;
  onEmployeeChange: (next: string | null) => void;
  leaveTypeFilter: string | null;
  onLeaveTypeChange: (next: string | null) => void;
  departmentFilter: string | null;
  onDepartmentChange: (next: string | null) => void;
  approverFilter: string | null;
  onApproverChange: (next: string | null) => void;
  /* date range */
  fromDate: string;
  onFromDate: (next: string) => void;
  toDate: string;
  onToDate: (next: string) => void;
  /* clear */
  hasActiveFilters: boolean;
  onClear: () => void;
  /* leave type catalog for dropdown */
  leaveTypes: LeaveTypeOption[];
}

export const LEAVE_PRESETS: { key: LeavePreset; label: string }[] = [
  { key: 'all', label: 'All requests' },
  { key: 'my-leaves', label: 'My leaves' },
  { key: 'team-pending', label: "Team's pending" },
  { key: 'this-month', label: 'This month' },
];

export function LeaveFiltersRow({
  statusFilter,
  onStatusChange,
  preset,
  onPresetChange,
  employeeFilter,
  onEmployeeChange,
  leaveTypeFilter,
  onLeaveTypeChange,
  departmentFilter,
  onDepartmentChange,
  approverFilter,
  onApproverChange,
  fromDate,
  onFromDate,
  toDate,
  onToDate,
  hasActiveFilters,
  onClear,
  leaveTypes,
}: LeaveFiltersRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={preset}
          onValueChange={(v) => onPresetChange(v as LeavePreset)}
        >
          <SelectTrigger
            className="h-9 w-[180px]"
            aria-label="Saved view"
          >
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as LeaveStatusFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={leaveTypeFilter ?? '__all__'}
          onValueChange={(v) => onLeaveTypeChange(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="h-9 w-[180px]" aria-label="Leave type">
            <SelectValue placeholder="All leave types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All leave types</SelectItem>
            {leaveTypes.map((lt) => (
              <SelectItem key={lt._id} value={lt._id}>
                {lt.code ? (
                  <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                    {lt.code}
                  </span>
                ) : null}
                <span className={lt.code ? 'ml-2' : ''}>{lt.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-auto"
          >
            <XCircle className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Employee
          </Label>
          <div className="mt-1">
            <EntityFormField
              entity="employee"
              name="__employeeFilter"
              initialId={employeeFilter}
              onChange={(next) => onEmployeeChange(next)}
              placeholder="All employees"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Department
          </Label>
          <div className="mt-1">
            <EntityFormField
              entity="department"
              name="__departmentFilter"
              initialId={departmentFilter}
              onChange={(next) => onDepartmentChange(next)}
              placeholder="All departments"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Approver
          </Label>
          <div className="mt-1">
            <EntityFormField
              entity="user"
              name="__approverFilter"
              initialId={approverFilter}
              onChange={(next) => onApproverChange(next)}
              placeholder="Any approver"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label
              htmlFor="leave-from"
              className="text-[11px] uppercase text-[var(--st-text-secondary)]"
            >
              From
            </Label>
            <Input
              id="leave-from"
              type="date"
              value={fromDate}
              onChange={(e) => onFromDate(e.target.value)}
              className="mt-1 h-9 text-[12.5px]"
            />
          </div>
          <div className="flex-1">
            <Label
              htmlFor="leave-to"
              className="text-[11px] uppercase text-[var(--st-text-secondary)]"
            >
              To
            </Label>
            <Input
              id="leave-to"
              type="date"
              value={toDate}
              onChange={(e) => onToDate(e.target.value)}
              className="mt-1 h-9 text-[12.5px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
