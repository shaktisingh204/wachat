'use client';

import { ZoruButton, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Shared composer UI used by the proposal/template editors.
 * Renders the client picker, line-item repeater, totals, and
 * note/terms fields. Pure-presentational — the parent owns state
 * and submission.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';
import type { LookupItem } from '@/lib/lookup-registry';
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
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary">
            <tr className="border-b border-border">
              <th className="p-3 text-left font-medium text-foreground">Item</th>
              <th className="p-3 text-right font-medium text-foreground">Qty</th>
              <th className="p-3 text-right font-medium text-foreground">Unit Price</th>
              <th className="p-3 text-right font-medium text-foreground">Tax %</th>
              <th className="p-3 text-right font-medium text-foreground">Total</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr className="border-b border-border">
                <td
                  colSpan={6}
                  className="p-6 text-center text-[12.5px] text-muted-foreground"
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
                  <tr key={l.id} className="border-b border-border">
                    <td className="p-2 align-top min-w-[220px]">
                      <div className="mb-1.5">
                        <EntityPicker
                          entity="item"
                          value={null}
                          placeholder="Pick item or type name"
                          onChange={(_id, hydrated) => {
                            const h = (Array.isArray(hydrated) ? hydrated[0] : hydrated) as LookupItem | undefined;
                            const raw = (h?.raw ?? {}) as Record<string, unknown>;
                            const name = typeof raw.name === 'string' ? raw.name : (h?.chip.primary ?? '');
                            const desc = typeof raw.description === 'string' ? (raw.description as string) : undefined;
                            const price = typeof raw.sellingPrice === 'number' ? (raw.sellingPrice as number) : undefined;
                            updateRow(l.id, 'name', name);
                            if (desc != null) updateRow(l.id, 'description', desc);
                            if (price != null) updateRow(l.id, 'unit_price', price);
                          }}
                        />
                      </div>
                      {l.name ? (
                        <ZoruInput
                          value={l.name}
                          onChange={(e) => updateRow(l.id, 'name', e.target.value)}
                          placeholder="Item name"
                          className="mb-1 h-9 rounded-lg border-border bg-card text-[13px]"
                        />
                      ) : null}
                      <ZoruTextarea
                        value={l.description || ''}
                        onChange={(e) =>
                          updateRow(l.id, 'description', e.target.value)
                        }
                        placeholder="Description (optional)"
                        rows={2}
                        className="rounded-lg border-border bg-card text-[12.5px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          updateRow(l.id, 'quantity', n(e.target.value))
                        }
                        className="h-9 w-20 rounded-lg border-border bg-card text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unit_price}
                        onChange={(e) =>
                          updateRow(l.id, 'unit_price', n(e.target.value))
                        }
                        className="h-9 w-28 rounded-lg border-border bg-card text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.tax || 0}
                        onChange={(e) => updateRow(l.id, 'tax', n(e.target.value))}
                        className="h-9 w-20 rounded-lg border-border bg-card text-right text-[13px]"
                      />
                    </td>
                    <td className="p-2 text-right align-top font-medium text-foreground">
                      {fmt(rowTotal, currency)}
                    </td>
                    <td className="p-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(l.id)}
                        aria-label="Remove row"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-destructive"
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
        <ZoruButton
          type="button"
          variant="pill"
          leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          onClick={addRow}
        >
          Add row
        </ZoruButton>

        <div className="min-w-[260px] rounded-lg border border-border bg-secondary p-4">
          <div className="flex items-center justify-between py-1 text-[13px] text-foreground">
            <span>Subtotal</span>
            <span className="font-medium">{fmt(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-[13px] text-foreground">
            <span>Tax</span>
            <span className="font-medium">{fmt(tax, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1 text-[13px] text-foreground">
            <ZoruLabel className="text-foreground">Discount</ZoruLabel>
            <ZoruInput
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => onDiscountChange(n(e.target.value))}
              className="h-8 w-24 rounded-lg border-border bg-card text-right text-[13px]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[14px] font-semibold text-foreground">
            <span>Total</span>
            <span>{fmt(total, currency)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel className="text-foreground">Notes</ZoruLabel>
          <ZoruTextarea
            rows={4}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
            placeholder="Internal or client-facing notes"
          />
        </div>
        <div>
          <ZoruLabel className="text-foreground">Terms &amp; Conditions</ZoruLabel>
          <ZoruTextarea
            rows={4}
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
            className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
            placeholder="Payment terms, delivery timeline, etc."
          />
        </div>
      </div>
    </div>
  );
}
