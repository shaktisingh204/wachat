'use client';

/**
 * <BillForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveBillAction`. The form encodes every
 * relational/reference field as an `<EntityFormField>` so the value
 * stored is an id (or a string for inline-create entities). Custom
 * fields are rendered below the standard fields and submitted as a
 * single `customFields` JSON blob — the action layer fans them out
 * via `applyCustomFieldsToEntity` against the `'expense'` belongs-to
 * key.
 *
 * Line items live in client state and are serialized as a JSON blob
 * under the `lineItems` form field on submit. Totals are derived
 * (subtotal / tax / total) and shown read-only; the server recomputes
 * them on save so the wire payload stays authoritative.
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
  ZoruSeparator,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveBillAction } from '@/app/actions/crm/bills.actions';
import type {
  CrmBillDoc,
  CrmBillLineItem,
  CrmBillStatus,
} from '@/lib/rust-client/crm-bills';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface BillFormProps {
  /** Existing bill — present in Edit mode, omit for Create. */
  initial?: CrmBillDoc | null;
  /** Custom field definitions for `belongs_to = 'expense'`. */
  customFields: WsCustomField[];
}

const STATUS_OPTIONS: { value: CrmBillStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Row in client state. Mirrors `CrmBillLineItem` but adds a stable
 * key so React can keyless-track rows during add/remove.
 */
interface LineItemRow extends CrmBillLineItem {
  _key: string;
}

function newRow(): LineItemRow {
  return {
    _key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: undefined,
    description: '',
    qty: 1,
    rate: 0,
    taxRatePct: undefined,
    total: 0,
  };
}

function fromDoc(items?: CrmBillLineItem[]): LineItemRow[] {
  if (!items || items.length === 0) return [newRow()];
  return items.map((li, idx) => ({
    _key: `row-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    ...li,
  }));
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

function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create bill'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function BillForm({ initial, customFields }: BillFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveBillAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [rows, setRows] = useState<LineItemRow[]>(() => fromDoc(initial?.items));

  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    const bag = (initial?.customFields ?? {}) as Record<string, unknown>;
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) {
        seed[f.name] = v as CustomFieldValue;
      }
    }
    return seed;
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/purchases/expenses/${state.id}`
          : '/dashboard/crm/purchases/expenses',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const handleCustomFieldChange = (name: string, next: CustomFieldValue) => {
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
  };

  // Row mutators.
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r._key !== key)));
  const patchRow = (key: string, patch: Partial<LineItemRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        const next = { ...r, ...patch };
        const qty = Number(next.qty) || 0;
        const rate = Number(next.rate) || 0;
        const discountPct = Number(next.discountPct) || 0;
        const taxRatePct = Number(next.taxRatePct) || 0;
        const baseLine = qty * rate;
        const discounted = baseLine * (1 - discountPct / 100);
        const taxed = discounted * (1 + taxRatePct / 100);
        next.total = Number.isFinite(taxed) ? taxed : 0;
        return next;
      }),
    );
  };

  // Totals derived from rows.
  const subTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  // For preview-only — server recomputes authoritatively on save.
  const total = subTotal;

  // Strip the client-only `_key` from the line items wire payload.
  const lineItemsForSubmit: CrmBillLineItem[] = rows
    .filter((r) => Number(r.qty) > 0 || Number(r.rate) > 0 || (r.description && r.description.length > 0))
    .map(({ _key: _ignored, ...rest }) => rest);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input type="hidden" name="currency" value={currency} />
      <input
        type="hidden"
        name="lineItems"
        value={JSON.stringify(lineItemsForSubmit)}
      />
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldValues)}
      />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="billNo">Bill number</ZoruLabel>
            <ZoruInput
              id="billNo"
              name="billNo"
              defaultValue={initial?.billNo ?? ''}
              className="mt-1.5"
              placeholder="BILL-2026-0001"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="vendorInvoiceNo">Vendor invoice number</ZoruLabel>
            <ZoruInput
              id="vendorInvoiceNo"
              name="vendorInvoiceNo"
              defaultValue={initial?.vendorInvoiceNo ?? ''}
              className="mt-1.5"
              placeholder="INV-9876"
            />
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
            <ZoruLabel htmlFor="billDate">
              Bill date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="billDate"
              name="billDate"
              type="date"
              required
              defaultValue={toDateInput(initial?.billDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="dueDate">Due date</ZoruLabel>
            <ZoruInput
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={toDateInput(initial?.dueDate)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="__currency_picker"
                initialId={currency}
                onChange={(id) => setCurrency(id || 'INR')}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="placeOfSupply">Place of supply</ZoruLabel>
            <ZoruInput
              id="placeOfSupply"
              name="placeOfSupply"
              defaultValue={initial?.placeOfSupply ?? ''}
              className="mt-1.5"
              placeholder="29-Karnataka"
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
            <Plus className="h-3.5 w-3.5" /> Add line
          </ZoruButton>
        </div>

        <div className="overflow-x-auto rounded-md border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2">
              <tr className="border-b border-zoru-line text-left">
                <th className="p-2 font-medium text-zoru-ink">Item</th>
                <th className="p-2 font-medium text-zoru-ink">Description</th>
                <th className="p-2 text-right font-medium text-zoru-ink">Qty</th>
                <th className="p-2 text-right font-medium text-zoru-ink">Rate</th>
                <th className="p-2 font-medium text-zoru-ink">Tax</th>
                <th className="p-2 text-right font-medium text-zoru-ink">
                  Amount
                </th>
                <th className="w-[40px] p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._key} className="border-b border-zoru-line last:border-b-0">
                  <td className="min-w-[180px] p-2 align-top">
                    <EntityFormField
                      entity="item"
                      name={`__item_${row._key}`}
                      initialId={row.itemId ?? null}
                      onChange={(id, hydrated) => {
                        // Auto-fill rate from the catalog item's buying
                        // price when the user picks a known item.
                        const raw = hydrated?.raw as
                          | Record<string, unknown>
                          | undefined;
                        const rate =
                          typeof raw?.buyingPrice === 'number'
                            ? raw.buyingPrice
                            : typeof raw?.costPrice === 'number'
                              ? raw.costPrice
                              : typeof raw?.rate === 'number'
                                ? raw.rate
                                : undefined;
                        const description =
                          typeof raw?.description === 'string'
                            ? raw.description
                            : row.description;
                        patchRow(row._key, {
                          itemId: id ?? undefined,
                          ...(rate != null ? { rate } : {}),
                          ...(description != null ? { description } : {}),
                        });
                      }}
                    />
                  </td>
                  <td className="min-w-[200px] p-2 align-top">
                    <ZoruInput
                      value={row.description ?? ''}
                      onChange={(e) =>
                        patchRow(row._key, { description: e.target.value })
                      }
                      placeholder="Free-text description"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <ZoruInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.qty ?? 0}
                      onChange={(e) =>
                        patchRow(row._key, { qty: Number(e.target.value) })
                      }
                      className="w-24 text-right tabular-nums"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <ZoruInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.rate ?? 0}
                      onChange={(e) =>
                        patchRow(row._key, { rate: Number(e.target.value) })
                      }
                      className="w-28 text-right tabular-nums"
                    />
                  </td>
                  <td className="min-w-[160px] p-2 align-top">
                    <EntityFormField
                      entity="taxRate"
                      name={`__tax_${row._key}`}
                      initialId={
                        row.taxRatePct != null ? String(row.taxRatePct) : null
                      }
                      onChange={(_id, hydrated) => {
                        const raw = hydrated?.raw as
                          | Record<string, unknown>
                          | undefined;
                        const pct =
                          typeof raw?.ratePct === 'number'
                            ? raw.ratePct
                            : typeof raw?.rate === 'number'
                              ? raw.rate
                              : undefined;
                        patchRow(row._key, { taxRatePct: pct });
                      }}
                    />
                  </td>
                  <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                    {fmtMoney(Number(row.total) || 0, currency)}
                  </td>
                  <td className="p-2 align-top">
                    <ZoruButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(row._key)}
                      disabled={rows.length <= 1}
                      className="text-zoru-danger-ink"
                      aria-label="Remove line"
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

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h3>
        <div className="ml-auto max-w-sm space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-zoru-ink-muted">Subtotal</span>
            <span className="tabular-nums text-zoru-ink">
              {fmtMoney(subTotal, currency)}
            </span>
          </div>
          <ZoruSeparator />
          <div className="flex justify-between">
            <span className="font-medium text-zoru-ink">Total</span>
            <span className="text-base font-semibold tabular-nums text-zoru-ink">
              {fmtMoney(total, currency)}
            </span>
          </div>
          <p className="text-[11px] text-zoru-ink-muted">
            Server recomputes authoritatively on save.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="tdsSection">TDS section</ZoruLabel>
            <ZoruInput
              id="tdsSection"
              name="tdsSection"
              defaultValue={initial?.tdsSection ?? ''}
              className="mt-1.5"
              placeholder="194C"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="tdsAmount">TDS amount</ZoruLabel>
            <ZoruInput
              id="tdsAmount"
              name="tdsAmount"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.tdsAmount ?? ''}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="reverseCharge"
              name="reverseCharge"
              type="checkbox"
              defaultChecked={initial?.reverseCharge ?? false}
              value="true"
              className="h-4 w-4 rounded border-zoru-line"
            />
            <ZoruLabel htmlFor="reverseCharge" className="!mb-0">
              Reverse charge (GST)
            </ZoruLabel>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Status & Notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <ZoruSelect
              name="status"
              defaultValue={(initial?.status as string) || 'draft'}
            >
              <ZoruSelectTrigger id="status" className="mt-1.5">
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
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initial?.notes ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput
                key={String(f._id ?? f.name)}
                field={f}
                value={customFieldValues[f.name]}
                onChange={(v) => handleCustomFieldChange(f.name, v)}
              />
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/purchases/expenses/${String(initial!._id)}`
                : '/dashboard/crm/purchases/expenses'
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
