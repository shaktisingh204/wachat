'use client';

import { BarChart, DollarSign, Target, Users as UsersIcon, LineChart as LineChartIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });

const mockChartData = [
  { month: "Jan", kpi: 85 },
  { month: "Feb", kpi: 88 },
  { month: "Mar", kpi: 90 },
  { month: "Apr", kpi: 92 },
  { month: "May", kpi: 95 },
  { month: "Jun", kpi: 94 },
];

const chartConfig = {
  kpi: {
    label: "Overall Performance",
    color: "hsl(var(--primary))",
  },
};

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description: string }) => (
    <ClayCard>
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-clay-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
        </div>
        <p className="mt-2 text-2xl font-bold text-clay-ink">{value}</p>
        <p className="mt-1 text-[11.5px] text-clay-ink-muted">{description}</p>
    </ClayCard>
);

export default function KpiTrackingPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="KPI Tracking"
                subtitle="Define and monitor Key Performance Indicators for your teams and employees."
                icon={LineChartIcon}
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Overall Target Achievement" value="92%" icon={Target} description="+2% from last month" />
                <StatCard title="Sales Growth" value="15%" icon={BarChart} description="Quarter-over-quarter" />
                <StatCard title="Customer Satisfaction" value="95%" icon={DollarSign} description="Based on recent surveys" />
                <StatCard title="Top Performer" value="Anika Sharma" icon={UsersIcon} description="Highest sales volume this quarter" />
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Performance Trend</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Overall KPI score over the last 6 months.</p>
                </div>
                <ChartContainer config={chartConfig} className="h-64 w-full">
                    <AreaChart data={mockChartData}>
                        <defs>
                            <linearGradient id="fillKpi" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-kpi)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-kpi)" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="kpi" stroke="var(--color-kpi)" fill="url(#fillKpi)" />
                    </AreaChart>
                </ChartContainer>
            </ClayCard>
        </div>
    )
}
