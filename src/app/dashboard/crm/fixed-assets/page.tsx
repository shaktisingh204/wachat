import { Button } from '@/components/sabcrm/20ui';
import { Plus } from 'lucide-react';

/**
 * CRM Fixed Assets list — `/dashboard/crm/fixed-assets`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listFixedAssets` action, and hands off
 * to `<FixedAssetListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listFixedAssets } from '@/app/actions/crm/fixed-assets.actions';
import { FixedAssetListClient } from './_components/fixed-asset-list-client';
import { BarcodeScannerDialog } from './_components/barcode-scanner-dialog';

import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

async function FixedAssetsData({ sp }: { sp: SearchParams }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { assets, hasMore, error } = await listFixedAssets({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <FixedAssetListClient
      assets={assets}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      error={error}
    />
  );
}

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  return (
    <EntityListShell
      title="Fixed Assets"
      subtitle="Track durable company property — laptops, vehicles, machinery — with depreciation and custody."
      primaryAction={
        <div className="flex gap-2 items-center">
          <BarcodeScannerDialog />
          <Button asChild>
            <Link href="/dashboard/crm/fixed-assets/new">
              <Plus className="h-4 w-4" />
              New fixed asset
            </Link>
          </Button>
        </div>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <FixedAssetsData sp={sp} />
      </Suspense>
    </EntityListShell>
  );
}
