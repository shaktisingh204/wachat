'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Users, Link as LinkIcon, BarChart, Globe, Target, Map } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { getSeoProject, getSiteMetrics } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Bar, CartesianGrid, XAxis, YAxis, ComposedChart } from 'recharts';
import Link from 'next/link';

const chartConfig = {
    organic: { label: "Organic", color: "hsl(var(--chart-1))" },
    social: { label: "Social", color: "hsl(var(--chart-2))" },
    direct: { label: "Direct", color: "hsl(var(--chart-3))" },
};

const StatCard = ({ title, value, icon: Icon, gradient, desc }: { title: string, value: string | number, icon: React.ElementType, gradient?: string, desc?: string }) => (
    <Card className={`card-gradient ${gradient}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
        </CardContent>
    </Card>
);

export default function ProjectDashboard({ params }: { params: Promise<{ projectId: string }> }) {
    // Correctly unwrap params using React.use() in Next.js 15+
    const unwrappedParams = use(params);
    const projectId = unwrappedParams.projectId;

    const [project, setProject] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const proj = await getSeoProject(projectId);
                if (!proj) {
                    toast({ title: "Error", description: "Project not found", variant: "destructive" });
                    return;
                }
                setProject(proj);

                // Load metrics
                const m = await getSiteMetrics(proj.domain);
                setMetrics(m);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [projectId]);

    if (loading || !project || !metrics) return <Skeleton className="h-full w-full" />;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Globe className="h-8 w-8 text-primary" />
                        {project.domain}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Tracking {project.settings?.locations?.[0] || 'US'} • {project.crawledAt ? 'Last Crawl: ' + new Date(project.crawledAt).toLocaleDateString() : 'No crawls yet'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/dashboard/seo/${projectId}/audit`}>
                        <Button variant="outline">Run Audit</Button>
                    </Link>
                    <Link href={`/dashboard/seo/${projectId}/grid`}>
                        <Button className="gap-2"><Map className="h-4 w-4" /> Grid Tracker</Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Domain Authority"
                    value={metrics.domainAuthority || 'N/A'}
                    icon={BarChart}
                    gradient="card-gradient-purple"
                    desc="Normalized score (0-100)"
                />
                <StatCard
                    title="Backlinks"
                    value={metrics.totalBacklinks || 0}
                    icon={LinkIcon}
                    gradient="card-gradient-blue"
                    desc={`${metrics.linkingDomains || 0} Referring Domains`}
                />
                <StatCard
                    title="Health Score"
                    value={project.healthScore || 'N/A'}
                    icon={Target}
                    gradient="card-gradient-green"
                    desc="Based on last technical audit"
                />
                <StatCard
                    title="Keywords Tracked"
                    value={project.settings?.targetedKeywords?.length || 0}
                    icon={Star}
                    gradient="card-gradient-orange"
                    desc="In top 100 positions"
                />
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                    <TabsTrigger value="competitors">Competitors</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estimated Traffic Trend</CardTitle>
                            <CardDescription>Organic vs Social traffic over the last 6 months (Simulated)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <ComposedChart data={metrics.trafficData}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
                </TabsContent>

                <TabsContent value="keywords">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Performing Keywords</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Keyword table coming soon...</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="competitors">
                    <Card>
                        <CardHeader>
                            <CardTitle>Competitor Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                {project.competitors?.map((comp: string) => (
                                    <div key={comp} className="flex justify-between items-center p-3 border rounded">
                                        <span className="font-semibold">{comp}</span>
                                        <Button size="sm" variant="ghost">View Report</Button>
                                    </div>
                                ))}
                                {(!project.competitors || project.competitors.length === 0) && (
                                    <p className="text-muted-foreground">No competitors added.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
