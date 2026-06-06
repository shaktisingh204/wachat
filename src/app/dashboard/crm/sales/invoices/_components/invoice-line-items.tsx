'use client';

import { Button, Card, Input } from '@/components/sabcrm/20ui';
import { Plus, Trash2 } from 'lucide-react';

/**
 * <InvoiceLineItems> — the line-items table for `<InvoiceForm>`.
 *
 * Pure presentational; the parent owns row state and totals. Each row
 * picker auto-fills rate, description, HSN/SAC, and tax rate from the
 * catalog item record when an item is selected.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { CrmInvoiceLineItem } from '@/lib/rust-client/crm-invoices';

export interface LineItemRow extends CrmInvoiceLineItem {
  _key: string;
}

interface InvoiceLineItemsProps {
  rows: LineItemRow[];
  currency: string;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onPatchRow: (key: string, patch: Partial<LineItemRow>) => void;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value.toFixed(2)}`;
  }
}

export function InvoiceLineItems({
  rows,
  currency,
  onAddRow,
  onRemoveRow,
  onPatchRow,
}: InvoiceLineItemsProps) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Line items
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--st-bg-muted)]">
            <tr className="border-b border-[var(--st-border)] text-left">
              <th className="p-2 font-medium text-[var(--st-text)]">Item</th>
              <th className="p-2 font-medium text-[var(--st-text)]">Description</th>
              <th className="p-2 text-right font-medium text-[var(--st-text)]">Qty</th>
              <th className="p-2 text-right font-medium text-[var(--st-text)]">Rate</th>
              <th className="p-2 text-right font-medium text-[var(--st-text)]">
                Disc %
              </th>
              <th className="p-2 font-medium text-[var(--st-text)]">Tax</th>
              <th className="p-2 text-right font-medium text-[var(--st-text)]">
                Amount
              </th>
              <th className="w-[40px] p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row._key}
                className="border-b border-[var(--st-border)] last:border-b-0"
              >
                <td className="min-w-[180px] p-2 align-top">
                  <EntityFormField
                    entity="item"
                    name={`__item_${row._key}`}
                    initialId={row.itemId ?? null}
                    onChange={(id, hydrated) => {
                      const raw = hydrated?.raw as
                        | Record<string, unknown>
                        | undefined;
                      const rate =
                        typeof raw?.sellingPrice === 'number'
                          ? raw.sellingPrice
                          : typeof raw?.rate === 'number'
                            ? raw.rate
                            : undefined;
                      const description =
                        typeof raw?.description === 'string'
                          ? raw.description
                          : row.description;
                      const hsnSac =
                        typeof raw?.hsnSac === 'string'
                          ? raw.hsnSac
                          : typeof raw?.hsn === 'string'
                            ? raw.hsn
                            : undefined;
                      const taxRatePct =
                        typeof raw?.taxRatePct === 'number'
                          ? raw.taxRatePct
                          : undefined;
                      onPatchRow(row._key, {
                        itemId: id ?? undefined,
                        ...(rate != null ? { rate } : {}),
                        ...(description != null ? { description } : {}),
                        ...(hsnSac != null ? { hsnSac } : {}),
                        ...(taxRatePct != null ? { taxRatePct } : {}),
                      });
                    }}
                  />
                </td>
                <td className="min-w-[200px] p-2 align-top">
                  <Input
                    value={row.description ?? ''}
                    onChange={(e) =>
                      onPatchRow(row._key, { description: e.target.value })
                    }
                    placeholder="Free-text description"
                  />
                </td>
                <td className="p-2 align-top">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={row.qty ?? 0}
                    onChange={(e) =>
                      onPatchRow(row._key, { qty: Number(e.target.value) })
                    }
                    className="w-24 text-right tabular-nums"
                  />
                </td>
                <td className="p-2 align-top">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={row.rate ?? 0}
                    onChange={(e) =>
                      onPatchRow(row._key, { rate: Number(e.target.value) })
                    }
                    className="w-28 text-right tabular-nums"
                  />
                </td>
                <td className="p-2 align-top">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={row.discountPct ?? ''}
                    onChange={(e) =>
                      onPatchRow(row._key, {
                        discountPct:
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-20 text-right tabular-nums"
                    placeholder="0"
                  />
                </td>
                <td className="min-w-[160px] p-2 align-top">
                  <EntityFormField
                    entity="taxRate"
                    name={`__tax_${row._key}`}
                    initialId={
                      row.taxRatePct != null ? String(row.taxRatePct) : null
                    }
                    onChange={(_id, hydrated) => {
                      const raw = hydrated?.raw as
                        | Record<string, unknown>
                        | undefined;
                      const pct =
                        typeof raw?.ratePct === 'number'
                          ? raw.ratePct
                          : typeof raw?.rate === 'number'
                            ? raw.rate
                            : undefined;
                      onPatchRow(row._key, { taxRatePct: pct });
                    }}
                  />
                </td>
                <td className="p-2 text-right align-top tabular-nums text-[var(--st-text)]">
                  {fmtMoney(Number(row.total) || 0, currency)}
                </td>
                <td className="p-2 align-top">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveRow(row._key)}
                    disabled={rows.length <= 1}
                    className="text-[var(--st-danger)]"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
