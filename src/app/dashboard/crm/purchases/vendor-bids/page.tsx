/**
 * CRM Vendor Bids list — `/dashboard/crm/purchases/vendor-bids`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listVendorBids` action, and hands off
 * to `<VendorBidListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Gavel, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listVendorBids } from '@/app/actions/crm/vendor-bids.actions';
import { VendorBidListClient } from './_components/vendor-bid-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  rfqId?: string;
  vendorId?: string;
  status?: string;
}

export default async function VendorBidsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const rfqId = (sp.rfqId ?? '').trim();
  const vendorId = (sp.vendorId ?? '').trim();
  const status = (sp.status ?? '').trim();

  const { bids, hasMore, error } = await listVendorBids({
    page,
    limit,
    q: q || undefined,
    rfqId: rfqId || undefined,
    vendorId: vendorId || undefined,
    status: status || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Vendor Bids"
        subtitle="Compare quotations submitted by vendors against your RFQs."
        icon={Gavel}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/vendor-bids/new">
              <Plus className="h-4 w-4" />
              New vendor bid
            </Link>
          </ZoruButton>
        }
      />

      <VendorBidListClient
        bids={bids}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
