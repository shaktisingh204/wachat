import { getLeadStatuses, getLeadStatusKpis } from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadStatus } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import { StatusesClient } from './_components/statuses-client';

export const dynamic = 'force-dynamic';

type Row = WithId<WsLeadStatus> & { _id: string };

export default async function LeadStatusesPage() {
  const [rows, kpi] = await Promise.all([
    getLeadStatuses(),
    getLeadStatusKpis(),
  ]);

  return <StatusesClient rows={rows as Row[]} kpi={kpi} />;
}
