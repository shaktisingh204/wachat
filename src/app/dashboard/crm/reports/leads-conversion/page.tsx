export const dynamic = 'force-dynamic';

import { ArrowRightLeft } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { ReportToolbar, StatCard } from '../_components/report-toolbar';
import { getLeadConversion } from '@/app/actions/worksuite/reports.actions';

export default async function LeadsConversionPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const stats = await getLeadConversion(sp.from, sp.to);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leads Conversion"
        subtitle="Conversion rate and average cycle time for leads."
        icon={ArrowRightLeft}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Total leads" value={String(stats.total)} />
        <StatCard label="Converted" value={String(stats.converted)} tone="green" />
        <StatCard
          label="Conversion rate"
          value={`${stats.conversionRate.toFixed(1)}%`}
          tone={stats.conversionRate >= 20 ? 'green' : 'amber'}
        />
        <StatCard
          label="Avg cycle"
          value={`${stats.avgCycleDays.toFixed(1)} days`}
        />
      </div>

      <ClayCard>
        <p className="text-[13px] text-clay-ink-muted">
          Cycle time is measured from lead creation to conversion (using{' '}
          <code className="rounded bg-clay-surface-2 px-1">convertedAt</code>{' '}
          or{' '}
          <code className="rounded bg-clay-surface-2 px-1">updatedAt</code>).
        </p>
      </ClayCard>
    </div>
  );
}
