'use client';

/**
 * <SalesOrderForm> — single source of truth for both Create and Edit
 * flows of a Sales Order.
 *
 * Server-action driven via `saveSalesOrderAction`. The form composes:
 *   - Header (order #, customer, date, PO ref, expected shipment)
 *   - Line items table (add / remove rows, item picker, qty, rate,
 *     tax-rate)
 *   - Totals (sub-total, shipping, discount, adjustment, final total)
 *   - Status (open / partial / fulfilled / closed / cancelled)
 *
 * Sales orders are NOT registered with the worksuite custom-fields
 * system — there is no custom-fields panel here. Line items are
 * encoded as a single `items` JSON blob on the FormData payload.
 */

import * as React from 'react';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveSalesOrderAction } from '@/app/actions/crm/sales-orders.actions';
import type {
  CrmSalesOrderDoc,
  CrmSalesOrderLineItem,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import type { LookupItem } from '@/lib/lookup-registry';

interface SalesOrderFormProps {
  /** Existing order — present in Edit mode, omit for Create. */
  initial?: CrmSalesOrderDoc | null;
}

interface LineItemRow {
  /** Stable local row key — never sent to the server. */
  key: string;
  itemId?: string;
  description: string;
  qty: number;
  rate: number;
  unit?: string;
  taxRatePct?: number;
}

const STATUS_OPTIONS: Array<{ value: CrmSalesOrderStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'partial', label: 'Partial' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create sales order'}
    </ZoruButton>
  );
}

const INITIAL_STATE: { message?: string; error?: string; id?: string } = {
  message: undefined,
  error: undefined,
  id: undefined,
};

function isoToDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function rowFromInitial(li: CrmSalesOrderLineItem, idx: number): LineItemRow {
  return {
    key: `init-${idx}`,
    itemId: li.itemId,
    description: li.description ?? '',
    qty: li.qty ?? 0,
    rate: li.rate ?? 0,
    unit: li.unit,
    taxRatePct: li.taxRatePct ?? undefined,
  };
}

function makeBlankRow(): LineItemRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    qty: 1,
    rate: 0,
  };
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

export function SalesOrderForm({ initial }: SalesOrderFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveSalesOrderAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [status, setStatus] = useState<CrmSalesOrderStatus>(
    (initial?.status as CrmSalesOrderStatus) ?? 'open',
  );

  const [rows, setRows] = useState<LineItemRow[]>(() => {
    if (initial?.items?.length) return initial.items.map(rowFromInitial);
    return [makeBlankRow()];
  });

  const [shippingCharge, setShippingCharge] = useState<string>(
    initial?.totals?.shippingCharge != null
      ? String(initial.totals.shippingCharge)
      : '',
  );
  const [discountOverall, setDiscountOverall] = useState<string>(
    initial?.totals?.discountOverall != null
      ? String(initial.totals.discountOverall)
      : '',
  );
  const [adjustment, setAdjustment] = useState<string>(
    initial?.totals?.adjustment != null ? String(initial.totals.adjustment) : '',
  );

  const computed = useMemo(() => {
    const subTotal = rows.reduce((sum, r) => sum + r.qty * r.rate, 0);
    const lineTotals = rows.reduce((sum, r) => {
      const lineSubtotal = r.qty * r.rate;
      const tax = r.taxRatePct != null ? (lineSubtotal * r.taxRatePct) / 100 : 0;
      return sum + lineSubtotal + tax;
    }, 0);
    const ship = Number(shippingCharge) || 0;
    const disc = Number(discountOverall) || 0;
    const adj = Number(adjustment) || 0;
    const total = lineTotals + ship - disc + adj;
    return { subTotal, lineTotals, total };
  }, [rows, shippingCharge, discountOverall, adjustment]);

  // Serialized form of `rows` ready to ship via the hidden input.
  const itemsPayload = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.qty > 0 || r.rate > 0 || r.description || r.itemId)
          .map((r) => ({
            itemId: r.itemId,
            description: r.description || undefined,
            qty: r.qty,
            rate: r.rate,
            unit: r.unit,
            taxRatePct: r.taxRatePct,
          })),
      ),
    [rows],
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/sales/orders/${state.id}`
          : '/dashboard/crm/sales/orders',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const updateRow = (key: string, patch: Partial<LineItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, makeBlankRow()]);
  const removeRow = (key: string) =>
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.key !== key),
    );

  const onItemPick = (
    key: string,
    id: string | null,
    hydrated?: LookupItem,
  ) => {
    if (!id) {
      updateRow(key, { itemId: undefined });
      return;
    }
    const raw = (hydrated?.raw ?? {}) as Record<string, unknown>;
    const rate = Number(raw.sellingPrice ?? raw.rate ?? 0);
    const description =
      (typeof raw.description === 'string' && raw.description) ||
      hydrated?.chip?.primary ||
      '';
    const unit =
      (typeof raw.unit === 'string' && raw.unit) ||
      (typeof raw.unitOfMeasure === 'string' && raw.unitOfMeasure) ||
      undefined;
    updateRow(key, {
      itemId: id,
      description,
      rate: Number.isFinite(rate) ? rate : 0,
      unit,
    });
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={itemsPayload} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="currency" value={currency} />
      <input
        type="hidden"
        name="shippingCharge"
        value={shippingCharge}
      />
      <input
        type="hidden"
        name="discountOverall"
        value={discountOverall}
      />
      <input type="hidden" name="adjustment" value={adjustment} />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="soNo">
              Order # <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="soNo"
              name="soNo"
              required={!editing}
              defaultValue={initial?.soNo ?? ''}
              className="mt-1.5"
              placeholder="SO-00001"
              disabled={editing}
            />
          </div>
          <div>
            <ZoruLabel>
              Customer <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="clientId"
                initialId={initial?.clientId ?? null}
                required={!editing}
                placeholder="Select customer…"
                disabled={editing}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="date">
              Order date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={isoToDateInput(initial?.date) || isoToDateInput(new Date().toISOString())}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="expectedShipmentDate">Expected shipment</ZoruLabel>
            <ZoruInput
              id="expectedShipmentDate"
              name="expectedShipmentDate"
              type="date"
              defaultValue={isoToDateInput(initial?.expectedShipmentDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="poNo">Customer PO #</ZoruLabel>
            <ZoruInput
              id="poNo"
              name="poNo"
              defaultValue={initial?.poNo ?? ''}
              className="mt-1.5"
              placeholder="PO-1234"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="poDate">Customer PO date</ZoruLabel>
            <ZoruInput
              id="poDate"
              name="poDate"
              type="date"
              defaultValue={isoToDateInput(initial?.poDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currencyHidden"
                initialId={currency}
                onChange={(id) => setCurrency(id ?? 'INR')}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="paymentTerms">Payment terms</ZoruLabel>
            <ZoruInput
              id="paymentTerms"
              name="paymentTerms"
              defaultValue={initial?.paymentTerms ?? ''}
              className="mt-1.5"
              placeholder="Net 30"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
          <ZoruButton type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Add line
          </ZoruButton>
        </div>

        <div className="overflow-x-auto rounded-md border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
              <tr>
                <th className="p-2.5 font-medium">Item</th>
                <th className="p-2.5 font-medium">Description</th>
                <th className="w-[100px] p-2.5 text-right font-medium">Qty</th>
                <th className="w-[120px] p-2.5 text-right font-medium">
                  Unit price
                </th>
                <th className="w-[100px] p-2.5 text-right font-medium">Tax %</th>
                <th className="w-[120px] p-2.5 text-right font-medium">
                  Line total
                </th>
                <th className="w-[40px] p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sub = row.qty * row.rate;
                const tax =
                  row.taxRatePct != null ? (sub * row.taxRatePct) / 100 : 0;
                const total = sub + tax;
                return (
                  <tr
                    key={row.key}
                    className="border-t border-zoru-line align-top"
                  >
                    <td className="min-w-[200px] p-2">
                      <EntityFormField
                        entity="item"
                        name={`row-${row.key}-itemId`}
                        initialId={row.itemId ?? null}
                        placeholder="Select item…"
                        onChange={(id, hydrated) =>
                          onItemPick(row.key, id, hydrated)
                        }
                      />
                    </td>
                    <td className="min-w-[180px] p-2">
                      <ZoruInput
                        value={row.description}
                        onChange={(e) =>
                          updateRow(row.key, { description: e.target.value })
                        }
                        placeholder="Description"
                        className="h-9 text-[12.5px]"
                      />
                    </td>
                    <td className="p-2">
                      <ZoruInput
                        type="number"
                        step="any"
                        min={0}
                        value={Number.isFinite(row.qty) ? row.qty : ''}
                        onChange={(e) =>
                          updateRow(row.key, {
                            qty: Number(e.target.value) || 0,
                          })
                        }
                        className="h-9 text-right text-[12.5px] tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <ZoruInput
                        type="number"
                        step="any"
                        min={0}
                        value={Number.isFinite(row.rate) ? row.rate : ''}
                        onChange={(e) =>
                          updateRow(row.key, {
                            rate: Number(e.target.value) || 0,
                          })
                        }
                        className="h-9 text-right text-[12.5px] tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <ZoruInput
                        type="number"
                        step="any"
                        min={0}
                        max={100}
                        value={row.taxRatePct ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateRow(row.key, {
                            taxRatePct: v === '' ? undefined : Number(v),
                          });
                        }}
                        className="h-9 text-right text-[12.5px] tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-right text-[12.5px] tabular-nums text-zoru-ink">
                      {fmtMoney(total, currency)}
                    </td>
                    <td className="p-2 text-right">
                      <ZoruButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length === 1}
                        className="text-zoru-danger-ink"
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

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <ZoruLabel htmlFor="shippingCharge">Shipping charge</ZoruLabel>
              <ZoruInput
                id="shippingCharge"
                type="number"
                step="any"
                min={0}
                value={shippingCharge}
                onChange={(e) => setShippingCharge(e.target.value)}
                className="mt-1.5"
                placeholder="0"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="discountOverall">Overall discount</ZoruLabel>
              <ZoruInput
                id="discountOverall"
                type="number"
                step="any"
                min={0}
                value={discountOverall}
                onChange={(e) => setDiscountOverall(e.target.value)}
                className="mt-1.5"
                placeholder="0"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="adjustment">Adjustment</ZoruLabel>
              <ZoruInput
                id="adjustment"
                type="number"
                step="any"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                className="mt-1.5"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2 rounded-md border border-zoru-line bg-zoru-surface-2 p-4 text-[13px]">
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Sub-total</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(computed.subTotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Lines incl. tax</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(computed.lineTotals, currency)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-zoru-line pt-2 text-[14px] font-semibold text-zoru-ink">
              <span>Total ({currency})</span>
              <span className="tabular-nums">
                {fmtMoney(computed.total, currency)}
              </span>
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow & Notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Status</ZoruLabel>
            <ZoruSelect
              value={status}
              onValueChange={(v) => setStatus(v as CrmSalesOrderStatus)}
            >
              <ZoruSelectTrigger className="mt-1.5">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <ZoruSelectItem key={s.value} value={s.value}>
                    {s.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="customerNotes">Customer notes</ZoruLabel>
            <ZoruTextarea
              id="customerNotes"
              name="customerNotes"
              defaultValue={initial?.customerNotes ?? ''}
              className="mt-1.5"
              placeholder="Any notes visible on the printed SO."
              maxLength={1000}
            />
          </div>
          <div>
            <ZoruLabel htmlFor="internalNotes">Internal notes</ZoruLabel>
            <ZoruTextarea
              id="internalNotes"
              name="internalNotes"
              defaultValue={initial?.internalNotes ?? ''}
              className="mt-1.5"
              placeholder="Notes for your team — never shown to the customer."
              maxLength={1000}
            />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/sales/orders/${String(initial!._id)}`
                : '/dashboard/crm/sales/orders'
            }
          >
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
