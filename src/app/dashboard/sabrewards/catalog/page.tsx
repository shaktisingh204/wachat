import * as React from 'react';

import { listRewardsCatalog, listRewardsPrograms } from '@/app/actions/rewards.actions';
import { CatalogClient } from './_catalog-client';

export const dynamic = 'force-dynamic';

export default async function RewardsCatalogPage(): Promise<React.JSX.Element> {
  const [items, programs] = await Promise.all([
    listRewardsCatalog(),
    listRewardsPrograms(),
  ]);
  return (
    <CatalogClient
      initialItems={items}
      programs={programs.map((p) => ({ id: p._id, name: p.name }))}
    />
  );
}
