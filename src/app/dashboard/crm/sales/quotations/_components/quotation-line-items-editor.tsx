'use client';

import { Button, Input, Label } from '@/components/sabcrm/20ui/compat';
import { PlusCircle, Trash2 } from 'lucide-react';

/**
 * <QuotationLineItemsEditor> — rich line-item editor extracted from
 * `<QuotationForm>` so neither file blows past the 600-line cap.
 *
 * Each row carries: item picker · qty · rate · discount % · tax % +
 * GST sub-fields (CGST / SGST / IGST / cess). The parent owns the
 * `rows` array; the editor mutates via the supplied callbacks.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';
import type { CrmQuotationLineItem } from '@/lib/rust-client/crm-quotations';
import type { LookupItem } from '@/lib/lookup-registry';

/**
 * Editable row state — mirrors `CrmQuotationLineItem` plus a local
 * `rowKey` so React can key sibling rows even when ids/descriptions
 * are blank.
 */
export interface LineRow {
  rowKey: string;
  itemId?: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  total?: number;
}

export function freshRow(): LineRow {
  return {
    rowKey: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    qty: 1,
    rate: 0,
  };
}

export function seedRows(items?: CrmQuotationLineItem[]): LineRow[] {
  if (!items || items.length === 0) return [freshRow()];
  return items.map((it, idx) => ({
    rowKey: `seed-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: it.itemId,
    description: it.description,
    hsnSac: it.hsnSac,
    qty: typeof it.qty === 'number' ? it.qty : 0,
    unit: it.unit,
    rate: typeof it.rate === 'number' ? it.rate : 0,
    discountPct: it.discountPct,
    taxRatePct: it.taxRatePct,
    cgstAmount: it.cgstAmount,
    sgstAmount: it.sgstAmount,
    igstAmount: it.igstAmount,
    cessAmount: it.cessAmount,
    total: it.total,
  }));
}

interface QuotationLineItemsEditorProps {
  rows: LineRow[];
  onAdd: () => void;
  onRemove: (rowKey: string) => void;
  onPatch: (rowKey: string, patch: Partial<LineRow>) => void;
  fmtMoney: (n: number) => string;
}

export function QuotationLineItemsEditor({
  rows,
  onAdd,
  onRemove,
  onPatch,
  fmtMoney,
}: QuotationLineItemsEditorProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
            Line items <span className="text-[var(--st-danger)]">*</span>
          </h2>
          <p className="text-[12.5px] text-[var(--st-text-secondary)]">
            Pick an item per row, or leave the picker blank and use the description.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <PlusCircle className="h-4 w-4" />
          Add line
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <tr>
              <th className="p-2 text-left">Item / Description</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Unit price</th>
              <th className="p-2 text-right">Disc %</th>
              <th className="p-2 text-right">Tax %</th>
              <th className="p-2 text-right">CGST</th>
              <th className="p-2 text-right">SGST</th>
              <th className="p-2 text-right">IGST</th>
              <th className="p-2 text-right">Cess</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const qty = Number(row.qty) || 0;
              const rate = Number(row.rate) || 0;
              const sub = qty * rate;
              const taxRate = Number(row.taxRatePct);
              const lineTotal =
                sub +
                (Number.isFinite(taxRate) && taxRate > 0 ? (sub * taxRate) / 100 : 0);
              return (
                <tr
                  key={row.rowKey}
                  className="border-t border-[var(--st-border)] align-top"
                >
                  <td className="space-y-1.5 p-2">
                    <EntityPicker
                      entity="item"
                      value={row.itemId ?? null}
                      placeholder="Pick item or leave blank"
                      onChange={(next, hydrated) => {
                        const id = Array.isArray(next) ? next[0] ?? null : next ?? null;
                        const item = (Array.isArray(hydrated)
                          ? hydrated[0]
                          : hydrated) as LookupItem | undefined;
                        const raw = (item?.raw ?? {}) as Record<string, unknown>;
                        onPatch(row.rowKey, {
                          itemId: id ?? undefined,
                          description:
                            row.description ??
                            (typeof raw.description === 'string'
                              ? (raw.description as string)
                              : typeof raw.name === 'string'
                                ? (raw.name as string)
                                : undefined),
                          rate:
                            typeof raw.sellingPrice === 'number'
                              ? (raw.sellingPrice as number)
                              : row.rate,
                          hsnSac:
                            typeof raw.hsnSac === 'string'
                              ? (raw.hsnSac as string)
                              : row.hsnSac,
                        });
                      }}
                    />
                    <Input
                      value={row.description ?? ''}
                      onChange={(e) =>
                        onPatch(row.rowKey, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="h-8 text-[12px]"
                    />
                  </td>
                  <NumberCell
                    value={row.qty}
                    onChange={(v) => onPatch(row.rowKey, { qty: v })}
                  />
                  <NumberCell
                    value={row.rate}
                    onChange={(v) => onPatch(row.rowKey, { rate: v })}
                    width="md"
                  />
                  <NumberCell
                    value={row.discountPct ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { discountPct: v })}
                  />
                  <NumberCell
                    value={row.taxRatePct ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { taxRatePct: v })}
                  />
                  <NumberCell
                    value={row.cgstAmount ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { cgstAmount: v })}
                  />
                  <NumberCell
                    value={row.sgstAmount ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { sgstAmount: v })}
                  />
                  <NumberCell
                    value={row.igstAmount ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { igstAmount: v })}
                  />
                  <NumberCell
                    value={row.cessAmount ?? 0}
                    onChange={(v) => onPatch(row.rowKey, { cessAmount: v })}
                  />
                  <td className="p-2 text-right text-[var(--st-text)] tabular-nums">
                    {fmtMoney(lineTotal)}
                  </td>
                  <td className="p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(row.rowKey)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Label className="block text-[11px] text-[var(--st-text-secondary)]">
        Discount / shipping / adjustment / round-off — captured in the Summary card below.
      </Label>
    </>
  );
}

/* ─── Small re-usable numeric cell ─────────────────────────────── */

function NumberCell({
  value,
  onChange,
  width = 'sm',
}: {
  value: number;
  onChange: (next: number) => void;
  /** sm ≈ 5rem, md ≈ 7rem. */
  width?: 'sm' | 'md';
}) {
  return (
    <td className="p-2">
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={
          width === 'md'
            ? 'h-8 w-28 text-right text-[12px]'
            : 'h-8 w-20 text-right text-[12px]'
        }
      />
    </td>
  );
}
