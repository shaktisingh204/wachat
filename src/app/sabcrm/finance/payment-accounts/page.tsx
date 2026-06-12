/**
 * SabCRM Finance — Payment accounts
 * (`/sabcrm/finance/payment-accounts`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec
 * §3.9). Fetches page 1 of display-ready rows plus the KPI strip
 * (total opening balance, computed current balance over a capped
 * bank-transaction scan, active count) through the gated actions, then
 * hands everything to the kit-driven client. NB: crm-common-style
 * crate — the actions translate the kit's 1-indexed pages onto the
 * crate's 0-indexed wire.
 */

import * as React from 'react';

import {
  getSabcrmPaymentAccountKpis,
  listSabcrmPaymentAccountsPage,
} from '@/app/actions/sabcrm-finance-payment-accounts.actions';
import { PaymentAccountsClient } from './payment-accounts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment accounts — SabCRM Finance',
};

export default async function SabcrmFinancePaymentAccountsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPaymentAccountsPage({ page: 1 }),
    getSabcrmPaymentAccountKpis(),
  ]);

  return (
    <PaymentAccountsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
