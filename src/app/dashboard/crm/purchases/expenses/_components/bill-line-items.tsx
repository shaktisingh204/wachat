'use client';

import { Button, Card, Input } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

/**
 * <BillLineItems> — the inventory-style line-items table for `<BillForm>`.
 *
 * Each row picker auto-fills rate, description, HSN/SAC, and tax rate
 * from the catalog item record when an item is selected — note the
 * picker reads `buyingPrice` (vendor side) instead of `sellingPrice`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { CrmBillLineItem } from '@/lib/rust-client/crm-bills';

export interface LineItemRow extends CrmBillLineItem {
  _key: string;
}

interface BillLineItemsProps {
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

export function BillLineItems({
  rows,
  currency,
  onAddRow,
  onRemoveRow,
  onPatchRow,
}: BillLineItemsProps) {
  return (
    <ZoruCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h3>
        <ZoruButton type="button" variant="outline" size="sm" onClick={onAddRow}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </ZoruButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-zoru-line">
        <table className="w-full text-[13px]">
          <thead className="bg-zoru-surface-2">
            <tr className="border-b border-zoru-line text-left">
              <th className="p-2 font-medium text-zoru-ink">Item</th>
              <th className="p-2 font-medium text-zoru-ink">Description</th>
              <th className="p-2 text-right font-medium text-zoru-ink">Qty</th>
              <th className="p-2 text-right font-medium text-zoru-ink">Rate</th>
              <th className="p-2 text-right font-medium text-zoru-ink">
                Disc %
              </th>
              <th className="p-2 font-medium text-zoru-ink">Tax</th>
              <th className="p-2 text-right font-medium text-zoru-ink">
                Amount
              </th>
              <th className="w-[40px] p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row._key}
                className="border-b border-zoru-line last:border-b-0"
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
                        typeof raw?.buyingPrice === 'number'
                          ? raw.buyingPrice
                          : typeof raw?.costPrice === 'number'
                            ? raw.costPrice
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
                  <ZoruInput
                    value={row.description ?? ''}
                    onChange={(e) =>
                      onPatchRow(row._key, { description: e.target.value })
                    }
                    placeholder="Free-text description"
                  />
                </td>
                <td className="p-2 align-top">
                  <ZoruInput
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
                  <ZoruInput
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
                  <ZoruInput
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
                <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                  {fmtMoney(Number(row.total) || 0, currency)}
                </td>
                <td className="p-2 align-top">
                  <ZoruButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveRow(row._key)}
                    disabled={rows.length <= 1}
                    className="text-zoru-danger-ink"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ZoruButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ZoruCard>
  );
}
