'use client';

import {
  Button,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  format } from 'date-fns';
import {
  Banknote,
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  } from 'lucide-react';

/**
 * <PayrollRunsTable> — 10-column canonical table for the payroll-runs
 * list (per §1D.1). Columns: select · Period · Pay date · Employees
 * count · Gross total · Net total · Status · Approvals · Disbursed at ·
 * Actions.
 *
 * Inline lifecycle actions (compute · approve · disburse · edit · delete)
 * are emitted via callbacks so the parent owns the busy state.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type {
  CrmPayrollRunDoc,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

interface PayrollRunsTableProps {
  rows: CrmPayrollRunDoc[];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onCompute: (id: string) => void;
  onApprove: (id: string) => void;
  onDisburse: (id: string) => void;
  onDelete: (id: string) => void;
  actionBusy: boolean;
  hasActiveFilters: boolean;
}



export function periodLabel(run: CrmPayrollRunDoc): string {
  if (!run.periodFrom || !run.periodTo) return '—';
  const a = new Date(run.periodFrom);
  const b = new Date(run.periodTo);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—';
  if (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === 1 &&
    b.getDate() ===
      new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate()
  ) {
    return format(a, 'MMM yyyy');
  }
  return `${format(a, 'dd MMM')} – ${format(b, 'dd MMM yyyy')}`;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

export function PayrollRunsTable({
  rows,
  selected,
  onToggleOne,
  onToggleAll,
  onCompute,
  onApprove,
  onDisburse,
  onDelete,
  actionBusy,
  hasActiveFilters,
}: PayrollRunsTableProps): React.JSX.Element {
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r._id));

  return (
    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow className="hover:bg-transparent">
            <ZoruTableHead className="w-10">
              <Checkbox
                aria-label="Select all rows on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </ZoruTableHead>
            <ZoruTableHead>Period</ZoruTableHead>
            <ZoruTableHead>Pay date</ZoruTableHead>
            <ZoruTableHead className="text-right">Employees</ZoruTableHead>
            <ZoruTableHead className="text-right">Gross</ZoruTableHead>
            <ZoruTableHead className="text-right">Net</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead className="text-right">Approvals</ZoruTableHead>
            <ZoruTableHead>Disbursed at</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={10}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                {hasActiveFilters
                  ? 'No payroll runs match the current filters.'
                  : 'No payroll runs yet.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            rows.map((r) => {
              const employeeCount =
                r.totals?.employeeCount ?? r.employees?.length ?? 0;
              const status = (r.status ?? 'draft') as CrmPayrollRunStatus;
              const approvals = r.approvals?.length ?? 0;
              return (
                <ZoruTableRow key={r._id} className="border-[var(--st-border)]">
                  <ZoruTableCell>
                    <Checkbox
                      aria-label={`Select run for ${periodLabel(r)}`}
                      checked={selected.has(r._id)}
                      onCheckedChange={() => onToggleOne(r._id)}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                    {periodLabel(r)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                    {fmtDate(r.payDate)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-[13px] tabular-nums text-[var(--st-text)]">
                    {employeeCount}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                    {fmtMoney(r.totals?.gross ?? 0, 'INR')}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                    {fmtMoney(r.totals?.net ?? 0, 'INR')}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <StatusPill label={status} tone={statusToTone(status)} />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-[13px] tabular-nums text-[var(--st-text-secondary)]">
                    {approvals}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                    {status === 'disbursed' || status === 'closed'
                      ? fmtDate(r.updatedAt)
                      : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex justify-end gap-1">
                      {(status === 'draft' || status === 'processing') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCompute(r._id)}
                          disabled={actionBusy}
                          title="Compute payroll"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Compute
                        </Button>
                      )}
                      {status === 'processing' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onApprove(r._id)}
                          disabled={actionBusy}
                          title="Approve"
                        >
                          <Check className="h-3.5 w-3.5 text-[var(--st-text)]" />{' '}
                          Approve
                        </Button>
                      )}
                      {status === 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDisburse(r._id)}
                          disabled={actionBusy}
                          title="Disburse"
                        >
                          <Banknote className="h-3.5 w-3.5" /> Disburse
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/dashboard/hrm/payroll/payroll/new?id=${r._id}`}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(r._id)}
                        aria-label="Delete"
                        disabled={
                          status === 'disbursed' || status === 'closed'
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
                      </Button>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </Table>
    </div>
  );
}
