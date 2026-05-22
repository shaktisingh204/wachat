'use client';

/**
 * Leave list table — `/dashboard/crm/hr-payroll/leave`.
 *
 * Renders the filtered set of leave requests as a `<ZoruTable>` with
 * bulk-select. Columns:
 *   • select        — per-row checkbox
 *   • Employee      — `<EntityRowLink>` to the detail page,
 *                     leave type as the subtitle
 *   • Dates         — from → to range (compact)
 *   • Days          — numeric day count
 *   • Reason        — first ~80 chars of the user's reason text
 *   • Status        — pending / approved / rejected pill
 *   • Actions       — view / edit shortcuts
 *
 * Multi-tenant scoping is enforced upstream — the parent page already
 * filters by the current `userId` through the WorkSuite leave actions,
 * so this component just renders whatever rows it receives.
 */

import * as React from 'react';
import Link from 'next/link';
import { Eye, Pencil } from 'lucide-react';

import {
  Button,
  Card,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import type { LeaveListRow } from './types';

interface LeaveTableProps {
  rows: LeaveListRow[];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  filtersActive: boolean;
}

const REASON_SNIPPET_LEN = 80;

function fmtDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtDateRange(
  start: string | Date | undefined,
  end: string | Date | undefined,
): string {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s === '—' && e === '—') return '—';
  if (e === '—' || s === e) return s;
  return `${s} → ${e}`;
}

function reasonSnippet(reason: string | undefined): string {
  if (!reason) return '—';
  const trimmed = reason.trim();
  if (trimmed.length === 0) return '—';
  if (trimmed.length <= REASON_SNIPPET_LEN) return trimmed;
  return `${trimmed.slice(0, REASON_SNIPPET_LEN).trimEnd()}…`;
}

function statusTone(status: string): StatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'green';
  if (s === 'rejected' || s === 'cancelled') return 'red';
  if (s === 'pending') return 'amber';
  return 'neutral';
}

export function LeaveTable({
  rows,
  selected,
  onToggleOne,
  onToggleAll,
  filtersActive,
}: LeaveTableProps): React.JSX.Element {
  const headChecked =
    rows.length > 0 && rows.every((r) => selected.has(r._id));

  return (
    <ZoruCard className="overflow-hidden p-0">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead className="w-8">
              <ZoruCheckbox
                checked={headChecked}
                onCheckedChange={(c) => onToggleAll(Boolean(c))}
                aria-label="Select all leave requests"
              />
            </ZoruTableHead>
            <ZoruTableHead>Employee</ZoruTableHead>
            <ZoruTableHead>Dates</ZoruTableHead>
            <ZoruTableHead className="text-right">Days</ZoruTableHead>
            <ZoruTableHead>Reason</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={7}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No leave requests match these filters.'
                  : 'No leave requests yet.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            rows.map((row) => {
              const id = row._id;
              const checked = selected.has(id);
              const employeeName = row.employeeName?.trim() || 'Unnamed';
              const leaveType = row.leaveTypeName?.trim() || '—';
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <ZoruCheckbox
                      checked={checked}
                      onCheckedChange={() => onToggleOne(id)}
                      aria-label={`Select leave request for ${employeeName}`}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <EntityRowLink
                      href={`/dashboard/crm/hr-payroll/leave/${id}`}
                      label={employeeName}
                      subtitle={leaveType}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDateRange(row.startDate, row.endDate)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink">
                    {row.days ?? '—'}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className="max-w-[320px] truncate text-[12.5px] text-zoru-ink-muted"
                    title={row.reason ?? ''}
                  >
                    {reasonSnippet(row.reason)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <StatusPill
                      label={row.status || 'pending'}
                      tone={statusTone(row.status)}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/leave/${id}`}
                          aria-label={`View leave request for ${employeeName}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/leave/${id}/edit`}
                          aria-label={`Edit leave request for ${employeeName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>
    </ZoruCard>
  );
}
