/**
 * CRM RFQs list — `/dashboard/crm/purchases/rfqs`.
 *
 * Server component shell. Reads search/page/limit/status from the URL,
 * fetches via the Rust-backed `listRfqs` action, and hands off to
 * `<RfqListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listRfqs } from '@/app/actions/crm/rfqs.actions';
import { RfqListClient } from './_components/rfq-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}

export default async function RfqsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();

  const { rfqs, hasMore, error } = await listRfqs({
    page,
    limit,
    q: q || undefined,
    status: status || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Request for Quotations"
        subtitle="Send RFQs to vendors and compare bids side by side."
        icon={ClipboardList}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/rfqs/new">
              <Plus className="h-4 w-4" />
              New RFQ
            </Link>
          </ZoruButton>
        }
      />

      <RfqListClient
        rfqs={rfqs}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
