import { getLeadSources, getLeadSourceKpis } from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadSource } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import { SourcesClient } from './_components/sources-client';

export const dynamic = 'force-dynamic';

type Row = WithId<WsLeadSource> & { _id: string };

export default async function LeadSourcesPage() {
  const [rows, kpi] = await Promise.all([
    getLeadSources(),
    getLeadSourceKpis(),
  ]);

  return <SourcesClient rows={rows as Row[]} kpi={kpi} />;
}
