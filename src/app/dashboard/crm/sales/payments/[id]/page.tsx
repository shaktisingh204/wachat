import { Button, Card, Badge } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Payment receipt detail — `/dashboard/crm/sales/payments/[id]`.
 *
 * Server component: hydrates the receipt via the Rust client, resolves
 * relational fields (customer, bank account, currency) through
 * `<EntityPickerChip>`, and renders the allocation summary. Edit and
 * Delete actions live on this page; the delete dialog is on the list
 * page.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getPaymentReceipt } from '@/app/actions/crm/payment-receipts.actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

export default async function PaymentReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { receipt, error } = await getPaymentReceipt(id);

  if (!receipt) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this payment receipt — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/sales/payments">
              <ArrowLeft className="h-4 w-4" /> Back to Payment Receipts
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const title = receipt.receiptNo || String(receipt._id);
  const applied = receipt.applyTo ?? [];

  return (
    <EntityDetailShell
      eyebrow="PAYMENT RECEIPT"
      title={title}
      back={{ href: '/dashboard/crm/sales/payments', label: 'Payment Receipts' }}
      actions={
        <Button asChild>
          <Link href={`/dashboard/crm/sales/payments/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      }
    >

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Receipt #">{receipt.receiptNo || '—'}</Field>
            <Field label="Date">{fmtDate(receipt.date)}</Field>
            <Field label="Customer">
              {receipt.clientId ? (
                <EntityPickerChip entity="client" id={receipt.clientId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Payment method">
              <Badge variant="outline">{receipt.mode}</Badge>
            </Field>
            <Field label="Bank account">
              {receipt.bankAccountId ? (
                <EntityPickerChip entity="bankAccount" id={receipt.bankAccountId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Status">
              {receipt.status ? (
                <Badge variant="outline">{receipt.status}</Badge>
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Mode details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cheque #">{receipt.chequeNo || '—'}</Field>
            <Field label="Cheque date">{fmtDate(receipt.chequeDate)}</Field>
            <Field label="Transaction ID">
              {receipt.txnId ? (
                <span className="font-mono text-[12.5px]">{receipt.txnId}</span>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Reference">{receipt.reference || '—'}</Field>
          </div>

          {receipt.notes ? (
            <>
              <h3 className="mb-2 mt-8 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {receipt.notes}
              </p>
            </>
          ) : null}
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Amount
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Amount">{fmtMoney(receipt.amount, receipt.currency)}</Field>
            <Field label="Currency">{receipt.currency || '—'}</Field>
            <Field label="TDS deducted">
              {fmtMoney(receipt.tdsDeducted, receipt.currency)}
            </Field>
            <Field label="Bank charges">
              {fmtMoney(receipt.bankCharges, receipt.currency)}
            </Field>
            <Field label="Excess as advance">
              {receipt.excessAsAdvance ? 'Yes' : 'No'}
            </Field>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Allocation
        </h3>
        {applied.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            No invoice allocations on this receipt.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {applied.map((row, idx) => (
              <div
                key={`${row.invoiceId}-${idx}`}
                className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[13px]"
              >
                <span className="font-mono text-[12px] text-[var(--st-text)]">
                  {row.invoiceId}
                </span>
                <span className="tabular-nums text-[var(--st-text)]">
                  {fmtMoney(row.amount, receipt.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="text-[11px] text-[var(--st-text-secondary)]">
        Created {fmtDate(receipt.createdAt || receipt.audit?.createdAt)} · Updated{' '}
        {fmtDate(receipt.updatedAt || receipt.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
