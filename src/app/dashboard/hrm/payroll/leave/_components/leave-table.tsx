'use client';

import {
  ZoruButton,
  ZoruCheckbox,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  format } from 'date-fns';
import { Eye,
  Pencil } from 'lucide-react';

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
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
      <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-10 text-center text-[13px] text-zoru-ink-muted">
        {filtersActive
          ? 'No leave requests match the current filters.'
          : 'No leave requests yet — submit one with "Apply leave" above.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow className="hover:bg-transparent">
            <ZoruTableHead className="w-10">
              <ZoruCheckbox
                aria-label="Select all rows on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </ZoruTableHead>
            <ZoruTableHead>Employee</ZoruTableHead>
            <ZoruTableHead>Leave type</ZoruTableHead>
            <ZoruTableHead>From</ZoruTableHead>
            <ZoruTableHead>To</ZoruTableHead>
            <ZoruTableHead className="text-right">Days</ZoruTableHead>
            <ZoruTableHead>Reason</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Approver</ZoruTableHead>
            <ZoruTableHead>Submitted</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.map((row) => (
            <ZoruTableRow key={row._id} className="border-zoru-line">
              <ZoruTableCell>
                <ZoruCheckbox
                  aria-label={`Select leave for ${row.employeeName}`}
                  checked={selected.has(row._id)}
                  onCheckedChange={() => onToggleOne(row._id)}
                />
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink">
                <Link
                  href={`/dashboard/hrm/payroll/leave/${row._id}`}
                  className="hover:underline"
                >
                  {row.employeeName}
                </Link>
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink">
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
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink">
                {fmtDate(row.from)}
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink">
                {fmtDate(row.to)}
              </ZoruTableCell>
              <ZoruTableCell className="text-right text-[13px] tabular-nums text-zoru-ink">
                {Number.isFinite(row.days) ? row.days : '—'}
                {row.halfDay ? (
                  <span className="ml-1 text-[11px] text-zoru-ink-muted">
                    ½
                  </span>
                ) : null}
              </ZoruTableCell>
              <ZoruTableCell
                className="max-w-[220px] truncate text-[13px] text-zoru-ink-muted"
                title={row.reason ?? ''}
              >
                {row.reason ?? '—'}
              </ZoruTableCell>
              <ZoruTableCell>
                <StatusPill
                  label={row.status}
                  tone={statusToTone(row.status)}
                />
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                {row.approverName ?? '—'}
              </ZoruTableCell>
              <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                {fmtDate(row.submittedAt)}
              </ZoruTableCell>
              <ZoruTableCell>
                <div className="flex justify-end gap-1">
                  <ZoruButton variant="ghost" size="icon" asChild>
                    <Link
                      href={`/dashboard/hrm/payroll/leave/${row._id}`}
                      aria-label="View"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </ZoruButton>
                  <ZoruButton variant="ghost" size="icon" asChild>
                    <Link
                      href={`/dashboard/hrm/payroll/leave/${row._id}/edit`}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </ZoruButton>
                </div>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}
