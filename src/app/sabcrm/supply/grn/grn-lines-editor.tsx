'use client';

/**
 * SabCRM Supply — bespoke GRN lines editor (rollout WI-6).
 *
 * The kit `LineItemsEditor` is rate/tax-shaped and cannot model a goods
 * receipt's ordered/received/accepted/rejected quartet + batch / expiry /
 * serials, so GRN lines get this dedicated editor (rendered inside the
 * DocForm via `config.extraFields`, with `hideLines` on).
 *
 * Each row carries a REAL picked catalog item (EntityPicker over the
 * items mount — never a free-text id), the four quantity columns (the
 * action enforces `accepted + rejected ≤ received`), an optional batch +
 * expiry for batch-tracked SKUs, and a comma/Enter serial-number tag
 * input for serialised SKUs.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  Button,
  Field,
  IconButton,
  Input,
  Tag,
} from '@/components/sabcrm/20ui';
import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface';
import { searchSabcrmSupplyItemOptions } from '@/app/actions/sabcrm-supply-docs.actions';
import type { SabcrmGrnLineInput } from '@/app/actions/sabcrm-supply-grn.actions.types';

/** A GRN line draft with a stable client-side row key + item label cache. */
export interface GrnLineDraft extends SabcrmGrnLineInput {
  rowId: string;
  itemLabel: string | null;
}

let seq = 0;
export function blankGrnLine(): GrnLineDraft {
  seq += 1;
  return {
    rowId: `grn-${Date.now().toString(36)}-${seq}`,
    itemId: '',
    itemLabel: null,
    orderedQty: 0,
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    batch: '',
    expiry: '',
    serialNos: [],
  };
}

function numOrZero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export interface GrnLinesEditorProps {
  lines: GrnLineDraft[];
  onChange: (lines: GrnLineDraft[]) => void;
  disabled?: boolean;
}

export function GrnLinesEditor({
  lines,
  onChange,
  disabled = false,
}: GrnLinesEditorProps): React.JSX.Element {
  const update = (rowId: string, patch: Partial<GrnLineDraft>): void => {
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)));
  };
  const remove = (rowId: string): void => {
    const next = lines.filter((l) => l.rowId !== rowId);
    onChange(next.length > 0 ? next : [blankGrnLine()]);
  };
  const add = (): void => onChange([...lines, blankGrnLine()]);

  const [serialDrafts, setSerialDrafts] = React.useState<
    Record<string, string>
  >({});

  const commitSerial = (line: GrnLineDraft): void => {
    const raw = serialDrafts[line.rowId] ?? '';
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const existing = new Set(line.serialNos ?? []);
    const merged = [...(line.serialNos ?? [])];
    for (const p of parts) {
      if (!existing.has(p)) {
        merged.push(p);
        existing.add(p);
      }
    }
    update(line.rowId, { serialNos: merged });
    setSerialDrafts((d) => ({ ...d, [line.rowId]: '' }));
  };

  const removeSerial = (line: GrnLineDraft, serial: string): void => {
    update(line.rowId, {
      serialNos: (line.serialNos ?? []).filter((s) => s !== serial),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {lines.map((line) => {
        const overReceived =
          (line.acceptedQty ?? 0) + (line.rejectedQty ?? 0) >
          (line.receivedQty ?? 0) + 1e-6;
        return (
          <div
            key={line.rowId}
            className="rounded-[var(--st-radius-md,8px)] border border-[var(--st-border)] p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Field label="Item" required>
                  <EntityPicker
                    value={line.itemId || null}
                    valueLabel={line.itemLabel}
                    search={async (q) => {
                      const res = await searchSabcrmSupplyItemOptions(q);
                      return res.ok ? res.data : [];
                    }}
                    placeholder="Search items…"
                    disabled={disabled}
                    onChange={(opt) =>
                      update(line.rowId, {
                        itemId: opt?.id ?? '',
                        itemLabel: opt?.label ?? null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="pt-7">
                <IconButton
                  label="Remove line"
                  icon={Trash2}
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => remove(line.rowId)}
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Ordered">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={String(line.orderedQty ?? 0)}
                  onChange={(e) =>
                    update(line.rowId, { orderedQty: numOrZero(e.target.value) })
                  }
                  disabled={disabled}
                />
              </Field>
              <Field label="Received">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={String(line.receivedQty ?? 0)}
                  onChange={(e) =>
                    update(line.rowId, {
                      receivedQty: numOrZero(e.target.value),
                    })
                  }
                  disabled={disabled}
                />
              </Field>
              <Field label="Accepted">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={String(line.acceptedQty ?? 0)}
                  onChange={(e) =>
                    update(line.rowId, {
                      acceptedQty: numOrZero(e.target.value),
                    })
                  }
                  invalid={overReceived}
                  disabled={disabled}
                />
              </Field>
              <Field label="Rejected">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={String(line.rejectedQty ?? 0)}
                  onChange={(e) =>
                    update(line.rowId, {
                      rejectedQty: numOrZero(e.target.value),
                    })
                  }
                  invalid={overReceived}
                  disabled={disabled}
                />
              </Field>
            </div>

            {overReceived ? (
              <p className="mt-1 text-xs text-[var(--st-danger,#dc2626)]">
                Accepted + rejected can&apos;t exceed received.
              </p>
            ) : null}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Batch" help="Batch / lot no. (optional).">
                <Input
                  value={line.batch ?? ''}
                  onChange={(e) => update(line.rowId, { batch: e.target.value })}
                  placeholder="LOT-001"
                  disabled={disabled}
                />
              </Field>
              <Field label="Expiry">
                <Input
                  type="date"
                  value={(line.expiry ?? '').slice(0, 10)}
                  onChange={(e) =>
                    update(line.rowId, { expiry: e.target.value })
                  }
                  disabled={disabled}
                />
              </Field>
            </div>

            <Field
              label="Serial numbers"
              help="Comma or Enter to add — for serialised SKUs."
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {(line.serialNos ?? []).map((serial) => (
                  <Tag
                    key={serial}
                    onRemove={
                      disabled ? undefined : () => removeSerial(line, serial)
                    }
                  >
                    {serial}
                  </Tag>
                ))}
                <Input
                  value={serialDrafts[line.rowId] ?? ''}
                  onChange={(e) =>
                    setSerialDrafts((d) => ({
                      ...d,
                      [line.rowId]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      commitSerial(line);
                    }
                  }}
                  onBlur={() => commitSerial(line)}
                  placeholder="SN-0001"
                  disabled={disabled}
                />
              </div>
            </Field>
          </div>
        );
      })}

      <div>
        <Button
          type="button"
          variant="ghost"
          iconLeft={Plus}
          onClick={add}
          disabled={disabled}
        >
          Add line
        </Button>
      </div>
    </div>
  );
}
