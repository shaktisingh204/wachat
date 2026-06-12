'use client';

/**
 * doc-surface — AllocationsEditor.
 *
 * The "apply this money to documents" table used by payment receipts
 * (receipt → invoices) and payouts (payout → bills):
 *
 *   - one row per target document: async EntityPicker over OPEN
 *     invoices / bills (the option's meta line shows the balance) plus
 *     an amount input;
 *   - add / remove row buttons (the table never collapses below one
 *     row);
 *   - footer summary "Allocated ₹X of ₹Y — ₹Z unallocated" (flips to an
 *     over-allocated warning when Σ rows exceeds the total), kept live
 *     via `aria-live`.
 *
 * The rows map 1:1 onto the wire `applyTo: {invoiceId|billId, amount}[]`
 * — the consuming surface filters out rows without a picked doc and
 * renames `docId` to its entity key on submit.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Input } from '@/components/sabcrm/20ui';
import { round2, safeNum } from '@/lib/sabcrm/finance-doc-math';
import { EntityPicker } from './entity-picker';
import type { DocEntityOption } from './types';

import './doc-surface.css';

let allocSeq = 0;

/** One allocation row (client-side identity + picked-doc label cache). */
export interface AllocationRow {
  /** Stable client-side row key. */
  rowId: string;
  /** Target document id (invoice / bill) or null while unpicked. */
  docId: string | null;
  /** Display label of the picked document (never an ObjectId). */
  docLabel: string | null;
  /** Open balance of the picked document, when the consumer knows it. */
  openBalance?: number;
  /** Amount applied to this document. */
  amount: number;
}

/** A fresh blank allocation row with a stable client-side key. */
export function blankAllocationRow(): AllocationRow {
  allocSeq += 1;
  return {
    rowId: `al-${Date.now().toString(36)}-${allocSeq}`,
    docId: null,
    docLabel: null,
    amount: 0,
  };
}

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export interface AllocationsEditorProps {
  rows: AllocationRow[];
  onChange: (rows: AllocationRow[]) => void;
  currency: string;
  /** Searches open documents (invoices / bills). Option.meta shows balance. */
  searchDocs: (q: string) => Promise<DocEntityOption[]>;
  /** Column heading + picker copy: "Invoice" | "Bill". */
  docLabel: string;
  /** Total being allocated — renders allocated vs unallocated summary line. */
  totalAmount: number;
  disabled?: boolean;
}

export function AllocationsEditor({
  rows,
  onChange,
  currency,
  searchDocs,
  docLabel,
  totalAmount,
  disabled = false,
}: AllocationsEditorProps): React.JSX.Element {
  const patchRow = (rowId: string, patch: Partial<AllocationRow>): void => {
    onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const removeRow = (rowId: string): void => {
    const next = rows.filter((r) => r.rowId !== rowId);
    onChange(next.length > 0 ? next : [blankAllocationRow()]);
  };

  const addRow = (): void => onChange([...rows, blankAllocationRow()]);

  const docLower = docLabel.toLowerCase();
  const allocated = round2(rows.reduce((sum, r) => sum + safeNum(r.amount), 0));
  const unallocated = round2(totalAmount - allocated);
  const over = unallocated < 0;

  return (
    <div className="fdoc-lines">
      <table>
        <colgroup>
          <col className="fdoc-col--doc" />
          <col className="fdoc-col--rate" />
          <col className="fdoc-col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th>{docLabel}</th>
            <th className="is-num">Amount</th>
            <th>
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const n = i + 1;
            return (
              <tr key={row.rowId}>
                <td>
                  <EntityPicker
                    value={row.docId}
                    valueLabel={row.docLabel}
                    search={searchDocs}
                    placeholder={`Open ${docLower}…`}
                    emptyText={`No open ${docLower}s`}
                    disabled={disabled}
                    aria-label={`Allocation ${n} ${docLower}`}
                    onChange={(opt) =>
                      patchRow(row.rowId, {
                        docId: opt?.id ?? null,
                        docLabel: opt?.label ?? null,
                        // The cached balance belongs to the previous pick.
                        openBalance: undefined,
                      })
                    }
                  />
                  {row.openBalance !== undefined ? (
                    <span className="fdoc-cell-sub">
                      Open balance {fmt(row.openBalance, currency)}
                    </span>
                  ) : null}
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={String(row.amount ?? '')}
                    onChange={(e) =>
                      patchRow(row.rowId, { amount: safeNum(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === rows.length - 1) {
                        e.preventDefault();
                        addRow();
                      }
                    }}
                    disabled={disabled}
                    aria-label={`Allocation ${n} amount`}
                  />
                </td>
                <td>
                  <span className="fdoc-lines__rowactions">
                    <IconButton
                      label={`Remove allocation ${n}`}
                      icon={Trash2}
                      size="sm"
                      disabled={disabled}
                      onClick={() => removeRow(row.rowId)}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="fdoc-lines__footer">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          onClick={addRow}
          disabled={disabled}
        >
          Add {docLower}
        </Button>

        <p
          className={[
            'fdoc-alloc__summary',
            over && 'fdoc-alloc__summary--over',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-live="polite"
        >
          Allocated {fmt(allocated, currency)} of {fmt(totalAmount, currency)}{' '}
          —{' '}
          {over
            ? `${fmt(Math.abs(unallocated), currency)} over-allocated`
            : `${fmt(unallocated, currency)} unallocated`}
        </p>
      </div>
    </div>
  );
}
