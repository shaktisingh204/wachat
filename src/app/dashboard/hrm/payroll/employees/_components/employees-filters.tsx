'use client';

import { Input, Label } from '@/components/sabcrm/20ui';
/**
 * <EmployeesFilters> — collapsible filter row for the employees list.
 *
 * 8 dimensions: status, department, designation, reporting manager,
 * employment type, work location, joined-date range, branch. Pure
 * presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

interface EmployeesFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  departmentFilter: string | null;
  onDepartmentFilter: (next: string | null) => void;
  designationFilter: string | null;
  onDesignationFilter: (next: string | null) => void;
  managerFilter: string | null;
  onManagerFilter: (next: string | null) => void;
  employmentTypeFilter: string;
  onEmploymentTypeFilter: (next: string) => void;
  locationFilter: string;
  onLocationFilter: (next: string) => void;
  branchFilter: string | null;
  onBranchFilter: (next: string | null) => void;
  joinedFrom: string;
  onJoinedFrom: (v: string) => void;
  joinedTo: string;
  onJoinedTo: (v: string) => void;
}

export function EmployeesFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  departmentFilter,
  onDepartmentFilter,
  designationFilter,
  onDesignationFilter,
  managerFilter,
  onManagerFilter,
  employmentTypeFilter,
  onEmploymentTypeFilter,
  locationFilter,
  onLocationFilter,
  branchFilter,
  onBranchFilter,
  joinedFrom,
  onJoinedFrom,
  joinedTo,
  onJoinedTo,
}: EmployeesFiltersProps) {
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
            enumName="employeeStatus"
            value={statusFilter}
            onChange={onStatusFilter}
            allLabel="All statuses"
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
          <Label>Designation</Label>
          <EntityFormField
            entity="designation"
            name="_filter_designation"
            initialId={designationFilter}
            onChange={onDesignationFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Reporting manager</Label>
          <EntityFormField
            entity="employee"
            name="_filter_manager"
            initialId={managerFilter}
            onChange={onManagerFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Employment type</Label>
          <EnumFilterField
            enumName="employmentType"
            value={employmentTypeFilter}
            onChange={onEmploymentTypeFilter}
            allLabel="All types"
          />
        </div>
        <div className="space-y-1">
          <Label>Work location</Label>
          <Input
            value={locationFilter}
            onChange={(e) => onLocationFilter(e.target.value)}
            placeholder="City or campus name"
          />
        </div>
        <div className="space-y-1">
          <Label>Branch</Label>
          <EntityFormField
            entity="branch"
            name="_filter_branch"
            initialId={branchFilter}
            onChange={onBranchFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Joined — from</Label>
          <Input
            type="date"
            value={joinedFrom}
            onChange={(e) => onJoinedFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Joined — to</Label>
          <Input
            type="date"
            value={joinedTo}
            onChange={(e) => onJoinedTo(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
