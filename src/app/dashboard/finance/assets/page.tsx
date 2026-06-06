import { Suspense } from 'react';
import { listAssets } from '@/app/actions/finance/assets.actions';
import { AssetListClient } from './_components/assets-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function AssetListContainer() {
  const { items, error } = await listAssets();
  return <AssetListClient initialItems={items || []} error={error} />;
}

function AssetPageFallback() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton height={28} width={220} radius="var(--st-radius)" />
        <Skeleton height={16} width={320} radius="var(--st-radius)" />
      </div>
      <Skeleton height={36} width={280} radius="var(--st-radius)" />
      <Skeleton height={400} radius="var(--st-radius)" />
    </div>
  );
}

export default function AssetPage() {
  return (
    <Suspense fallback={<AssetPageFallback />}>
      <AssetListContainer />
    </Suspense>
  );
}
