export const dynamic = 'force-dynamic';

import { BarChart } from 'lucide-react';

import { getAnalyticsData } from '@/app/actions/crm-analytics.actions';
import { AnalyticsDashboard } from '@/components/crm/analytics/analytics-dashboard';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParams = await props.searchParams;
  const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
  const data = await getAnalyticsData(year);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="CRM Analytics"
        subtitle={`Financial and sales intelligence for ${year}`}
        icon={BarChart}
      />

      {data ? (
        <AnalyticsDashboard data={data} />
      ) : (
        <ClayCard>
          <p className="py-8 text-center text-[13px] text-clay-ink-muted">
            Unable to load analytics data.
          </p>
        </ClayCard>
      )}
    </div>
  );
}
