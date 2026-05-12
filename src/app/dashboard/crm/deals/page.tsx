/**
 * CRM Deals list — `/dashboard/crm/deals`.
 *
 * Server component. Reads page/limit/q from the URL, fetches via the
 * Rust-backed `listDeals` action, hands off to `<DealListClient>`.
 *
 * Replaces the old kanban-only deals view — kanban now lives at
 * `/dashboard/crm/sales-crm/deals` for users who want the board UX.
 */

import Link from 'next/link';
import { Trophy, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';
import { listDeals } from '@/app/actions/crm/deals.actions';
import { DealListClient } from './_components/deal-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { deals, total, hasMore, error } = await listDeals({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Deals"
        subtitle="Track opportunities through your sales pipeline."
        icon={Trophy}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/deals/new">
              <Plus className="h-4 w-4" />
              New deal
            </Link>
          </ZoruButton>
        }
      />

      <DealListClient
        deals={deals}
        page={page}
        limit={limit}
        total={total}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
