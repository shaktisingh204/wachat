

export const dynamic = 'force-dynamic';

import { getAnalyticsData } from '@/app/actions/crm-analytics.actions';
import { AnalyticsDashboard } from '@/components/crm/analytics/analytics-dashboard';
import { BarChart } from 'lucide-react';

export default async function AnalyticsPage({ searchParams }: { searchParams: { year?: string } }) {
    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
    const data = await getAnalyticsData(year);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                    <BarChart className="h-8 w-8 text-primary" />
                    CRM Analytics
                </h1>
                <p className="text-muted-foreground">Financial and Sales Intelligence for {year}</p>
            </div>

            {data ? (
                <AnalyticsDashboard data={data} />
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    Unable to load analytics data.
                </div>
            )}
        </div>
    );
}
