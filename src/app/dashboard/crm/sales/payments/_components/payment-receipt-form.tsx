'use client';

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
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <PaymentReceiptForm> — single source of truth for both Create and
 * Edit flows.
 *
 * Server-action driven via `savePaymentReceiptAction`. The form encodes
 * relational/reference fields (customer, bank account, currency) as
 * `<EntityFormField>` so the value stored is an id. Payment method is a
 * ZoruSelect over the fixed Rust enum. The allocation section uses a
 * plain ZoruInput for the invoice id/number since `invoice` is not in
 * the EntityKey scope here.
 *
 * Note: `'paymentReceipt'` is NOT in `WsCustomFieldBelongsTo`, so the
 * custom-fields panel is intentionally omitted.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { savePaymentReceiptAction } from '@/app/actions/crm/payment-receipts.actions';
import type {
  CrmPaymentMode,
  CrmPaymentReceiptDoc,
  CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';

interface PaymentReceiptFormProps {
  /** Existing receipt — present in Edit mode, omit for Create. */
  initial?: CrmPaymentReceiptDoc | null;
}

const PAYMENT_MODES: { value: CrmPaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
];

const RECEIPT_STATUSES: { value: CrmReceiptStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'bounced', label: 'Bounced' },
];

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create receipt'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function toDateInput(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function PaymentReceiptForm({ initial }: PaymentReceiptFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    savePaymentReceiptAction,
    INITIAL_STATE,
  );

  const editing = !!initial?._id;

  // Mode is a local state value so the cheque-specific fields can
  // conditionally show without form remounts. Defaults to existing value
  // on edit, or 'upi' on create.
  const [mode, setMode] = React.useState<CrmPaymentMode>(
    initial?.mode ?? 'upi',
  );
  const [status, setStatus] = React.useState<CrmReceiptStatus>(
    initial?.status ?? 'received',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/sales/payments/${state.id}`
          : '/dashboard/crm/sales/payments',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  // Initial invoice id from the existing applyTo[0] when editing.
  const initialInvoiceId = initial?.applyTo?.[0]?.invoiceId ?? '';

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      {/* Mode + status are ZoruSelect (client state) — render hidden mirror
          inputs so the FormData carries the latest values. */}
      <input type="hidden" name="mode" value={mode} />
      {editing ? <input type="hidden" name="status" value={status} /> : null}

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="receiptNo">
              Receipt # <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="receiptNo"
              name="receiptNo"
              required
              defaultValue={initial?.receiptNo ?? ''}
              className="mt-1.5"
              placeholder="RCPT-0001"
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
              defaultValue={toDateInput(initial?.date)}
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
                disabled={editing}
              />
            </div>
            {editing ? (
              <p className="mt-1 text-[11px] text-zoru-ink-muted">
                Customer cannot be changed after creation.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel htmlFor="payment-method">
              Payment method <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruSelect
              value={mode}
              onValueChange={(v) => setMode(v as CrmPaymentMode)}
              disabled={editing}
            >
              <ZoruSelectTrigger id="payment-method" className="mt-1.5">
                <ZoruSelectValue placeholder="Pick a method" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {PAYMENT_MODES.map((m) => (
                  <ZoruSelectItem key={m.value} value={m.value}>
                    {m.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {editing ? (
              <p className="mt-1 text-[11px] text-zoru-ink-muted">
                Payment method cannot be changed after creation.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel>
              Bank account <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="bankAccount"
                name="bankAccountId"
                initialId={initial?.bankAccountId ?? null}
                required
              />
            </div>
          </div>
          {editing ? (
            <div>
              <ZoruLabel htmlFor="receipt-status">Status</ZoruLabel>
              <ZoruSelect
                value={status}
                onValueChange={(v) => setStatus(v as CrmReceiptStatus)}
              >
                <ZoruSelectTrigger id="receipt-status" className="mt-1.5">
                  <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {RECEIPT_STATUSES.map((s) => (
                    <ZoruSelectItem key={s.value} value={s.value}>
                      {s.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          ) : null}
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Amount
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="amount">
              Amount <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={initial?.amount ?? ''}
              className="mt-1.5"
              disabled={editing}
            />
            {editing ? (
              <p className="mt-1 text-[11px] text-zoru-ink-muted">
                Amount cannot be edited; void and recreate to change.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={initial?.currency ?? 'INR'}
                disabled={editing}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="tdsDeducted">TDS deducted</ZoruLabel>
            <ZoruInput
              id="tdsDeducted"
              name="tdsDeducted"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.tdsDeducted ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="bankCharges">Bank charges</ZoruLabel>
            <ZoruInput
              id="bankCharges"
              name="bankCharges"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.bankCharges ?? ''}
              className="mt-1.5"
            />
          </div>
        </div>

        {mode === 'cheque' ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel htmlFor="chequeNo">Cheque #</ZoruLabel>
              <ZoruInput
                id="chequeNo"
                name="chequeNo"
                defaultValue={initial?.chequeNo ?? ''}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="chequeDate">Cheque date</ZoruLabel>
              <ZoruInput
                id="chequeDate"
                name="chequeDate"
                type="date"
                defaultValue={toDateInput(initial?.chequeDate)}
                className="mt-1.5"
              />
            </div>
          </div>
        ) : null}

        {mode !== 'cash' && mode !== 'cheque' ? (
          <div className="mt-4">
            <ZoruLabel htmlFor="txnId">Transaction ID</ZoruLabel>
            <ZoruInput
              id="txnId"
              name="txnId"
              defaultValue={initial?.txnId ?? ''}
              className="mt-1.5"
              placeholder="UPI / NEFT / RTGS reference"
            />
          </div>
        ) : null}
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Allocation
        </h3>
        <p className="mb-3 text-[12px] text-zoru-ink-muted">
          Optional reference to an invoice this receipt applies to. Enter
          the invoice id or number for now — multi-invoice allocation
          lives on the invoice's payment ledger.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="reference">Reference</ZoruLabel>
            <ZoruInput
              id="reference"
              name="reference"
              defaultValue={initial?.reference ?? initialInvoiceId}
              className="mt-1.5"
              placeholder="Invoice # or human reference"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Notes
        </h3>
        <ZoruTextarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ''}
          placeholder="Internal note about this payment…"
        />
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/sales/payments/${String(initial!._id)}`
                : '/dashboard/crm/sales/payments'
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
