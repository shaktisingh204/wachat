'use client';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
/**
 * <VendorBidTable> — the table-view body of the canonical Vendor Bids
 * list. Pure presentation; the parent owns filters / selection.
 *
 * 10 columns per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D:
 *   select · Bid no · Vendor · Linked RFQ · Submitted date · Currency ·
 *   Total · Lead time · Status · Actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { VendorBidListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface VendorBidTableProps {
  bids: VendorBidListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  defaultCurrency: string;
  density?: DensityMode;
}

const DENSITY_CELL: Record<DensityMode, string> = {
  comfortable: 'p-2',
  compact: 'p-1.5',
  dense: 'p-1',
};

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
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

export function VendorBidTable({
  bids,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: VendorBidTableProps) {
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
                aria-label="Select all visible vendor bids"
              />
            </th>
            <th className={`${cell} text-left`}>Bid #</th>
            <th className={`${cell} text-left`}>Vendor</th>
            <th className={`${cell} text-left`}>Linked RFQ</th>
            <th className={`${cell} text-left`}>Submitted</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={`${cell} text-right`}>Lead (days)</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {bids.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No vendor bids match the current filters.'
                  : 'No vendor bids yet — click "New vendor bid" to add the first one.'}
              </td>
            </tr>
          ) : (
            bids.map((b) => (
              <tr
                key={b._id}
                className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
              >
                <td className={`${cell} align-middle`}>
                  <input
                    type="checkbox"
                    checked={selected.has(b._id)}
                    onChange={() => onToggleRow(b._id)}
                    aria-label={`Select ${b.bidNo}`}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  <EntityRowLink
                    href={`/dashboard/crm/purchases/vendor-bids/${b._id}`}
                    label={b.bidNo}
                    subtitle={b.vendorName || undefined}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  {b.vendorId ? (
                    <EntityPickerChip entity="vendor" id={b.vendorId} />
                  ) : (
                    <span className="text-zoru-ink-muted">
                      {b.vendorName || '—'}
                    </span>
                  )}
                </td>
                <td className={`${cell} align-middle`}>
                  {b.rfqId ? (
                    <Link
                      href={`/dashboard/crm/purchases/rfqs/${b.rfqId}`}
                      className="font-mono text-[11.5px] text-zoru-ink-muted hover:underline"
                    >
                      {b.rfqId.slice(-8).toUpperCase()}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {fmtDate(b.submittedAt)}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {b.currency || defaultCurrency}
                </td>
                <td className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}>
                  {fmtMoney(b.total, b.currency ?? defaultCurrency)}
                </td>
                <td className={`${cell} text-right align-middle tabular-nums text-zoru-ink-muted`}>
                  {typeof b.leadTimeDays === 'number' ? b.leadTimeDays : '—'}
                </td>
                <td className={`${cell} align-middle`}>
                  <StatusPill label={b.status} tone={statusToTone(b.status)} />
                </td>
                <td className={`${cell} text-right align-middle`}>
                  <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <ZoruButton size="sm" variant="ghost" aria-label="Row actions">
                        …
                      </ZoruButton>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/purchases/vendor-bids/${b._id}`}>
                          View
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/crm/purchases/vendor-bids/${b._id}/edit`}
                        >
                          Edit
                        </Link>
                      </ZoruDropdownMenuItem>
                      {b.status === 'awarded' ? (
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/purchases/orders/new?fromKind=vendorBid&fromId=${b._id}`}
                          >
                            Convert to PO
                          </Link>
                        </ZoruDropdownMenuItem>
                      ) : null}
                      <ZoruDropdownMenuSeparator />
                      {b.rfqId ? (
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/purchases/rfqs/${b.rfqId}`}>
                            Open RFQ
                          </Link>
                        </ZoruDropdownMenuItem>
                      ) : null}
                    </ZoruDropdownMenuContent>
                  </ZoruDropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
