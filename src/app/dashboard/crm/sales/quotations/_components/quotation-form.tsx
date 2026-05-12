'use client';

/**
 * <QuotationForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveQuotationAction`. Relational/reference
 * fields (`clientId`, `currency`, `ownerId`, `salesAgentId`,
 * per-line `itemId` / `warehouseId` / `taxRatePct`) are encoded as
 * `<EntityFormField>`s / `<EntityPicker>` rows so the values written
 * to FormData are ids. Line items are managed locally and serialised
 * to a single `items` JSON blob on submit. Custom fields are rendered
 * below the standard fields and submitted as a single `customFields`
 * JSON blob — the action layer fans them out via
 * `applyCustomFieldsToEntity`.
 */

import * as React from 'react';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';

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
import { EntityPicker } from '@/components/crm/entity-picker';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveQuotationAction } from '@/app/actions/crm/quotations.actions';
import type {
  CrmQuotationDoc,
  CrmQuotationLineItem,
  CrmQuotationStatus,
} from '@/lib/rust-client/crm-quotations';
import type { LookupItem } from '@/lib/lookup-registry';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface QuotationFormProps {
  /** Existing quotation — present in Edit mode, omit for Create. */
  initial?: CrmQuotationDoc | null;
  /** Custom field definitions for `belongs_to = 'quotation'`. */
  customFields: WsCustomField[];
}

const STATUS_OPTIONS: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create quotation'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/**
 * Editable row state — mirrors `CrmQuotationLineItem` plus a local
 * `rowKey` so React can key sibling rows even when ids/descriptions
 * are blank.
 */
interface LineRow {
  rowKey: string;
  itemId?: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  total?: number;
}

function freshRow(): LineRow {
  return {
    rowKey: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    qty: 1,
    rate: 0,
  };
}

function seedRows(items?: CrmQuotationLineItem[]): LineRow[] {
  if (!items || items.length === 0) return [freshRow()];
  return items.map((it, idx) => ({
    rowKey: `seed-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: it.itemId,
    description: it.description,
    hsnSac: it.hsnSac,
    qty: typeof it.qty === 'number' ? it.qty : 0,
    unit: it.unit,
    rate: typeof it.rate === 'number' ? it.rate : 0,
    discountPct: it.discountPct,
    taxRatePct: it.taxRatePct,
    total: it.total,
  }));
}

function toIsoDate(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function QuotationForm({ initial, customFields }: QuotationFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveQuotationAction, INITIAL_STATE);

  const editing = !!initial?._id;

  /* ----- line items -------------------------------------------- */
  const [rows, setRows] = useState<LineRow[]>(() => seedRows(initial?.items));

  const addRow = () => setRows((prev) => [...prev, freshRow()]);
  const removeRow = (key: string) =>
    setRows((prev) =>
      prev.length === 1 ? [freshRow()] : prev.filter((r) => r.rowKey !== key),
    );
  const patchRow = (key: string, patch: Partial<LineRow>) =>
    setRows((prev) => prev.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));

  const itemsPayload = useMemo<CrmQuotationLineItem[]>(
    () =>
      rows.map((r) => {
        const qty = Number(r.qty) || 0;
        const rate = Number(r.rate) || 0;
        const sub = qty * rate;
        const taxRate = Number(r.taxRatePct);
        const total =
          sub +
          (Number.isFinite(taxRate) && taxRate > 0 ? (sub * taxRate) / 100 : 0);
        return {
          itemId: r.itemId,
          description: r.description,
          hsnSac: r.hsnSac,
          qty,
          unit: r.unit,
          rate,
          discountPct: r.discountPct,
          taxRatePct: Number.isFinite(taxRate) ? taxRate : undefined,
          total,
        };
      }),
    [rows],
  );

  /* ----- totals ------------------------------------------------ */
  const totals = useMemo(() => {
    let subTotal = 0;
    let taxTotal = 0;
    for (const r of rows) {
      const qty = Number(r.qty) || 0;
      const rate = Number(r.rate) || 0;
      const sub = qty * rate;
      subTotal += sub;
      const taxRate = Number(r.taxRatePct);
      if (Number.isFinite(taxRate) && taxRate > 0) {
        taxTotal += (sub * taxRate) / 100;
      }
    }
    return { subTotal, taxTotal, total: subTotal + taxTotal };
  }, [rows]);

  /* ----- custom fields ----------------------------------------- */
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

  /* ----- currency tracker (drives money labels in real time) --- */
  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const fmtMoney = (n: number) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${currency || 'INR'} ${n.toFixed(2)}`;
    }
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/sales/quotations/${state.id}`
          : '/dashboard/crm/sales/quotations',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const handleCustomFieldChange = (name: string, next: CustomFieldValue) => {
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldValues)}
      />
      <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="quotationNo">
              Quotation # <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="quotationNo"
              name="quotationNo"
              required
              defaultValue={initial?.quotationNo ?? ''}
              placeholder="QT-2026-0042"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Customer <span className="text-zoru-danger-ink">*</span></ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="clientId"
                initialId={initial?.clientId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="date">
              Quotation date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={toIsoDate(initial?.date)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="validUntil">
              Valid until <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="validUntil"
              name="validUntil"
              type="date"
              required
              defaultValue={toIsoDate(initial?.validUntil)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="subject">Subject</ZoruLabel>
            <ZoruInput
              id="subject"
              name="subject"
              defaultValue={initial?.subject ?? ''}
              placeholder="Q3 hosting renewal"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={initial?.currency ?? 'INR'}
                onChange={(next) => setCurrency(next ?? 'INR')}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="placeOfSupply">Place of supply</ZoruLabel>
            <ZoruInput
              id="placeOfSupply"
              name="placeOfSupply"
              defaultValue={initial?.placeOfSupply ?? ''}
              placeholder="State code (GST)"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel>Owner (Sales agent)</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="ownerId"
                initialId={initial?.assignment?.assignedTo ?? initial?.salesAgentId ?? null}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items <span className="text-zoru-danger-ink">*</span>
          </h3>
          <ZoruButton type="button" variant="outline" size="sm" onClick={addRow}>
            <PlusCircle className="h-4 w-4" />
            Add line
          </ZoruButton>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2">
              <tr className="border-b border-zoru-line">
                <th className="p-2.5 text-left text-zoru-ink">Item / Description</th>
                <th className="p-2.5 text-right text-zoru-ink">Qty</th>
                <th className="p-2.5 text-right text-zoru-ink">Unit price</th>
                <th className="p-2.5 text-right text-zoru-ink">Tax</th>
                <th className="p-2.5 text-right text-zoru-ink">Amount</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const qty = Number(row.qty) || 0;
                const rate = Number(row.rate) || 0;
                const sub = qty * rate;
                const taxRate = Number(row.taxRatePct);
                const lineTotal =
                  sub +
                  (Number.isFinite(taxRate) && taxRate > 0
                    ? (sub * taxRate) / 100
                    : 0);
                return (
                  <tr key={row.rowKey} className="border-b border-zoru-line last:border-b-0 align-top">
                    <td className="p-2 space-y-1.5">
                      <EntityPicker
                        entity="item"
                        value={row.itemId ?? null}
                        placeholder="Pick item or leave blank"
                        onChange={(next, hydrated) => {
                          const id = Array.isArray(next) ? next[0] ?? null : next ?? null;
                          const item = (Array.isArray(hydrated)
                            ? hydrated[0]
                            : hydrated) as LookupItem | undefined;
                          const raw = (item?.raw ?? {}) as Record<string, unknown>;
                          patchRow(row.rowKey, {
                            itemId: id ?? undefined,
                            description:
                              row.description ??
                              (typeof raw.description === 'string'
                                ? (raw.description as string)
                                : typeof raw.name === 'string'
                                  ? (raw.name as string)
                                  : undefined),
                            rate:
                              typeof raw.sellingPrice === 'number'
                                ? (raw.sellingPrice as number)
                                : row.rate,
                            hsnSac:
                              typeof raw.hsnSac === 'string'
                                ? (raw.hsnSac as string)
                                : row.hsnSac,
                          });
                        }}
                      />
                      <ZoruInput
                        value={row.description ?? ''}
                        onChange={(e) =>
                          patchRow(row.rowKey, { description: e.target.value })
                        }
                        placeholder="Description"
                        className="h-8 text-[12.5px]"
                      />
                    </td>
                    <td className="p-2">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.qty}
                        onChange={(e) =>
                          patchRow(row.rowKey, { qty: Number(e.target.value) })
                        }
                        className="h-8 w-24 text-right text-[12.5px]"
                      />
                    </td>
                    <td className="p-2">
                      <ZoruInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.rate}
                        onChange={(e) =>
                          patchRow(row.rowKey, { rate: Number(e.target.value) })
                        }
                        className="h-8 w-32 text-right text-[12.5px]"
                      />
                    </td>
                    <td className="p-2">
                      <EntityPicker
                        entity="taxRate"
                        value={
                          Number.isFinite(Number(row.taxRatePct))
                            ? String(row.taxRatePct)
                            : null
                        }
                        placeholder="Tax %"
                        onChange={(_id, hydrated) => {
                          const item = (Array.isArray(hydrated)
                            ? hydrated[0]
                            : hydrated) as LookupItem | undefined;
                          const raw = (item?.raw ?? {}) as Record<string, unknown>;
                          const next =
                            typeof raw.rate === 'number'
                              ? (raw.rate as number)
                              : typeof raw.percent === 'number'
                                ? (raw.percent as number)
                                : Number(item?.id ?? '');
                          patchRow(row.rowKey, {
                            taxRatePct: Number.isFinite(next) ? next : undefined,
                          });
                        }}
                      />
                    </td>
                    <td className="p-2 text-right text-zoru-ink tabular-nums">
                      {fmtMoney(lineTotal)}
                    </td>
                    <td className="p-2">
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.rowKey)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
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
        <div className="grid gap-2 md:grid-cols-2 text-[13px]">
          <div className="flex justify-between md:col-start-2">
            <span className="text-zoru-ink-muted">Subtotal</span>
            <span className="text-zoru-ink tabular-nums">{fmtMoney(totals.subTotal)}</span>
          </div>
          <div className="flex justify-between md:col-start-2">
            <span className="text-zoru-ink-muted">Tax</span>
            <span className="text-zoru-ink tabular-nums">{fmtMoney(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-zoru-line pt-2 md:col-start-2">
            <span className="font-medium text-zoru-ink">Total</span>
            <span className="text-zoru-ink font-medium tabular-nums">
              {fmtMoney(totals.total)}
            </span>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Status & body
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {editing ? (
            <div>
              <ZoruLabel htmlFor="status">Status</ZoruLabel>
              <ZoruSelect
                name="status"
                defaultValue={(initial?.status ?? 'draft') as string}
              >
                <ZoruSelectTrigger className="mt-1.5">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <ZoruSelectItem key={s} value={s}>
                      {s}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="termsAndConditions">Terms &amp; conditions</ZoruLabel>
            <ZoruTextarea
              id="termsAndConditions"
              name="termsAndConditions"
              defaultValue={initial?.termsAndConditions ?? ''}
              placeholder="Net 30. Prices in INR…"
              className="mt-1.5 min-h-[88px]"
            />
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="notes">Customer notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              defaultValue={initial?.customerNotes ?? ''}
              placeholder="Pricing valid till month-end."
              className="mt-1.5 min-h-[72px]"
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
                ? `/dashboard/crm/sales/quotations/${String(initial!._id)}`
                : '/dashboard/crm/sales/quotations'
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
