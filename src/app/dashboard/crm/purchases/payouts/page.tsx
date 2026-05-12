/**
 * CRM Payouts list — `/dashboard/crm/purchases/payouts`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listPayouts` action, and hands off to
 * `<PayoutListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Wallet, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listPayouts } from '@/app/actions/crm/payouts.actions';
import { PayoutListClient } from './_components/payout-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { payouts, hasMore, error } = await listPayouts({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payouts"
        subtitle="Record and track payments made to vendors."
        icon={Wallet}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/payouts/new">
              <Plus className="h-4 w-4" />
              New payout
            </Link>
          </ZoruButton>
        }
      />

      <PayoutListClient
        payouts={payouts}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
