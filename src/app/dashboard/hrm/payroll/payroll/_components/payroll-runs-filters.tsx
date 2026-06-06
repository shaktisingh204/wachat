'use client';

import { Button, Label, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  RefreshCw,
  XCircle } from 'lucide-react';

/**
 * <PayrollRunsFiltersRow> — filter row for the canonical payroll-runs
 * list (per §1D.1). 5 filters: status, month, year, department,
 * employee. Plus a Refresh + Clear control.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { CrmPayrollRunStatus } from '@/lib/rust-client/crm-payroll-runs';

export type PayrollStatusFilter = 'all' | CrmPayrollRunStatus;

export const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

interface PayrollRunsFiltersRowProps {
  statusFilter: PayrollStatusFilter;
  onStatusChange: (v: PayrollStatusFilter) => void;
  monthFilter: string;
  onMonthChange: (v: string) => void;
  yearFilter: string;
  onYearChange: (v: string) => void;
  yearOptions: number[];
  departmentFilter: string | null;
  onDepartmentChange: (v: string | null) => void;
  employeeFilter: string | null;
  onEmployeeChange: (v: string | null) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function PayrollRunsFiltersRow({
  statusFilter,
  onStatusChange,
  monthFilter,
  onMonthChange,
  yearFilter,
  onYearChange,
  yearOptions,
  departmentFilter,
  onDepartmentChange,
  employeeFilter,
  onEmployeeChange,
  hasActiveFilters,
  onClear,
  onRefresh,
  refreshing,
}: PayrollRunsFiltersRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <EnumFilterField
          enumName="payrollRunFilterStatus"
          value={statusFilter}
          onChange={(v) => onStatusChange(v as PayrollStatusFilter)}
          placeholder="All statuses"
        />

        <Select value={monthFilter} onValueChange={onMonthChange}>
          <ZoruSelectTrigger className="h-9 w-[140px]" aria-label="Month">
            <ZoruSelectValue placeholder="All months" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All months</ZoruSelectItem>
            {MONTH_OPTIONS.map((m) => (
              <ZoruSelectItem key={m.value} value={m.value}>
                {m.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={onYearChange}>
          <ZoruSelectTrigger className="h-9 w-[120px]" aria-label="Year">
            <ZoruSelectValue placeholder="Year" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All years</ZoruSelectItem>
            {yearOptions.map((y) => (
              <ZoruSelectItem key={y} value={String(y)}>
                {y}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="ml-auto"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />{' '}
          Refresh
        </Button>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            <XCircle className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Department
          </Label>
          <div className="mt-1">
            <EntityFormField
              entity="department"
              name="__departmentFilter"
              initialId={departmentFilter}
              onChange={(v) => onDepartmentChange(v)}
              placeholder="All departments"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase text-[var(--st-text-secondary)]">
            Employee
          </Label>
          <div className="mt-1">
            <EntityFormField
              entity="employee"
              name="__employeeFilter"
              initialId={employeeFilter}
              onChange={(v) => onEmployeeChange(v)}
              placeholder="All employees"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
