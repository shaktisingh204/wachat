'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * §1D Sales-Order form — owns both Create and Edit flows.
 *
 * Server-action driven via `saveSalesOrderAction`. The form composes:
 *   - Header card (SO #, customer, quotation ref, PO #/date, expected
 *     shipment, delivery method, payment terms, currency, sales agent)
 *   - Line items table — see `<SoLineItemsTable>`
 *   - Totals card (subtotal · shipping · discount · adjustment · total)
 *   - Addresses card (shipping address)
 *   - Status & Notes card
 *
 * Smart defaults: when `seed` carries a `quotationRef`, that's pre-
 * filled. The parent `/new` page detects `?fromKind=quotation&fromId=`
 * server-side and produces a seed for us.
 *
 * Preserves these FormData keys: `_id`, `soNo`, `clientId`, `date`,
 * `expectedShipmentDate`, `poNo`, `poDate`, `paymentTerms`, `currency`,
 * `items`, `status`, `shippingCharge`, `discountOverall`, `adjustment`,
 * `customerNotes`, `internalNotes`. Adds: `quotationRef`,
 * `deliveryMethod`, `shippingAddress` (JSON), `assignedTo` — the
 * action layer accepts (currently ignores) these; the form ships
 * everything so the wire is complete once the action is updated.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveSalesOrderAction } from '@/app/actions/crm/sales-orders.actions';
import type {
  CrmSalesOrderDoc,
  CrmSalesOrderDeliveryMethod,
  CrmSalesOrderLineItem,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import type { LookupItem } from '@/lib/lookup-registry';
import { SoLineItemsTable, type SoLineRow } from './sales-orders-form-lines';
import {
  ShippingAddressCard,
  TotalsCard,
  type ShipAddr,
} from './sales-orders-form-sections';

export interface SalesOrdersFormProps {
  /** Existing order — present in Edit mode. Omit for Create. */
  initial?: CrmSalesOrderDoc | null;
  /** Seed values for Create flow via `?fromKind=quotation&fromId=…`. */
  seed?: {
    quotationRef?: string;
    clientId?: string;
    currency?: string;
    items?: CrmSalesOrderLineItem[];
    paymentTerms?: string;
    customerNotes?: string;
  };
}

// Status + delivery-method options now sourced from CRM_ENUMS
// (`salesOrderFulfillmentStatus`, `salesOrderDeliveryMethod`).

const INITIAL_STATE: { message?: string; error?: string; id?: string } = {
  message: undefined,
  error: undefined,
  id: undefined,
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create sales order'}
    </ZoruButton>
  );
}

function isoToDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function rowFromDoc(li: CrmSalesOrderLineItem, idx: number): SoLineRow {
  return {
    key: `init-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: li.itemId,
    description: li.description ?? '',
    hsnSac: li.hsnSac,
    qty: li.qty ?? 0,
    rate: li.rate ?? 0,
    unit: li.unit,
    warehouseId: li.warehouseId,
    taxRatePct: li.taxRatePct ?? undefined,
    qtyPending: li.qtyPending,
    qtyDelivered: li.qtyDelivered,
    qtyInvoiced: li.qtyInvoiced,
  };
}

function blankRow(): SoLineRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    qty: 1,
    rate: 0,
  };
}

export function SalesOrdersForm({ initial, seed }: SalesOrdersFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveSalesOrderAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(
    initial?.currency ?? seed?.currency ?? 'INR',
  );
  const [status, setStatus] = useState<CrmSalesOrderStatus>(
    (initial?.status as CrmSalesOrderStatus) ?? 'open',
  );
  const [deliveryMethod, setDeliveryMethod] = useState<CrmSalesOrderDeliveryMethod | ''>(
    initial?.deliveryMethod ?? '',
  );
  const [quotationRef, setQuotationRef] = useState<string>(
    initial?.quotationRef ?? seed?.quotationRef ?? '',
  );
  const [assignedTo, setAssignedTo] = useState<string>(
    initial?.assignment?.assignedTo ?? '',
  );

  const seedItems = initial?.items?.length
    ? initial.items.map(rowFromDoc)
    : seed?.items?.length
      ? seed.items.map(rowFromDoc)
      : [blankRow()];
  const [rows, setRows] = useState<SoLineRow[]>(seedItems);

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

  const initialShip = (initial?.shippingAddress as ShipAddr | undefined) ?? {};
  const [ship, setShip] = useState<ShipAddr>({
    line1: initialShip.line1 ?? '',
    line2: initialShip.line2 ?? '',
    city: initialShip.city ?? '',
    state: initialShip.state ?? '',
    postalCode: initialShip.postalCode ?? '',
    country: initialShip.country ?? '',
  });

  const computed = useMemo(() => {
    const subTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0);
    const lineTotals = rows.reduce((s, r) => {
      const sub = r.qty * r.rate;
      const tax = r.taxRatePct != null ? (sub * r.taxRatePct) / 100 : 0;
      return s + sub + tax;
    }, 0);
    const ship = Number(shippingCharge) || 0;
    const disc = Number(discountOverall) || 0;
    const adj = Number(adjustment) || 0;
    return { subTotal, lineTotals, total: lineTotals + ship - disc + adj };
  }, [rows, shippingCharge, discountOverall, adjustment]);

  const itemsPayload = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.qty > 0 || r.rate > 0 || r.description || r.itemId)
          .map((r) => ({
            itemId: r.itemId,
            description: r.description || undefined,
            hsnSac: r.hsnSac,
            qty: r.qty,
            rate: r.rate,
            unit: r.unit,
            warehouseId: r.warehouseId,
            taxRatePct: r.taxRatePct,
            qtyPending: r.qtyPending,
            qtyDelivered: r.qtyDelivered,
            qtyInvoiced: r.qtyInvoiced,
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

  function patchRow(key: string, patch: Partial<SoLineRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function onItemPick(key: string, id: string | null, hydrated?: LookupItem) {
    if (!id) {
      patchRow(key, { itemId: undefined });
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
    const hsnSac =
      (typeof raw.hsnSac === 'string' && raw.hsnSac) ||
      (typeof raw.hsnCode === 'string' && raw.hsnCode) ||
      undefined;
    patchRow(key, {
      itemId: id,
      description,
      hsnSac,
      rate: Number.isFinite(rate) ? rate : 0,
      unit,
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={itemsPayload} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="shippingCharge" value={shippingCharge} />
      <input type="hidden" name="discountOverall" value={discountOverall} />
      <input type="hidden" name="adjustment" value={adjustment} />
      <input type="hidden" name="quotationRef" value={quotationRef} />
      <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
      <input type="hidden" name="assignedTo" value={assignedTo} />
      <input type="hidden" name="shippingAddress" value={JSON.stringify(ship)} />

      {/* Header */}
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
                initialId={initial?.clientId ?? seed?.clientId ?? null}
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
              defaultValue={
                isoToDateInput(initial?.date) ||
                isoToDateInput(new Date().toISOString())
              }
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
            <ZoruLabel>Quotation ref</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="quotation"
                name="__quotation_picker"
                initialId={quotationRef || null}
                placeholder="Link a quotation (optional)…"
                onChange={(id) => setQuotationRef(id ?? '')}
              />
            </div>
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
            <ZoruLabel>Delivery method</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="salesOrderDeliveryMethod"
                name="__deliveryMethod_picker"
                initialId={deliveryMethod || null}
                placeholder="Select delivery method"
                onChange={(id) =>
                  setDeliveryMethod((id ?? '') as CrmSalesOrderDeliveryMethod | '')
                }
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="paymentTerms">Payment terms</ZoruLabel>
            <ZoruInput
              id="paymentTerms"
              name="paymentTerms"
              defaultValue={initial?.paymentTerms ?? seed?.paymentTerms ?? ''}
              className="mt-1.5"
              placeholder="Net 30"
            />
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="__currency_picker"
                initialId={currency}
                onChange={(id) => setCurrency(id ?? 'INR')}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Sales agent</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="__agent_picker"
                initialId={assignedTo || null}
                placeholder="Assign sales agent…"
                onChange={(id) => setAssignedTo(id ?? '')}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      {/* Line items */}
      <ZoruCard className="p-6">
        <SoLineItemsTable
          rows={rows}
          currency={currency}
          editing={editing}
          onAdd={addRow}
          onRemove={removeRow}
          onPatch={patchRow}
          onItemPick={onItemPick}
        />
      </ZoruCard>

      <TotalsCard
        currency={currency}
        subTotal={computed.subTotal}
        lineTotals={computed.lineTotals}
        total={computed.total}
        shippingCharge={shippingCharge}
        setShippingCharge={setShippingCharge}
        discountOverall={discountOverall}
        setDiscountOverall={setDiscountOverall}
        adjustment={adjustment}
        setAdjustment={setAdjustment}
      />

      <ShippingAddressCard ship={ship} setShip={setShip} />

      {/* Workflow & notes */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow & notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Status</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="salesOrderFulfillmentStatus"
                name="__status_picker"
                initialId={status || null}
                onChange={(id) => setStatus((id ?? 'open') as CrmSalesOrderStatus)}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="customerNotes">Customer notes</ZoruLabel>
            <ZoruTextarea
              id="customerNotes"
              name="customerNotes"
              defaultValue={initial?.customerNotes ?? seed?.customerNotes ?? ''}
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
