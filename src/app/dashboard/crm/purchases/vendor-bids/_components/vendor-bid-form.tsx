'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * <VendorBidForm> — single source of truth for both Create and Edit
 * flows. Server-action driven via `saveVendorBidAction`.
 *
 * Layout:
 *   1. Header — vendor (via <EntityFormField>), related RFQ id (plain
 *      <Input> since RFQ isn't a registered EntityKey yet),
 *      currency, valid-until date, vendor display name.
 *   2. Line Items — editable table with item picker, qty, unit price
 *      (rate), and lead time per row.
 *   3. Totals — sub-total / grand total (auto-computed; vendor bids
 *      use a flat `qty * rate` model — overall discount / tax live in
 *      the `terms` blob).
 *   4. Status — workflow status select (`submitted` … `awarded`).
 *
 * Vendor Bids intentionally skip the custom-field panel — `'vendorBid'`
 * is not a registered `WsCustomFieldBelongsTo` key.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import { saveVendorBidAction } from '@/app/actions/crm/vendor-bids.actions';
import type {
  CrmVendorBidDoc,
  CrmVendorBidLineItem,
  CrmVendorBidStatus,
} from '@/lib/rust-client/crm-vendor-bids';
import type { LookupItem } from '@/lib/lookup-registry';

interface VendorBidFormProps {
  /** Existing bid — present in Edit mode, omit for Create. */
  initial?: CrmVendorBidDoc | null;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmVendorBidStatus;
  label: string;
}> = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/** Editable line-item row. Mirrors `CrmVendorBidLineItem` plus a local
 *  `key` so React can key sibling rows even when ids are blank. */
interface DraftLine {
  /** Stable local id for React keys; never sent to the server. */
  key: string;
  itemId: string;
  qty: string;
  rate: string;
  leadTimeDays: string;
  notes: string;
}

function newLine(seed?: Partial<DraftLine>): DraftLine {
  return {
    key:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `line-${Math.random().toString(36).slice(2)}`,
    itemId: seed?.itemId ?? '',
    qty: seed?.qty ?? '',
    rate: seed?.rate ?? '',
    leadTimeDays: seed?.leadTimeDays ?? '',
    notes: seed?.notes ?? '',
  };
}

function lineFromDoc(it: CrmVendorBidLineItem): DraftLine {
  return newLine({
    itemId: it.itemId ?? '',
    qty: Number.isFinite(it.qty) ? String(it.qty) : '',
    rate: Number.isFinite(it.rate) ? String(it.rate) : '',
    leadTimeDays:
      typeof it.leadTimeDays === 'number' ? String(it.leadTimeDays) : '',
    notes: it.notes ?? '',
  });
}

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create vendor bid'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function VendorBidForm({ initial }: VendorBidFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveVendorBidAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // Lineage propagation from query string (e.g. `?fromKind=rfq&fromId=`).
  // The §1D smart-default seeds the linked RFQ on the Create flow only.
  const seededRfqId =
    !editing && searchParams?.get('fromKind') === 'rfq'
      ? (searchParams?.get('fromId') ?? '')
      : '';

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [status, setStatus] = useState<string>(
    typeof initial?.status === 'string' ? initial.status : 'submitted',
  );
  const [rfqId, setRfqId] = useState<string>(initial?.rfqId ?? seededRfqId);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial?.items && initial.items.length > 0
      ? initial.items.map(lineFromDoc)
      : [newLine()],
  );

  // Derived totals — recomputed on every render. Cheap; lines are tiny.
  const lineTotals = lines.map((l) => toNum(l.qty) * toNum(l.rate));
  const subTotal = Number(lineTotals.reduce((s, n) => s + n, 0).toFixed(2));
  const grandTotal = subTotal;

  // Serialise lines for the hidden `items` field so the server action
  // can rebuild the wire shape without re-doing the math.
  const itemsPayload = lines
    .filter((l) => l.itemId || l.qty || l.rate)
    .map((l) => ({
      itemId: l.itemId || undefined,
      qty: toNum(l.qty),
      rate: toNum(l.rate),
      leadTimeDays: l.leadTimeDays ? toNum(l.leadTimeDays) : undefined,
      notes: l.notes || undefined,
    }));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/purchases/vendor-bids/${state.id}`
          : '/dashboard/crm/purchases/vendor-bids',
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

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="rfqId" value={rfqId} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Vendor <span className="text-zoru-danger-ink">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="vendor"
                name="vendorId"
                initialId={initial?.vendorId ?? null}
                dualWriteName="vendorName"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-zoru-ink-muted">
              The vendor's display name is mirrored as the bid's back-link
              label.
            </p>
          </div>
          <div>
            <Label>
              Related RFQ <span className="text-zoru-danger-ink">*</span>
            </Label>
            <div className="mt-1.5">
              {editing ? (
                <>
                  <input type="hidden" value={rfqId} />
                  <Input
                    value={rfqId}
                    readOnly
                    className="font-mono text-[12.5px]"
                  />
                </>
              ) : (
                <EntityFormField
                  entity="rfq"
                  name="__rfqId_picker"
                  initialId={rfqId || null}
                  onChange={(id) => setRfqId(id ?? '')}
                  required
                  placeholder="Pick an RFQ…"
                />
              )}
            </div>
            {editing ? (
              <p className="mt-1 text-[11px] text-zoru-ink-muted">
                The RFQ parent is immutable — withdraw + resubmit instead.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Currency</Label>
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
            <Label htmlFor="validUntil">Valid until</Label>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              defaultValue={
                initial?.submittedAt
                  ? new Date(initial.submittedAt).toISOString().slice(0, 10)
                  : ''
              }
              className="mt-1.5"
            />
            <p className="mt-1 text-[11px] text-zoru-ink-muted">
              Captured as a free-form date for now — pricing-validity
              cascades land with the RFQ surface.
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Line Items ─────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items <span className="text-zoru-danger-ink">*</span>
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            Add line
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zoru-line text-left text-zoru-ink-muted">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Unit price</th>
                <th className="py-2 pr-3 font-medium">Lead (days)</th>
                <th className="py-2 pr-3 font-medium">Notes</th>
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
                  <td className="py-2 pr-2 min-w-[220px]">
                    <EntityPicker
                      entity="item"
                      value={line.itemId || null}
                      placeholder="Pick item"
                      onChange={(next, hydrated) => {
                        const id = Array.isArray(next)
                          ? next[0] ?? ''
                          : (next ?? '');
                        const item = (Array.isArray(hydrated)
                          ? hydrated[0]
                          : hydrated) as LookupItem | undefined;
                        const raw = (item?.raw ?? {}) as Record<string, unknown>;
                        updateLine(line.key, {
                          itemId: id,
                          rate:
                            line.rate ||
                            (typeof raw.sellingPrice === 'number'
                              ? String(raw.sellingPrice)
                              : line.rate),
                        });
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.key, { qty: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 w-20 text-right text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={line.rate}
                      onChange={(e) =>
                        updateLine(line.key, { rate: e.target.value })
                      }
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 w-28 text-right text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={line.leadTimeDays}
                      onChange={(e) =>
                        updateLine(line.key, { leadTimeDays: e.target.value })
                      }
                      type="number"
                      step="1"
                      min={0}
                      className="h-8 w-20 text-right text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2 min-w-[160px]">
                    <Input
                      value={line.notes}
                      onChange={(e) =>
                        updateLine(line.key, { notes: e.target.value })
                      }
                      placeholder="Optional"
                      maxLength={250}
                      className="h-8 text-[12.5px]"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-zoru-ink">
                    {fmtMoney(lineTotals[idx] || 0, currency)}
                  </td>
                  <td className="py-2 pl-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      className="text-zoru-danger-ink"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Totals ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="text-[12.5px] text-zoru-ink-muted">
            Vendor bids carry a flat <code>qty × rate</code> total. Document-
            level discount, taxes, and adjustment cascades land with the
            invoice surface — capture vendor caveats in the Terms field
            below.
          </div>
          <div className="flex flex-col justify-end gap-2 rounded-md border border-zoru-line bg-zoru-surface-2 p-4 text-[13px]">
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Sub-total</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(subTotal, currency)}
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
      </Card>

      {/* ─── Status + terms ─────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="vendorBidStatus"
                name="__status_picker"
                initialId={status || null}
                placeholder="Select status"
                onChange={(id) => setStatus(id ?? '')}
              />
            </div>
            <p className="mt-1 text-[11px] text-zoru-ink-muted">
              Flipping to <strong>Awarded</strong> cascades the parent RFQ
              to <code>awarded</code> automatically.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea
              id="terms"
              name="terms"
              defaultValue={initial?.terms ?? ''}
              placeholder="Payment terms, delivery terms, validity, etc."
              rows={4}
              className="mt-1.5"
              maxLength={2000}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/purchases/vendor-bids/${String(initial!._id)}`
                : '/dashboard/crm/purchases/vendor-bids'
            }
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
