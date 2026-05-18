'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
/**
 * <AttendanceFilters> — collapsible filter row for the attendance list.
 *
 * Six dimensions per §1D: status, employee, department, date range,
 * shift, source. Pure presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half day' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'wfh', label: 'Work from home' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'biometric', label: 'Biometric' },
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobile' },
];

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
    <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        Filters{' '}
        {filtersActive ? (
          <>
            <span className="ml-2 text-zoru-ink">·</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClearAll();
              }}
              className="ml-1 text-zoru-primary hover:underline"
            >
              clear all
            </button>
          </>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <ZoruLabel>Status</ZoruLabel>
          <ZoruSelect value={statusFilter} onValueChange={onStatusFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="space-y-1">
          <ZoruLabel>Employee</ZoruLabel>
          <EntityFormField
            entity="employee"
            name="_filter_employee"
            initialId={employeeFilter}
            onChange={onEmployeeFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Department</ZoruLabel>
          <EntityFormField
            entity="department"
            name="_filter_department"
            initialId={departmentFilter}
            onChange={onDepartmentFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Shift</ZoruLabel>
          <ZoruInput
            value={shiftFilter ?? ''}
            onChange={(e) => onShiftFilter(e.target.value || null)}
            placeholder="Shift ID"
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Source</ZoruLabel>
          <ZoruSelect value={sourceFilter} onValueChange={onSourceFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="space-y-1">
          <ZoruLabel>Date — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={fromDate}
            onChange={(e) => onFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Date — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={toDate}
            onChange={(e) => onToDate(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
