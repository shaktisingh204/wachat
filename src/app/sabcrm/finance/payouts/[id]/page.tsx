/**
 * SabCRM Finance — Payout detail (`/sabcrm/finance/payouts/[id]`).
 *
 * Server entry for the payout document detail. Fetches the payout, its
 * resolved context (vendor + bank-account labels, bill allocations,
 * lineage rail — never raw ObjectIds) and the payment-account options
 * for the edit drawer in parallel, then hands everything to the detail
 * client.
 */

import * as React from 'react';

import {
  getSabcrmPayoutContext,
  getSabcrmPayoutFull,
} from '@/app/actions/sabcrm-finance-payouts.actions';
import { listSabcrmPaymentAccountOptions } from '@/app/actions/sabcrm-finance-invoices.actions';
import { PayoutDetailClient } from './payout-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payout — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinancePayoutDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const payoutRes = await getSabcrmPayoutFull(id);
  if (!payoutRes.ok) {
    return (
      <PayoutDetailClient
        payout={null}
        vendor={null}
        bankAccountLabel={null}
        allocations={[]}
        related={[]}
        paymentAccounts={[]}
        error={payoutRes.error}
      />
    );
  }

  const [contextRes, accountsRes] = await Promise.all([
    getSabcrmPayoutContext(id),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <PayoutDetailClient
      payout={payoutRes.data}
      vendor={contextRes.ok ? contextRes.data.vendor : null}
      bankAccountLabel={contextRes.ok ? contextRes.data.bankAccountLabel : null}
      allocations={contextRes.ok ? contextRes.data.allocations : []}
      related={contextRes.ok ? contextRes.data.related : []}
      paymentAccounts={accountsRes.ok ? accountsRes.data : []}
      error={null}
    />
  );
}
