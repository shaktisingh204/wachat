
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, Link as LinkIcon, BarChart, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { getBacklinks, getSiteMetrics } from '@/app/actions/seo.actions';
import type { Backlink, SiteMetrics } from '@/lib/definitions';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';


const chartConfigBacklinks = { count: { label: "Backlinks", color: "hsl(var(--chart-1))" } };

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

export default function SiteExplorerPage() {
    const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
    const [backlinks, setBacklinks] = useState<Backlink[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const [metricsData, backlinksData] = await Promise.all([
                getSiteMetrics('sabnode.com'),
                getBacklinks('sabnode.com'),
            ]);
            setMetrics(metricsData);
            setBacklinks(backlinksData);
        });
    }, []);
    
    const anchorTextData = backlinks.reduce((acc, link) => {
        const existing = acc.find(item => item.text === link.anchorText);
        if (existing) {
            existing.count++;
        } else {
            acc.push({ text: link.anchorText, count: 1 });
        }
        return acc;
    }, [] as { text: string; count: number }[]).map(item => ({ ...item, percentage: (item.count / backlinks.length) * 100 }));


    if (isLoading || !metrics) {
        return <Skeleton className="h-full w-full" />;
    }

    const backlinkHistory = metrics.trafficData.map((d, i) => ({ month: d.date.substring(0, 3), count: 50 + i * 80 + Math.random() * 50 }));

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Globe className="h-8 w-8"/>
                    Site Explorer
                </h1>
                <p className="text-muted-foreground mt-2">
                   Analyze domain-level SEO metrics for any website.
                </p>
            </div>

            <div className="flex gap-2">
                <Input placeholder="Enter a domain, e.g., sabnode.com" className="flex-1"/>
                <Button><Search className="mr-2 h-4 w-4"/>Analyze</Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Domain Authority" value={metrics.domainAuthority} icon={BarChart} />
                <StatCard title="Linking Domains" value={metrics.linkingDomains} icon={Globe} />
                <StatCard title="Total Backlinks" value={metrics.totalBacklinks} icon={LinkIcon} />
                <StatCard title="Toxicity Score" value={`${metrics.toxicityScore}%`} icon={BarChart} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Backlink Growth</CardTitle>
                </CardHeader>
                <CardContent>
                     <ChartContainer config={chartConfigBacklinks} className="h-64 w-full">
                        <AreaChart data={backlinkHistory}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <defs>
                                <linearGradient id="fillBacklinks" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="count" stroke="var(--color-count)" fill="url(#fillBacklinks)" />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader><CardTitle>Anchor Text Distribution</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {anchorTextData.map(item => (
                                <div key={item.text} className="space-y-1">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-sm font-medium truncate">{item.text}</p>
                                        <p className="text-xs text-muted-foreground">{item.percentage.toFixed(0)}%</p>
                                    </div>
                                    <Progress value={item.percentage} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                     <CardHeader><CardTitle>Top Linking Domains</CardTitle></CardHeader>
                    <CardContent>
                         <div className="border rounded-md">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-medium">Domain</th>
                                        <th className="text-right p-3 font-medium">Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backlinks.map(item => (
                                        <tr key={item.sourceUrl} className="border-b last:border-0">
                                            <td className="p-3 truncate max-w-xs">{new URL(item.sourceUrl).hostname}</td>
                                            <td className="p-3 text-right"><Badge variant="outline">{item.linkType}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
