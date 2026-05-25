import { Suspense } from 'react';
import { getT } from '@/lib/i18n/server';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listLeads } from '@/app/actions/crm/leads.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { LeadListClient } from './_components/lead-list-client';
import { StatCard } from '@/components/zoruui/stat-card';
import { Users, DollarSign, Target, Activity } from 'lucide-react';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import LeadsLoading from './loading';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const t = await getT();

  return (
    <EntityListShell
      title={t('crm.leads.list.title') || "Leads Dashboard"}
      subtitle={t('crm.leads.list.subtitle') || "Overview and management of CRM leads"}
    >
      <Suspense fallback={<LeadsLoading />}>
        <LeadsDashboardContent page={page} limit={limit} q={q} />
      </Suspense>
    </EntityListShell>
  );
}

async function LeadsDashboardContent({ page, limit, q }: { page: number; limit: number; q: string }) {
  const [{ leads, hasMore, error }, customFields] = await Promise.all([
    listLeads({ page, limit, q: q || undefined }),
    getCustomFieldsFor('lead').catch(() => []) as Promise<WsCustomField[]>,
  ]);

  const totalEstimatedValue = leads.reduce((acc, lead) => acc + (lead.estimatedValue || 0), 0);
  const avgProbability = leads.length > 0 
    ? leads.reduce((acc, lead) => acc + (lead.probabilityPct || 0), 0) / leads.length 
    : 0;
  
  const newLeads = leads.filter(l => l.status === 'new' || !l.status).length;
  const inProgressLeads = leads.filter(l => l.status === 'in_progress' || l.status === 'contacted').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Pipeline Value"
          value={`$${totalEstimatedValue.toLocaleString()}`}
          icon={<DollarSign />}
          delta={12.5}
          period="vs last month"
        />
        <StatCard
          label="Avg Conversion Prob"
          value={`${avgProbability.toFixed(1)}%`}
          icon={<Target />}
          delta={2.1}
          period="vs last month"
        />
        <StatCard
          label="New Leads"
          value={newLeads}
          icon={<Users />}
          delta={5.2}
          period="vs last week"
        />
        <StatCard
          label="In Progress"
          value={inProgressLeads}
          icon={<Activity />}
          delta={-1.5}
          invertDelta
          period="vs last week"
        />
      </div>

      <LeadListClient
        leads={leads}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
        customFields={customFields}
      />
    </div>
  );
}
