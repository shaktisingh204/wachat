export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeadConversion,
  getLeadStageFunnel,
  getLeadsBySource,
} from '@/app/actions/worksuite/reports.actions';
import { getCrmLeads } from '@/app/actions/crm-leads.actions';
import { LeadsConversionView } from './leads-conversion-view';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    source?: string;
    owner?: string;
  }>;
}

export default async function LeadsConversionPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = Math.max(5, Number(sp.limit ?? 20));

  const [stats, funnel, bySource, leadsRes] = await Promise.all([
    getLeadConversion(sp.from, sp.to),
    getLeadStageFunnel(sp.from, sp.to),
    getLeadsBySource(sp.from, sp.to, sp.owner),
    getCrmLeads(page, limit),
  ]);

  const leadRows = leadsRes.leads.map((l) => ({
    id: String(l._id),
    title: (l as { title?: string }).title ?? 'Untitled lead',
    contactName: (l as { contactName?: string }).contactName,
    company: (l as { company?: string }).company,
    status: (l as { status?: string }).status ?? 'New',
    source: (l as { source?: string }).source ?? '—',
    createdAt: (l as { createdAt?: string | Date }).createdAt
      ? new Date(
          (l as { createdAt?: string | Date }).createdAt as string | Date,
        ).toISOString()
      : null,
  }));

  // If source filter is active, filter in memory (getCrmLeads doesn't expose source filter)
  const filteredLeads = sp.source
    ? leadRows.filter((l) =>
        l.source.toLowerCase().includes(sp.source!.toLowerCase()),
      )
    : leadRows;

  return (
    <EntityListShell
      title="Leads Conversion"
      subtitle="Funnel, conversion rate, and recent lead activity by stage."
    >
      <LeadsConversionView
        stats={stats}
        funnel={funnel}
        bySource={bySource}
        leads={filteredLeads}
        total={leadsRes.total}
        page={page}
        limit={limit}
        from={sp.from}
        to={sp.to}
        source={sp.source ?? ''}
        owner={sp.owner ?? ''}
      />
    </EntityListShell>
  );
}
