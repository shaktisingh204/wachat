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
  MoreHorizontal } from 'lucide-react';

/**
 * <PurchaseOrdersTable> — table-view body for the canonical PO list.
 *
 * 12 columns: select · PO no · Vendor (EntityPickerChip) · Date ·
 * Expected delivery (red if overdue) · Currency · Total · Status pill ·
 * Buyer/Owner · Approver · Created · Actions.
 *
 * Density modes control row padding; the parent owns selection state.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { PurchaseOrderDensity, PurchaseOrderListRow } from './types';

interface PurchaseOrdersTableProps {
  orders: PurchaseOrderListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: PurchaseOrderDensity;
}

const DENSITY_CELL: Record<PurchaseOrderDensity, string> = {
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

function isDeliveryOverdue(row: PurchaseOrderListRow): boolean {
  if (!row.expectedDelivery) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'received' || s === 'closed' || s === 'cancelled') return false;
  const t = new Date(row.expectedDelivery).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function PurchaseOrdersTable({
  orders,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: PurchaseOrdersTableProps) {
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
                aria-label="Select all visible purchase orders"
              />
            </th>
            <th className={`${cell} text-left`}>PO #</th>
            <th className={`${cell} text-left`}>Vendor</th>
            <th className={`${cell} text-left`}>Date</th>
            <th className={`${cell} text-left`}>Expected delivery</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={`${cell} text-left`}>Buyer</th>
            <th className={`${cell} text-left`}>Approver</th>
            <th className={`${cell} text-left`}>Created</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No purchase orders match the current filters.'
                  : 'No purchase orders yet — click "New purchase order" to add the first one.'}
              </td>
            </tr>
          ) : (
            orders.map((po) => {
              const overdue = isDeliveryOverdue(po);
              const overdueClass = overdue
                ? 'text-zoru-danger-ink'
                : 'text-zoru-ink-muted';
              const id = po._id;
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
                      aria-label={`Select ${po.poNo}`}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    <EntityRowLink
                      href={`/dashboard/crm/purchases/orders/${id}`}
                      label={po.poNo || '—'}
                      subtitle={po.vendorLabel || undefined}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    {po.vendorId ? (
                      <EntityPickerChip entity="vendor" id={po.vendorId} />
                    ) : (
                      <span className="text-zoru-ink-muted">
                        {po.vendorLabel ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {fmtDate(po.date)}
                  </td>
                  <td className={`${cell} align-middle ${overdueClass}`}>
                    <span title={relativeDays(po.expectedDelivery)}>
                      {fmtDate(po.expectedDelivery)}
                    </span>
                    {overdue ? (
                      <span className="ml-1 text-[10px] uppercase">overdue</span>
                    ) : null}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {po.currency || '—'}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}
                  >
                    {fmtMoney(po.total, po.currency)}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {po.status ? (
                      <StatusPill
                        label={String(po.status).replace(/_/g, ' ')}
                        tone={statusToTone(po.status)}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {po.buyerId ? (
                      <EntityPickerChip entity="user" id={po.buyerId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {po.approverId ? (
                      <EntityPickerChip entity="user" id={po.approverId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle text-zoru-ink-muted`}>
                    {fmtDate(po.createdAt)}
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
                          <Link href={`/dashboard/crm/purchases/orders/${id}`}>
                            View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/orders/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=${id}`}
                          >
                            Convert to GRN
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/bills/new?fromKind=purchaseOrder&fromId=${id}`}
                          >
                            Convert to bill
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/orders/${id}/activity`}
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
