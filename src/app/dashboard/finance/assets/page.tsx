import React, { Suspense } from 'react';
import { listAssets } from '@/app/actions/finance/assets.actions';
import { AssetListClient } from './_components/assets-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function AssetListContainer() {
  const { items, error } = await listAssets();
  return <AssetListClient initialItems={items || []} error={error} />;
}

export default function AssetPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <AssetListContainer />
    </Suspense>
  );
}
