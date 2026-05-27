import { Suspense } from 'react';

import { listSabtablesWorkspaces } from '@/app/actions/sabtables.actions';

import { WorkspacesListClient } from './_components/workspaces-list-client';

export const dynamic = 'force-dynamic';

export default async function SabtablesHomePage() {
  const res = await listSabtablesWorkspaces({ status: 'active', limit: 100 }).catch(
    () => ({ items: [], page: 0, limit: 100, hasMore: false }),
  );
  return (
    <Suspense fallback={null}>
      <WorkspacesListClient initialItems={res.items} />
    </Suspense>
  );
}
