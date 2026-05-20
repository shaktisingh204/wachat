import { getSalesCrmConfig, getLeadStatuses } from '@/app/actions/worksuite/crm-plus.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type { WsLeadStatus } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import { SettingsClient } from './_components/settings-client';

export const dynamic = 'force-dynamic';

type StatusRow = WithId<WsLeadStatus> & { _id: string };

export default async function SalesCrmSettingsPage() {
  const [config, pipelines, leadStatuses] = await Promise.all([
    getSalesCrmConfig(),
    getCrmPipelines(),
    getLeadStatuses(),
  ]);

  return (
    <SettingsClient
      config={config}
      pipelines={pipelines}
      leadStatuses={leadStatuses as StatusRow[]}
    />
  );
}
