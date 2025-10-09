
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Users, Link as LinkIcon, BarChart, Globe } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { getSiteMetrics } from '@/app/actions/seo.actions';
import type { SiteMetrics } from '@/lib/definitions';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Bar, CartesianGrid, XAxis, YAxis, ComposedChart } from 'recharts';

const chartConfig = {
  organic: { label: "Organic", color: "hsl(var(--chart-1))" },
  social: { label: "Social", color: "hsl(var(--chart-2))" },
  direct: { label: "Direct", color: "hsl(var(--chart-3))" },
};

const StatCard = ({ title, value, icon: Icon, gradient }: { title: string, value: string | number, icon: React.ElementType, gradient?: string }) => (
    <Card className={`card-gradient ${gradient}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

export default function SeoDashboardPage() {
    const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getSiteMetrics('sabnode.com');
            setMetrics(data);
        });
    }, []);

    if (isLoading || !metrics) {
        return <Skeleton className="h-full w-full" />;
    }

    return (
        <div className="flex flex-col gap-8">
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BarChart className="h-8 w-8"/>
                        SEO Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Your central hub for search engine optimization tools and analytics.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select defaultValue="sabnode.com">
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sabnode.com">sabnode.com</SelectItem>
                            <SelectItem value="example.com">example.com</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select defaultValue="30d">
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Domain Authority" value={metrics.domainAuthority} icon={BarChart} gradient="card-gradient-purple" />
                <StatCard title="Linking Domains" value={metrics.linkingDomains} icon={Globe} gradient="card-gradient-green" />
                <StatCard title="Total Backlinks" value={metrics.totalBacklinks} icon={LinkIcon} gradient="card-gradient-blue" />
                <StatCard title="Top Keywords" value={metrics.keywords.filter(k => k.position <= 3).length} icon={Star} gradient="card-gradient-orange" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Traffic Overview</CardTitle>
                    <CardDescription>Organic vs. Social vs. Direct traffic over the last 6 months.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                         <ComposedChart data={metrics.trafficData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="direct" stackId="a" fill="var(--color-direct)" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="social" stackId="a" fill="var(--color-social)" />
                            <Bar dataKey="organic" stackId="a" fill="var(--color-organic)" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Top Keyword Positions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-3 font-medium">Keyword</th>
                                    <th className="text-right p-3 font-medium">Position</th>
                                    <th className="text-right p-3 font-medium">Monthly Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.keywords.map(kw => (
                                    <tr key={kw.keyword} className="border-b last:border-0">
                                        <td className="p-3">{kw.keyword}</td>
                                        <td className="p-3 text-right">{kw.position}</td>
                                        <td className="p-3 text-right">{kw.volume.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
