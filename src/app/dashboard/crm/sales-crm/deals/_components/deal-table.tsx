'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
/**
 * <DealTable> — the table-view body of the canonical deals list.
 *
 * Extracted from <DealListClient> to keep the parent under the 600-line
 * cap. Purely presentational; the parent owns filters / selection.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { DealListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface DealTableProps {
  deals: DealListRow[];
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

export function DealTable({
  deals,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: DealTableProps) {
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
                aria-label="Select all visible deals"
              />
            </th>
            <th className={`${cell} text-left`}>Title</th>
            <th className={`${cell} text-left`}>Client</th>
            <th className={`${cell} text-right`}>Amount</th>
            <th className={`${cell} text-left`}>Stage</th>
            <th className={`${cell} text-left`}>Pipeline</th>
            <th className={`${cell} text-left`}>Owner</th>
            <th className={`${cell} text-right`}>Probability</th>
            <th className={`${cell} text-left`}>Expected close</th>
            <th className={`${cell} text-left`}>Created</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 ? (
            <tr>
              <td colSpan={11} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                {filtersActive
                  ? 'No deals match the current filters.'
                  : 'No deals yet — click "New deal" to add the first one.'}
              </td>
            </tr>
          ) : (
            deals.map((d) => (
              <tr key={d._id} className="border-t border-zoru-line hover:bg-zoru-surface-2/60">
                <td className={`${cell} align-middle`}>
                  <input
                    type="checkbox"
                    checked={selected.has(d._id)}
                    onChange={() => onToggleRow(d._id)}
                    aria-label={`Select ${d.name}`}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  <EntityRowLink
                    href={`/dashboard/crm/sales-crm/deals/${d._id}`}
                    label={d.name || 'Untitled deal'}
                    subtitle={d.stage || undefined}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  {d.accountId ? (
                    <EntityPickerChip entity="client" id={d.accountId} />
                  ) : d.contactId ? (
                    <EntityPickerChip entity="contact" id={d.contactId} />
                  ) : (
                    <span className="text-zoru-ink-muted">{d.clientLabel ?? '—'}</span>
                  )}
                </td>
                <td className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}>
                  {fmtMoney(d.amount, d.currency ?? defaultCurrency)}
                </td>
                <td className={`${cell} align-middle`}>
                  {d.stage ? <StatusPill label={d.stage} tone={statusToTone(d.stage)} /> : '—'}
                </td>
                <td className={`${cell} align-middle`}>
                  {d.pipelineId ? <EntityPickerChip entity="pipeline" id={d.pipelineId} /> : '—'}
                </td>
                <td className={`${cell} align-middle`}>
                  {d.ownerId ? <EntityPickerChip entity="user" id={d.ownerId} /> : '—'}
                </td>
                <td className={`${cell} text-right align-middle text-zoru-ink`}>
                  {typeof d.probability === 'number' ? `${d.probability}%` : '—'}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>{fmtDate(d.expectedClose)}</td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>{fmtDate(d.createdAt)}</td>
                <td className={`${cell} text-right align-middle`}>
                  <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label="Row actions">
                        …
                      </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}`}>View</Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}/edit`}>Edit</Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=${d._id}`}
                        >
                          Convert to quotation
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuSeparator />
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}/activity`}>
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
