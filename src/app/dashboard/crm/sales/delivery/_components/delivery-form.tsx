'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { LoaderCircle,
  Save,
  ArrowLeft } from 'lucide-react';

/**
 * §1D Delivery-Challan form — thin variant per the rebuild plan's
 * scope cap. Owns Create flow (and acts as the canonical form when an
 * edit sub-route is added).
 *
 * Sectioned cards: header · line items (`<DcLineItemsTable>`) ·
 * dispatch & ship-to · transport · notes.
 *
 * Preserves the existing FormData keys consumed by
 * `saveDeliveryChallan`: `accountId`, `challanNumber`, `challanDate`,
 * `lineItems` (JSON), `reason`, `vehicleNumber`, `driverName`, `mode`,
 * `notes`, `fromKind`, `fromId`. Adds: `warehouseId`, `transporterId`,
 * `shipTo` (JSON), `lrNumber`, `lrDate`, `ewayBillNumber`, `soRef`.
 *
 * The current action layer only reads the canonical keys above — the
 * extras are accepted-but-ignored until the action is widened (matches
 * the rebuild plan's "preserve FormData keys" rule).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveDeliveryChallan } from '@/app/actions/crm-delivery-challans.actions';
import { DcLineItemsTable, type DcLineRow } from './delivery-form-lines';

export interface DeliveryFormSeed {
  /** Pre-filled when invoked with `?fromKind=salesOrder&fromId=…`. */
  soRef?: string;
  clientId?: string;
  challanNumber?: string;
  items?: Array<{
    itemId?: string;
    name: string;
    hsnCode?: string;
    unit?: string;
    quantity: number;
  }>;
  shipTo?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface DeliveryFormProps {
  /** Optional pre-fill from a parent doc. */
  seed?: DeliveryFormSeed;
  /** Lineage parent kind (passed through to the action layer). */
  fromKind?: string;
  /** Lineage parent id. */
  fromId?: string;
  /** Edit-mode: existing challan id. Triggers the PATCH branch on save. */
  editId?: string;
}

// Mode of transport now sourced from CRM_ENUMS.transportMode.

const INITIAL_STATE: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save challan
    </Button>
  );
}

function blankRow(): DcLineRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    quantity: 1,
  };
}

function fromSeedItems(seed?: DeliveryFormSeed): DcLineRow[] {
  if (!seed?.items?.length) return [blankRow()];
  return seed.items.map((it, idx) => ({
    id: `seed-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: it.itemId,
    name: it.name,
    hsnCode: it.hsnCode,
    unit: it.unit,
    quantity: it.quantity,
  }));
}

export function DeliveryForm({ seed, fromKind, fromId, editId }: DeliveryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveDeliveryChallan, INITIAL_STATE);

  const [clientId, setClientId] = useState<string>(seed?.clientId ?? '');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [transporterId, setTransporterId] = useState<string>('');
  const [challanDate, setChallanDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [mode, setMode] = useState<string>('road');
  const [lineItems, setLineItems] = useState<DcLineRow[]>(() => fromSeedItems(seed));

  const [shipTo, setShipTo] = useState({
    line1: seed?.shipTo?.line1 ?? '',
    city: seed?.shipTo?.city ?? '',
    state: seed?.shipTo?.state ?? '',
    postalCode: seed?.shipTo?.postalCode ?? '',
    country: seed?.shipTo?.country ?? '',
  });

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/sales/delivery');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  function addRow() {
    setLineItems((prev) => [...prev, blankRow()]);
  }
  function removeRow(id: string) {
    setLineItems((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.id !== id),
    );
  }
  function patchRow(id: string, patch: Partial<DcLineRow>) {
    setLineItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  const itemsPayload = React.useMemo(
    () =>
      JSON.stringify(
        lineItems
          .filter((r) => (r.name && r.name.trim()) || r.itemId)
          .map((r) => ({
            id: r.id,
            itemId: r.itemId,
            name: r.name,
            hsnCode: r.hsnCode,
            quantity: r.quantity,
            unit: r.unit,
            batch: r.batch,
            expiry: r.expiry,
            serialNumbers: (r.serialNumbersText ?? '')
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean),
          })),
      ),
    [lineItems],
  );

  return (
    <form action={formAction} className="space-y-6">
      {editId ? <input type="hidden" name="_id" value={editId} /> : null}
      <input type="hidden" name="accountId" value={clientId} />
      <input type="hidden" name="challanDate" value={new Date(challanDate).toISOString()} />
      <input type="hidden" name="lineItems" value={itemsPayload} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <input type="hidden" name="transporterId" value={transporterId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="shipTo" value={JSON.stringify(shipTo)} />
      {fromKind ? <input type="hidden" name="fromKind" value={fromKind} /> : null}
      {fromId ? <input type="hidden" name="fromId" value={fromId} /> : null}

      {/* Header */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="challanNumber">
              Challan # <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="challanNumber"
              name="challanNumber"
              defaultValue={seed?.challanNumber ?? 'DC-00001'}
              required
              className="mt-1.5"
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor="challanDate">
              Challan date <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="challanDate"
              type="date"
              required
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>
              Customer <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="__client_picker"
                initialId={clientId || null}
                placeholder="Select customer…"
                required
                onChange={(id) => setClientId(id ?? '')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="soRef">Linked sales order</Label>
            <Input
              id="soRef"
              name="soRef"
              defaultValue={seed?.soRef ?? ''}
              placeholder="Sales order id (optional)"
              className="mt-1.5"
              readOnly={Boolean(seed?.soRef)}
            />
          </div>
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-6">
        <DcLineItemsTable
          rows={lineItems}
          onAdd={addRow}
          onRemove={removeRow}
          onPatch={patchRow}
        />
      </Card>

      {/* Dispatch + ship-to */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Dispatch & ship-to
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Dispatch warehouse</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="warehouse"
                name="__dispatchWarehouse"
                initialId={warehouseId || null}
                placeholder="Pick a warehouse…"
                onChange={(id) => setWarehouseId(id ?? '')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="reason">Reason for transport</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="e.g. For job work, sale on approval"
              className="mt-1.5"
              maxLength={200}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ship-line1">Ship-to address — line 1</Label>
            <Input
              id="ship-line1"
              value={shipTo.line1}
              onChange={(e) => setShipTo((p) => ({ ...p, line1: e.target.value }))}
              className="mt-1.5"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="ship-city">City</Label>
            <Input
              id="ship-city"
              value={shipTo.city}
              onChange={(e) => setShipTo((p) => ({ ...p, city: e.target.value }))}
              className="mt-1.5"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="ship-state">State</Label>
            <Input
              id="ship-state"
              value={shipTo.state}
              onChange={(e) => setShipTo((p) => ({ ...p, state: e.target.value }))}
              className="mt-1.5"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="ship-postal">Postal code</Label>
            <Input
              id="ship-postal"
              value={shipTo.postalCode}
              onChange={(e) => setShipTo((p) => ({ ...p, postalCode: e.target.value }))}
              className="mt-1.5"
              maxLength={20}
            />
          </div>
          <div>
            <Label htmlFor="ship-country">Country</Label>
            <Input
              id="ship-country"
              value={shipTo.country}
              onChange={(e) => setShipTo((p) => ({ ...p, country: e.target.value }))}
              className="mt-1.5"
              maxLength={100}
            />
          </div>
        </div>
      </Card>

      {/* Transport */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Transport
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="vehicleNumber">Vehicle number</Label>
            <Input
              id="vehicleNumber"
              name="vehicleNumber"
              placeholder="e.g. RJ14 AB 1234"
              className="mt-1.5"
              maxLength={20}
            />
          </div>
          <div>
            <Label htmlFor="driverName">Driver name</Label>
            <Input
              id="driverName"
              name="driverName"
              placeholder="e.g. John Doe"
              className="mt-1.5"
              maxLength={100}
            />
          </div>
          <div>
            <Label>Transporter</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="__transporterPicker"
                initialId={transporterId || null}
                placeholder="Pick transporter contact…"
                onChange={(id) => setTransporterId(id ?? '')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lrNumber">LR / consignment no</Label>
            <Input
              id="lrNumber"
              name="lrNumber"
              placeholder="LR-12345"
              className="mt-1.5"
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor="lrDate">LR date</Label>
            <Input
              id="lrDate"
              name="lrDate"
              type="date"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ewayBillNumber">E-way bill no</Label>
            <Input
              id="ewayBillNumber"
              name="ewayBillNumber"
              placeholder="123456789012"
              className="mt-1.5"
              maxLength={20}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Mode of transport</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="transportMode"
                name="__transportMode_picker"
                initialId={mode || null}
                onChange={(id) => setMode(id ?? 'road')}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Notes
        </h3>
        <Textarea
          name="notes"
          placeholder="Any special instructions…"
          maxLength={500}
        />
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/sales/delivery">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </Button>
        <SaveButton />
      </div>
    </form>
  );
}
