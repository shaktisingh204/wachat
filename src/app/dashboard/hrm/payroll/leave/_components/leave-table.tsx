'use client';

import { Button, Checkbox, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  format } from 'date-fns';
import { Eye, MessageSquare, Pencil } from 'lucide-react';

/**
 * <LeaveTable> — canonical leave-list table (per §1D.1).
 *
 * 11 columns: select · Employee chip · Leave type · From · To · Days ·
 * Reason · Status · Approver · Submitted · Actions.
 *
 * Status pill uses {@link statusToTone}.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { LeaveListRow } from './types';

interface LeaveTableProps {
  rows: LeaveListRow[];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  filtersActive: boolean;
}



export function LeaveTable({
  rows,
  selected,
  onToggleOne,
  onToggleAll,
  filtersActive,
}: LeaveTableProps): React.JSX.Element {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-10 text-center text-[13px] text-[var(--st-text-secondary)]">
        {filtersActive
          ? 'No leave requests match the current filters.'
          : 'No leave requests yet — submit one with "Apply leave" above.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th className="w-10">
              <Checkbox
                aria-label="Select all rows on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </Th>
            <Th>Employee</Th>
            <Th>Leave type</Th>
            <Th>From</Th>
            <Th>To</Th>
            <Th className="text-right">Days</Th>
            <Th>Reason</Th>
            <Th>Status</Th>
            <Th>Approver</Th>
            <Th>Submitted</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row._id} className="border-[var(--st-border)]">
              <Td>
                <Checkbox
                  aria-label={`Select leave for ${row.employeeName}`}
                  checked={selected.has(row._id)}
                  onCheckedChange={() => onToggleOne(row._id)}
                />
              </Td>
              <Td className="text-[13px] text-[var(--st-text)]">
                <Link
                  href={`/dashboard/hrm/payroll/leave/${row._id}`}
                  className="hover:underline"
                >
                  {row.employeeName}
                </Link>
              </Td>
              <Td className="text-[13px] text-[var(--st-text)]">
                {row.leaveTypeName ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px]"
                    style={{
                      backgroundColor:
                        (row.leaveTypeColor || '#94A3B8') + '20',
                      color: row.leaveTypeColor || '#64748B',
                      border: `1px solid ${(row.leaveTypeColor || '#94A3B8')}40`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: row.leaveTypeColor || '#94A3B8',
                      }}
                    />
                    {row.leaveTypeName}
                  </span>
                ) : (
                  '—'
                )}
              </Td>
              <Td className="text-[13px] text-[var(--st-text)]">
                {fmtDate(row.from)}
              </Td>
              <Td className="text-[13px] text-[var(--st-text)]">
                {fmtDate(row.to)}
              </Td>
              <Td className="text-right text-[13px] tabular-nums text-[var(--st-text)]">
                {Number.isFinite(row.days) ? row.days : '—'}
                {row.halfDay ? (
                  <span className="ml-1 text-[11px] text-[var(--st-text-secondary)]">
                    ½
                  </span>
                ) : null}
              </Td>
              <Td
                className="max-w-[220px] truncate text-[13px] text-[var(--st-text-secondary)]"
                title={row.reason ?? ''}
              >
                {row.reason ?? '—'}
              </Td>
              <Td>
                <StatusPill
                  label={row.status}
                  tone={statusToTone(row.status)}
                />
              </Td>
              <Td className="text-[13px] text-[var(--st-text-secondary)]">
                {row.approverName ?? '—'}
              </Td>
              <Td className="text-[13px] text-[var(--st-text-secondary)]">
                {fmtDate(row.submittedAt)}
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  {row.employeeEmail ? (
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        href={`mailto:${row.employeeEmail}?subject=Regarding your leave request`}
                        aria-label="Message employee"
                        title="Message employee"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      href={`/dashboard/hrm/payroll/leave/${row._id}`}
                      aria-label="View"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      href={`/dashboard/hrm/payroll/leave/${row._id}/edit`}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
