/**
 * SabCRM Finance — Recurring invoices
 * (`/sabcrm/finance/recurring-invoices`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec
 * §3.11). Fetches page 1 of display-ready rows (customer + template
 * labels resolved server-side — no ObjectIds reach the client) plus
 * the KPI strip through the gated actions. Parses `searchParams`
 * (`q`, `status`, `from`, `to`) into the kit's `initialFilters` for
 * deep links. NB: crm-common-style crate — the actions translate the
 * kit's 1-indexed pages onto the crate's 0-indexed wire.
 */

import * as React from 'react';

import {
  getSabcrmRecurringInvoiceKpis,
  listSabcrmRecurringInvoicesPage,
} from '@/app/actions/sabcrm-finance-recurring-invoices.actions';
import type { CrmRecurringInvoiceStatus } from '@/lib/rust-client/crm-recurring-invoices';
import { RecurringInvoicesClient } from './recurring-invoices-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recurring invoices — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceRecurringInvoicesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmRecurringInvoicesPage({
      page: 1,
      q: q || undefined,
      status: (status as CrmRecurringInvoiceStatus | '') || '',
      from,
      to,
    }),
    getSabcrmRecurringInvoiceKpis(),
  ]);

  return (
    <RecurringInvoicesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || from || to ? { q, status, from, to } : undefined
      }
    />
  );
}
