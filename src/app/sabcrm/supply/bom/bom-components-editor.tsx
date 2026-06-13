'use client';

/**
 * SabCRM Supply — bespoke BOM / production components editor
 * (rollout WI-10 + reused by WI-11).
 *
 * The kit `LineItemsEditor` lacks scrap %, optional and per-unit-cost
 * columns, so BOM components (and production-order components) get this
 * dedicated editor. Each row carries an optional REAL catalog item
 * (EntityPicker over the items mount — picking fills both itemId AND
 * itemName), a free-text name fallback, qty + unit, scrap %, an optional
 * switch (BOM only) and a per-unit cost. A live material-cost preview
 * rolls up Σ qty×costPerUnit.
 *
 * `showOptional={false}` for production orders (the crate component has
 * no `optional` flag).
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  Button,
  Field,
  IconButton,
  Input,
  Switch,
} from '@/components/sabcrm/20ui';
import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface';
import { searchSabcrmSupplyItemOptions } from '@/app/actions/sabcrm-supply-docs.actions';

/** A component draft with a stable client-side row key. */
export interface BomComponentDraft {
  rowId: string;
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct?: number;
  optional?: boolean;
  costPerUnit?: number;
}

let seq = 0;
export function blankBomComponent(): BomComponentDraft {
  seq += 1;
  return {
    rowId: `cmp-${Date.now().toString(36)}-${seq}`,
    itemId: undefined,
    itemName: '',
    qty: 1,
    unit: 'unit',
    scrapPct: undefined,
    optional: false,
    costPerUnit: undefined,
  };
}

function numOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function fmtMoney(n: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `INR ${n.toFixed(2)}`;
  }
}

export interface BomComponentsEditorProps {
  components: BomComponentDraft[];
  onChange: (components: BomComponentDraft[]) => void;
  disabled?: boolean;
  /** Render the "Optional" switch (BOM only — production orders omit it). */
  showOptional?: boolean;
}

export function BomComponentsEditor({
  components,
  onChange,
  disabled = false,
  showOptional = true,
}: BomComponentsEditorProps): React.JSX.Element {
  const update = (rowId: string, patch: Partial<BomComponentDraft>): void => {
    onChange(
      components.map((c) => (c.rowId === rowId ? { ...c, ...patch } : c)),
    );
  };
  const remove = (rowId: string): void => {
    const next = components.filter((c) => c.rowId !== rowId);
    onChange(next.length > 0 ? next : [blankBomComponent()]);
  };
  const add = (): void => onChange([...components, blankBomComponent()]);

  const materialCost = components.reduce(
    (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {components.map((c) => (
        <div
          key={c.rowId}
          className="rounded-[var(--st-radius-md,8px)] border border-[var(--st-border)] p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Field label="Component item" help="Pick a catalog item or type a name.">
                <EntityPicker
                  value={c.itemId || null}
                  valueLabel={c.itemId ? c.itemName : null}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyItemOptions(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search items…"
                  disabled={disabled}
                  onChange={(opt) =>
                    update(c.rowId, {
                      itemId: opt?.id ?? undefined,
                      itemName: opt?.label ?? c.itemName,
                    })
                  }
                />
              </Field>
            </div>
            <div className="pt-7">
              <IconButton
                label="Remove component"
                icon={Trash2}
                variant="ghost"
                disabled={disabled}
                onClick={() => remove(c.rowId)}
              />
            </div>
          </div>

          <Field label="Component name" required>
            <Input
              value={c.itemName}
              onChange={(e) => update(c.rowId, { itemName: e.target.value })}
              placeholder="Steel sheet 2mm"
              disabled={disabled}
            />
          </Field>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Qty" required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={String(c.qty ?? 0)}
                onChange={(e) =>
                  update(c.rowId, { qty: Number(e.target.value) || 0 })
                }
                disabled={disabled}
              />
            </Field>
            <Field label="Unit" required>
              <Input
                value={c.unit ?? ''}
                onChange={(e) => update(c.rowId, { unit: e.target.value })}
                placeholder="kg"
                disabled={disabled}
              />
            </Field>
            <Field label="Scrap %">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={c.scrapPct === undefined ? '' : String(c.scrapPct)}
                onChange={(e) =>
                  update(c.rowId, { scrapPct: numOrUndef(e.target.value) })
                }
                placeholder="0"
                disabled={disabled}
              />
            </Field>
            <Field label="Cost / unit">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={c.costPerUnit === undefined ? '' : String(c.costPerUnit)}
                onChange={(e) =>
                  update(c.rowId, { costPerUnit: numOrUndef(e.target.value) })
                }
                placeholder="0.00"
                disabled={disabled}
              />
            </Field>
          </div>

          {showOptional ? (
            <div className="mt-2 flex items-center gap-2">
              <Switch
                checked={Boolean(c.optional)}
                onCheckedChange={(next) =>
                  update(c.rowId, { optional: next })
                }
                disabled={disabled}
                aria-label="Optional component"
              />
              <span className="text-sm text-[var(--st-text-secondary)]">
                Optional component
              </span>
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          iconLeft={Plus}
          onClick={add}
          disabled={disabled}
        >
          Add component
        </Button>
        <span className="text-sm text-[var(--st-text-secondary)]">
          Material cost {fmtMoney(materialCost)}
        </span>
      </div>
    </div>
  );
}
