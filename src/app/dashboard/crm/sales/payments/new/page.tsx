/**
 * Create payment receipt — `/dashboard/crm/sales/payments/new`.
 *
 * Server component shell that renders the shared <PaymentReceiptForm>.
 * No custom-field plumbing here — `'paymentReceipt'` is NOT in
 * `WsCustomFieldBelongsTo`.
 */

import { CreditCard } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PaymentReceiptForm } from '../_components/payment-receipt-form';

export const dynamic = 'force-dynamic';

export default function NewPaymentReceiptPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New payment receipt"
        subtitle="Log an incoming customer payment."
        icon={CreditCard}
      />
      <PaymentReceiptForm />
    </div>
  );
}
