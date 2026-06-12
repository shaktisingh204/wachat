'use client';

/**
 * doc-surface — JournalLinesEditor.
 *
 * The debit/credit legs editor for voucher entries (journal entries):
 *
 *   - two stacked tables (Debits / Credits), each row = ledger-account
 *     EntityPicker (chart of accounts) + amount + optional description;
 *   - add / remove row per side (each side keeps at least one row);
 *   - footer shows `totalDebit`, `totalCredit` and a live
 *     balanced/unbalanced badge (the Rust create handler enforces the
 *     same ±0.01 balance rule and 400s otherwise).
 *
 * Rows map 1:1 onto the wire `debitEntries[]` / `creditEntries[]`
 * (`{accountId, amount, description?}`) — the consuming surface drops
 * rows without a picked account on submit.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, IconButton, Input } from '@/components/sabcrm/20ui';
import { round2, safeNum } from '@/lib/sabcrm/finance-doc-math';
import { EntityPicker } from './entity-picker';
import type { DocEntityOption } from './types';

import './doc-surface.css';

let legSeq = 0;

/** One debit/credit leg (client-side identity + picked-account label). */
export interface JournalLeg {
  /** Stable client-side row key. */
  rowId: string;
  /** Ledger account id (chart of accounts) or null while unpicked. */
  accountId: string | null;
  /** Display label of the picked account (never an ObjectId). */
  accountLabel: string | null;
  amount: number;
  description?: string;
}

/** A fresh blank leg with a stable client-side key. */
export function blankJournalLeg(): JournalLeg {
  legSeq += 1;
  return {
    rowId: `jl-${Date.now().toString(36)}-${legSeq}`,
    accountId: null,
    accountLabel: null,
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

export interface JournalLinesEditorProps {
  debits: JournalLeg[];
  credits: JournalLeg[];
  onChange: (next: { debits: JournalLeg[]; credits: JournalLeg[] }) => void;
  /** Ledger-account search (chart of accounts). */
  searchAccounts: (q: string) => Promise<DocEntityOption[]>;
  currency: string;
  disabled?: boolean;
}

interface LegTableProps {
  side: 'Debit' | 'Credit';
  legs: JournalLeg[];
  onLegsChange: (legs: JournalLeg[]) => void;
  searchAccounts: (q: string) => Promise<DocEntityOption[]>;
  disabled: boolean;
}

function LegTable({
  side,
  legs,
  onLegsChange,
  searchAccounts,
  disabled,
}: LegTableProps): React.JSX.Element {
  const patchLeg = (rowId: string, patch: Partial<JournalLeg>): void => {
    onLegsChange(
      legs.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)),
    );
  };

  const removeLeg = (rowId: string): void => {
    const next = legs.filter((l) => l.rowId !== rowId);
    onLegsChange(next.length > 0 ? next : [blankJournalLeg()]);
  };

  const addLeg = (): void => onLegsChange([...legs, blankJournalLeg()]);

  return (
    <div className="fdoc-journal__section">
      <h4 className="fdoc-journal__heading">{side}s</h4>
      <table>
        <colgroup>
          <col className="fdoc-col--doc" />
          <col />
          <col className="fdoc-col--rate" />
          <col className="fdoc-col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Account</th>
            <th>Description</th>
            <th className="is-num">Amount</th>
            <th>
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const n = i + 1;
            return (
              <tr key={leg.rowId}>
                <td>
                  <EntityPicker
                    value={leg.accountId}
                    valueLabel={leg.accountLabel}
                    search={searchAccounts}
                    placeholder="Ledger account…"
                    emptyText="No accounts"
                    disabled={disabled}
                    aria-label={`${side} ${n} account`}
                    onChange={(opt) =>
                      patchLeg(leg.rowId, {
                        accountId: opt?.id ?? null,
                        accountLabel: opt?.label ?? null,
                      })
                    }
                  />
                </td>
                <td>
                  <Input
                    value={leg.description ?? ''}
                    onChange={(e) =>
                      patchLeg(leg.rowId, {
                        description: e.target.value || undefined,
                      })
                    }
                    placeholder="Description"
                    disabled={disabled}
                    aria-label={`${side} ${n} description`}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={String(leg.amount ?? '')}
                    onChange={(e) =>
                      patchLeg(leg.rowId, { amount: safeNum(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === legs.length - 1) {
                        e.preventDefault();
                        addLeg();
                      }
                    }}
                    disabled={disabled}
                    aria-label={`${side} ${n} amount`}
                  />
                </td>
                <td>
                  <span className="fdoc-lines__rowactions">
                    <IconButton
                      label={`Remove ${side.toLowerCase()} ${n}`}
                      icon={Trash2}
                      size="sm"
                      disabled={disabled}
                      onClick={() => removeLeg(leg.rowId)}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="fdoc-journal__add">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          onClick={addLeg}
          disabled={disabled}
        >
          Add {side.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

export function JournalLinesEditor({
  debits,
  credits,
  onChange,
  searchAccounts,
  currency,
  disabled = false,
}: JournalLinesEditorProps): React.JSX.Element {
  const totalDebit = round2(
    debits.reduce((sum, l) => sum + safeNum(l.amount), 0),
  );
  const totalCredit = round2(
    credits.reduce((sum, l) => sum + safeNum(l.amount), 0),
  );
  // Same rule the Rust create handler enforces (±0.01), plus "something
  // was actually entered" so an empty form doesn't read as balanced.
  const balanced =
    Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  return (
    <div className="fdoc-lines fdoc-journal">
      <LegTable
        side="Debit"
        legs={debits}
        onLegsChange={(next) => onChange({ debits: next, credits })}
        searchAccounts={searchAccounts}
        disabled={disabled}
      />
      <LegTable
        side="Credit"
        legs={credits}
        onLegsChange={(next) => onChange({ debits, credits: next })}
        searchAccounts={searchAccounts}
        disabled={disabled}
      />

      <div className="fdoc-lines__footer">
        <Badge tone={balanced ? 'success' : 'warning'} dot>
          {balanced ? 'Balanced' : 'Unbalanced'}
        </Badge>
        <dl className="fdoc-totals" aria-live="polite">
          <dt className="fdoc-totals__label">Total debit</dt>
          <dd className="fdoc-totals__value">{fmt(totalDebit, currency)}</dd>
          <dt className="fdoc-totals__label">Total credit</dt>
          <dd className="fdoc-totals__value">{fmt(totalCredit, currency)}</dd>
          <div className="fdoc-totals__grand">
            <dt className="fdoc-totals__label">Difference</dt>
            <dd className="fdoc-totals__value">
              {fmt(round2(totalDebit - totalCredit), currency)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
