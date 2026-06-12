/**
 * SabCRM Finance — Bill detail (`/sabcrm/finance/bills/[id]`).
 *
 * Server entry for the bill document detail (finance-rollout spec
 * §3.6). Fetches the bill (with resolved expense-line account labels),
 * its vendor, the lineage rail (PO / GRN parents + payout / debit-note
 * children) and the project's payment-account options in parallel, then
 * hands everything to the detail client.
 */

import * as React from 'react';

import {
  getSabcrmBillFull,
  getSabcrmBillRelated,
} from '@/app/actions/sabcrm-finance-bills.actions';
import { listSabcrmPaymentAccountOptions } from '@/app/actions/sabcrm-finance-invoices.actions';
import { resolveSabcrmFinanceVendors } from '@/app/actions/sabcrm-finance-pickers.actions';
import { BillDetailClient } from './bill-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bill — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceBillDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const billRes = await getSabcrmBillFull(id);
  if (!billRes.ok) {
    return (
      <BillDetailClient
        bill={null}
        expenseAccounts={[]}
        vendor={null}
        related={[]}
        paymentAccounts={[]}
        error={billRes.error}
      />
    );
  }

  const [vendorRes, relatedRes, accountsRes] = await Promise.all([
    billRes.data.doc.vendorId
      ? resolveSabcrmFinanceVendors([billRes.data.doc.vendorId])
      : Promise.resolve(null),
    getSabcrmBillRelated(id),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <BillDetailClient
      bill={billRes.data.doc}
      expenseAccounts={billRes.data.expenseAccounts}
      vendor={vendorRes?.ok ? (vendorRes.data[0] ?? null) : null}
      related={relatedRes.ok ? relatedRes.data : []}
      paymentAccounts={accountsRes.ok ? accountsRes.data : []}
      error={null}
    />
  );
}
