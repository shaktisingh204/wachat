'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
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
 * Select over the fixed Rust enum. The allocation section uses a
 * plain Input for the invoice id/number since `invoice` is not in
 * the EntityKey scope here.
 *
 * Note: `'paymentReceipt'` is NOT in `WsCustomFieldBelongsTo`, so the
 * custom-fields panel is intentionally omitted.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
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
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create receipt'}
    </Button>
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
  const { toast } = useToast();
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
      {/* Mode + status are Select (client state) — render hidden mirror
          inputs so the FormData carries the latest values. */}
      <input type="hidden" name="mode" value={mode} />
      {editing ? <input type="hidden" name="status" value={status} /> : null}

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Header
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="receiptNo">
              Receipt # <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="receiptNo"
              name="receiptNo"
              required
              defaultValue={initial?.receiptNo ?? ''}
              className="mt-1.5"
              placeholder="RCPT-0001"
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
              defaultValue={toDateInput(initial?.date)}
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
                name="clientId"
                initialId={initial?.clientId ?? null}
                required
                disabled={editing}
              />
            </div>
            {editing ? (
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                Customer cannot be changed after creation.
              </p>
            ) : null}
          </div>
          <div>
            <Label>
              Payment method <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="paymentMode"
                name="__mode_picker"
                initialId={mode}
                disabled={editing}
                onChange={(v) => setMode((v ?? 'upi') as CrmPaymentMode)}
              />
            </div>
            {editing ? (
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                Payment method cannot be changed after creation.
              </p>
            ) : null}
          </div>
          <div>
            <Label>
              Bank account <span className="text-[var(--st-danger)]">*</span>
            </Label>
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
              <Label>Status</Label>
              <div className="mt-1.5">
                <EnumFormField
                  enumName="paymentReceiptStatus"
                  name="__status_picker"
                  initialId={status}
                  onChange={(v) => setStatus((v ?? 'received') as CrmReceiptStatus)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Amount
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="amount">
              Amount <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
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
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                Amount cannot be edited; void and recreate to change.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Currency</Label>
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
            <Label htmlFor="tdsDeducted">TDS deducted</Label>
            <Input
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
            <Label htmlFor="bankCharges">Bank charges</Label>
            <Input
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
              <Label htmlFor="chequeNo">Cheque #</Label>
              <Input
                id="chequeNo"
                name="chequeNo"
                defaultValue={initial?.chequeNo ?? ''}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="chequeDate">Cheque date</Label>
              <Input
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
            <Label htmlFor="txnId">Transaction ID</Label>
            <Input
              id="txnId"
              name="txnId"
              defaultValue={initial?.txnId ?? ''}
              className="mt-1.5"
              placeholder="UPI / NEFT / RTGS reference"
            />
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Allocation
        </h3>
        <p className="mb-3 text-[12px] text-[var(--st-text-secondary)]">
          Optional reference to an invoice this receipt applies to. Enter
          the invoice id or number for now — multi-invoice allocation
          lives on the invoice's payment ledger.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              name="reference"
              defaultValue={initial?.reference ?? initialInvoiceId}
              className="mt-1.5"
              placeholder="Invoice # or human reference"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Notes
        </h3>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ''}
          placeholder="Internal note about this payment…"
        />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/sales/payments/${String(initial!._id)}`
                : '/dashboard/crm/sales/payments'
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
