import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import {
  getSabtablesBase,
  getSabtablesTable,
  listSabtablesRecords,
  listSabtablesTables,
  listSabtablesViews,
} from '@/app/actions/sabtables.actions';

import { BaseShellClient } from '../_components/base-shell-client';
import { TableViewClient } from './_components/table-view-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workspaceId: string; baseId: string; tableId: string }>;
}

export default async function TablePage({ params }: PageProps) {
  const { workspaceId, baseId, tableId } = await params;

  const [base, table, tablesRes, recordsRes, viewsRes] = await Promise.all([
    getSabtablesBase(baseId).catch(() => null),
    getSabtablesTable(tableId).catch(() => null),
    listSabtablesTables({ baseId, limit: 100 }).catch(() => ({
      items: [],
      page: 0,
      limit: 100,
      hasMore: false,
    })),
    listSabtablesRecords({ tableId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
    listSabtablesViews({ tableId }).catch(() => ({ items: [] })),
  ]);

  if (!base || !table) notFound();

  return (
    <Suspense fallback={null}>
      <BaseShellClient
        workspaceId={workspaceId}
        base={base}
        tables={tablesRes.items}
        activeTableId={tableId}
      >
        <TableViewClient
          workspaceId={workspaceId}
          baseId={baseId}
          table={table}
          initialRecords={recordsRes.items}
          views={viewsRes.items}
        />
      </BaseShellClient>
    </Suspense>
  );
}
