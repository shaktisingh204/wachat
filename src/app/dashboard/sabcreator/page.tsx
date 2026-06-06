import { Suspense } from 'react';

import { listSabcreatorApps } from '@/app/actions/sabcreator.actions';

import { AppsListClient } from './_components/apps-list-client';

// Server entry for the SabCreator apps home. All UI is rendered by the
// AppsListClient client component, which is built entirely on 20ui primitives.
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
