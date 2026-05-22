'use client';

import { Button, Input, Textarea } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Line-items table for `<DeliveryForm>`. Extracted to its own file
 * to keep the parent form under the 600-line per-file cap.
 *
 * Each row carries DC-specific fields (batch, expiry, serial numbers)
 * stored as freeform strings. The parent form serialises these into
 * a single JSON blob on the `lineItems` FormData entry.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

export interface DcLineRow {
  id: string;
  itemId?: string;
  name: string;
  hsnCode?: string;
  unit?: string;
  quantity: number;
  batch?: string;
  expiry?: string;
  serialNumbersText?: string;
}

export interface DcLineItemsTableProps {
  rows: DcLineRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<DcLineRow>) => void;
}

export function DcLineItemsTable({
  rows,
  onAdd,
  onRemove,
  onPatch,
}: DcLineItemsTableProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h3>
        <ZoruButton type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </ZoruButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-zoru-line">
        <table className="w-full text-[13px]">
          <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
            <tr>
              <th className="p-2.5 font-medium">Item</th>
              <th className="p-2.5 font-medium">HSN</th>
              <th className="w-[90px] p-2.5 text-right font-medium">Qty</th>
              <th className="w-[120px] p-2.5 font-medium">Unit</th>
              <th className="w-[120px] p-2.5 font-medium">Batch</th>
              <th className="w-[140px] p-2.5 font-medium">Expiry</th>
              <th className="min-w-[180px] p-2.5 font-medium">Serial nos</th>
              <th className="w-[40px] p-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zoru-line align-top">
                <td className="min-w-[200px] p-2">
                  <EntityFormField
                    entity="item"
                    name={`row-${row.id}-itemPicker`}
                    initialId={row.itemId ?? null}
                    placeholder="Pick item or type below…"
                    onChange={(id, hydrated) => {
                      const raw = (hydrated?.raw ?? {}) as Record<string, unknown>;
                      const nm =
                        (typeof raw.name === 'string' && raw.name) ||
                        hydrated?.chip?.primary ||
                        row.name;
                      const hsn =
                        (typeof raw.hsnSac === 'string' && raw.hsnSac) ||
                        (typeof raw.hsnCode === 'string' && raw.hsnCode) ||
                        row.hsnCode;
                      const unit =
                        (typeof raw.unit === 'string' && raw.unit) || row.unit;
                      onPatch(row.id, {
                        itemId: id ?? undefined,
                        name: nm,
                        hsnCode: hsn,
                        unit,
                      });
                    }}
                  />
                  <ZoruInput
                    value={row.name}
                    onChange={(e) => onPatch(row.id, { name: e.target.value })}
                    placeholder="Item description"
                    className="mt-1 h-8 text-[12.5px]"
                    maxLength={200}
                  />
                </td>
                <td className="p-2">
                  <ZoruInput
                    value={row.hsnCode ?? ''}
                    onChange={(e) => onPatch(row.id, { hsnCode: e.target.value })}
                    placeholder="e.g. 998314"
                    className="h-9 text-[12.5px]"
                    maxLength={20}
                  />
                </td>
                <td className="p-2">
                  <ZoruInput
                    type="number"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onChange={(e) =>
                      onPatch(row.id, { quantity: Number(e.target.value) || 0 })
                    }
                    className="h-9 text-right text-[12.5px] tabular-nums"
                  />
                </td>
                <td className="min-w-[120px] p-2">
                  <EntityFormField
                    entity="unit"
                    name={`row-${row.id}-unitPicker`}
                    initialId={row.unit ?? null}
                    placeholder="e.g. PCS"
                    onChange={(id) => onPatch(row.id, { unit: id ?? undefined })}
                  />
                </td>
                <td className="p-2">
                  <ZoruInput
                    value={row.batch ?? ''}
                    onChange={(e) => onPatch(row.id, { batch: e.target.value })}
                    placeholder="Batch #"
                    className="h-9 text-[12.5px]"
                    maxLength={40}
                  />
                </td>
                <td className="p-2">
                  <ZoruInput
                    type="date"
                    value={row.expiry ?? ''}
                    onChange={(e) => onPatch(row.id, { expiry: e.target.value })}
                    className="h-9 text-[12.5px]"
                  />
                </td>
                <td className="p-2">
                  <ZoruTextarea
                    rows={2}
                    value={row.serialNumbersText ?? ''}
                    onChange={(e) =>
                      onPatch(row.id, { serialNumbersText: e.target.value })
                    }
                    placeholder="One per line or comma-separated"
                    className="text-[12.5px]"
                  />
                </td>
                <td className="p-2 text-right">
                  <ZoruButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(row.id)}
                    disabled={rows.length === 1}
                    className="text-zoru-danger-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ZoruButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
