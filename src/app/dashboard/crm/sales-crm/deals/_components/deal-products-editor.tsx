'use client';

import { ZoruButton, ZoruInput, ZoruLabel } from '@/components/zoruui';
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
          <h2 className="text-[15px] font-semibold text-zoru-ink">Products</h2>
          <p className="text-[12.5px] text-zoru-ink-muted">
            Optional line items; helps when converting to a quotation.
          </p>
        </div>
        <ZoruButton type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </ZoruButton>
      </div>

      {products.length === 0 ? (
        <p className="text-[12.5px] text-zoru-ink-muted">No line items yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-[12.5px]">
            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
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
                  <tr key={idx} className="border-t border-zoru-line">
                    <td className="p-2 align-top" style={{ minWidth: 180 }}>
                      <ZoruLabel className="sr-only" htmlFor={`item-${idx}`}>
                        Item
                      </ZoruLabel>
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
                      <ZoruInput
                        value={row.name}
                        onChange={(e) => onPatch(idx, { name: e.target.value })}
                        aria-label="Line item name"
                      />
                    </td>
                    <td className="p-2 align-top text-right">
                      <ZoruInput
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
                      <ZoruInput
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
                      <ZoruInput
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
                      <ZoruButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(idx)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-zoru-line bg-zoru-surface-2">
                <td colSpan={5} className="p-2 text-right font-medium text-zoru-ink-muted">
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
