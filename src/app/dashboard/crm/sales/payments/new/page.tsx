/**
 * Create payment receipt — `/dashboard/crm/sales/payments/new`.
 *
 * Server component shell that renders the shared <PaymentReceiptForm>.
 *
 * Convert flow: when invoked with `?fromKind=invoice&fromId=…`, we hydrate
 * the parent invoice via `getCrmEntityForPrefill` and seed the form with
 * `clientId`, `currency`, and a single apply-row referencing the invoice
 * outstanding amount — same projection as the sibling `sales/receipts/new`
 * route.
 *
 * No custom-field plumbing here — `'paymentReceipt'` is NOT in
 * `WsCustomFieldBelongsTo`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PaymentReceiptForm } from '../_components/payment-receipt-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

export const dynamic = 'force-dynamic';

interface NewPaymentSearch {
  fromKind?: string;
  fromId?: string;
}

/** Project a parent invoice into the payment-receipt-form `initial` shape. */
function invoiceToPaymentSeed(
  invoice: CrmInvoiceDoc,
): Partial<CrmPaymentReceiptDoc> {
  const outstanding = Math.max(
    0,
    Number(invoice.totals?.total ?? 0) - Number(invoice.amountPaid ?? 0),
  );
  return {
    clientId: invoice.clientId,
    currency: invoice.currency ?? 'INR',
    amount: outstanding,
    applyTo: [{ invoiceId: String(invoice._id), amount: outstanding }],
  };
}

export default async function NewPaymentReceiptPage({
  searchParams,
}: {
  searchParams: Promise<NewPaymentSearch>;
}) {
  const sp = await searchParams;
  const parent = await getCrmEntityForPrefill<CrmInvoiceDoc>(
    sp.fromKind,
    sp.fromId,
  );

  const initial =
    parent && (sp.fromKind ?? '').trim() === 'invoice'
      ? (invoiceToPaymentSeed(parent) as CrmPaymentReceiptDoc)
      : undefined;

  return (
    <EntityDetailShell
      eyebrow="PAYMENT RECEIPT"
      title="New payment receipt"
      back={{ href: '/dashboard/crm/sales/payments', label: 'Payment Receipts' }}
    >
      <PaymentReceiptForm initial={initial} />
    </EntityDetailShell>
  );
}
