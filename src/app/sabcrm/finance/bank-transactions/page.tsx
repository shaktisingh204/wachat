/**
 * SabCRM Finance — Bank transactions
 * (`/sabcrm/finance/bank-transactions`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec
 * §3.10). Fetches page 1 of display-ready rows (account labels
 * resolved server-side — no ObjectIds reach the client), the KPI strip
 * and the payment-account options for the dialog, all through the
 * gated actions. Parses `searchParams` (`q`, `status`, `partyId` =
 * accountId, `from`, `to`) into the kit's `initialFilters` so
 * statement drill-downs deep-link into a filtered list.
 */

import * as React from 'react';

import {
  getSabcrmBankTransactionKpis,
  listSabcrmBankTransactionsPage,
} from '@/app/actions/sabcrm-finance-bank-transactions.actions';
import { listSabcrmPaymentAccountOptions } from '@/app/actions/sabcrm-finance-invoices.actions';
import type { CrmBankTransactionStatus } from '@/lib/rust-client/crm-bank-transactions';
import { BankTransactionsClient } from './bank-transactions-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bank transactions — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceBankTransactionsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  // `accountId` and the kit's generic `partyId` are both accepted.
  const accountId = first(params.accountId) ?? first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes, accountsRes] = await Promise.all([
    listSabcrmBankTransactionsPage({
      page: 1,
      q: q || undefined,
      status: (status as CrmBankTransactionStatus | '') || '',
      accountId: accountId || undefined,
      from,
      to,
    }),
    getSabcrmBankTransactionKpis(),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <BankTransactionsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      accounts={accountsRes.ok ? accountsRes.data : []}
      initialFilters={
        q || status || accountId || from || to
          ? { q, status, partyId: accountId, from, to }
          : undefined
      }
    />
  );
}
