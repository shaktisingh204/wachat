/**
 * CRM Quotations list — `/dashboard/crm/sales/quotations`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listQuotations` action, and hands off
 * to `<QuotationListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listQuotations } from '@/app/actions/crm/quotations.actions';
import { QuotationListClient } from './_components/quotation-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { quotations, hasMore, error } = await listQuotations({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Quotations & Estimates"
        subtitle="Create and manage your sales quotations."
        icon={FileText}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/quotations/new">
              <Plus className="h-4 w-4" />
              New quotation
            </Link>
          </ZoruButton>
        }
      />

      <QuotationListClient
        quotations={quotations}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
