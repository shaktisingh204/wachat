export const dynamic = 'force-dynamic';

import { BarChart } from 'lucide-react';

import { getAnalyticsData } from '@/app/actions/crm-analytics.actions';
import { AnalyticsDashboard } from '@/components/crm/analytics/analytics-dashboard';
import {
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParams = await props.searchParams;
  const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
  const data = await getAnalyticsData(year);

  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruPageHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
            <BarChart className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <ZoruPageHeading>
            <ZoruPageTitle>CRM Analytics</ZoruPageTitle>
            <ZoruPageDescription>
              Financial and sales intelligence for {year}
            </ZoruPageDescription>
          </ZoruPageHeading>
        </div>
      </ZoruPageHeader>

      {data ? (
        <AnalyticsDashboard data={data} />
      ) : (
        <ZoruCard className="p-6">
          <p className="py-8 text-center text-[13px] text-zoru-ink-muted">
            Unable to load analytics data.
          </p>
        </ZoruCard>
      )}
    </div>
  );
}
