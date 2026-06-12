'use client';

/**
 * doc-surface — LineItemsEditor.
 *
 * The table editor every finance document form embeds: per-row item
 * picker (optional — free-text rows allowed), description, qty, rate,
 * tax %, discount %, computed line total, add / remove / reorder, and a
 * footer that rolls the lines up via the SHARED `finance-doc-math`
 * module (the same code the server action re-runs, so the preview can
 * never disagree with what gets saved).
 *
 * Keyboard friendly: every cell is a native input; ⏎ in the last row's
 * rate appends a fresh row; reorder buttons are real buttons.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, IconButton, Input } from '@/components/sabcrm/20ui';
import {
  computeDocGrandTotals,
  computeDocLine,
  isBlankDocLine,
  safeNum,
  signedNum,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import { EntityPicker } from './entity-picker';
import type { DocItemOption, DocLineDraft } from './types';

let rowSeq = 0;

/** A fresh blank row with a stable client-side key. */
export function blankDocLine(): DocLineDraft {
  rowSeq += 1;
  return {
    rowId: `ln-${Date.now().toString(36)}-${rowSeq}`,
    qty: 1,
    rate: 0,
    itemLabel: null,
  };
}

/** Format a number with 2 decimals for the computed cells. */
function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export interface LineItemsEditorProps {
  lines: DocLineDraft[];
  onChange: (lines: DocLineDraft[]) => void;
  currency: string;
  /** Item-catalog search; omit to make all rows free-text. */
  searchItems?: (q: string) => Promise<DocItemOption[]>;
  disabled?: boolean;
  /**
   * Compact HSN/SAC + unit inputs on rows WITHOUT a picked catalog item
   * (picked items keep sourcing both from the catalog and render them
   * as read-only sub-text).
   */
  lineExtras?: boolean;
  /**
   * Header totals modifiers (overall discount / shipping / adjustment /
   * round-off). Providing BOTH props enables the footer section and
   * folds the modifiers into the live total preview via the shared
   * `computeDocGrandTotals` — the same math the server persists.
   */
  modifiers?: DocTotalsModifiersInput;
  onModifiersChange?: (modifiers: DocTotalsModifiersInput) => void;
}

export function LineItemsEditor({
  lines,
  onChange,
  currency,
  searchItems,
  disabled = false,
  lineExtras = false,
  modifiers,
  onModifiersChange,
}: LineItemsEditorProps): React.JSX.Element {
  const itemCacheRef = React.useRef(new Map<string, DocItemOption>());

  const patchRow = (rowId: string, patch: Partial<DocLineDraft>): void => {
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)));
  };

  const removeRow = (rowId: string): void => {
    const next = lines.filter((l) => l.rowId !== rowId);
    onChange(next.length > 0 ? next : [blankDocLine()]);
  };

  const moveRow = (rowId: string, dir: -1 | 1): void => {
    const idx = lines.findIndex((l) => l.rowId === rowId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= lines.length) return;
    const next = [...lines];
    const [row] = next.splice(idx, 1);
    next.splice(target, 0, row);
    onChange(next);
  };

  const addRow = (): void => onChange([...lines, blankDocLine()]);

  const handleItemSearch = React.useCallback(
    async (q: string) => {
      if (!searchItems) return [];
      let results: DocItemOption[] = [];
      try {
        results = await searchItems(q);
      } catch {
        results = [];
      }
      for (const r of results) itemCacheRef.current.set(r.id, r);
      return results;
    },
    [searchItems],
  );

  const withModifiers = !!modifiers && !!onModifiersChange;
  const patchModifiers = (p: Partial<DocTotalsModifiersInput>): void =>
    onModifiersChange?.({ ...modifiers, ...p });

  const totals = computeDocGrandTotals(
    lines.filter((l) => !isBlankDocLine(l)),
    withModifiers ? modifiers : undefined,
  );

  return (
    <div className="fdoc-lines">
      <table>
        <colgroup>
          {searchItems ? <col className="fdoc-col--item" /> : null}
          <col />
          <col className="fdoc-col--qty" />
          <col className="fdoc-col--rate" />
          <col className="fdoc-col--pct" />
          <col className="fdoc-col--pct" />
          <col className="fdoc-col--amount" />
          <col className="fdoc-col--actions" />
        </colgroup>
        <thead>
          <tr>
            {searchItems ? <th>Item</th> : null}
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Disc %</th>
            <th>Tax %</th>
            <th className="is-num">Amount</th>
            <th>
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const computed = computeDocLine(line);
            const n = i + 1;
            return (
              <tr key={line.rowId}>
                {searchItems ? (
                  <td>
                    <EntityPicker
                      value={line.itemId ?? null}
                      valueLabel={line.itemLabel ?? null}
                      search={handleItemSearch}
                      placeholder="Catalog item…"
                      emptyText="No items"
                      disabled={disabled}
                      aria-label={`Line ${n} item`}
                      onChange={(opt) => {
                        if (!opt) {
                          patchRow(line.rowId, {
                            itemId: undefined,
                            itemLabel: null,
                          });
                          return;
                        }
                        const item = itemCacheRef.current.get(opt.id);
                        patchRow(line.rowId, {
                          itemId: opt.id,
                          itemLabel: opt.label,
                          description:
                            line.description?.trim() ||
                            item?.description ||
                            opt.label,
                          rate:
                            safeNum(line.rate) > 0
                              ? line.rate
                              : (item?.rate ?? 0),
                          taxRatePct: line.taxRatePct ?? item?.taxRatePct,
                          hsnSac: line.hsnSac ?? item?.hsnSac,
                          unit: line.unit ?? item?.unit,
                        });
                      }}
                    />
                  </td>
                ) : null}
                <td>
                  <Input
                    value={line.description ?? ''}
                    onChange={(e) =>
                      patchRow(line.rowId, { description: e.target.value })
                    }
                    placeholder="Description"
                    disabled={disabled}
                    aria-label={`Line ${n} description`}
                  />
                  {lineExtras && !line.itemId ? (
                    <span className="fdoc-lines__extras">
                      <Input
                        value={line.hsnSac ?? ''}
                        onChange={(e) =>
                          patchRow(line.rowId, {
                            hsnSac: e.target.value || undefined,
                          })
                        }
                        placeholder="HSN/SAC"
                        disabled={disabled}
                        aria-label={`Line ${n} HSN or SAC code`}
                      />
                      <Input
                        value={line.unit ?? ''}
                        onChange={(e) =>
                          patchRow(line.rowId, {
                            unit: e.target.value || undefined,
                          })
                        }
                        placeholder="Unit (nos, kg…)"
                        disabled={disabled}
                        aria-label={`Line ${n} unit of measure`}
                      />
                    </span>
                  ) : lineExtras && (line.hsnSac || line.unit) ? (
                    <span className="fdoc-cell-sub">
                      {[
                        line.hsnSac ? `HSN/SAC ${line.hsnSac}` : null,
                        line.unit || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={String(line.qty ?? '')}
                    onChange={(e) =>
                      patchRow(line.rowId, { qty: safeNum(e.target.value) })
                    }
                    disabled={disabled}
                    aria-label={`Line ${n} quantity`}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={String(line.rate ?? '')}
                    onChange={(e) =>
                      patchRow(line.rowId, { rate: safeNum(e.target.value) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && i === lines.length - 1) {
                        e.preventDefault();
                        addRow();
                      }
                    }}
                    disabled={disabled}
                    aria-label={`Line ${n} rate`}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.discountPct === undefined ? '' : String(line.discountPct)}
                    onChange={(e) =>
                      patchRow(line.rowId, {
                        discountPct:
                          e.target.value === ''
                            ? undefined
                            : Math.min(safeNum(e.target.value), 100),
                      })
                    }
                    placeholder="0"
                    disabled={disabled}
                    aria-label={`Line ${n} discount percent`}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={line.taxRatePct === undefined ? '' : String(line.taxRatePct)}
                    onChange={(e) =>
                      patchRow(line.rowId, {
                        taxRatePct:
                          e.target.value === ''
                            ? undefined
                            : safeNum(e.target.value),
                      })
                    }
                    placeholder="0"
                    disabled={disabled}
                    aria-label={`Line ${n} tax percent`}
                  />
                </td>
                <td className="fdoc-lines__total" aria-label={`Line ${n} amount`}>
                  {fmt(computed.total, currency)}
                </td>
                <td>
                  <span className="fdoc-lines__rowactions">
                    <IconButton
                      label={`Move line ${n} up`}
                      icon={ArrowUp}
                      size="sm"
                      disabled={disabled || i === 0}
                      onClick={() => moveRow(line.rowId, -1)}
                    />
                    <IconButton
                      label={`Move line ${n} down`}
                      icon={ArrowDown}
                      size="sm"
                      disabled={disabled || i === lines.length - 1}
                      onClick={() => moveRow(line.rowId, 1)}
                    />
                    <IconButton
                      label={`Remove line ${n}`}
                      icon={Trash2}
                      size="sm"
                      disabled={disabled}
                      onClick={() => removeRow(line.rowId)}
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
          Add line
        </Button>

        <dl className="fdoc-totals" aria-live="polite">
          <dt className="fdoc-totals__label">Subtotal</dt>
          <dd className="fdoc-totals__value">{fmt(totals.subTotal, currency)}</dd>
          {totals.discountTotal > 0 ? (
            <>
              <dt className="fdoc-totals__label">Line discounts</dt>
              <dd className="fdoc-totals__value">
                −{fmt(totals.discountTotal, currency)}
              </dd>
            </>
          ) : null}
          <dt className="fdoc-totals__label">Tax</dt>
          <dd className="fdoc-totals__value">{fmt(totals.taxTotal, currency)}</dd>
          {withModifiers ? (
            <>
              <dt className="fdoc-totals__label">
                <label htmlFor="fdoc-mod-discount">Overall discount</label>
              </dt>
              <dd className="fdoc-totals__value">
                <Input
                  id="fdoc-mod-discount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="fdoc-totals__input"
                  value={
                    modifiers?.discountOverall === undefined
                      ? ''
                      : String(modifiers.discountOverall)
                  }
                  onChange={(e) =>
                    patchModifiers({
                      discountOverall:
                        e.target.value === ''
                          ? undefined
                          : safeNum(e.target.value),
                    })
                  }
                  placeholder="0.00"
                  disabled={disabled}
                />
              </dd>
              <dt className="fdoc-totals__label">
                <label htmlFor="fdoc-mod-shipping">Shipping</label>
              </dt>
              <dd className="fdoc-totals__value">
                <Input
                  id="fdoc-mod-shipping"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="fdoc-totals__input"
                  value={
                    modifiers?.shippingCharge === undefined
                      ? ''
                      : String(modifiers.shippingCharge)
                  }
                  onChange={(e) =>
                    patchModifiers({
                      shippingCharge:
                        e.target.value === ''
                          ? undefined
                          : safeNum(e.target.value),
                    })
                  }
                  placeholder="0.00"
                  disabled={disabled}
                />
              </dd>
              <dt className="fdoc-totals__label">
                <label htmlFor="fdoc-mod-adjustment">Adjustment</label>
              </dt>
              <dd className="fdoc-totals__value">
                <Input
                  id="fdoc-mod-adjustment"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="fdoc-totals__input"
                  value={
                    modifiers?.adjustment === undefined
                      ? ''
                      : String(modifiers.adjustment)
                  }
                  onChange={(e) =>
                    patchModifiers({
                      adjustment:
                        e.target.value === ''
                          ? undefined
                          : signedNum(e.target.value),
                    })
                  }
                  placeholder="±0.00"
                  disabled={disabled}
                />
              </dd>
              <dt className="fdoc-totals__label">
                <Checkbox
                  size="sm"
                  label="Round off"
                  checked={!!modifiers?.roundOff}
                  onChange={(e) =>
                    patchModifiers({ roundOff: e.target.checked })
                  }
                  disabled={disabled}
                />
              </dt>
              <dd className="fdoc-totals__value">
                {totals.roundOff !== 0
                  ? `${totals.roundOff > 0 ? '+' : '−'}${fmt(Math.abs(totals.roundOff), currency)}`
                  : '—'}
              </dd>
            </>
          ) : null}
          <div className="fdoc-totals__grand">
            <dt className="fdoc-totals__label">Total</dt>
            <dd className="fdoc-totals__value">
              {fmt(withModifiers ? totals.grandTotal : totals.total, currency)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
