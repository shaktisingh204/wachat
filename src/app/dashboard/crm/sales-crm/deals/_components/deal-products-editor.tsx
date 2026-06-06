'use client';

import { Button, Input, Label } from '@/components/sabcrm/20ui/compat';
import { Plus, Trash2 } from 'lucide-react';

/**
 * <DealProductsEditor> — line-item editor for the Deal form.
 *
 * Extracted from <DealForm> to keep the form file under the 600-line
 * cap. Holds no state of its own — fully controlled by the parent.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';

export interface ProductRow {
  itemId: string | null;
  name: string;
  quantity: number;
  rate: number;
  discount: number;
}

interface ProductsEditorProps {
  products: ProductRow[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onPatch: (idx: number, patch: Partial<ProductRow>) => void;
}

function safeNumber(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function DealProductsEditor({ products, onAdd, onRemove, onPatch }: ProductsEditorProps) {
  const subtotal = products.reduce(
    (sum, p) =>
      sum + Math.max(0, p.quantity) * Math.max(0, p.rate) * (1 - p.discount / 100),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Products</h2>
          <p className="text-[12.5px] text-[var(--st-text-secondary)]">
            Optional line items; helps when converting to a quotation.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">No line items yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <table className="w-full text-[12.5px]">
            <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <tr>
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Disc %</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((row, idx) => {
                const total =
                  Math.max(0, row.quantity) * Math.max(0, row.rate) * (1 - row.discount / 100);
                return (
                  <tr key={idx} className="border-t border-[var(--st-border)]">
                    <td className="p-2 align-top" style={{ minWidth: 180 }}>
                      <Label className="sr-only" htmlFor={`item-${idx}`}>
                        Item
                      </Label>
                      <EntityPicker
                        entity="item"
                        value={row.itemId}
                        onChange={(next, hydrated) => {
                          const nextId = typeof next === 'string' ? next : null;
                          const h = Array.isArray(hydrated) ? hydrated[0] : hydrated;
                          onPatch(idx, {
                            itemId: nextId,
                            name: h?.chip?.primary ?? row.name,
                          });
                        }}
                      />
                    </td>
                    <td className="p-2 align-top" style={{ minWidth: 160 }}>
                      <Input
                        value={row.name}
                        onChange={(e) => onPatch(idx, { name: e.target.value })}
                        aria-label="Line item name"
                      />
                    </td>
                    <td className="p-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={row.quantity}
                        onChange={(e) =>
                          onPatch(idx, { quantity: safeNumber(e.target.value) })
                        }
                        className="text-right"
                        style={{ width: 80 }}
                        aria-label="Quantity"
                      />
                    </td>
                    <td className="p-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.rate}
                        onChange={(e) => onPatch(idx, { rate: safeNumber(e.target.value) })}
                        className="text-right"
                        style={{ width: 110 }}
                        aria-label="Rate"
                      />
                    </td>
                    <td className="p-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={row.discount}
                        onChange={(e) =>
                          onPatch(idx, { discount: safeNumber(e.target.value) })
                        }
                        className="text-right"
                        style={{ width: 80 }}
                        aria-label="Discount percentage"
                      />
                    </td>
                    <td className="p-2 align-top text-right font-mono tabular-nums">
                      {total.toFixed(2)}
                    </td>
                    <td className="p-2 align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(idx)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                <td colSpan={5} className="p-2 text-right font-medium text-[var(--st-text-secondary)]">
                  Subtotal
                </td>
                <td className="p-2 text-right font-mono font-semibold tabular-nums">
                  {subtotal.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
