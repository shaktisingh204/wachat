'use client';

import { Card, Button } from '@/components/sabcrm/20ui/compat';
import { Mail, Phone, UserCircle2 } from 'lucide-react';

/**
 * <EmployeesGrid> — card-grid view alternative to the table.
 *
 * Renders one tile per row with the headline name, employee code,
 * department + designation lookup, status pill, and quick links to View
 * / Edit. Selection is intentionally omitted from cards — selecting in
 * grid mode is rare and would clutter the tile chrome.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { EmployeeListRow } from './types';

interface EmployeesGridProps {
  rows: EmployeeListRow[];
  filtersActive: boolean;
}

function fullName(row: EmployeeListRow): string {
  return (
    row.displayName ||
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.workEmail ||
    '—'
  );
}

export function EmployeesGrid({ rows, filtersActive }: EmployeesGridProps) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
        {filtersActive
          ? 'No employees match the current filters.'
          : 'No employees yet — click "New Employee" to add the first one.'}
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((emp) => {
        const id = emp._id;
        const name = fullName(emp);
        return (
          <Card
            key={id}
            className="flex flex-col gap-3 p-4 transition hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                <UserCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/hrm/payroll/employees/${id}`}
                  className="truncate text-[14px] font-medium text-[var(--st-text)] hover:underline"
                >
                  {name}
                </Link>
                <p className="truncate font-mono text-[11px] text-[var(--st-text-secondary)]">
                  {emp.employeeId || id.slice(-6)}
                </p>
              </div>
              {emp.status ? (
                <StatusPill
                  label={emp.status.replace(/_/g, ' ')}
                  tone={statusToTone(emp.status)}
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-1 text-[12px] text-[var(--st-text-secondary)]">
              {emp.designationId ? (
                <EntityPickerChip
                  entity="designation"
                  id={emp.designationId}
                />
              ) : emp.designation ? (
                <span>{emp.designation}</span>
              ) : null}
              {emp.departmentId ? (
                <EntityPickerChip entity="department" id={emp.departmentId} />
              ) : null}
              {emp.workEmail ? (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3" />
                  {emp.workEmail}
                </span>
              ) : null}
              {emp.workPhone || emp.personalPhone ? (
                <span className="inline-flex items-center gap-1 truncate">
                  <Phone className="h-3 w-3" />
                  {emp.workPhone || emp.personalPhone}
                </span>
              ) : null}
            </div>

            <div className="mt-auto flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/dashboard/hrm/payroll/employees/${id}`}>
                  View
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/hrm/payroll/employees/${id}/edit`}>
                  Edit
                </Link>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
