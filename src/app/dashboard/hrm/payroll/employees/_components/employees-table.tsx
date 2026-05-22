'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  MoreHorizontal,
  UserCircle2 } from 'lucide-react';

/**
 * <EmployeesTable> — table-view body for the canonical Employees list.
 *
 * 13 columns: select · Photo + Name chip · Employee ID · Department ·
 * Designation · Email · Phone · Reporting manager · Status · Joined ·
 * Tenure · Salary · Actions.
 *
 * Parent owns selection state. Status colour comes from `statusToTone`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { EmployeeListRow } from './types';

interface EmployeesTableProps {
  rows: EmployeeListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtTenure(joining?: string | null, exit?: string | null): string {
  if (!joining) return '—';
  const start = new Date(joining);
  if (Number.isNaN(start.getTime())) return '—';
  const end = exit ? new Date(exit) : new Date();
  if (Number.isNaN(end.getTime())) return '—';
  const months = Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
    ),
  );
  if (months < 1) return '<1 mo';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remM = months % 12;
  return remM === 0 ? `${years}y` : `${years}y ${remM}m`;
}

function fmtMoney(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `INR ${value}`;
  }
}

function fullName(row: EmployeeListRow): string {
  return (
    row.displayName ||
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.workEmail ||
    '—'
  );
}

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

export function EmployeesTable({
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
}: EmployeesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
          <tr>
            <th className="p-2 text-left">
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={onToggleAll}
                aria-label="Select all visible employees"
              />
            </th>
            <th className="p-2 text-left">Employee</th>
            <th className="p-2 text-left">Employee ID</th>
            <th className="p-2 text-left">Department</th>
            <th className="p-2 text-left">Designation</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Reporting manager</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Joined</th>
            <th className="p-2 text-left">Tenure</th>
            <th className="p-2 text-right">Salary</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No employees match the current filters.'
                  : 'No employees yet — click "New Employee" to add the first one.'}
              </td>
            </tr>
          ) : (
            rows.map((emp) => {
              const id = emp._id;
              const name = fullName(emp);
              return (
                <tr
                  key={id}
                  className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
                >
                  <td className="p-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggleRow(id)}
                      aria-label={`Select ${name}`}
                    />
                  </td>
                  <td className="p-2 align-middle">
                    <Link
                      href={`/dashboard/hrm/payroll/employees/${id}`}
                      className="inline-flex items-center gap-2 text-zoru-ink hover:underline"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zoru-line bg-zoru-surface text-zoru-ink-muted">
                        <UserCircle2 className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{name}</span>
                    </Link>
                  </td>
                  <td className="p-2 align-middle font-mono text-zoru-ink-muted">
                    {emp.employeeId || '—'}
                  </td>
                  <td className="p-2 align-middle">
                    {emp.departmentId ? (
                      <EntityPickerChip
                        entity="department"
                        id={emp.departmentId}
                      />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-2 align-middle">
                    {emp.designationId ? (
                      <EntityPickerChip
                        entity="designation"
                        id={emp.designationId}
                      />
                    ) : (
                      <span className="text-zoru-ink-muted">
                        {emp.designation || '—'}
                      </span>
                    )}
                  </td>
                  <td className="p-2 align-middle text-zoru-ink">
                    {emp.workEmail || '—'}
                  </td>
                  <td className="p-2 align-middle text-zoru-ink-muted">
                    {emp.workPhone || emp.personalPhone || '—'}
                  </td>
                  <td className="p-2 align-middle">
                    {emp.reportingManagerId ? (
                      <EntityPickerChip
                        entity="employee"
                        id={emp.reportingManagerId}
                      />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-2 align-middle">
                    {emp.status ? (
                      <StatusPill
                        label={statusLabel(emp.status)}
                        tone={statusToTone(emp.status)}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2 align-middle text-zoru-ink-muted">
                    {fmtDate(emp.joiningDate)}
                  </td>
                  <td className="p-2 align-middle text-zoru-ink-muted">
                    {fmtTenure(emp.joiningDate, emp.exitDate)}
                  </td>
                  <td className="p-2 text-right align-middle font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(emp.ctc)}
                  </td>
                  <td className="p-2 text-right align-middle">
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/hrm/payroll/employees/${id}`}>
                            View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/hrm/payroll/employees/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/hrm/payroll/employees/${id}/activity`}
                          >
                            Activity
                          </Link>
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
