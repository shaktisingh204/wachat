/**
 * Edit payment receipt — `/dashboard/crm/sales/payments/[id]/edit`.
 *
 * Hydrates the existing receipt and passes it to the shared
 * <PaymentReceiptForm> (re-used from the Create flow). The form
 * submits a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { CreditCard } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update payment receipt details."
        icon={CreditCard}
      />
      <PaymentReceiptForm initial={receipt} />
    </div>
  );
}
