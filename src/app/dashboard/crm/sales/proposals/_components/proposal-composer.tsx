'use client';

/**
 * Shared composer UI used by the proposal/template editors.
 * Renders the client picker, line-item repeater, totals, and
 * note/terms fields. Pure-presentational — the parent owns state
 * and submission.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClayButton } from '@/components/clay';
import type { WsProposalLineInput } from '@/lib/worksuite/proposals-types';

export interface ComposerLine extends WsProposalLineInput {
  id: string;
}

export interface ProposalComposerProps {
  lines: ComposerLine[];
  onLinesChange: (lines: ComposerLine[]) => void;
  discount: number;
  onDiscountChange: (n: number) => void;
  note: string;
  onNoteChange: (v: string) => void;
  terms: string;
  onTermsChange: (v: string) => void;
  currency: string;
}

function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function fmt(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(v || 0);
  } catch {
    return `${currency} ${(v || 0).toFixed(2)}`;
  }
}

export function ProposalComposer({
  lines,
  onLinesChange,
  discount,
  onDiscountChange,
  note,
  onNoteChange,
  terms,
  onTermsChange,
  currency,
}: ProposalComposerProps) {
  const addRow = () => {
    onLinesChange([
      ...lines,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        tax: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    onLinesChange(lines.filter((l) => l.id !== id));
  };

  const updateRow = <K extends keyof ComposerLine>(
    id: string,
    key: K,
    value: ComposerLine[K],
  ) => {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const subtotal = lines.reduce((s, l) => s + n(l.quantity) * n(l.unit_price), 0);
  const tax = lines.reduce(
    (s, l) => s + (n(l.quantity) * n(l.unit_price) * n(l.tax)) / 100,
    0,
  );
  const total = Math.max(0, subtotal + tax - n(discount));

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-clay-md border border-clay-border">
        <table className="w-full text-[13px]">
          <thead className="bg-clay-surface-2">
            <tr className="border-b border-clay-border">
              <th className="p-3 text-left font-medium text-clay-ink">Item</th>
              <th className="p-3 text-right font-medium text-clay-ink">Qty</th>
              <th className="p-3 text-right font-medium text-clay-ink">Unit Price</th>
              <th className="p-3 text-right font-medium text-clay-ink">Tax %</th>
              <th className="p-3 text-right font-medium text-clay-ink">Total</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr className="border-b border-clay-border">
                <td
                  colSpan={6}
                  className="p-6 text-center text-[12.5px] text-clay-ink-muted"
                >
                  No line items yet. Click “Add row” to start.
                </td>
              </tr>
            ) : (
              lines.map((l) => {
                const rowTotal =
                  n(l.quantity) * n(l.unit_price) +
                  (n(l.quantity) * n(l.unit_price) * n(l.tax)) / 100;
                return (
                  <tr key={l.id} className="border-b border-clay-border">
                    <td className="p-2 align-top">
                      <Input
                        value={l.name}
                        onChange={(e) => updateRow(l.id, 'name', e.target.value)}
                        placeholder="Item name"
                        className="mb-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                      />
                      <Textarea
                        value={l.description || ''}
                        onChange={(e) =>
                          updateRow(l.id, 'description', e.target.value)
                        }
                        placeholder="Description (optional)"
                        rows={2}
                        className="rounded-clay-md border-clay-border bg-clay-surface text-[12.5px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          updateRow(l.id, 'quantity', n(e.target.value))
                        }
                        className="h-9 w-20 rounded-clay-md border-clay-border bg-clay-surface text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unit_price}
                        onChange={(e) =>
                          updateRow(l.id, 'unit_price', n(e.target.value))
                        }
                        className="h-9 w-28 rounded-clay-md border-clay-border bg-clay-surface text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.tax || 0}
                        onChange={(e) => updateRow(l.id, 'tax', n(e.target.value))}
                        className="h-9 w-20 rounded-clay-md border-clay-border bg-clay-surface text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 text-right align-top font-medium text-clay-ink">
                      {fmt(rowTotal, currency)}
                    </td>
                    <td className="p-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(l.id)}
                        aria-label="Remove row"
                        className="rounded-clay-md p-1.5 text-clay-ink-muted hover:bg-clay-red-soft hover:text-clay-red"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-between gap-4">
        <ClayButton
          type="button"
          variant="pill"
          leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          onClick={addRow}
        >
          Add row
        </ClayButton>

        <div className="min-w-[260px] rounded-clay-md border border-clay-border bg-clay-surface-2 p-4">
          <div className="flex items-center justify-between py-1 text-[13px] text-clay-ink">
            <span>Subtotal</span>
            <span className="font-medium">{fmt(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-[13px] text-clay-ink">
            <span>Tax</span>
            <span className="font-medium">{fmt(tax, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1 text-[13px] text-clay-ink">
            <Label className="text-clay-ink">Discount</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => onDiscountChange(n(e.target.value))}
              className="h-8 w-24 rounded-clay-md border-clay-border bg-clay-surface text-right text-[13px]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-clay-border pt-2 text-[14px] font-semibold text-clay-ink">
            <span>Total</span>
            <span>{fmt(total, currency)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-clay-ink">Notes</Label>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            placeholder="Internal or client-facing notes"
          />
        </div>
        <div>
          <Label className="text-clay-ink">Terms &amp; Conditions</Label>
          <Textarea
            rows={4}
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
            className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            placeholder="Payment terms, delivery timeline, etc."
          />
        </div>
      </div>
    </div>
  );
}
