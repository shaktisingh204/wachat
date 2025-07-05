'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, Link as LinkIcon, BarChart, LineChart, TrendingUp, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const backlinkData = [
  { month: 'Jan', count: 150 },
  { month: 'Feb', count: 180 },
  { month: 'Mar', count: 250 },
  { month: 'Apr', count: 320 },
  { month: 'May', count: 450 },
  { month: 'Jun', count: 510 },
];
const chartConfigBacklinks = { count: { label: "Backlinks", color: "hsl(var(--chart-1))" } };

const anchorTextData = [
    { text: 'SabNode', count: 210, percentage: 41 },
    { text: 'whatsapp marketing tool', count: 80, percentage: 16 },
    { text: 'click here', count: 55, percentage: 11 },
    { text: 'sabnode.com', count: 45, percentage: 9 },
    { text: 'read more', count: 30, percentage: 6 },
];

const linkingDomains = [
    { domain: 'techcrunch.com', type: 'News' },
    { domain: 'indiehackers.com', type: 'Forum' },
    { domain: 'marketingblog.com', type: 'Blog' },
    { domain: 'saasreviews.net', type: 'Review' },
];

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function SiteExplorerPage() {
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
                <StatCard title="Domain Authority" value="45" icon={BarChart} />
                <StatCard title="Linking Domains" value="850" icon={Globe} />
                <StatCard title="Total Backlinks" value="5.1k" icon={LinkIcon} />
                <StatCard title="Toxicity Score" value="2%" icon={AlertTriangle} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Backlink Growth</CardTitle>
                </CardHeader>
                <CardContent>
                     <ChartContainer config={chartConfigBacklinks} className="h-64 w-full">
                        <AreaChart data={backlinkData}>
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
                                        <p className="text-xs text-muted-foreground">{item.percentage}%</p>
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
                                    {linkingDomains.map(item => (
                                        <tr key={item.domain} className="border-b last:border-0">
                                            <td className="p-3">{item.domain}</td>
                                            <td className="p-3 text-right"><Badge variant="outline">{item.type}</Badge></td>
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
