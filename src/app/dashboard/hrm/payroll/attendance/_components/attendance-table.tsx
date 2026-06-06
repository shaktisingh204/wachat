'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
import {
  MoreHorizontal } from 'lucide-react';

/**
 * <AttendanceTable> — table-view body for the canonical Attendance list.
 *
 * 12 columns per §1D: select · Employee · Department · Date · Shift ·
 * Punch in · Punch out · Hours · Overtime · Late by · Status · Actions.
 *
 * Parent owns selection state.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { AttendanceListRow } from './types';

interface AttendanceTableProps {
  rows: AttendanceListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
}



function fmtTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(v?: number): string {
  if (typeof v !== 'number') return '—';
  return `${v.toFixed(2)}h`;
}

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

export function AttendanceTable({
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
}: AttendanceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          <tr>
            <th className="p-2 text-left">
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={onToggleAll}
                aria-label="Select all visible attendance rows"
              />
            </th>
            <th className="p-2 text-left">Employee</th>
            <th className="p-2 text-left">Department</th>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Shift</th>
            <th className="p-2 text-left">Punch in</th>
            <th className="p-2 text-left">Punch out</th>
            <th className="p-2 text-right">Hours</th>
            <th className="p-2 text-right">Overtime</th>
            <th className="p-2 text-right">Late by</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                {filtersActive
                  ? 'No attendance entries match the current filters.'
                  : 'No attendance entries yet — click "New record" to add the first one.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = row._id;
              return (
                <tr
                  key={id}
                  className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/60"
                >
                  <td className="p-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggleRow(id)}
                      aria-label={`Select attendance ${id}`}
                    />
                  </td>
                  <td className="p-2 align-middle">
                    <EntityPickerChip entity="employee" id={row.employeeId} />
                  </td>
                  <td className="p-2 align-middle text-[var(--st-text-secondary)]">—</td>
                  <td className="p-2 align-middle">
                    <Link
                      href={`/dashboard/hrm/payroll/attendance/${id}`}
                      className="text-[var(--st-text)] hover:underline"
                    >
                      {fmtDate(row.date)}
                    </Link>
                  </td>
                  <td className="p-2 align-middle font-mono text-[11px] text-[var(--st-text-secondary)]">
                    {row.shiftId || '—'}
                  </td>
                  <td className="p-2 align-middle text-[var(--st-text)]">
                    {fmtTime(row.punchInAt)}
                  </td>
                  <td className="p-2 align-middle text-[var(--st-text)]">
                    {fmtTime(row.punchOutAt)}
                  </td>
                  <td className="p-2 text-right align-middle font-mono tabular-nums text-[var(--st-text)]">
                    {fmtHours(row.totalHours)}
                  </td>
                  <td className="p-2 text-right align-middle text-[var(--st-text-secondary)]">
                    {fmtHours(row.overtimeHours)}
                  </td>
                  <td className="p-2 text-right align-middle text-[var(--st-text-secondary)]">
                    {row.lateByMinutes ?? 0} m
                  </td>
                  <td className="p-2 align-middle">
                    <StatusPill
                      label={statusLabel(row.status)}
                      tone={statusToTone(row.status)}
                    />
                  </td>
                  <td className="p-2 text-right align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/hrm/payroll/attendance/${id}`}
                          >
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/hrm/payroll/attendance/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/hrm/payroll/attendance/${id}/activity`}
                          >
                            Activity
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
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
