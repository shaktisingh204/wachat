'use client';

import { Button, Input } from '@/components/zoruui';
import { Plus, Trash2, Warehouse } from 'lucide-react';

/**
 * Upgraded Line-items table for `<SalesOrdersForm>` with self-contained
 * reactive warehouse stock trackers.
 */

import * as React from 'react';
import { getCrmProductById } from '@/app/actions/crm-products.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { LookupItem } from '@/lib/lookup-registry';

export interface SoLineRow {
  key: string;
  itemId?: string;
  description: string;
  hsnSac?: string;
  qty: number;
  rate: number;
  unit?: string;
  warehouseId?: string;
  taxRatePct?: number;
  qtyPending?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
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

export interface SoLineItemsTableProps {
  rows: SoLineRow[];
  currency: string;
  editing: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onPatch: (key: string, patch: Partial<SoLineRow>) => void;
  onItemPick: (key: string, id: string | null, hydrated?: LookupItem) => void;
}

export function SoLineItemsTable({
  rows,
  currency,
  editing,
  onAdd,
  onRemove,
  onPatch,
  onItemPick,
}: SoLineItemsTableProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface">
        <table className="w-full text-[13px]">
          <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
            <tr>
              <th className="p-2.5 font-medium">Item</th>
              <th className="p-2.5 font-medium">Description</th>
              <th className="w-[100px] p-2.5 text-right font-medium">Qty</th>
              <th className="min-w-[180px] p-2.5 font-medium">Warehouse</th>
              <th className="w-[120px] p-2.5 text-right font-medium">Unit price</th>
              <th className="w-[90px] p-2.5 text-right font-medium">Tax %</th>
              <th className="w-[120px] p-2.5 text-right font-medium">Line total</th>
              <th className="w-[40px] p-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SoLineItemRow
                key={row.key}
                row={row}
                rowsCount={rows.length}
                currency={currency}
                editing={editing}
                onRemove={onRemove}
                onPatch={onPatch}
                onItemPick={onItemPick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SoLineItemRowProps {
  row: SoLineRow;
  rowsCount: number;
  currency: string;
  editing: boolean;
  onRemove: (key: string) => void;
  onPatch: (key: string, patch: Partial<SoLineRow>) => void;
  onItemPick: (key: string, id: string | null, hydrated?: LookupItem) => void;
}

function SoLineItemRow({
  row,
  rowsCount,
  currency,
  editing,
  onRemove,
  onPatch,
  onItemPick,
}: SoLineItemRowProps) {
  const [warehouseStocks, setWarehouseStocks] = React.useState<Record<string, number>>({});
  const [loadingStocks, setLoadingStocks] = React.useState(false);

  React.useEffect(() => {
    if (!row.itemId) {
      setWarehouseStocks({});
      return;
    }

    let active = true;
    setLoadingStocks(true);
    getCrmProductById(row.itemId)
      .then((prod) => {
        if (!active) return;
        const stocks: Record<string, number> = {};
        if (prod?.inventory) {
          prod.inventory.forEach((inv) => {
            if (inv.warehouseId) {
              stocks[String(inv.warehouseId)] = inv.stock ?? 0;
            }
          });
        }
        setWarehouseStocks(stocks);
      })
      .catch((err) => {
        console.error('Failed to load item stocks:', err);
      })
      .finally(() => {
        if (active) setLoadingStocks(false);
      });

    return () => {
      active = false;
    };
  }, [row.itemId]);

  const sub = row.qty * row.rate;
  const tax = row.taxRatePct != null ? (sub * row.taxRatePct) / 100 : 0;
  const total = sub + tax;

  const currentWarehouseStock = row.warehouseId ? (warehouseStocks[row.warehouseId] ?? 0) : 0;
  const hasSufficientStock = !row.itemId || !row.warehouseId || currentWarehouseStock >= row.qty;

  return (
    <React.Fragment>
      <tr className="border-t border-zoru-line align-top">
        {/* Item Picker */}
        <td className="min-w-[200px] p-2">
          <EntityFormField
            entity="item"
            name={`row-${row.key}-itemId`}
            initialId={row.itemId ?? null}
            placeholder="Select item…"
            onChange={(id, hydrated) => onItemPick(row.key, id, hydrated)}
          />
        </td>

        {/* Description */}
        <td className="min-w-[180px] p-2">
          <Input
            value={row.description}
            onChange={(e) => onPatch(row.key, { description: e.target.value })}
            placeholder="Description"
            className="h-9 text-[12.5px]"
          />
        </td>

        {/* Quantity */}
        <td className="p-2">
          <Input
            type="number"
            step="any"
            min={0}
            value={Number.isFinite(row.qty) ? row.qty : ''}
            onChange={(e) => onPatch(row.key, { qty: Number(e.target.value) || 0 })}
            className="h-9 text-right text-[12.5px] tabular-nums"
          />
        </td>

        {/* Warehouse Selector & Stock Indicator */}
        <td className="p-2 min-w-[180px]">
          <div className="flex flex-col gap-1.5">
            <EntityFormField
              entity="warehouse"
              name={`row-${row.key}-warehouseId`}
              initialId={row.warehouseId ?? null}
              placeholder="Warehouse…"
              onChange={(id) => onPatch(row.key, { warehouseId: id ?? undefined })}
            />
            {row.itemId && row.warehouseId && (
              <div className="flex items-center gap-1 text-[11px] px-1 py-0.5 rounded">
                <Warehouse className="h-3 w-3 text-zoru-ink-muted shrink-0" />
                {loadingStocks ? (
                  <span className="text-zoru-ink-muted animate-pulse">Checking stock...</span>
                ) : (
                  <span
                    className={
                      currentWarehouseStock > 0
                        ? hasSufficientStock
                          ? 'text-zoru-success-ink font-medium'
                          : 'text-zoru-ink font-medium'
                        : 'text-zoru-danger-ink font-medium'
                    }
                  >
                    {currentWarehouseStock > 0
                      ? `${currentWarehouseStock} in stock ${
                          !hasSufficientStock ? '(insufficient)' : ''
                        }`
                      : 'Out of stock'}
                  </span>
                )}
              </div>
            )}
          </div>
        </td>

        {/* Rate */}
        <td className="p-2">
          <Input
            type="number"
            step="any"
            min={0}
            value={Number.isFinite(row.rate) ? row.rate : ''}
            onChange={(e) => onPatch(row.key, { rate: Number(e.target.value) || 0 })}
            className="h-9 text-right text-[12.5px] tabular-nums"
          />
        </td>

        {/* Tax Percentage */}
        <td className="p-2">
          <Input
            type="number"
            step="any"
            min={0}
            max={100}
            value={row.taxRatePct ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onPatch(row.key, {
                taxRatePct: v === '' ? undefined : Number(v),
              });
            }}
            className="h-9 text-right text-[12.5px] tabular-nums"
          />
        </td>

        {/* Line Total */}
        <td className="p-2 text-right text-[12.5px] tabular-nums text-zoru-ink font-medium">
          {fmtMoney(total, currency)}
        </td>

        {/* Actions */}
        <td className="p-2 text-right">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(row.key)}
            disabled={rowsCount === 1}
            className="text-zoru-danger-ink"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>

      {/* Fulfillment Status Info */}
      {editing &&
      (row.qtyDelivered != null ||
        row.qtyInvoiced != null ||
        row.qtyPending != null) ? (
        <tr className="border-t border-zoru-line/60 bg-zoru-surface-2/40 text-[11.5px]">
          <td className="p-2 text-zoru-ink-muted" colSpan={8}>
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Pending:{' '}
                <span className="tabular-nums text-zoru-ink">
                  {row.qtyPending ?? row.qty}
                </span>
              </span>
              <span>
                Delivered:{' '}
                <span className="tabular-nums text-zoru-ink">
                  {row.qtyDelivered ?? 0}
                </span>
              </span>
              <span>
                Invoiced:{' '}
                <span className="tabular-nums text-zoru-ink">
                  {row.qtyInvoiced ?? 0}
                </span>
              </span>
            </div>
          </td>
        </tr>
      ) : null}
    </React.Fragment>
  );
}
