import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import {
  getSabtablesWorkspace,
  listSabtablesBases,
} from '@/app/actions/sabtables.actions';

import { BasesListClient } from './_components/bases-list-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceBasesPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const workspace = await getSabtablesWorkspace(workspaceId).catch(() => null);
  if (!workspace) notFound();

  const res = await listSabtablesBases({
    workspaceId,
    status: 'active',
    limit: 100,
  }).catch(() => ({ items: [], page: 0, limit: 100, hasMore: false }));

  return (
    <Suspense fallback={null}>
      <BasesListClient
        workspace={workspace}
        initialItems={res.items}
      />
    </Suspense>
  );
}
