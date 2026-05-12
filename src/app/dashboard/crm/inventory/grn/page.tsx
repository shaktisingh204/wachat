/**
 * CRM GRN list — `/dashboard/crm/inventory/grn`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listGrns` action, and hands off to
 * `<GrnListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { PackageCheck, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listGrns } from '@/app/actions/crm/grns.actions';
import { GrnListClient } from './_components/grn-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  vendorId?: string;
  status?: string;
}

export default async function GrnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const vendorId = (sp.vendorId ?? '').trim();
  const status = (sp.status ?? '').trim();

  const { grns, hasMore, error } = await listGrns({
    page,
    limit,
    q: q || undefined,
    vendorId: vendorId || undefined,
    status: status || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Goods Receipt (GRN)"
        subtitle="Record incoming stock against purchase orders and reconcile quantities."
        icon={PackageCheck}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/inventory/grn/new">
              <Plus className="h-4 w-4" />
              New GRN
            </Link>
          </ZoruButton>
        }
      />

      <GrnListClient
        grns={grns}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
