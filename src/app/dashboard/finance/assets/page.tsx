import React from 'react';
import { listAssets } from '@/app/actions/finance/assets.actions';
import { AssetListClient } from './_components/assets-list-client';

export default async function AssetPage() {
  const { items, error } = await listAssets();

  return <AssetListClient initialItems={items || []} error={error} />;
}
