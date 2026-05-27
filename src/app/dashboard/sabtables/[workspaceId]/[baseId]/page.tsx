import { redirect, notFound } from 'next/navigation';

import {
  getSabtablesBase,
  listSabtablesTables,
} from '@/app/actions/sabtables.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workspaceId: string; baseId: string }>;
}

/**
 * Base shell — auto-redirects to the first table (or stays on a "create
 * your first table" empty state if there are none yet). The per-table
 * page does the heavy lifting; this page just routes.
 */
export default async function BaseShellPage({ params }: PageProps) {
  const { workspaceId, baseId } = await params;
  const base = await getSabtablesBase(baseId).catch(() => null);
  if (!base) notFound();

  const res = await listSabtablesTables({ baseId, limit: 100 }).catch(() => ({
    items: [],
    page: 0,
    limit: 100,
    hasMore: false,
  }));

  if (res.items.length > 0) {
    redirect(`/dashboard/sabtables/${workspaceId}/${baseId}/${res.items[0]._id}`);
  }

  // No tables yet — render the same client shell with an empty state.
  const { BaseShellClient } = await import('./_components/base-shell-client');
  return (
    <BaseShellClient
      workspaceId={workspaceId}
      base={base}
      tables={[]}
      activeTableId={null}
    >
      <div className="p-10 text-center text-muted-foreground">
        Create your first table to get started.
      </div>
    </BaseShellClient>
  );
}
