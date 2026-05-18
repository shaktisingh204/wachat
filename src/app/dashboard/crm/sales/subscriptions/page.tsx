/**
 * Canonical Subscriptions list — `/dashboard/crm/sales/subscriptions`
 * (§1D.1 rebuild).
 *
 * P1.1B Wave 2 rebuild. Server component. Reads page/limit/q from the
 * URL, fetches a page window + a wider KPI window in parallel, and
 * hands rows + KPIs to `<SubscriptionListClient>` — which composes
 * <EntityListShell> internally (per the ACCOUNTS / INVOICES template).
 *
 * Per CRM_REBUILD_PLAN §1D.
 */

import {
  getSubscriptionKpis,
  listSubscriptions,
} from '@/app/actions/crm/subscriptions.actions';

import { SubscriptionListClient } from './_components/subscription-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const [
    { subscriptions, hasMore, error },
    { kpi },
  ] = await Promise.all([
    listSubscriptions({ page, limit, q: q || undefined }),
    getSubscriptionKpis(),
  ]);

  return (
    <SubscriptionListClient
      subscriptions={subscriptions}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      kpi={kpi}
      error={error}
    />
  );
}
