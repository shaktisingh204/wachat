'use client';

/**
 * <PurchaseOrderForm> — single source of truth for both Create and
 * Edit flows. Server-action driven via `savePurchaseOrderAction`.
 *
 * Layout:
 *   1. Header — PO number, vendor (via <EntityFormField>), dates.
 *   2. Line Items — editable table (add/remove rows).
 *   3. Totals — sub-total, adjustments, grand total (auto-computed,
 *      overridable on the wire by the action layer).
 *   4. Status — workflow status select.
 *
 * Purchase Orders intentionally skip the custom-field panel —
 * `'purchaseOrder'` is not a registered `WsCustomFieldBelongsTo` key.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
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
import { savePurchaseOrderAction } from '@/app/actions/crm/purchase-orders.actions';
import type {
  CrmPurchaseOrderDoc,
  CrmPurchaseOrderLineItem,
  CrmPurchaseOrderStatus,
} from '@/lib/rust-client/crm-purchase-orders';

interface PurchaseOrderFormProps {
  /** Existing PO — present in Edit mode, omit for Create. */
  initial?: CrmPurchaseOrderDoc | null;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmPurchaseOrderStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Editable line-item row. All fields except qty/rate/total are optional. */
interface DraftLine {
  /** Stable local id for React keys; never sent to the server. */
  key: string;
  description: string;
  hsnSac: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  taxRatePct: string;
}

function newLine(seed?: Partial<DraftLine>): DraftLine {
  return {
    key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `line-${Math.random().toString(36).slice(2)}`,
    description: seed?.description ?? '',
    hsnSac: seed?.hsnSac ?? '',
    qty: seed?.qty ?? '',
    unit: seed?.unit ?? '',
    rate: seed?.rate ?? '',
    discountPct: seed?.discountPct ?? '',
    taxRatePct: seed?.taxRatePct ?? '',
  };
}

function lineFromDoc(it: CrmPurchaseOrderLineItem): DraftLine {
  return newLine({
    description: it.description ?? '',
    hsnSac: it.hsnSac ?? '',
    qty: Number.isFinite(it.qty) ? String(it.qty) : '',
    unit: it.unit ?? '',
    rate: Number.isFinite(it.rate) ? String(it.rate) : '',
    discountPct:
      typeof it.discountPct === 'number' ? String(it.discountPct) : '',
    taxRatePct:
      typeof it.taxRatePct === 'number' ? String(it.taxRatePct) : '',
  });
}

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Per-line gross = qty * rate, minus per-line discount, plus per-line tax. */
function computeLineTotal(line: DraftLine): number {
  const qty = toNum(line.qty);
  const rate = toNum(line.rate);
  const gross = qty * rate;
  const discount = (gross * toNum(line.discountPct)) / 100;
  const taxable = gross - discount;
  const tax = (taxable * toNum(line.taxRatePct)) / 100;
  return Number((taxable + tax).toFixed(2));
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

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create purchase order'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function PurchaseOrderForm({ initial }: PurchaseOrderFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    savePurchaseOrderAction,
    INITIAL_STATE,
  );

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [status, setStatus] = useState<string>(
    typeof initial?.status === 'string' ? initial.status : 'draft',
  );
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial?.items && initial.items.length > 0
      ? initial.items.map(lineFromDoc)
      : [newLine()],
  );

  const [discountOverall, setDiscountOverall] = useState<string>(
    typeof initial?.totals?.discountOverall === 'number'
      ? String(initial.totals.discountOverall)
      : '',
  );
  const [shippingCharge, setShippingCharge] = useState<string>(
    typeof initial?.totals?.shippingCharge === 'number'
      ? String(initial.totals.shippingCharge)
      : '',
  );
  const [adjustment, setAdjustment] = useState<string>(
    typeof initial?.totals?.adjustment === 'number'
      ? String(initial.totals.adjustment)
      : '',
  );
  const [roundOff, setRoundOff] = useState<string>(
    typeof initial?.totals?.roundOff === 'number'
      ? String(initial.totals.roundOff)
      : '',
  );

  // Derived totals — recomputed on every render. Cheap; lines are tiny.
  const lineTotals = lines.map(computeLineTotal);
  const subTotal = Number(
    lineTotals.reduce((s, n) => s + n, 0).toFixed(2),
  );
  const grandTotal = Number(
    (
      subTotal -
      toNum(discountOverall) +
      toNum(shippingCharge) +
      toNum(adjustment) +
      toNum(roundOff)
    ).toFixed(2),
  );

  // Serialise lines for the hidden `items` field so the server action
  // can rebuild the wire shape without re-doing the math.
  const itemsPayload = lines.map((l, i) => ({
    description: l.description || undefined,
    hsnSac: l.hsnSac || undefined,
    qty: toNum(l.qty),
    unit: l.unit || undefined,
    rate: toNum(l.rate),
    discountPct: l.discountPct ? toNum(l.discountPct) : undefined,
    taxRatePct: l.taxRatePct ? toNum(l.taxRatePct) : undefined,
    total: lineTotals[i],
  }));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/purchases/orders/${state.id}`
          : '/dashboard/crm/purchases/orders',
      );
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) =>
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );

  const defaultDate = initial?.date
    ? new Date(initial.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const defaultExpected = initial?.expectedDelivery
    ? new Date(initial.expectedDelivery).toISOString().slice(0, 10)
    : '';

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="status" value={status} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="poNo">
              PO number <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="poNo"
              name="poNo"
              required={!editing}
              readOnly={editing}
              defaultValue={initial?.poNo ?? ''}
              placeholder="PO-2026-0001"
              className="mt-1.5"
            />
            {editing ? (
              <p className="mt-1 text-[11px] text-zoru-ink-muted">
                PO numbers are immutable — rotate via cancel + new PO.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel>
              Vendor <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="vendor"
                name="vendorId"
                initialId={initial?.vendorId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="date">
              PO date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="expectedDelivery">Expected delivery</ZoruLabel>
            <ZoruInput
              id="expectedDelivery"
              name="expectedDelivery"
              type="date"
              defaultValue={defaultExpected}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Ship-to warehouse</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="warehouse"
                name="shipToWarehouseId"
                initialId={initial?.shipToWarehouseId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Billing branch</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="branch"
                name="billingBranchId"
                initialId={initial?.billingBranchId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="_currencyChip"
                initialId={currency}
                onChange={(next) => setCurrency(next || 'INR')}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="paymentTerms">Payment terms</ZoruLabel>
            <ZoruInput
              id="paymentTerms"
              name="paymentTerms"
              defaultValue={initial?.paymentTerms ?? ''}
              placeholder="Net 30 / 50% advance / …"
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      {/* ─── Line Items ─────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
          <ZoruButton
            type="button"
            size="sm"
            variant="outline"
            onClick={addLine}
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </ZoruButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zoru-line text-left text-zoru-ink-muted">
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">HSN/SAC</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Unit</th>
                <th className="py-2 pr-3 font-medium">Rate</th>
                <th className="py-2 pr-3 font-medium">Disc %</th>
                <th className="py-2 pr-3 font-medium">Tax %</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 pl-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.key}
                  className="border-b border-zoru-line/60 align-top"
                >
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="h-8 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.hsnSac}
                      onChange={(e) =>
                        updateLine(line.key, { hsnSac: e.target.value })
                      }
                      placeholder="HSN"
                      className="h-8 w-24 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.key, { qty: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 w-20 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.unit}
                      onChange={(e) =>
                        updateLine(line.key, { unit: e.target.value })
                      }
                      placeholder="nos"
                      className="h-8 w-20 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.rate}
                      onChange={(e) =>
                        updateLine(line.key, { rate: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 w-24 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.discountPct}
                      onChange={(e) =>
                        updateLine(line.key, { discountPct: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      className="h-8 w-20 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <ZoruInput
                      value={line.taxRatePct}
                      onChange={(e) =>
                        updateLine(line.key, { taxRatePct: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      className="h-8 w-20 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-zoru-ink">
                    {fmtMoney(lineTotals[idx] || 0, currency)}
                  </td>
                  <td className="py-2 pl-1">
                    <ZoruButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="text-zoru-danger-ink"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ZoruButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      {/* ─── Totals ─────────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <ZoruLabel htmlFor="discountOverall">
                Discount (overall)
              </ZoruLabel>
              <ZoruInput
                id="discountOverall"
                name="discountOverall"
                type="number"
                step="any"
                min={0}
                value={discountOverall}
                onChange={(e) => setDiscountOverall(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="shippingCharge">Shipping charge</ZoruLabel>
              <ZoruInput
                id="shippingCharge"
                name="shippingCharge"
                type="number"
                step="any"
                value={shippingCharge}
                onChange={(e) => setShippingCharge(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="adjustment">Adjustment</ZoruLabel>
              <ZoruInput
                id="adjustment"
                name="adjustment"
                type="number"
                step="any"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="roundOff">Round off</ZoruLabel>
              <ZoruInput
                id="roundOff"
                name="roundOff"
                type="number"
                step="any"
                value={roundOff}
                onChange={(e) => setRoundOff(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2 rounded-md border border-zoru-line bg-zoru-surface-2 p-4 text-[13px]">
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Sub-total</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(subTotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Discount</span>
              <span className="tabular-nums">
                {fmtMoney(-toNum(discountOverall), currency)}
              </span>
            </div>
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Shipping + adjustments</span>
              <span className="tabular-nums">
                {fmtMoney(
                  toNum(shippingCharge) + toNum(adjustment) + toNum(roundOff),
                  currency,
                )}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-zoru-line pt-2 text-[14px] font-semibold text-zoru-ink">
              <span>Grand total</span>
              <span className="tabular-nums">
                {fmtMoney(grandTotal, currency)}
              </span>
            </div>
          </div>
        </div>
      </ZoruCard>

      {/* ─── Status + notes ─────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Status</ZoruLabel>
            <div className="mt-1.5">
              <ZoruSelect value={status} onValueChange={setStatus}>
                <ZoruSelectTrigger className="h-9 text-[13px]">
                  <ZoruSelectValue placeholder="Select status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <ZoruSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="termsAndConditions">
              Terms &amp; conditions
            </ZoruLabel>
            <ZoruTextarea
              id="termsAndConditions"
              name="termsAndConditions"
              defaultValue={initial?.termsAndConditions ?? ''}
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ''}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/purchases/orders/${String(initial!._id)}`
                : '/dashboard/crm/purchases/orders'
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
