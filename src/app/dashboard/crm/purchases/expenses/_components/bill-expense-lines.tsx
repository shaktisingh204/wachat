'use client';

import { Button, Card, Input } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

/**
 * <BillExpenseLines> — direct-to-ledger expense rows for `<BillForm>`.
 *
 * Used when a bill is for non-inventory spend (rent, utilities, fees).
 * Each row: account picker + project picker + description + amount +
 * tax %. Totals roll up into the summary card.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { CrmBillExpenseLine } from '@/lib/rust-client/crm-bills';

export interface ExpenseLineRow extends CrmBillExpenseLine {
  _key: string;
  projectId?: string;
}

interface BillExpenseLinesProps {
  rows: ExpenseLineRow[];
  currency: string;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onPatchRow: (key: string, patch: Partial<ExpenseLineRow>) => void;
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

export function BillExpenseLines({
  rows,
  currency,
  onAddRow,
  onRemoveRow,
  onPatchRow,
}: BillExpenseLinesProps) {
  return (
    <ZoruCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Expense lines
        </h3>
        <ZoruButton type="button" variant="outline" size="sm" onClick={onAddRow}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </ZoruButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-zoru-line">
        <table className="w-full text-[13px]">
          <thead className="bg-zoru-surface-2">
            <tr className="border-b border-zoru-line text-left">
              <th className="p-2 font-medium text-zoru-ink">Account</th>
              <th className="p-2 font-medium text-zoru-ink">Project</th>
              <th className="p-2 font-medium text-zoru-ink">Description</th>
              <th className="p-2 text-right font-medium text-zoru-ink">
                Amount
              </th>
              <th className="p-2 text-right font-medium text-zoru-ink">Tax %</th>
              <th className="p-2 text-right font-medium text-zoru-ink">Net</th>
              <th className="w-[40px] p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const amount = Number(row.amount) || 0;
              const taxPct = Number(row.taxRatePct) || 0;
              const net = amount * (1 + taxPct / 100);
              return (
                <tr
                  key={row._key}
                  className="border-b border-zoru-line last:border-b-0"
                >
                  <td className="min-w-[200px] p-2 align-top">
                    <EntityFormField
                      entity="account"
                      name={`__account_${row._key}`}
                      initialId={row.accountId ?? null}
                      onChange={(id) =>
                        onPatchRow(row._key, { accountId: id ?? undefined })
                      }
                    />
                  </td>
                  <td className="min-w-[180px] p-2 align-top">
                    <EntityFormField
                      entity="project"
                      name={`__project_${row._key}`}
                      initialId={row.projectId ?? null}
                      onChange={(id) =>
                        onPatchRow(row._key, { projectId: id ?? undefined })
                      }
                    />
                  </td>
                  <td className="min-w-[200px] p-2 align-top">
                    <ZoruInput
                      value={row.description ?? ''}
                      onChange={(e) =>
                        onPatchRow(row._key, { description: e.target.value })
                      }
                      placeholder="What was paid for?"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <ZoruInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.amount ?? 0}
                      onChange={(e) =>
                        onPatchRow(row._key, { amount: Number(e.target.value) })
                      }
                      className="w-32 text-right tabular-nums"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <ZoruInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.taxRatePct ?? ''}
                      onChange={(e) =>
                        onPatchRow(row._key, {
                          taxRatePct:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      className="w-20 text-right tabular-nums"
                      placeholder="0"
                    />
                  </td>
                  <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                    {fmtMoney(net, currency)}
                  </td>
                  <td className="p-2 align-top">
                    <ZoruButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveRow(row._key)}
                      disabled={rows.length <= 1}
                      className="text-zoru-danger-ink"
                      aria-label="Remove expense line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ZoruButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ZoruCard>
  );
}
