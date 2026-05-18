'use client';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  MoreHorizontal } from 'lucide-react';

/**
 * <BillsTable> — table-view body for the canonical bills list (§1D).
 *
 * 13 columns: select · bill no · vendor invoice no · vendor · bill date
 * · due date (red if overdue) · currency · total · paid · balance ·
 * status · linked PO · actions.
 *
 * Density modes control row padding; the parent owns selection state.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { BillDensity, BillListRow } from './types';

interface BillsTableProps {
  bills: BillListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: BillDensity;
}

const DENSITY_CELL: Record<BillDensity, string> = {
  comfortable: 'p-2',
  compact: 'p-1.5',
  dense: 'p-1',
};

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function relativeDays(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}

function isOverdue(row: BillListRow): boolean {
  if (!row.dueDate) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(row.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && (row.balance ?? 0) > 0;
}

export function BillsTable({
  bills,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: BillsTableProps) {
  const cell = DENSITY_CELL[density];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
          <tr>
            <th className={`${cell} text-left`}>
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={onToggleAll}
                aria-label="Select all visible bills"
              />
            </th>
            <th className={`${cell} text-left`}>Bill #</th>
            <th className={`${cell} text-left`}>Vendor invoice #</th>
            <th className={`${cell} text-left`}>Vendor</th>
            <th className={`${cell} text-left`}>Bill date</th>
            <th className={`${cell} text-left`}>Due date</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={`${cell} text-right`}>Paid</th>
            <th className={`${cell} text-right`}>Balance</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={`${cell} text-left`}>Linked PO</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No bills match the current filters.'
                  : 'No bills yet — click "New bill" to add the first one.'}
              </td>
            </tr>
          ) : (
            bills.map((bill) => {
              const overdue = isOverdue(bill);
              const overdueClass = overdue
                ? 'text-zoru-danger-ink'
                : 'text-zoru-ink-muted';
              const id = bill._id;
              return (
                <tr
                  key={id}
                  className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
                >
                  <td className={`${cell} align-middle`}>
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggleRow(id)}
                      aria-label={`Select ${bill.billNo}`}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    <Link
                      href={`/dashboard/crm/purchases/expenses/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {bill.billNo || '—'}
                    </Link>
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {bill.vendorInvoiceNo || '—'}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {bill.vendorId ? (
                      <EntityPickerChip entity="vendor" id={bill.vendorId} />
                    ) : (
                      <span className="text-zoru-ink-muted">
                        {bill.vendorLabel ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {fmtDate(bill.billDate)}
                  </td>
                  <td className={`${cell} align-middle ${overdueClass}`}>
                    <span title={relativeDays(bill.dueDate)}>
                      {fmtDate(bill.dueDate)}
                    </span>
                    {overdue ? (
                      <span className="ml-1 text-[10px] uppercase">overdue</span>
                    ) : null}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {bill.currency || '—'}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}
                  >
                    {fmtMoney(bill.total, bill.currency)}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink-muted`}
                  >
                    {fmtMoney(bill.paid, bill.currency)}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums ${
                      overdue && bill.balance > 0
                        ? 'text-zoru-danger-ink'
                        : 'text-zoru-ink'
                    }`}
                  >
                    {fmtMoney(bill.balance, bill.currency)}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {bill.status ? (
                      <StatusPill
                        label={String(bill.status).replace(/_/g, ' ')}
                        tone={statusToTone(bill.status)}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {bill.linkedPoId ? (
                      <Link
                        href={`/dashboard/crm/purchases/orders/${bill.linkedPoId}`}
                        className="text-zoru-primary hover:underline"
                      >
                        PO
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${cell} text-right align-middle`}>
                    <ZoruDropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <ZoruButton
                          size="sm"
                          variant="ghost"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </ZoruButton>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/purchases/expenses/${id}`}>
                            View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/expenses/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${id}`}
                          >
                            Record payout
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/debit-notes/new?fromKind=bill&fromId=${id}`}
                          >
                            Convert to debit note
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/expenses/${id}/activity`}
                          >
                            Activity
                          </Link>
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </ZoruDropdownMenu>
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
