/**
 * CRM Subscriptions list — `/dashboard/crm/sales/subscriptions`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listSubscriptions` action, and hands
 * off to `<SubscriptionListClient>` for interactive bits (search,
 * delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Repeat, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listSubscriptions } from '@/app/actions/crm/subscriptions.actions';
import { SubscriptionListClient } from './_components/subscription-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { subscriptions, hasMore, error } = await listSubscriptions({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Subscriptions & Recurring"
        subtitle="Manage recurring billing plans, renewals and dunning workflows."
        icon={Repeat}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/subscriptions/new">
              <Plus className="h-4 w-4" />
              New subscription
            </Link>
          </ZoruButton>
        }
      />

      <SubscriptionListClient
        subscriptions={subscriptions}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
