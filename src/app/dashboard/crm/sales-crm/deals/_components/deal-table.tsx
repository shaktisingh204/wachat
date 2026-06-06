'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
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
        <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
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
              <td colSpan={11} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                {filtersActive
                  ? 'No deals match the current filters.'
                  : 'No deals yet — click "New deal" to add the first one.'}
              </td>
            </tr>
          ) : (
            deals.map((d) => (
              <tr key={d._id} className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/60">
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
                    <span className="text-[var(--st-text-secondary)]">{d.clientLabel ?? '—'}</span>
                  )}
                </td>
                <td className={`${cell} text-right align-middle font-mono tabular-nums text-[var(--st-text)]`}>
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
                <td className={`${cell} text-right align-middle text-[var(--st-text)]`}>
                  {typeof d.probability === 'number' ? `${d.probability}%` : '—'}
                </td>
                <td className={`${cell} align-middle text-[var(--st-text-secondary)]`}>{fmtDate(d.expectedClose)}</td>
                <td className={`${cell} align-middle text-[var(--st-text-secondary)]`}>{fmtDate(d.createdAt)}</td>
                <td className={`${cell} text-right align-middle`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label="Row actions">
                        …
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}`}>View</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}/edit`}>Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/crm/sales/quotations/new?fromKind=deal&fromId=${d._id}`}
                        >
                          Convert to quotation
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/deals/${d._id}/activity`}>
                          Activity
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
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
