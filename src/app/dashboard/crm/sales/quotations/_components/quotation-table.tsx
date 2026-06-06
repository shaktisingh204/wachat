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
 * <QuotationTable> — the table-view body of the canonical quotations
 * list. Pure presentation; the parent owns filters / selection.
 *
 * 11 columns per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D:
 *   select · Quote no · Customer · Date · Valid until (red if expired)
 *   · Currency · Total · Status · Sales agent · Created · Actions
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { QuotationListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface QuotationTableProps {
  quotations: QuotationListRow[];
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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export function QuotationTable({
  quotations,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: QuotationTableProps) {
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
                aria-label="Select all visible quotations"
              />
            </th>
            <th className={`${cell} text-left`}>Quote #</th>
            <th className={`${cell} text-left`}>Customer</th>
            <th className={`${cell} text-left`}>Date</th>
            <th className={`${cell} text-left`}>Valid until</th>
            <th className={`${cell} text-left`}>Currency</th>
            <th className={`${cell} text-right`}>Total</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={`${cell} text-left`}>Sales agent</th>
            <th className={`${cell} text-left`}>Created</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {quotations.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No quotations match the current filters.'
                  : 'No quotations yet — click "New quotation" to add the first one.'}
              </td>
            </tr>
          ) : (
            quotations.map((q) => (
              <tr key={q._id} className="border-t border-zoru-line hover:bg-zoru-surface-2/60">
                <td className={`${cell} align-middle`}>
                  <input
                    type="checkbox"
                    checked={selected.has(q._id)}
                    onChange={() => onToggleRow(q._id)}
                    aria-label={`Select ${q.quotationNo}`}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  <EntityRowLink
                    href={`/dashboard/crm/sales/quotations/${q._id}`}
                    label={q.quotationNo || '—'}
                    subtitle={q.subject || undefined}
                  />
                </td>
                <td className={`${cell} align-middle`}>
                  {q.clientId ? (
                    <EntityPickerChip entity="client" id={q.clientId} />
                  ) : (
                    <span className="text-zoru-ink-muted">—</span>
                  )}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {fmtDate(q.date)}
                </td>
                <td
                  className={`${cell} align-middle ${
                    q.expired
                      ? 'font-medium text-zoru-danger-ink'
                      : 'text-zoru-ink-muted'
                  }`}
                >
                  {fmtDate(q.validUntil)}
                  {q.expired ? <span className="ml-1 text-[10.5px]">expired</span> : null}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {q.currency || defaultCurrency}
                </td>
                <td
                  className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}
                >
                  {fmtMoney(q.total, q.currency ?? defaultCurrency)}
                </td>
                <td className={`${cell} align-middle`}>
                  <StatusPill label={q.status} tone={statusToTone(q.status)} />
                </td>
                <td className={`${cell} align-middle`}>
                  {q.salesAgentId ? (
                    <EntityPickerChip entity="user" id={q.salesAgentId} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${cell} align-middle text-zoru-ink-muted`}>
                  {fmtDate(q.createdAt)}
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
                        <Link href={`/dashboard/crm/sales/quotations/${q._id}`}>View</Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales/quotations/${q._id}/edit`}>
                          Edit
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${q._id}`}
                        >
                          Convert to invoice
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuSeparator />
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales/quotations/${q._id}/activity`}>
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
