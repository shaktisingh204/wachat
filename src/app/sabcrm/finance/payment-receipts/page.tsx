/**
 * SabCRM Finance — Payment receipts (`/sabcrm/finance/payment-receipts`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec
 * §3.7). Fetches page 1 of display-ready rows (customer + account
 * labels resolved server-side — no ObjectIds reach the client), the
 * KPI strip and the payment-account options for the form, all through
 * the gated actions. Parses `searchParams` (`q`, `status`, `partyId`,
 * `from`, `to`) into the kit's `initialFilters` so statement
 * drill-downs (cash-flow inflow) deep-link into a filtered list.
 */

import * as React from 'react';

import {
  getSabcrmPaymentReceiptKpis,
  listSabcrmPaymentReceiptsPage,
} from '@/app/actions/sabcrm-finance-payment-receipts.actions';
import { listSabcrmPaymentAccountOptions } from '@/app/actions/sabcrm-finance-invoices.actions';
import type { CrmReceiptStatus } from '@/lib/rust-client/crm-payment-receipts';
import { PaymentReceiptsClient } from './payment-receipts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment receipts — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinancePaymentReceiptsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes, accountsRes] = await Promise.all([
    listSabcrmPaymentReceiptsPage({
      page: 1,
      q: q || undefined,
      status: (status as CrmReceiptStatus | '') || '',
      clientId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmPaymentReceiptKpis(),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <PaymentReceiptsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      accounts={accountsRes.ok ? accountsRes.data : []}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
