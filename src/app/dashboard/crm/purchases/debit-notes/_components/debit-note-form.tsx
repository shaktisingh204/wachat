'use client';

import { Button, Card, Input, Label, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle,
  PlusCircle,
  Trash2 } from 'lucide-react';

/**
 * <DebitNoteForm> — single source of truth for both Create and Edit
 * flows.
 *
 * Server-action driven via `saveDebitNoteAction`. The vendor reference
 * is encoded as an `<EntityFormField entity="vendor">`. The
 * `linkedBillId` field is a plain `<Input>` because the `bill`
 * EntityKey isn't registered yet — once it is, swap this to
 * `<EntityFormField entity="bill">`.
 *
 * Line items and totals are dynamic state, serialized as JSON hidden
 * inputs before submission. Each row uses `<EntityFormField>` pickers
 * for item and taxRate (auto-filling rate from catalog metadata).
 *
 * No custom fields — `'debitNote'` is not in `WsCustomFieldBelongsTo`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveDebitNoteAction } from '@/app/actions/crm/debit-notes.actions';
import type {
  CrmDebitNoteDoc,
  CrmDebitNoteLineItem,
  CrmDebitNoteTotals,
  DebitNoteReason,
  DebitNoteRefundMode,
  DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';

interface DebitNoteFormProps {
  /** Existing debit note — present in Edit mode, omit for Create. */
  initial?: CrmDebitNoteDoc | null;
}

interface EditableLineRow {
  /** Local row id — never sent to the server. */
  rowKey: string;
  itemId: string;
  description: string;
  hsnSac: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  taxRatePct: string;
}

const REASONS: Array<{ value: DebitNoteReason; label: string }> = [
  { value: 'return', label: 'Return' },
  { value: 'discount', label: 'Discount' },
  { value: 'price_adjust', label: 'Price adjustment' },
  { value: 'cancel', label: 'Cancellation' },
  { value: 'other', label: 'Other' },
];

const REFUND_MODES: Array<{ value: DebitNoteRefundMode; label: string }> = [
  { value: 'cash', label: 'Cash / bank' },
  { value: 'credit', label: 'Vendor credit' },
  { value: 'replacement', label: 'Replacement' },
];

const STATUSES: Array<{ value: DebitNoteStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create debit note'}
    </Button>
  );
}

function makeRowKey(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowFromLineItem(item: CrmDebitNoteLineItem): EditableLineRow {
  return {
    rowKey: makeRowKey(),
    itemId: item.itemId ?? '',
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
    itemId: '',
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

function serializeItems(rows: EditableLineRow[]): CrmDebitNoteLineItem[] {
  return rows.map((row) => {
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const item: CrmDebitNoteLineItem = {
      qty,
      rate,
      total: computeRowTotal(row),
    };
    if (row.itemId.trim()) item.itemId = row.itemId.trim();
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

export function DebitNoteForm({ initial }: DebitNoteFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDebitNoteAction, INITIAL_STATE);

  const editing = !!initial?._id;
  // Smart-default: pre-fill `linkedBillId` from `?billId=…` if present.
  const presetBillId = searchParams?.get('billId') ?? '';

  const [items, setItems] = useState<EditableLineRow[]>(() => {
    if (initial?.items?.length) return initial.items.map(rowFromLineItem);
    return [blankRow()];
  });
  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
  const [reason, setReason] = useState<DebitNoteReason>(initial?.reason ?? 'return');
  const [refundMode, setRefundMode] = useState<DebitNoteRefundMode>(
    initial?.refundMode ?? 'cash',
  );
  const [status, setStatus] = useState<DebitNoteStatus>(initial?.status ?? 'draft');
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

  const totals: CrmDebitNoteTotals = useMemo(() => {
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
          ? `/dashboard/crm/purchases/debit-notes/${state.id}`
          : '/dashboard/crm/purchases/debit-notes',
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
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Debit note
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="dnNo">
              Debit note # <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="dnNo"
              name="dnNo"
              required
              defaultValue={initial?.dnNo ?? ''}
              className="mt-1.5"
              placeholder="DN-00001"
            />
          </div>
          <div>
            <Label htmlFor="date">
              Date <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={dateDefault}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>
              Vendor <span className="text-[var(--st-danger)]">*</span>
            </Label>
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
            <Label htmlFor="linkedBillId">Original bill #</Label>
            {/*
              The `bill` EntityKey isn't registered yet — keep this as
              a plain text input. Wire to `<EntityFormField entity="bill">`
              once the EntityKey lands.
            */}
            <Input
              id="linkedBillId"
              name="linkedBillId"
              defaultValue={initial?.linkedBillId ?? presetBillId}
              className="mt-1.5"
              placeholder="BILL-00012"
            />
          </div>
          <div>
            <Label>Reason</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="debitNoteReason"
                name="__reason_picker"
                initialId={reason || null}
                onChange={(id) => setReason((id ?? 'other') as DebitNoteReason)}
              />
            </div>
          </div>
          <div>
            <Label>Currency</Label>
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
      </Card>

      {/* ─── Line items ─────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Line items
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <PlusCircle className="h-3.5 w-3.5" /> Add row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th className="min-w-[200px]">Item</Th>
                <Th className="min-w-[180px]">Description</Th>
                <Th className="w-[90px]">Qty</Th>
                <Th className="w-[110px]">Unit price</Th>
                <Th className="min-w-[150px]">Tax rate</Th>
                <Th className="w-[120px] text-right">Line total</Th>
                <Th className="w-[40px]" />
              </Tr>
            </THead>
            <TBody>
              {items.map((row) => (
                <Tr key={row.rowKey}>
                  <Td className="align-top">
                    <EntityFormField
                      entity="item"
                      name={`__item_${row.rowKey}`}
                      initialId={row.itemId || null}
                      onChange={(id, hydrated) => {
                        // Auto-fill rate from the catalog item's selling
                        // price when the user picks a known item.
                        const raw = hydrated?.raw as
                          | Record<string, unknown>
                          | undefined;
                        const rate =
                          typeof raw?.purchasePrice === 'number'
                            ? raw.purchasePrice
                            : typeof raw?.sellingPrice === 'number'
                              ? raw.sellingPrice
                              : typeof raw?.rate === 'number'
                                ? raw.rate
                                : undefined;
                        const description =
                          typeof raw?.description === 'string'
                            ? raw.description
                            : row.description;
                        updateRow(row.rowKey, {
                          itemId: id ?? '',
                          ...(rate != null ? { rate: String(rate) } : {}),
                          ...(description != null ? { description } : {}),
                        });
                      }}
                    />
                  </Td>
                  <Td className="align-top">
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(row.rowKey, { description: e.target.value })}
                      placeholder="Item or service"
                      className="h-8 text-[12.5px]"
                    />
                  </Td>
                  <Td className="align-top">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.qty}
                      onChange={(e) => updateRow(row.rowKey, { qty: e.target.value })}
                      className="h-8 text-right text-[12.5px]"
                    />
                  </Td>
                  <Td className="align-top">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => updateRow(row.rowKey, { rate: e.target.value })}
                      className="h-8 text-right text-[12.5px]"
                    />
                  </Td>
                  <Td className="align-top">
                    <EntityFormField
                      entity="taxRate"
                      name={`__tax_${row.rowKey}`}
                      initialId={row.taxRatePct ? row.taxRatePct : null}
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
                        updateRow(row.rowKey, {
                          taxRatePct: pct != null ? String(pct) : '',
                        });
                      }}
                    />
                  </Td>
                  <Td className="text-right align-top tabular-nums text-[12.5px]">
                    {fmtMoney(computeRowTotal(row), currency)}
                  </Td>
                  <Td className="align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(row.rowKey)}
                      disabled={items.length <= 1}
                      className="text-[var(--st-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* ─── Totals ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Totals
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="discountOverall">Overall discount</Label>
            <Input
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
            <Label htmlFor="shippingCharge">Shipping charge</Label>
            <Input
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
            <Label htmlFor="adjustment">Adjustment</Label>
            <Input
              id="adjustment"
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="roundOff">Round off</Label>
            <Input
              id="roundOff"
              type="number"
              step="0.01"
              value={roundOff}
              onChange={(e) => setRoundOff(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-end gap-1 border-t border-[var(--st-border)] pt-4 text-[13px] tabular-nums">
          <div className="text-[var(--st-text-secondary)]">
            Subtotal: <span className="ml-2 text-[var(--st-text)]">{fmtMoney(totals.subTotal, currency)}</span>
          </div>
          <div className="text-[15px] font-semibold text-[var(--st-text)]">
            Total: {fmtMoney(totals.total, currency)}
          </div>
        </div>
      </Card>

      {/* ─── Refund + Status ────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Refund & status
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Refund mode</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="debitNoteRefundMode"
                name="__refundMode_picker"
                initialId={refundMode || null}
                onChange={(id) => setRefundMode((id ?? 'cash') as DebitNoteRefundMode)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="refundTxnId">Refund transaction ID</Label>
            <Input
              id="refundTxnId"
              name="refundTxnId"
              defaultValue={initial?.refundTxnId ?? ''}
              className="mt-1.5"
              placeholder="TXN-…"
            />
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="debitNoteStatusV2"
                name="__status_picker"
                initialId={status || null}
                onChange={(id) => setStatus((id ?? 'draft') as DebitNoteStatus)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ''}
            className="mt-1.5"
            rows={3}
            placeholder="Internal or vendor-facing notes"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/purchases/debit-notes/${String(initial!._id)}`
                : '/dashboard/crm/purchases/debit-notes'
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
