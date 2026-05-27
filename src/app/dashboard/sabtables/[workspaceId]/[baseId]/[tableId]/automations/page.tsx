import { notFound } from 'next/navigation';

import {
  getSabtablesBase,
  getSabtablesTable,
  listSabtablesAutomations,
  listSabtablesTables,
} from '@/app/actions/sabtables.actions';

import { BaseShellClient } from '../../_components/base-shell-client';
import { AutomationsBuilderClient } from './_components/automations-builder-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workspaceId: string; baseId: string; tableId: string }>;
}

export default async function AutomationsPage({ params }: PageProps) {
  const { workspaceId, baseId, tableId } = await params;
  const [base, table, tablesRes, automationsRes] = await Promise.all([
    getSabtablesBase(baseId).catch(() => null),
    getSabtablesTable(tableId).catch(() => null),
    listSabtablesTables({ baseId, limit: 100 }).catch(() => ({
      items: [],
      page: 0,
      limit: 100,
      hasMore: false,
    })),
    listSabtablesAutomations({ tableId }).catch(() => ({ items: [] })),
  ]);
  if (!base || !table) notFound();
  return (
    <BaseShellClient
      workspaceId={workspaceId}
      base={base}
      tables={tablesRes.items}
      activeTableId={tableId}
    >
      <AutomationsBuilderClient
        tableId={tableId}
        initialAutomations={automationsRes.items}
      />
    </BaseShellClient>
  );
}
