'use client';

import {
  Badge,
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
/**
 * <RfqTable> — the table-view body of the canonical RFQs list. Pure
 * presentation; the parent owns filters / selection.
 *
 * 11 columns per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D:
 *   select · RFQ no/title · Scope/title · Vendors invited (chip) ·
 *   Deadline (red if past) · Currency · Estimated value · Status pill ·
 *   Owner · Created · Actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { RfqListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface RfqTableProps {
  rfqs: RfqListRow[];
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

export function RfqTable({
  rfqs,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: RfqTableProps) {
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
                aria-label="Select all visible RFQs"
              />
            </th>
            <th className={`${cell} text-left`}>RFQ</th>
            <th className={`${cell} text-left`}>Scope / title</th>
            <th className={`${cell} text-left`}>Vendors</th>
            <th className={`${cell} text-left`}>Deadline</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Est. value</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={`${cell} text-left`}>Owner</th>
            <th className={`${cell} text-left`}>Created</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {rfqs.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No RFQs match the current filters.'
                  : 'No RFQs yet — click "New RFQ" to add the first one.'}
              </td>
            </tr>
          ) : (
            rfqs.map((r) => (
              <tr
                key={r._id}
                className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
              >
                <td className={`${cell} align-middle`}>
                  <input
                    type="checkbox"
                    checked={selected.has(r._id)}
                    onChange={() => onToggleRow(r._id)}
                    aria-label={`Select ${r.title || r._id}`}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  <EntityRowLink
                    href={`/dashboard/crm/purchases/rfqs/${r._id}`}
                    label={r.title || '—'}
                    subtitle={r.vendorsInvitedCount ? `${r.vendorsInvitedCount} vendor${r.vendorsInvitedCount === 1 ? '' : 's'} invited` : undefined}
                  />
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {r.scope || r.title || '—'}
                </td>
                <td className={`${cell} align-middle`}>
                  <Badge variant="outline">{r.vendorsInvitedCount}</Badge>
                </td>
                <td
                  className={`${cell} align-middle ${
                    r.deadlinePassed
                      ? 'font-medium text-zoru-danger-ink'
                      : 'text-zoru-ink-muted'
                  }`}
                >
                  {fmtDate(r.deadline)}
                  {r.deadlinePassed ? (
                    <span className="ml-1 text-[10.5px]">past</span>
                  ) : null}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {r.currency || defaultCurrency}
                </td>
                <td className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}>
                  {fmtMoney(r.estimatedValue, r.currency ?? defaultCurrency)}
                </td>
                <td className={`${cell} align-middle`}>
                  <StatusPill label={r.status} tone={statusToTone(r.status)} />
                </td>
                <td className={`${cell} align-middle`}>
                  {r.ownerId ? (
                    <EntityPickerChip entity="user" id={r.ownerId} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {fmtDate(r.createdAt)}
                </td>
                <td className={`${cell} text-right align-middle`}>
                  <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label="Row actions">
                        …
                      </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/purchases/rfqs/${r._id}`}>
                          View
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/purchases/rfqs/${r._id}/edit`}>
                          Edit
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/crm/purchases/vendor-bids/new?fromKind=rfq&fromId=${r._id}`}
                        >
                          Record a bid
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuSeparator />
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/purchases/rfqs/${r._id}/activity`}>
                          Activity
                        </Link>
                      </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
