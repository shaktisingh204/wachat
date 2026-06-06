'use client';

import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
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
    <div className="flex flex-col gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={preset}
          onValueChange={(v) => onPresetChange(v as LeavePreset)}
        >
          <ZoruSelectTrigger
            className="h-9 w-[180px]"
            aria-label="Saved view"
          >
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {LEAVE_PRESETS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusChange(v as LeaveStatusFilter)}
        >
          <ZoruSelectTrigger className="h-9 w-[140px]" aria-label="Status">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
            <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
            <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
            <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>

        <Select
          value={leaveTypeFilter ?? '__all__'}
          onValueChange={(v) => onLeaveTypeChange(v === '__all__' ? null : v)}
        >
          <ZoruSelectTrigger className="h-9 w-[180px]" aria-label="Leave type">
            <ZoruSelectValue placeholder="All leave types" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="__all__">All leave types</ZoruSelectItem>
            {leaveTypes.map((lt) => (
              <ZoruSelectItem key={lt._id} value={lt._id}>
                {lt.code ? (
                  <span className="font-mono text-[11.5px] text-zoru-ink-muted">
                    {lt.code}
                  </span>
                ) : null}
                <span className={lt.code ? 'ml-2' : ''}>{lt.name}</span>
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
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
          <Label className="text-[11px] uppercase text-zoru-ink-muted">
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
          <Label className="text-[11px] uppercase text-zoru-ink-muted">
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
          <Label className="text-[11px] uppercase text-zoru-ink-muted">
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
              className="text-[11px] uppercase text-zoru-ink-muted"
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
              className="text-[11px] uppercase text-zoru-ink-muted"
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
