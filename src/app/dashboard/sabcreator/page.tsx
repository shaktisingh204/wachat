import { Suspense } from 'react';

import { listSabcreatorApps } from '@/app/actions/sabcreator.actions';

import { AppsListClient } from './_components/apps-list-client';

export const dynamic = 'force-dynamic';

export default async function SabcreatorHomePage() {
  const res = await listSabcreatorApps({ status: 'active_visible', limit: 100 }).catch(
    () => ({ items: [], page: 0, limit: 100, hasMore: false }),
  );
  return (
    <Suspense fallback={null}>
      <AppsListClient initialItems={res.items} />
    </Suspense>
  );
}
