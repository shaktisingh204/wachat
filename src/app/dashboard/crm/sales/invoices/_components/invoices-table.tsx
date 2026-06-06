'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
import {
  MoreHorizontal } from 'lucide-react';

/**
 * <InvoicesTable> — table-view body for the canonical invoices list.
 *
 * 13 columns: select · invoice no · customer · invoice date · due date
 * (red if overdue) · currency · total · paid · balance · status · sales
 * agent · created · actions.
 *
 * Density modes control row padding; the parent owns selection state.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { InvoiceDensity, InvoiceListRow } from './types';

interface InvoicesTableProps {
  invoices: InvoiceListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: InvoiceDensity;
}

const DENSITY_CELL: Record<InvoiceDensity, string> = {
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

function isOverdue(row: InvoiceListRow): boolean {
  if (!row.dueDate) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(row.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && (row.balance ?? 0) > 0;
}

export function InvoicesTable({
  invoices,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: InvoicesTableProps) {
  const cell = DENSITY_CELL[density];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          <tr>
            <th className={`${cell} text-left`}>
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={onToggleAll}
                aria-label="Select all visible invoices"
              />
            </th>
            <th className={`${cell} text-left`}>Invoice #</th>
            <th className={`${cell} text-left`}>Customer</th>
            <th className={`${cell} text-left`}>Invoice date</th>
            <th className={`${cell} text-left`}>Due date</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={`${cell} text-right`}>Paid</th>
            <th className={`${cell} text-right`}>Balance</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={`${cell} text-left`}>Sales agent</th>
            <th className={`${cell} text-left`}>Created</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                {filtersActive
                  ? 'No invoices match the current filters.'
                  : 'No invoices yet — click "New invoice" to add the first one.'}
              </td>
            </tr>
          ) : (
            invoices.map((inv) => {
              const overdue = isOverdue(inv);
              const overdueClass = overdue ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]';
              const id = inv._id;
              return (
                <tr
                  key={id}
                  className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/60"
                >
                  <td className={`${cell} align-middle`}>
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggleRow(id)}
                      aria-label={`Select ${inv.invoiceNo}`}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    <EntityRowLink
                      href={`/dashboard/crm/sales/invoices/${id}`}
                      label={inv.invoiceNo || '—'}
                      subtitle={inv.clientLabel || undefined}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    {inv.clientId ? (
                      <EntityPickerChip entity="client" id={inv.clientId} />
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">
                        {inv.clientLabel ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} align-middle text-[var(--st-text-secondary)]`}>
                    {fmtDate(inv.date)}
                  </td>
                  <td className={`${cell} align-middle ${overdueClass}`}>
                    <span title={relativeDays(inv.dueDate)}>
                      {fmtDate(inv.dueDate)}
                    </span>
                    {overdue ? (
                      <span className="ml-1 text-[10px] uppercase">overdue</span>
                    ) : null}
                  </td>
                  <td className={`${cell} align-middle text-[var(--st-text-secondary)]`}>
                    {inv.currency || '—'}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-[var(--st-text)]`}
                  >
                    {fmtMoney(inv.total, inv.currency)}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-[var(--st-text-secondary)]`}
                  >
                    {fmtMoney(inv.paid, inv.currency)}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums ${
                      overdue && inv.balance > 0
                        ? 'text-[var(--st-danger)]'
                        : 'text-[var(--st-text)]'
                    }`}
                  >
                    {fmtMoney(inv.balance, inv.currency)}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {inv.status ? (
                      <StatusPill
                        label={String(inv.status).replace(/_/g, ' ')}
                        tone={statusToTone(inv.status)}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {inv.salesAgentId ? (
                      <EntityPickerChip entity="user" id={inv.salesAgentId} />
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle text-[var(--st-text-secondary)]`}>
                    {fmtDate(inv.createdAt)}
                  </td>
                  <td className={`${cell} text-right align-middle`}>
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
                          <Link href={`/dashboard/crm/sales/invoices/${id}`}>
                            View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/sales/invoices/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/sales/receipts/new?fromKind=invoice&fromId=${id}`}
                          >
                            Record payment
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/sales/credit-notes/new?fromKind=invoice&fromId=${id}`}
                          >
                            Convert to credit note
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/sales/invoices/${id}/activity`}
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
