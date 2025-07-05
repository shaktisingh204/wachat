'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, Link as LinkIcon, BarChart, LineChart, Globe } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Bar, CartesianGrid, XAxis, YAxis, Line, ComposedChart } from 'recharts';


const trafficData = [
  { date: 'Jan 23', organic: 1200, social: 800, direct: 500 },
  { date: 'Feb 23', organic: 1400, social: 900, direct: 600 },
  { date: 'Mar 23', organic: 1800, social: 1100, direct: 700 },
  { date: 'Apr 23', organic: 1700, social: 1200, direct: 800 },
  { date: 'May 23', organic: 2100, social: 1300, direct: 900 },
  { date: 'Jun 23', organic: 2400, social: 1500, direct: 1000 },
];

const keywordData = [
    { keyword: 'sabnode reviews', position: 3, volume: 1200 },
    { keyword: 'whatsapp marketing tool', position: 5, volume: 8500 },
    { keyword: 'how to create whatsapp ads', position: 2, volume: 4500 },
    { keyword: 'best flow builder', position: 8, volume: 3200 },
    { keyword: 'meta suite pricing', position: 12, volume: 900 },
]

const chartConfig = {
  organic: { label: "Organic", color: "hsl(var(--chart-1))" },
  social: { label: "Social", color: "hsl(var(--chart-2))" },
  direct: { label: "Direct", color: "hsl(var(--chart-3))" },
};

const StatCard = ({ title, value, change, icon: Icon, gradient }: { title: string, value: string, change: string, icon: React.ElementType, gradient?: string }) => (
    <Card className={`card-gradient ${gradient}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{change}</p>
        </CardContent>
    </Card>
);

export default function SeoDashboardPage() {
    return (
        <div className="flex flex-col gap-8">
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <TrendingUp className="h-8 w-8"/>
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
                <StatCard title="Organic Traffic" value="2,450" change="+20.1% from last month" icon={Users} gradient="card-gradient-green" />
                <StatCard title="Backlinks" value="1,823" change="+50 since last week" icon={LinkIcon} gradient="card-gradient-blue" />
                <StatCard title="Domain Authority" value="45" change="+2 since last month" icon={BarChart} gradient="card-gradient-purple" />
                <StatCard title="Top Keywords" value="8" change="In the top 3 positions" icon={TrendingUp} gradient="card-gradient-orange" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Traffic Overview</CardTitle>
                    <CardDescription>Organic vs. Social vs. Direct traffic over time.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                         <ComposedChart data={trafficData}>
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
                                {keywordData.map(kw => (
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

