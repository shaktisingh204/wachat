
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { TrendingUp, BarChart, DollarSign, Target } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton";

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function KpiTrackingPage() {
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <TrendingUp className="h-8 w-8"/>
                    KPI Tracking
                </h1>
                <p className="text-muted-foreground mt-2">
                   Define and monitor Key Performance Indicators for your teams and employees.
                </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Overall Target Achievement" value="92%" icon={Target} description="+2% from last month" />
                <StatCard title="Sales Growth" value="15%" icon={BarChart} description="Quarter-over-quarter" />
                <StatCard title="Customer Satisfaction" value="95%" icon={DollarSign} description="Based on recent surveys" />
                <StatCard title="Top Performer" value="Anika Sharma" icon={UsersIcon} description="Highest sales volume this quarter" />
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Performance Trend</CardTitle>
                    <CardDescription>Overall KPI score over the last 6 months.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>
        </div>
    )
}
