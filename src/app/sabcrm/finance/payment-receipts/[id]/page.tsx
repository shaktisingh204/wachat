/**
 * SabCRM Finance — Payment-receipt detail
 * (`/sabcrm/finance/payment-receipts/[id]`).
 *
 * Server entry (finance-rollout spec §3.7). Fetches the receipt, its
 * linked customer contact (label + email — never a raw ObjectId), the
 * lineage rail + resolved allocation table and the payment-account
 * options (edit form + account-label resolution) in parallel, then
 * hands everything to the detail client.
 */

import * as React from 'react';

import {
  getSabcrmPaymentReceiptFull,
  getSabcrmPaymentReceiptRelated,
} from '@/app/actions/sabcrm-finance-payment-receipts.actions';
import {
  getSabcrmFinancePartyContact,
  listSabcrmPaymentAccountOptions,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { PaymentReceiptDetailClient } from './payment-receipt-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment receipt — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinancePaymentReceiptDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const receiptRes = await getSabcrmPaymentReceiptFull(id);
  if (!receiptRes.ok) {
    return (
      <PaymentReceiptDetailClient
        receipt={null}
        contact={null}
        related={[]}
        allocations={[]}
        accounts={[]}
        error={receiptRes.error}
      />
    );
  }

  const [contactRes, relatedRes, accountsRes] = await Promise.all([
    getSabcrmFinancePartyContact(receiptRes.data.clientId),
    getSabcrmPaymentReceiptRelated(id),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <PaymentReceiptDetailClient
      receipt={receiptRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data.related : []}
      allocations={relatedRes.ok ? relatedRes.data.allocations : []}
      accounts={accountsRes.ok ? accountsRes.data : []}
      error={null}
    />
  );
}
