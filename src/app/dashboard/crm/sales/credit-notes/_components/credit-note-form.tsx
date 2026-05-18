'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle,
  PlusCircle,
  Trash2 } from 'lucide-react';

/**
 * <CreditNoteForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveCreditNoteAction`. The customer
 * reference is encoded as an `<EntityFormField entity="client">`. The
 * `originalInvoiceId` field is a plain `<ZoruInput>` because the
 * `invoice` EntityKey isn't registered yet — once it is, swap this to
 * `<EntityFormField entity="invoice">`.
 *
 * Line items and totals are dynamic state, serialized as JSON hidden
 * inputs before submission. No custom fields — `'creditNote'` is not in
 * `WsCustomFieldBelongsTo`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import { saveCreditNoteAction } from '@/app/actions/crm/credit-notes.actions';
import type {
  CreditNoteLineItem,
  CreditNoteReason,
  CreditNoteStatus,
  CreditNoteTotals,
  CrmCreditNoteDoc,
  RefundMode,
} from '@/lib/rust-client/crm-credit-notes';

interface CreditNoteFormProps {
  /** Existing credit note — present in Edit mode, omit for Create. */
  initial?: CrmCreditNoteDoc | null;
}

interface EditableLineRow {
  /** Local row id — never sent to the server. */
  rowKey: string;
  description: string;
  hsnSac: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  taxRatePct: string;
}

// Reason / refund-mode / status options now sourced from CRM_ENUMS
// (`creditNoteReason`, `creditNoteRefundMode`, `creditNoteStatusV2`).

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create credit note'}
    </ZoruButton>
  );
}

function makeRowKey(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowFromLineItem(item: CreditNoteLineItem): EditableLineRow {
  return {
    rowKey: makeRowKey(),
    description: item.description ?? '',
    hsnSac: item.hsnSac ?? '',
    qty: item.qty != null ? String(item.qty) : '1',
    unit: item.unit ?? '',
    rate: item.rate != null ? String(item.rate) : '0',
    discountPct: item.discountPct != null ? String(item.discountPct) : '',
    taxRatePct: item.taxRatePct != null ? String(item.taxRatePct) : '',
  };
}

function blankRow(): EditableLineRow {
  return {
    rowKey: makeRowKey(),
    description: '',
    hsnSac: '',
    qty: '1',
    unit: '',
    rate: '0',
    discountPct: '',
    taxRatePct: '',
  };
}

/** Compute one row's total: qty * rate - discount, tax on top. */
function computeRowTotal(row: EditableLineRow): number {
  const qty = Number(row.qty) || 0;
  const rate = Number(row.rate) || 0;
  const sub = qty * rate;
  const dPct = Number(row.discountPct) || 0;
  const afterDiscount = sub - sub * (dPct / 100);
  const tPct = Number(row.taxRatePct) || 0;
  const taxed = afterDiscount + afterDiscount * (tPct / 100);
  return Math.round(taxed * 100) / 100;
}

function serializeItems(rows: EditableLineRow[]): CreditNoteLineItem[] {
  return rows.map((row) => {
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const item: CreditNoteLineItem = {
      qty,
      rate,
      total: computeRowTotal(row),
    };
    if (row.description.trim()) item.description = row.description.trim();
    if (row.hsnSac.trim()) item.hsnSac = row.hsnSac.trim();
    if (row.unit.trim()) item.unit = row.unit.trim();
    if (row.discountPct.trim()) {
      const d = Number(row.discountPct);
      if (Number.isFinite(d)) item.discountPct = d;
    }
    if (row.taxRatePct.trim()) {
      const t = Number(row.taxRatePct);
      if (Number.isFinite(t)) item.taxRatePct = t;
    }
    return item;
  });
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

export function CreditNoteForm({ initial }: CreditNoteFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveCreditNoteAction, INITIAL_STATE);

  const editing = !!initial?._id;

  const [items, setItems] = useState<EditableLineRow[]>(() => {
    if (initial?.items?.length) return initial.items.map(rowFromLineItem);
    return [blankRow()];
  });
  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [reason, setReason] = useState<CreditNoteReason>(initial?.reason ?? 'return');
  const [refundMode, setRefundMode] = useState<RefundMode>(initial?.refundMode ?? 'cash');
  const [status, setStatus] = useState<CreditNoteStatus>(initial?.status ?? 'draft');
  const [discountOverall, setDiscountOverall] = useState<string>(
    initial?.totals?.discountOverall != null ? String(initial.totals.discountOverall) : '',
  );
  const [shippingCharge, setShippingCharge] = useState<string>(
    initial?.totals?.shippingCharge != null ? String(initial.totals.shippingCharge) : '',
  );
  const [adjustment, setAdjustment] = useState<string>(
    initial?.totals?.adjustment != null ? String(initial.totals.adjustment) : '',
  );
  const [roundOff, setRoundOff] = useState<string>(
    initial?.totals?.roundOff != null ? String(initial.totals.roundOff) : '',
  );

  const totals: CreditNoteTotals = useMemo(() => {
    const subTotal = items.reduce((sum, row) => sum + computeRowTotal(row), 0);
    const dOverall = Number(discountOverall) || 0;
    const ship = Number(shippingCharge) || 0;
    const adj = Number(adjustment) || 0;
    const round = Number(roundOff) || 0;
    const total = Math.round((subTotal - dOverall + ship + adj + round) * 100) / 100;
    return {
      subTotal: Math.round(subTotal * 100) / 100,
      discountOverall: discountOverall.trim() ? dOverall : undefined,
      shippingCharge: shippingCharge.trim() ? ship : undefined,
      adjustment: adjustment.trim() ? adj : undefined,
      roundOff: roundOff.trim() ? round : undefined,
      total,
    };
  }, [items, discountOverall, shippingCharge, adjustment, roundOff]);

  const serializedItems = useMemo(() => serializeItems(items), [items]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/sales/credit-notes/${state.id}`
          : '/dashboard/crm/sales/credit-notes',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const updateRow = (rowKey: string, patch: Partial<EditableLineRow>) => {
    setItems((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  };

  const addRow = () => setItems((prev) => [...prev, blankRow()]);
  const removeRow = (rowKey: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
  };

  const dateDefault = (() => {
    if (initial?.date) {
      const d = new Date(initial.date);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  })();

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input type="hidden" name="items" value={JSON.stringify(serializedItems)} />
      <input type="hidden" name="totals" value={JSON.stringify(totals)} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="refundMode" value={refundMode} />
      <input type="hidden" name="status" value={status} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Credit note
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="cnNo">
              Credit note # <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="cnNo"
              name="cnNo"
              required
              defaultValue={initial?.cnNo ?? ''}
              className="mt-1.5"
              placeholder="CN-00001"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="date">
              Date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="date"
              name="date"
              type="date"
              required
              defaultValue={dateDefault}
              className="mt-1.5"
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
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel>
              Linked invoice
              {refundMode === 'credit' ? (
                <span className="ml-1 text-[10.5px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  apply target
                </span>
              ) : (
                <span className="ml-1 text-[10.5px] uppercase tracking-wider text-zoru-ink-muted">
                  optional reference
                </span>
              )}
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="invoice"
                name="linkedInvoiceId"
                initialId={initial?.linkedInvoiceId ?? null}
                placeholder={
                  refundMode === 'credit'
                    ? 'Pick the invoice this credit applies to…'
                    : 'Pick the source invoice (optional)…'
                }
                required={refundMode === 'credit'}
              />
            </div>
            <p className="mt-1 text-[11px] text-zoru-ink-muted">
              {refundMode === 'credit'
                ? 'Required for "Apply as customer credit" — the credit settles against this invoice.'
                : refundMode === 'cash'
                  ? 'Helpful for audit, but not required for a cash refund.'
                  : 'Helpful for audit, but not required for a replacement.'}
            </p>
          </div>
          <div>
            <ZoruLabel>Reason</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="creditNoteReason"
                name="__reason_picker"
                initialId={reason || null}
                onChange={(id) => setReason((id ?? 'other') as CreditNoteReason)}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={currency}
                onChange={(next) => setCurrency(next ?? 'INR')}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      {/* ─── Line items ─────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
          <ZoruButton type="button" size="sm" variant="outline" onClick={addRow}>
            <PlusCircle className="h-3.5 w-3.5" /> Add row
          </ZoruButton>
        </div>
        <div className="overflow-x-auto">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="min-w-[200px]">Description</ZoruTableHead>
                <ZoruTableHead className="w-[110px]">HSN/SAC</ZoruTableHead>
                <ZoruTableHead className="w-[90px]">Qty</ZoruTableHead>
                <ZoruTableHead className="w-[90px]">Unit</ZoruTableHead>
                <ZoruTableHead className="w-[110px]">Rate</ZoruTableHead>
                <ZoruTableHead className="w-[90px]">Disc %</ZoruTableHead>
                <ZoruTableHead className="w-[90px]">Tax %</ZoruTableHead>
                <ZoruTableHead className="w-[120px] text-right">Line total</ZoruTableHead>
                <ZoruTableHead className="w-[40px]" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {items.map((row) => (
                <ZoruTableRow key={row.rowKey}>
                  <ZoruTableCell>
                    <ZoruInput
                      value={row.description}
                      onChange={(e) => updateRow(row.rowKey, { description: e.target.value })}
                      placeholder="Item or service"
                      className="h-8 text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruInput
                      value={row.hsnSac}
                      onChange={(e) => updateRow(row.rowKey, { hsnSac: e.target.value })}
                      className="h-8 text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.qty}
                      onChange={(e) => updateRow(row.rowKey, { qty: e.target.value })}
                      className="h-8 text-right text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <EntityPicker
                      entity="unit"
                      value={row.unit || null}
                      placeholder="nos"
                      onChange={(next) => {
                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                        updateRow(row.rowKey, { unit: id });
                      }}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => updateRow(row.rowKey, { rate: e.target.value })}
                      className="h-8 text-right text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruInput
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.discountPct}
                      onChange={(e) =>
                        updateRow(row.rowKey, { discountPct: e.target.value })
                      }
                      className="h-8 text-right text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruInput
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.taxRatePct}
                      onChange={(e) =>
                        updateRow(row.rowKey, { taxRatePct: e.target.value })
                      }
                      className="h-8 text-right text-[12.5px]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                    {fmtMoney(computeRowTotal(row), currency)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(row.rowKey)}
                      disabled={items.length <= 1}
                      className="text-zoru-danger-ink"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ZoruButton>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      {/* ─── Totals ─────────────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="discountOverall">Overall discount</ZoruLabel>
            <ZoruInput
              id="discountOverall"
              type="number"
              min={0}
              step="0.01"
              value={discountOverall}
              onChange={(e) => setDiscountOverall(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="shippingCharge">Shipping charge</ZoruLabel>
            <ZoruInput
              id="shippingCharge"
              type="number"
              min={0}
              step="0.01"
              value={shippingCharge}
              onChange={(e) => setShippingCharge(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="adjustment">Adjustment</ZoruLabel>
            <ZoruInput
              id="adjustment"
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="roundOff">Round off</ZoruLabel>
            <ZoruInput
              id="roundOff"
              type="number"
              step="0.01"
              value={roundOff}
              onChange={(e) => setRoundOff(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-end gap-1 border-t border-zoru-line pt-4 text-[13px] tabular-nums">
          <div className="text-zoru-ink-muted">
            Subtotal: <span className="ml-2 text-zoru-ink">{fmtMoney(totals.subTotal, currency)}</span>
          </div>
          <div className="text-[15px] font-semibold text-zoru-ink">
            Total: {fmtMoney(totals.total, currency)}
          </div>
        </div>
      </ZoruCard>

      {/* ─── Refund + Status ────────────────────────────────────── */}
      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Refund & status
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Refund mode</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="creditNoteRefundMode"
                name="__refundMode_picker"
                initialId={refundMode || null}
                onChange={(id) => setRefundMode((id ?? 'cash') as RefundMode)}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="refundTxnId">Refund transaction ID</ZoruLabel>
            <ZoruInput
              id="refundTxnId"
              name="refundTxnId"
              defaultValue={initial?.refundTxnId ?? ''}
              className="mt-1.5"
              placeholder="TXN-…"
            />
          </div>
          <div>
            <ZoruLabel>Status</ZoruLabel>
            <div className="mt-1.5">
              <EnumFormField
                enumName="creditNoteStatusV2"
                name="__status_picker"
                initialId={status || null}
                onChange={(id) => setStatus((id ?? 'draft') as CreditNoteStatus)}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink-muted">
              <input
                type="checkbox"
                name="taxRecalc"
                value="true"
                defaultChecked={!!initial?.taxRecalc}
                className="h-4 w-4 rounded border-zoru-line"
              />
              Recompute taxes from line items
            </label>
          </div>
        </div>

        <div className="mt-4">
          <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ''}
            className="mt-1.5"
            rows={3}
            placeholder="Internal or customer-facing notes"
          />
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/sales/credit-notes/${String(initial!._id)}`
                : '/dashboard/crm/sales/credit-notes'
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
