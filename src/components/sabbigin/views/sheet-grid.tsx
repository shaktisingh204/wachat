'use client';

/**
 * SabBigin sheet view — a keyboard-first editable grid over deals.
 *
 * Deliberately NOT a spreadsheet engine (no formulas/ranges — that's SabSheet's
 * job; an "Open in SabSheet" export is the power escape hatch). Click a cell to
 * edit; Enter/Tab commits and advances; Escape cancels. Each commit optimistic
 * + persisted via a server action. Stage edits route through governance.
 */

import React from 'react';
import { useRouter } from 'next/navigation';

import { Card, toast } from '@/components/sabcrm/20ui';
import {
  patchSabbiginDeal,
  moveSabbiginDealStage,
} from '@/app/actions/sabbigin-deals.actions';
import type { SabDealRow, SabStage } from '@/components/sabbigin/lib/types';

type Col = {
  key: keyof SabDealRow;
  label: string;
  type: 'text' | 'number' | 'date' | 'stage';
  align?: 'right';
};

const COLS: Col[] = [
  { key: 'name', label: 'Deal', type: 'text' },
  { key: 'stage', label: 'Stage', type: 'stage' },
  { key: 'amount', label: 'Value', type: 'number', align: 'right' },
  { key: 'probability', label: 'Prob %', type: 'number', align: 'right' },
  { key: 'expectedClose', label: 'Close date', type: 'date' },
  { key: 'contactName', label: 'Contact', type: 'text' },
];

function toInputValue(col: Col, row: SabDealRow): string {
  const v = row[col.key];
  if (v == null) return '';
  if (col.type === 'date') {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  return String(v);
}

export function SheetGrid({
  deals: initial,
  stages,
  currency = 'INR',
}: {
  deals: SabDealRow[];
  stages: SabStage[];
  currency?: string;
}) {
  const router = useRouter();
  const [deals, setDeals] = React.useState(initial);
  const [editing, setEditing] = React.useState<{ row: number; col: number } | null>(null);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => setDeals(initial), [initial]);

  function startEdit(row: number, col: number) {
    if (COLS[col].key === 'contactName') return; // read-only here
    setEditing({ row, col });
    setDraft(toInputValue(COLS[col], deals[row]));
  }

  async function commit() {
    if (!editing) return;
    const col = COLS[editing.col];
    const deal = deals[editing.row];
    const value = draft;
    setEditing(null);

    if (col.key === 'contactName') return;

    // optimistic
    setDeals((cur) =>
      cur.map((d, i) =>
        i === editing.row
          ? {
              ...d,
              [col.key]:
                col.type === 'number' ? Number(value) || 0 : value,
            }
          : d,
      ),
    );

    if (col.key === 'stage') {
      const res = await moveSabbiginDealStage(deal._id, value);
      if (!res.success) {
        setDeals(initial);
        toast.warning({
          title: res.pendingApproval ? 'Sent for approval' : 'Could not move',
          description: res.error,
        });
      }
      router.refresh();
      return;
    }

    const patchKey = col.key === 'amount' ? 'value' : col.key === 'expectedClose' ? 'closeDate' : col.key;
    const res = await patchSabbiginDeal(deal._id, {
      [patchKey]: col.type === 'number' ? Number(value) || 0 : value,
    } as Record<string, string | number>);
    if (!res.success) {
      toast.error({ title: 'Update failed', description: res.error });
      setDeals(initial);
    }
  }

  return (
    <Card padding="none" className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--st-border)] bg-[var(--st-surface-2,rgba(0,0,0,0.02))]">
            {COLS.map((c) => (
              <th
                key={String(c.key)}
                className={`px-3 py-2 text-left text-xs font-semibold text-[var(--st-text-secondary)] ${
                  c.align === 'right' ? 'text-right' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((row, r) => (
            <tr key={row._id} className="border-b border-[var(--st-border)] last:border-0">
              {COLS.map((c, ci) => {
                const isEditing = editing?.row === r && editing?.col === ci;
                return (
                  <td
                    key={String(c.key)}
                    className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                      c.key === 'contactName' ? '' : 'cursor-text'
                    }`}
                    onClick={() => !isEditing && startEdit(r, ci)}
                  >
                    {isEditing ? (
                      c.type === 'stage' ? (
                        <select
                          autoFocus
                          className="u-input u-input--sm w-full"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                          className="u-input u-input--sm w-full"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      )
                    ) : c.type === 'number' && c.key === 'amount' ? (
                      row.amount != null
                        ? new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: row.currency || currency,
                            maximumFractionDigits: 0,
                          }).format(row.amount)
                        : '—'
                    ) : (
                      String(row[c.key] ?? '—')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
