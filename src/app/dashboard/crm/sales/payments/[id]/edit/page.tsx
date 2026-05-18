/**
 * Edit payment receipt — `/dashboard/crm/sales/payments/[id]/edit`.
 *
 * Hydrates the existing receipt and passes it to the shared
 * <PaymentReceiptForm> (re-used from the Create flow). The form
 * submits a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PaymentReceiptForm } from '../../_components/payment-receipt-form';
import { getPaymentReceipt } from '@/app/actions/crm/payment-receipts.actions';

export const dynamic = 'force-dynamic';

export default async function EditPaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { receipt } = await getPaymentReceipt(id);

  if (!receipt) notFound();

  const title = receipt.receiptNo || String(receipt._id);

  return (
    <EntityDetailShell
      eyebrow="PAYMENT RECEIPT"
      title={`Edit ${title}`}
      back={{ href: `/dashboard/crm/sales/payments/${id}`, label: 'Payment Receipt' }}
    >
      <PaymentReceiptForm initial={receipt} />
    </EntityDetailShell>
  );
}
